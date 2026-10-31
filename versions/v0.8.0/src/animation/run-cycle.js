// =====================================================================
// RUN CYCLE — picks the animation frame for a player from how they're moving. Owner: Animator (agents/animator/).
//
// Anim.frame(p, B, near, id) → { kind, dir, frame, turn, bob, lean, crouch, feet: [left, right], knees, arms }
//   kind  : "ready" | "run" | "backpedal" | "siderun" | "shuffle" | "plant" | "split" | "slide"
//   dir   : where the body travels on screen: "away" (up the screen) | "toward" | "left" | "right" | null
//   frame : 0..19 — every moving kind is a 20-frame cycle (one full stride: left step + right step)
//   turn  : −1..1 how far the body is turned sideways toward screen left/right (side runs show the profile)
//   feet[k]  : { dx, dy, lift, sole } — dx sideways from the hip (body widths, + = screen right), dy depth
//              (heights, + = farther from the camera, i.e. up the screen), lift (heights), sole 0..1 = how much
//              of the shoe's sole faces the camera (a heel kick seen from behind)
//   knees[k] : { dx, dy } extra knee drive (body widths / heights) on top of the hip–foot midpoint
//   arms[k]  : swing −1..1, + = hand forward in the direction of travel, opposite to the same-side leg
//   bob, lean (screen-x), crouch: heights
// Units are fractions of the sprite's height/width, so the same frames fit every player's real size.
//
// THE 20 FRAMES are built once per player and kind from a running gait model (stance ~38% of a step, a
// swing that lifts the heel then drives the knee, two flight bounces per stride, arms opposite the legs),
// shaped by that player's GAIT. Between two frames the pose is tweened, so even slow-motion running is fluent.
// The game's physics never reads this: animation follows the body, it never moves it.
// =====================================================================
(function () {
  const N = 20;                                           // frames per stride cycle
  // Each pro's running style. stride/knee/bounce/arm scale the gait; cadence scales strides per second.
  //   Sinner  — long levers, glides: long stride, little bounce, quiet arms, upright.
  //   Alcaraz — explosive and low: quicker steps, high knee drive, big bounce and arm action.
  const GAIT = {
    sinner:  { stride: 1.06, cadence: 0.95, knee: 0.9,  bounce: 0.75, arm: 0.85, crouch: 0.000, lean: 0.035 },
    alcaraz: { stride: 0.94, cadence: 1.10, knee: 1.25, bounce: 1.25, arm: 1.2,  crouch: 0.015, lean: 0.055 },
  };
  const DEF = { stride: 1, cadence: 1, knee: 1, bounce: 1, arm: 1, crouch: 0.008, lean: 0.045 };
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // One leg over a stride. psi 0..1: stance (foot planted, sweeping back under the hip), then swing
  // (heel kicks up, knee drives through, foot reaches forward to land). along: + = ahead in the direction of travel.
  function leg(psi, S, L, K, stance) {
    psi = ((psi % 1) + 1) % 1;
    if (psi < stance) { const u = psi / stance; return { along: S * (1 - 2 * u), lift: 0, knee: 0, kick: 0 }; }
    const u = (psi - stance) / (1 - stance), sw = Math.sin(Math.PI * u);
    return { along: -S * Math.cos(Math.PI * u), lift: L * sw * (1.25 - 0.5 * u),       // highest early: the heel kick
             knee: K * Math.sin(Math.PI * Math.min(1, u * 1.3)), kick: u < 0.55 ? Math.sin(Math.PI * u / 0.55) : 0 };
  }

  // Build the 20 frames for one player, kind and screen direction.
  function build(g, kind, dir) {
    const out = [];
    for (let f = 0; f < N; f++) {
      const ph = f / N, two = Math.cos(4 * Math.PI * ph);  // two steps per stride: two bounces
      let fr;
      if (kind === "shuffle") {                            // side-step: feet apart → together (a small hop) → apart, square to the net
        const s = dir === "right" ? 1 : -1, c = Math.cos(2 * Math.PI * ph), open = 0.25 + 0.13 * c;
        const lead = s > 0 ? 1 : 0, hopL = Math.max(0, -c) * 0.025;
        fr = { bob: -0.012 * g.bounce + 0.012 * g.bounce * Math.max(0, -c), lean: s * 0.035, crouch: 0.045 + g.crouch, turn: 0,
               feet: [0, 1].map(k => ({ dx: (k ? 1 : -1) * open + s * 0.05 * Math.sin(2 * Math.PI * ph), dy: 0, lift: k === lead ? hopL * 1.4 : hopL, sole: 0 })),
               knees: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }], arms: [0.25, 0.25] };
      } else {
        const back = kind === "backpedal", side = kind === "siderun";
        const S = (back ? 0.12 : 0.24) * g.stride, L = (back ? 0.06 : 0.18) * g.stride, K = (back ? 0.03 : 0.08) * g.knee;
        const legs = [leg(ph, S, L, K, back ? 0.5 : 0.38), leg(ph + 0.5, S, L, K, back ? 0.5 : 0.38)];
        const flight = (0.5 + 0.5 * two);                  // 1 at push-off/flight, 0 at mid-stance
        const bob = (back ? 0.008 : 0.022) * g.bounce * flight - (back ? 0.004 : 0.012) * g.bounce;
        const feet = [], knees = [];
        for (let k = 0; k < 2; k++) {
          const l = legs[k], base = k ? 0.17 : -0.17;
          if (side) {                                       // profile: the stride runs along screen x, legs nearly overlap
            const s = dir === "right" ? 1 : -1;
            feet.push({ dx: base * 0.35 + s * l.along / 0.3, dy: (k ? -0.012 : 0.012), lift: l.lift, sole: 0 });
            knees.push({ dx: s * l.knee / 0.3 * 1.4, dy: 0 });
          } else {                                          // away / toward: the stride runs in depth
            const s = dir === "away" ? 1 : -1;
            feet.push({ dx: base, dy: s * l.along, lift: l.lift, sole: dir === "away" && !back ? l.kick : 0 });
            knees.push({ dx: 0, dy: s * l.knee });
          }
        }
        const armL = -legs[0].along / S, armR = -legs[1].along / S;   // each arm opposite its own leg
        fr = { bob, lean: 0, crouch: (back ? 0.03 : 0.02) + g.crouch, turn: side ? (dir === "right" ? 1 : -1) : 0,
               feet, knees, arms: [armL * g.arm, armR * g.arm] };
      }
      fr.frame = f; out.push(fr);
    }
    return out;
  }

  const cache = {};
  const framesFor = (id, kind, dir) => {
    const key = id + "|" + kind + "|" + dir;
    return cache[key] || (cache[key] = build(GAIT[id] || DEF, kind, dir));
  };

  const lerp = (a, c, t) => a + (c - a) * t;
  function tween(A, C, t) {                               // blend two frames (and two different kinds when changing direction)
    const mix = (a, c) => ({ dx: lerp(a.dx, c.dx, t), dy: lerp(a.dy || 0, c.dy || 0, t), lift: lerp(a.lift, c.lift, t), sole: lerp(a.sole || 0, c.sole || 0, t) });
    const km = (a, c) => ({ dx: lerp(a.dx, c.dx, t), dy: lerp(a.dy, c.dy, t) });
    return { bob: lerp(A.bob, C.bob, t), lean: lerp(A.lean, C.lean, t), crouch: lerp(A.crouch, C.crouch, t), turn: lerp(A.turn, C.turn, t),
             feet: [mix(A.feet[0], C.feet[0]), mix(A.feet[1], C.feet[1])], knees: [km(A.knees[0], C.knees[0]), km(A.knees[1], C.knees[1])],
             arms: [lerp(A.arms[0], C.arms[0], t), lerp(A.arms[1], C.arms[1], t)] };
  }
  const still = (o) => Object.assign({ turn: 0, knees: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }] }, o,
    { feet: o.feet.map(f => ({ dy: 0, sole: 0, ...f })) });

  function pick(p, B, near, id) {
    const sp = Math.hypot(p.vx, p.vy), top = B.top || 6;
    const fwd = near ? p.vy : -p.vy;                       // + = toward the net, whichever side you're on
    const side = p.vx;                                     // + = screen right (court x)
    const up = p.vy > 0;                                   // moving up the screen (away from the camera)
    if (p.slide > 0) {                                     // slide: low, the lead leg out long toward the slide
      const dir = Math.sign(p.slideV.x || 1);
      return still({ kind: "slide", dir: dir > 0 ? "right" : "left", frame: 0, bob: -0.08, lean: dir * 0.05, crouch: 0.08,
               feet: [{ dx: dir < 0 ? -0.6 : 0.05, lift: 0 }, { dx: dir > 0 ? 0.6 : -0.05, lift: 0 }], arms: [0.6, -0.6] });
    }
    if (p.air > 0) return still({ kind: "split", dir: null, frame: 0, bob: -0.06, lean: 0, crouch: 0.03,
                            feet: [{ dx: -0.3, lift: 0.04 }, { dx: 0.3, lift: 0.04 }], arms: [0.3, 0.3] });
    if (p.plant > 0) {                                     // changing direction: plant wide and low, lean against the old way
      const back = -Math.sign(side || 1);
      return still({ kind: "plant", dir: null, frame: 0, bob: -0.05, lean: back * 0.04, crouch: 0.06,
               feet: [{ dx: -0.42, lift: 0 }, { dx: 0.42, lift: 0 }], arms: [0.4, 0.4] });
    }
    p._still = p._still ? sp < 0.65 : sp < 0.35;         // hysteresis: no flicker between ready and moving at walking pace
    if (p._still) {                                        // ready position: feet apart, knees soft, a slow breath
      const breathe = reduce() ? 0 : Math.sin(p.run * 2.2) * 0.006;
      return still({ kind: "ready", dir: null, frame: 0, bob: breathe, lean: 0, crouch: 0.025,
               feet: [{ dx: -0.26, lift: 0 }, { dx: 0.26, lift: 0 }], arms: [0.2, 0.2] });
    }
    const g = GAIT[id] || DEF;
    // Gait phase: strides per second rise with speed (≈1.1/s jogging → ≈1.7/s sprinting), shaped by the player's cadence.
    const rate = (0.9 + 0.11 * sp) * g.cadence / (0.4 + sp / 3);   // phase per unit of p.run (which moveBody advances)
    const dRun = p._animRun == null ? 0 : Math.max(0, p.run - p._animRun);
    p._animRun = p.run; p._phase = ((p._phase || 0) + dRun * rate) % 1;
    let kind, dir;
    if (Math.abs(side) > Math.abs(fwd) * 1.2) {            // mostly sideways
      dir = side > 0 ? "right" : "left";
      kind = sp < top * 0.62 ? "shuffle" : "siderun";      // short moves: side-step; long ones: turn and run
    } else {
      dir = up ? "away" : "toward";
      kind = fwd < -0.6 ? "backpedal" : "run";
    }
    const F = framesFor(id || "_", kind, dir), x = p._phase * N, k = Math.floor(x) % N;
    const fr = tween(F[k], F[(k + 1) % N], reduce() ? 0 : x - Math.floor(x));   // a fresh copy: the cache stays clean
    const stride = Math.min(1, sp / top);                  // faster = longer, higher steps
    const sc = 0.45 + 0.55 * stride;
    fr.feet = fr.feet.map((f, j) => ({ ...f, dy: f.dy * sc, lift: f.lift * sc,
                                        dx: kind === "siderun" ? f.dx * sc : f.dx }));
    fr.knees = fr.knees.map(kk => ({ dx: kk.dx * sc, dy: kk.dy * sc }));
    fr.bob *= sc;
    const tilt = Math.max(-1, Math.min(1, side / top));
    if (kind === "run" || kind === "backpedal") fr.lean += tilt * g.lean;   // lean into a diagonal
    if (kind === "siderun") fr.lean += Math.sign(side) * g.lean * stride;  // lean into the run
    return Object.assign(fr, { kind, dir, frame: k });
  }

  // FLUENT TRANSITIONS. Inside a cycle the 20 frames are already tweened. When the movement changes kind
  // (ready → shuffle → side run → plant → run …) the new pose is cross-faded from the last pose drawn over
  // BLEND seconds, so feet, knees and arms travel to their new place instead of jumping. Turn and lean ease too.
  const BLEND = 0.2;
  function frame(p, B, near, id) {
    const fr = pick(p, B, near, id), now = performance.now() / 1000;
    const s = p._animSmooth || (p._animSmooth = { turn: 0, lean: 0, kind: fr.kind, from: null, t: 9, last: null, at: now });
    const dt = Math.min(0.1, Math.max(0, now - s.at)); s.at = now;
    if (reduce()) { s.last = fr; s.kind = fr.kind; return fr; }
    if (fr.kind !== s.kind || fr.dir !== s.dir) { s.from = s.last; s.t = 0; s.kind = fr.kind; s.dir = fr.dir; }
    s.t += dt;
    const k = 1 - Math.exp(-dt * 12);                      // time-based easing: the same feel at 30, 60 or 120 fps
    s.turn += (fr.turn - s.turn) * k; s.lean += (fr.lean - s.lean) * k;
    let out = fr;
    if (s.from && s.t < BLEND) {
      const w = 1 - s.t / BLEND, e = w * w * (3 - 2 * w); // smoothstep from the old pose to the new one
      out = Object.assign(tween(fr, s.from, e), { kind: fr.kind, dir: fr.dir, frame: fr.frame });
    }
    out.turn = s.turn; out.lean = s.lean;
    s.last = out;
    return out;
  }


  window.Anim = { frame, FRAMES: N, GAIT, framesFor };
})();
