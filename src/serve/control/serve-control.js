// =====================================================================
// SERVE CONTROL — you hit your own serve in one continuous motion. Owner: Serve Controller (agents/serve-controller/).
//
//   1. TOSS   hold the serve key (F, or the touch Serve button): the arm lifts. Let go: the ball leaves the hand.
//             The longer you hold, the higher the toss.
//   2. POWER  while the ball rises, hold the key again: the swing loads (the pro waits in his trophy pose).
//             Let go: the racket swings and meets the ball one swing-time later.
//   3. AIM    arrows (or tap / drag in the box) steer the target until contact. The brush sets the spin:
//             nothing = FLAT, Q held = KICK (brush up), E held = SLICE (brush the side). On touch: flick up = kick,
//             flick sideways = slice, a plain tap = flat.
//
// Nothing to press: the serve still goes by itself (points serve themselves), as a safe, medium serve that can't ace.
// Output (Serve control contract, agents/README.md):
//   { toss:{ height }, power, spin:{ type:"flat"|"kick"|"slice", rpm }, target:{x,y}, sweetSpot: 0..1 }
// Every number that changes how the serve feels is in SERVE_TUNING below. Units: metres, seconds.
// =====================================================================
(function (root) {
  const G = 9.81;

  const SERVE_TUNING = {
    // TOSS: hold fraction u = time held / the ideal hold. u = 1 tosses the ball idealApex above the sweet spot.
    toss: {
      idealApex: 0.45,     // m the ball peaks above the contact point (it drops a little into the racket)
      perHold: 1.3,        // m of extra (or missing) apex per unit of hold fraction
      idealExtra: 0.14,    // s: the ideal hold = the pro's own arm lift + this
      minIdeal: 0.32,      // s: never shorter than this, so it stays playable
      maxHold: 1.9,        // × the ideal hold: then the ball leaves the hand anyway
      tolerance: 0.32,     // m of apex error that costs ~63% of the toss score
    },
    power: { load: 0.4, auto: 0.5 },    // s to load a full swing (fits in an ideal toss's flight); power used when you don't load at all
    timing: { tolerance: 0.24 },        // m the ball is above / below the sweet spot at contact
    point: { tolerance: 0.17, drift: 0.11 },   // m sideways off the hitting line; how much a toss drifts
    wait: 0.7,             // s you have to start the toss once the bouncing ends, before the serve tosses itself
    forceLow: 0.9,         // m below the sweet spot: the swing goes, ready or not
    spin: { flat: 1500, slice: 2600, kick: 3600 },   // rpm at full power (pro serves: flat ~1–2k, slice ~2–3k, kick ~3–4.5k)
    // SPREAD and NET: how a serve misses (planServe). sd in metres.
    // Tuned so the computer lands near real ATP rates: Sinner ~35% 1st-serve faults, ~2% double faults, ~7% aces;
    // Alcaraz ~40%, ~3%, ~6% (serve-control.test.mjs simulates it).
    spread: { first: 0.95, second: 1.1, offSweet: 0.9, power: 0.45 },
    spinSpread: { flat: 1.0, slice: 0.92, kick: 0.82 },
    net: { first: 0.06, second: 0.07, low: 1.6 },
    spinNet: { flat: 1.2, slice: 1.0, kick: 0.45 },
    // SPEED (m/s, before the Serve skill's serveBonus): base + perPower × power × (0.6 + 0.4 × sweetSpot)
    speed: { flat: [30, 15], slice: [28, 11], kick: [25, 8] },
    // ACE: only when the requirements are met, then from the placement, scaled by the Serve skill (1–20, 10 neutral).
    ace: {
      needToss: 0.7, needSweet: 0.75, needPowerFlat: 0.8, needPowerBrushed: 0.6,
      edge: 0.45,                         // m from the T, the sideline or the service line = a perfect spot
      wrongSide: 0.6, wrongSideStep: 0.014,    // receiver leaning the wrong way: base chance, + per Serve point above 10
      rightSide: 0.18, rightSideStep: 0.005,   // receiver on the right side
      secondMul: 0.3, cap: 0.8,                // the receiver still gets a racket on some: never certain
    },
    // COMPUTER SERVER: how far its inputs stray from perfect (sd).
    // aimFirst / aimSecond: how far toward the sideline (1 = on it) it aims wide; down the T is the mirror.
    ai: { hold: 0.05, timing: 0.022, power: [0.78, 0.97], slice: 0.25, aimFirst: 0.87, aimSecond: 0.55, depthFirst: 0.88 },
  };
  const T = SERVE_TUNING;

  // Box-Muller from a 0..1 source; a source returning 0.5 always gives 0 (tests use that)
  const gaussOf = rng => () => {
    const a = rng(), b = rng();
    if (a === 0.5 && b === 0.5) return 0;
    return Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(2 * Math.PI * b);
  };
  const clamp = (v, a, c) => Math.max(a, Math.min(c, v));
  const bell = (d, tol) => Math.exp(-((d / tol) ** 2));

  /* The sweet spot: the ball at the top of the player's reach. Shoulder height (0.81 of height) + arm to the grip
     (0.38 of arm span) + grip to the centre of the strings (0.82 of the racket) + the leg drive (~8 cm).
     Sinner (1.91 m) ≈ 2.93 m, Alcaraz (1.83 m) ≈ 2.84 m: real contact heights are ~1.5× standing height. */
  function reachTop(heightM, armSpanM, racketM = 0.68) {
    const span = armSpanM || heightM * 1.03;           // no arm span on file: a typical +3% ape index
    return 0.81 * heightM + 0.38 * span + 0.82 * racketM + 0.08;
  }

  function spinOf(brush, power) {
    const type = brush === "kick" || brush === "slice" ? brush : "flat";
    return { type, rpm: Math.round(T.spin[type] * (0.55 + 0.45 * power)) };
  }

  /* Contact quality 0–1 from the toss height, the timing and the contact point.
     apexAbove: m the toss peaked above the sweet spot. dz: m the ball was above (+) / below (−) it at contact.
     off: m sideways from the hitting line. */
  function sweetSpot({ apexAbove, dz, off = 0 }) {
    const toss = bell(apexAbove - T.toss.idealApex, T.toss.tolerance);
    const timing = bell(dz, T.timing.tolerance);
    const point = bell(off, T.point.tolerance);
    return { sweetSpot: +(toss * timing * point).toFixed(3), toss: +toss.toFixed(3), timing: +timing.toFixed(3), point: +point.toFixed(3) };
  }

  /* Ace chance: zero unless the requirements are met (a good toss, a sweet-spot contact, and high power on a flat
     serve or a well-brushed kick / slice) AND the ball lands on a perfect spot. skill = getSkills(id).serve. */
  function aceChance({ result, perfect, wrongSide, skill = 10, second = false }) {
    const A = T.ace, s = skill - 10, r = result;
    const brushed = r.spin.type !== "flat";
    const requirements = !r.auto && r.parts.toss >= A.needToss && r.sweetSpot >= A.needSweet &&
                         (brushed ? r.power >= A.needPowerBrushed : r.power >= A.needPowerFlat);
    if (!requirements || !perfect) return { chance: 0, requirements };
    let c = wrongSide ? A.wrongSide + A.wrongSideStep * s : A.rightSide + A.rightSideStep * s;
    c *= (0.5 + 0.5 * r.sweetSpot) * (brushed ? 0.85 : 0.6 + 0.4 * r.power);
    if (second) c *= A.secondMul;
    return { chance: +clamp(c, 0, A.cap).toFixed(3), requirements };
  }

  /* Where the serve lands and what happens. box = the service box (index.html serviceBox()), target = the aim,
     receiverX = where the receiver stands. Returns { land, fault, net, let, ace, chance, perfect, wrongSide, requirements }. */
  function resolveServe({ result, target, box, receiverX, second = false, errMul = 1, letRate = 0.02, skill = 10, rng = Math.random }) {
    const g = gaussOf(rng), r = result, type = r.spin.type;
    const sd = (second ? T.spread.second : T.spread.first) * errMul * T.spinSpread[type]
             * (1 + T.spread.offSweet * (1 - r.sweetSpot)) * (1 - T.spread.power / 2 + T.spread.power * r.power);
    const land = { x: target.x + g() * sd, y: target.y + g() * sd * 0.8 };
    const low = Math.max(0, -(r.parts.dz || 0)) / 0.5;    // hit below the sweet spot: the ball goes down into the net
    const net = rng() < (second ? T.net.second : T.net.first) * errMul * T.spinNet[type] * (1 + T.net.low * low);
    const inBox = land.x >= box.xlo && land.x <= box.xhi && land.y >= box.ylo && land.y <= box.yhi;
    const fault = net || !inBox;
    const isLet = !fault && rng() < letRate;
    const edge = Math.min(Math.abs(land.x - box.wide), Math.abs(land.x - box.t), Math.abs(land.y - box.back));
    const perfect = !fault && edge < T.ace.edge;
    const wrongSide = Math.sign(land.x - box.mid) !== Math.sign(receiverX - box.mid) && Math.abs(land.x - receiverX) > 1.4;
    const { chance, requirements } = aceChance({ result: r, perfect, wrongSide, skill, second });
    return { land, fault, net, let: isLet, ace: !fault && !isLet && rng() < chance, chance, perfect, wrongSide, requirements };
  }

  /* The computer server picks wide, body or down the T; second serves stay safer. */
  function aiAim(box, second, rng = Math.random) {
    const r = rng(), safe = second ? T.ai.aimSecond : T.ai.aimFirst;
    const x = r < 0.4 ? box.wide * safe : r < 0.7 ? box.mid : box.wide * (1 - safe) + 0.001;
    return { x, y: box.back * (second ? 0.72 : T.ai.depthFirst) };
  }

  function speedOf(result, serveBonus = 0) {
    const [base, per] = T.speed[result.spin.type];
    return base + per * result.power * (0.6 + 0.4 * result.sweetSpot) + serveBonus;
  }

  /* One serve, from the end of the bouncing to contact. It owns the motion clock (it can hold the pro in his
     toss or trophy pose while you hold the key) and the toss flight.
     opts: { events:{start, tossRelease, trophy, contact}, t, heightM, armSpanM, racketM, human, second, rng } */
  function create(opts) {
    const E = opts.events, rng = opts.rng || Math.random, g = gaussOf(rng);
    const contactZ = reachTop(opts.heightM, opts.armSpanM, opts.racketM);
    const idealHold = Math.max(T.toss.minIdeal, E.tossRelease - E.start + T.toss.idealExtra);
    const swingT = Math.max(0.2, E.contact - E.trophy);
    const s = {
      t: opts.t ?? E.start, phase: opts.t != null && opts.t < E.start ? "routine" : "wait",
      contactZ, idealHold, swingT, wait: 0, hold: 0, load: 0, tt: 0, power: 0, brush: "flat",
      human: !!opts.human, auto: false, plan: null, held: false, rel: null, result: null,
    };

    // The computer (and the auto serve) press the same "key" through a plan: hold, then load and let go on time.
    function planFor(autoServe) {
      const second = !!opts.second, slice = !second && rng() < T.ai.slice;
      return {
        hold: idealHold * (1 + g() * T.ai.hold),
        power: autoServe ? T.power.auto : T.ai.power[0] + rng() * (T.ai.power[1] - T.ai.power[0]),
        timing: g() * T.ai.timing,
        brush: second ? "kick" : slice ? "slice" : "flat",
      };
    }
    if (!s.human) s.plan = planFor(false);

    // ball height after the toss: z(tt) = z0 + vz tt − g tt²/2
    const zAt = tt => s.rel.z + s.rel.vz * tt - 0.5 * G * tt * tt;
    function idealContactTT() {                         // when the falling ball passes the sweet spot (or its peak)
      const { vz, z } = s.rel, disc = vz * vz - 2 * G * (contactZ - z);
      return disc > 0 ? (vz + Math.sqrt(disc)) / G : vz / G;
    }

    /* Advance by dt. input = { held, brush } (brush: "flat" | "kick" | "slice"). Returns the events this step:
       "release" (the ball leaves the hand: call launchToss with the hand's height), "swing", "contact". */
    function step(dt, input = {}) {
      const ev = [];
      let held = !!input.held;
      if (s.plan) {                                     // a planned serve presses the key itself
        const p = s.plan;
        if (s.phase === "wait" || s.phase === "toss") held = s.hold + dt / 2 < p.hold || s.phase === "wait";
        else if (s.phase === "flight" || s.phase === "load") {
          const startLoad = idealContactTT() - swingT - p.power * T.power.load + p.timing;
          held = s.tt + dt / 2 >= startLoad && s.load + dt / 2 < p.power * T.power.load;
        } else held = false;
        if (s.phase === "load" || s.phase === "flight") input = { brush: p.brush };
      }
      switch (s.phase) {
        case "routine":                                 // the bounce routine plays at its own pace
          s.t += dt;
          if (s.t >= E.start) { s.t = E.start; s.phase = "wait"; }
          break;
        // Every phase counts a frame as held when the key was down during it, so the result doesn't depend
        // on the frame rate (the key went down / up between frames).
        case "wait":                                    // ready, ball in hand: the toss starts when you press
          if (held) { s.phase = "toss"; s.hold = dt; break; }
          s.wait += dt;
          if (s.wait >= T.wait) { s.auto = true; s.plan = planFor(true); s.phase = "toss"; s.hold = 0; }
          break;
        case "toss":                                    // the arm lifts while you hold; it waits at the release pose
          if (held) s.hold += dt;
          s.t = Math.min(s.t + dt, E.tossRelease);
          if (!held || s.hold >= idealHold * T.toss.maxHold) { s.phase = "flight"; s.tt = 0; ev.push("release"); }
          break;
        case "flight":                                  // ball rising: the body turns into the trophy pose and waits there
        case "load": {
          if (!s.rel) break;                            // launchToss() not called yet
          s.tt += dt;
          s.t = Math.min(s.t + dt, E.trophy);
          if (input.brush) s.brush = input.brush;
          if (held) { s.phase = "load"; s.load += dt; s.power = Math.min(1, s.load / T.power.load); }
          const tooLow = zAt(s.tt + swingT) < contactZ - T.forceLow && s.tt > s.rel.vz / G;
          const letGo = s.phase === "load" && !held;
          const autoSwing = s.phase === "flight" && s.tt >= idealContactTT() - swingT && (s.auto || s.load === 0);
          if (letGo || tooLow || autoSwing) {
            if (s.load === 0) s.power = T.power.auto;   // never loaded: a medium swing
            // let go: the swing started when the key came up, at the start of this frame
            s.phase = "swing"; s.swingFrom = s.t; s.swingClock = letGo ? dt : 0; ev.push("swing");
          }
          break;
        }
        case "swing":                                   // trophy → contact in the pro's own swing time
          s.tt += dt; s.swingClock += dt;
          s.t = s.swingFrom + (E.contact - s.swingFrom) * Math.min(1, s.swingClock / swingT);
          if (s.swingClock >= swingT) { s.t = E.contact; s.phase = "done"; finish(s.swingClock - swingT); ev.push("contact"); }
          break;
        default:
          s.t += dt;
      }
      s.held = held;
      return ev;
    }

    /* The ball leaves the hand at height z0 (m). The hold sets how high it goes. */
    function launchToss(z0) {
      const u = s.hold / idealHold;
      const apexAbove = clamp(T.toss.idealApex + T.toss.perHold * (u - 1), z0 + 0.3 - contactZ, 2.4);
      const apexZ = contactZ + apexAbove;
      s.rel = { z: z0, vz: Math.sqrt(2 * G * Math.max(0.05, apexZ - z0)), apexAbove, u };
      // a toss that's off in height is usually off in line too
      s.off = g() * T.point.drift * (0.35 + 1.5 * Math.abs(u - 1));
      return s.rel;
    }

    function ballZ() { return s.rel ? Math.max(0, zAt(s.tt)) : null; }
    /* 0..1 of the way from the hand to the ideal contact (for the toss drifting over the head and into the court) */
    function flightU() { return s.rel ? clamp(s.tt / idealContactTT(), 0, 1) : 0; }

    /* over: s the frame ran past the exact contact moment; the ball is judged where it was at contact */
    function finish(over = 0) {
      const dz = zAt(s.tt - over) - contactZ;
      const q = sweetSpot({ apexAbove: s.rel.apexAbove, dz, off: s.off || 0 });
      s.result = {
        toss: { height: +(contactZ + s.rel.apexAbove).toFixed(2) },
        power: +s.power.toFixed(2),
        spin: spinOf(s.brush, s.power),
        target: null,                                   // filled by planServe from the aim
        sweetSpot: q.sweetSpot,
        parts: { toss: q.toss, timing: q.timing, point: q.point, dz: +dz.toFixed(2), off: +(s.off || 0).toFixed(2) },
        auto: s.auto, contactZ: +contactZ.toFixed(2),
      };
    }

    /* For the HUD meter: toss = hold fraction (1 = ideal), power 0..1. */
    function meter() {
      return { phase: s.phase, toss: s.rel ? s.rel.u : s.hold / idealHold, power: s.power, loading: s.phase === "load",
               brush: s.brush, auto: s.auto, result: s.result };
    }

    return { state: s, step, launchToss, ballZ, flightU, meter, get t() { return s.t; }, get phase() { return s.phase; },
             get result() { return s.result; }, contactZ };
  }

  /* A serve nobody controlled (routine fallback for pros without a motion file): a clean, medium serve, no ace. */
  function autoResult(second, heightM) {
    return { toss: { height: reachTop(heightM || 1.85) + T.toss.idealApex }, power: T.power.auto,
             spin: spinOf(second ? "kick" : "flat", T.power.auto), target: null, sweetSpot: 0.8,
             parts: { toss: 1, timing: 0.85, point: 0.95, dz: 0, off: 0 }, auto: true };
  }

  /* SERVE ACTIONS, described for help text. The live bindings are the `serve` / `kick` / `slice` actions in
     src/controls/schemes.js (CONTROL_SCHEMES); the game reads them with Controls.isHeld(). Keep the two in step. */
  const SERVE_BINDINGS = {
    keyboard: [
      { action: "serveToss",  keys: ["f"], text: "Hold F to toss, let go to release; hold F again to load the swing, let go to hit" },
      { action: "serveAim",   keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], text: "Arrows: aim the serve" },
      { action: "serveKick",  keys: ["q"], text: "Q held at the swing: kick (brush up)" },
      { action: "serveSlice", keys: ["e"], text: "E held at the swing: slice (brush the side)" },
    ],
    touch: [
      { action: "serveToss",  keys: ["Serve button"], text: "Hold Serve to toss, let go; hold again to load, let go to hit" },
      { action: "serveAim",   keys: ["tap the box"], text: "Tap or drag in the service box to aim" },
      { action: "serveKick",  keys: ["flick up"], text: "Let go of Serve with a flick up: kick" },
      { action: "serveSlice", keys: ["flick sideways"], text: "Let go of Serve with a sideways flick: slice" },
    ],
    gamepad: [
      { action: "serveToss",  keys: ["X"], text: "Hold X to toss, let go; hold again to load, let go to hit" },
      { action: "serveAim",   keys: ["right stick"], text: "Right stick: aim the serve" },
      { action: "serveKick",  keys: ["LB"], text: "LB held at the swing: kick" },
      { action: "serveSlice", keys: ["RB"], text: "RB held at the swing: slice" },
    ],
  };

  /* Touch: a flick when letting go of Serve picks the brush. dx, dy in px (screen y down). */
  function brushFromFlick(dx, dy) {
    if (Math.hypot(dx, dy) < 24) return "flat";
    return -dy > Math.abs(dx) ? "kick" : Math.abs(dx) > Math.abs(dy) ? "slice" : "flat";
  }

  root.SERVE_TUNING = SERVE_TUNING;
  root.ServeControl = { create, reachTop, sweetSpot, aceChance, resolveServe, aiAim, speedOf, spinOf, autoResult, brushFromFlick, SERVE_BINDINGS, TUNING: SERVE_TUNING };
})(typeof window !== "undefined" ? window : globalThis);
