// =====================================================================
// RUN CYCLE — picks the animation frame for a player from how they're moving. Owner: Animator (agents/animator/).
//
// Anim.frame(p, B, near, id) → { kind, dir, frame, turn, bob, lean, crouch, feet: [left, right], knees, arms }
//   kind  : "ready" | "receive" | "run" | "backpedal" | "siderun" | "shuffle" | "split" | "slide"
//           and the direction-change beats "decel" → "plant" → "crossover" | "dropstep" | "pushoff" (see DIRECTION CHANGES)
//   accel : 0..1 on running kinds: how much acceleration lean is in the pose (fades toward top speed)
//   dir   : where the body travels on screen: "away" (up the screen) | "toward" | "left" | "right" | null
//   frame : 0..19 — every moving kind is a 20-frame cycle (one full stride: left step + right step)
//   turn  : −1..1 how far the body is turned sideways toward screen left/right (side runs show the profile)
//   feet[k]  : { dx, dy, lift, sole } — dx sideways from the hip (body widths, + = screen right), dy depth
//              (heights, + = farther from the camera, i.e. up the screen), lift (heights), sole 0..1 = how much
//              of the shoe's sole faces the camera (a heel kick seen from behind)
//   knees[k] : { dx, dy } extra knee drive (body widths / heights) on top of the hip–foot midpoint
//   arms[k]  : swing −1..1, + = hand forward in the direction of travel, opposite to the same-side leg
//   bob, lean (screen-x), crouch, bend (upper body tipped forward: shoulders drop toward the hips): heights
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
    return { bob: lerp(A.bob, C.bob, t), lean: lerp(A.lean, C.lean, t), crouch: lerp(A.crouch, C.crouch, t), turn: lerp(A.turn, C.turn, t), bend: lerp(A.bend || 0, C.bend || 0, t),
             feet: [mix(A.feet[0], C.feet[0]), mix(A.feet[1], C.feet[1])], knees: [km(A.knees[0], C.knees[0]), km(A.knees[1], C.knees[1])],
             arms: [lerp(A.arms[0], C.arms[0], t), lerp(A.arms[1], C.arms[1], t)] };
  }
  const still = (o) => Object.assign({ turn: 0, knees: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }] }, o,
    { feet: o.feet.map(f => ({ dy: 0, sole: 0, ...f })) });

  // =====================================================================
  // DIRECTION CHANGES (Ryan's priority). A hard change of direction reads as four beats:
  //   decel     — braking steps: the lead foot reaches out ahead, the body sinks and leans back against the old way
  //   plant     — the lead foot loaded wide and low; the hips start to open toward the new way
  //   crossover — out of a sideways plant the outside leg swings across in front of the body toward the new way;
  //   dropstep  —   when the new way is backward the hip opens and that foot steps back;
  //   pushoff   —   when it is forward the back foot drives through with the body tipped in
  //   then the normal run, with an ACCELERATION LEAN that fades as the speed builds to top speed.
  // All of it is read from the velocity (and p.plant, which moveBody sets on a hard brake): animation never moves the body.
  // Screen directions equal court directions here: court +x = screen right, court +y = up the screen (dy +).
  // =====================================================================
  const DC = { plantMin: 0.06, plantMax: 0.3, cut: 0.24 };   // seconds: shortest plant, a plant that ends in a stop, the cut step
  const TURN_KINDS = new Set(["decel", "plant", "crossover", "dropstep", "pushoff"]);
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const sstep = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const sgn = (v) => (v < 0 ? -1 : 1);
  const screenDir = (d) => Math.abs(d.x) >= Math.abs(d.y) ? (d.x > 0 ? "right" : "left") : (d.y > 0 ? "away" : "toward");
  const steps = (u) => reduce() ? Math.round(clamp01(u) * 3) / 3 : clamp01(u);   // reduced motion: 4 poses, no in-between

  // The state machine. Keeps the last cruising heading, finds the brake, the plant and the cut, and the acceleration.
  function track(p, B, g, dt) {
    const s = p._dc || (p._dc = { mode: null, t: 0, head: null, v0: 0, nd: null, sp: 0, acc: 0 });
    const sp = Math.hypot(p.vx, p.vy);
    if (dt > 0) s.acc += ((sp - s.sp) / dt - s.acc) * Math.min(1, dt * 10);   // smoothed change of speed, m/s²
    s.sp = sp; s.t += dt;
    if (p.slide > 0 || p.air > 0) { s.mode = null; return s; }
    const along = s.head ? p.vx * s.head.x + p.vy * s.head.y : 0;      // speed still carried the old way
    const nd = sp > 0.4 ? { x: p.vx / sp, y: p.vy / sp } : null;
    const go = (mode) => { s.mode = mode; s.t = 0; };
    if (s.mode === null) {
      if (p.plant > 0 && s.head && sp > 1.5) { go("decel"); s.v0 = Math.max(sp, along); }
      else if (sp > 1.2) s.head = nd;
    } else if (s.mode === "decel") {
      if (along < 0.3 || s.t > 0.8) go("plant");
      else if (!(p.plant > 0) && along > 0.6 * s.v0 && s.acc > 0) { s.mode = null; s.head = nd; }   // gave up the brake
    } else if (s.mode === "plant") {
      if (s.t >= DC.plantMin && sp > 0.9 && nd) {
        if (nd.x * s.head.x + nd.y * s.head.y < 0.5) { go("cut"); s.nd = nd; }
        else { s.mode = null; s.head = nd; }                          // pushed off the same way again
      } else if (s.t > DC.plantMax && sp <= 0.9) { s.mode = null; s.head = null; }   // came to a stop: ready takes over
    } else if (s.mode === "cut") {
      if (p.plant > 0 && s.t > 0.08 && sp > 1.5) { s.head = s.nd; go("decel"); s.v0 = sp; }   // reversed again mid-cut
      else if (s.t >= DC.cut / g.cadence) { s.mode = null; s.head = nd || s.nd; }
    }
    return s;
  }

  // Braking steps, u 0..1 = share of the old speed already shed.
  function decelPose(s, u, g) {
    const h = s.head, e = sstep(u), lead = h.x >= 0 ? 1 : 0, ls = lead ? 1 : -1, lat = Math.abs(h.x) >= Math.abs(h.y);
    const feet = [], knees = [];
    feet[lead] = { dx: ls * 0.24 + h.x * 0.34 * e, dy: h.y * 0.16 * e, lift: 0, sole: 0 };
    feet[1 - lead] = { dx: -ls * 0.24 + h.x * 0.04, dy: -h.y * 0.03 * e, lift: 0.045 * Math.sin(Math.PI * Math.min(1, u * 1.8)), sole: 0 };   // a quick stutter step
    knees[lead] = { dx: h.x * 0.06 * e, dy: h.y * 0.04 * e }; knees[1 - lead] = { dx: 0, dy: 0 };
    return { kind: "decel", dir: screenDir(h), frame: Math.min(N - 1, Math.floor(u * N)),
             bob: -0.015 * e, lean: -h.x * 0.065 * e, crouch: 0.03 + 0.05 * e + g.crouch, bend: 0,
             turn: lat ? sgn(h.x) * (1 - 0.5 * e) : 0, feet, knees, arms: [0.4 * e, 0.4 * e] };
  }

  // Loaded in the plant, w 0..1 over the first beat; nd = where the body is starting to go.
  function plantPose(s, w, g, nd) {
    const h = s.head, e = sstep(w), lead = h.x >= 0 ? 1 : 0, ls = lead ? 1 : -1, lat = Math.abs(h.x) >= Math.abs(h.y);
    const feet = [], knees = [];
    feet[lead] = { dx: ls * 0.24 + h.x * 0.4, dy: h.y * 0.18, lift: 0, sole: 0 };
    feet[1 - lead] = { dx: -ls * 0.26 + h.x * 0.02, dy: -h.y * 0.03, lift: 0, sole: 0 };
    knees[lead] = { dx: h.x * 0.08, dy: h.y * 0.05 }; knees[1 - lead] = { dx: 0, dy: 0 };
    const open = Math.abs(nd.x) > 0.5 ? sgn(nd.x) * 0.35 * e : 0;   // hips begin to open toward the new way
    return { kind: "plant", dir: screenDir(nd), frame: Math.min(N - 1, Math.floor(w * N)),
             bob: -0.025, lean: lerp(-h.x * 0.065, nd.x * 0.03, e), crouch: 0.085 + g.crouch, bend: 0,
             turn: (lat ? sgn(h.x) * 0.5 * (1 - e) : 0) + open, feet, knees, arms: [0.4, 0.4] };
  }

  // The first step out, w 0..1 over the cut.
  function cutPose(s, w, g, near) {
    const nd = s.nd, e = sstep(w), arc = Math.sin(Math.PI * w), fast = sstep(Math.min(1, w * 1.7));
    const feet = [], knees = [], arms = [0, 0], front = near ? 1 : -1;   // front of the body: toward the net
    let kind, turn = 0, lean = 0, bend = 0, crouch;
    if (Math.abs(nd.x) >= Math.abs(nd.y)) {               // CROSSOVER: the outside leg swings across, hips and shoulders turn
      const sN = sgn(nd.x), out = sN > 0 ? 0 : 1, inn = 1 - out;
      const from = -sN * (0.3 + 0.32 * clamp01(-s.head.x * sN));   // where the plant left that foot: far out after a full reversal
      feet[out] = { dx: lerp(from, sN * 0.3, e), dy: front * 0.07 * arc, lift: 0.13 * arc * Math.sqrt(g.knee), sole: 0 };
      feet[inn] = { dx: lerp(sN * 0.26, sN * 0.12, e), dy: -front * 0.02 * arc, lift: 0, sole: 0 };   // the pivot foot pushes off
      knees[out] = { dx: sN * 0.12 * arc, dy: front * 0.03 * arc }; knees[inn] = { dx: 0, dy: 0 };
      arms[out] = -0.8 * arc * g.arm; arms[inn] = 0.8 * arc * g.arm;
      kind = "crossover"; turn = sN * fast; lean = sN * (0.04 + g.lean) * (1 - 0.35 * e);
      crouch = lerp(0.08, 0.035, e);
    } else {
      const sD = sgn(nd.y), forward = near ? sD > 0 : sD < 0;
      if (!forward) {                                      // DROP STEP: open the hip, step back with that foot
        const kd = s.head.x < -0.2 ? 0 : 1, sd = kd ? 1 : -1;   // the side the body was moving to (right by default)
        feet[kd] = { dx: lerp(sd * 0.26, sd * 0.42, e), dy: sD * 0.2 * e, lift: 0.08 * arc, sole: 0 };
        feet[1 - kd] = { dx: -sd * 0.24, dy: -sD * 0.03 * e, lift: 0, sole: 0 };
        knees[kd] = { dx: sd * 0.04 * arc, dy: 0 }; knees[1 - kd] = { dx: 0, dy: 0 };
        arms[kd] = -0.6 * arc; arms[1 - kd] = 0.6 * arc;
        kind = "dropstep"; turn = sd * 0.6 * fast; lean = sd * 0.03 * e; crouch = lerp(0.075, 0.04, e);
      } else {                                             // PUSH-OFF: the back foot drives through, body tipped in
        const kp = s.head.x > 0 ? 0 : 1;
        feet[kp] = { dx: kp ? 0.17 : -0.17, dy: lerp(-sD * 0.1, sD * 0.18, e), lift: 0.12 * arc, sole: near && sD > 0 ? arc : 0 };
        feet[1 - kp] = { dx: kp ? -0.2 : 0.2, dy: -sD * 0.06 * e, lift: 0, sole: 0 };
        knees[kp] = { dx: 0, dy: sD * 0.08 * arc }; knees[1 - kp] = { dx: 0, dy: 0 };
        arms[kp] = -0.8 * arc * g.arm; arms[1 - kp] = 0.8 * arc * g.arm;
        kind = "pushoff"; bend = 0.04 * (1 - 0.5 * e); crouch = lerp(0.07, 0.03, e);
      }
    }
    return { kind, dir: screenDir(nd), frame: Math.min(N - 1, Math.floor(w * N)),
             bob: -0.025 * (1 - e) + 0.012 * arc * g.bounce, lean, crouch: crouch + g.crouch, bend, turn, feet, knees, arms };
  }

  function turnaround(p, s, g, near) {
    let fr;
    if (s.mode === "decel") fr = decelPose(s, steps(1 - Math.max(0, p.vx * s.head.x + p.vy * s.head.y) / (s.v0 || 1)), g);
    else if (s.mode === "plant") {
      const sp = Math.hypot(p.vx, p.vy);
      fr = plantPose(s, steps(s.t / 0.12), g, sp > 0.4 ? { x: p.vx / sp, y: p.vy / sp } : { x: -s.head.x, y: -s.head.y });
    } else fr = cutPose(s, steps(s.t / (DC.cut / g.cadence)), g, near);
    if (reduce()) fr.bob = 0;
    return fr;
  }

  function pick(p, B, near, id, dt = 0) {
    const g = GAIT[id] || DEF, dc = track(p, B, g, dt);
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
    if (dc.mode) return turnaround(p, dc, g, near);       // braking, planted or cutting out: the direction-change beats
    if (p.plant > 0) {                                     // a plant with no heading on record yet: the plain wide, low stance
      const back = -Math.sign(side || 1);
      return still({ kind: "plant", dir: null, frame: 0, bob: -0.05, lean: back * 0.04, crouch: 0.06,
               feet: [{ dx: -0.42, lift: 0 }, { dx: 0.42, lift: 0 }], arms: [0.4, 0.4] });
    }
    p._still = p._still ? sp < 0.65 : sp < 0.35;         // hysteresis: no flicker between ready and moving at walking pace
    if (p._still && p.receiving) {                         // RETURN STANCE: squat low, feet wide, bent forward over the knees,
      const t = p.run;                                     // weight rocking side to side, a light bounce on the toes
      return still({ kind: "receive", dir: null, frame: 0, bob: reduce() ? 0 : Math.abs(Math.sin(t * 5.2)) * 0.008, lean: reduce() ? 0 : Math.sin(t * 2.6) * 0.012,
               crouch: 0.085, bend: 0.055, feet: [{ dx: -0.4, lift: 0 }, { dx: 0.4, lift: 0 }], arms: [0.3, 0.3] });
    }
    if (p._still) {                                        // ready position: feet apart, knees soft, a slow breath
      const breathe = reduce() ? 0 : Math.sin(p.run * 2.2) * 0.006;
      return still({ kind: "ready", dir: null, frame: 0, bob: breathe, lean: 0, crouch: 0.025,
               feet: [{ dx: -0.26, lift: 0 }, { dx: 0.26, lift: 0 }], arms: [0.2, 0.2] });
    }
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
    // ACCELERATION LEAN: while the speed is still building, the body tips into the run; it fades toward top speed.
    const acc = clamp01(dc.acc / (B.accel || 8)) * (1 - stride);
    if (acc > 0.02) {
      if (kind === "siderun" || kind === "shuffle") fr.lean += Math.sign(side) * 0.05 * acc;
      else if (kind === "run") { fr.bend = (fr.bend || 0) + 0.035 * acc; fr.lean += tilt * 0.03 * acc; }
      fr.crouch += 0.02 * acc;
    }
    if (reduce()) fr.bob = 0;
    return Object.assign(fr, { kind, dir, frame: k, accel: acc });
  }

  // FLUENT TRANSITIONS. Inside a cycle the 20 frames are already tweened. When the movement changes kind
  // (ready → shuffle → side run → plant → run …) the new pose is cross-faded from the last pose drawn over
  // BLEND seconds, so feet, knees and arms travel to their new place instead of jumping. Turn and lean ease too.
  // The direction-change beats already flow into each other, so between two of them the blend is short (QUICK)
  // and turn/lean ease twice as fast: a cut is quick, and a long cross-fade would wash out the plant.
  const BLEND = 0.2, QUICK = 0.07;
  function frame(p, B, near, id, now) {                  // now (seconds) is optional: tests pass their own clock
    if (now == null) now = performance.now() / 1000;
    const s = p._animSmooth || (p._animSmooth = { turn: 0, lean: 0, kind: null, dir: null, from: null, t: 9, len: BLEND, last: null, at: now });
    const dt = Math.min(0.1, Math.max(0, now - s.at)); s.at = now;
    const fr = pick(p, B, near, id, dt);
    if (reduce()) { s.last = fr; s.kind = fr.kind; s.dir = fr.dir; return fr; }
    if (fr.kind !== s.kind || fr.dir !== s.dir) {
      s.len = TURN_KINDS.has(fr.kind) && TURN_KINDS.has(s.kind) ? QUICK : BLEND;
      s.from = s.last; s.t = 0; s.kind = fr.kind; s.dir = fr.dir;
    }
    s.t += dt;
    const k = 1 - Math.exp(-dt * (TURN_KINDS.has(fr.kind) ? 24 : 12));   // time-based easing: the same feel at 30, 60 or 120 fps
    s.turn += (fr.turn - s.turn) * k; s.lean += (fr.lean - s.lean) * k;
    let out = fr;
    if (s.from && s.t < s.len) {
      const w = 1 - s.t / s.len, e = w * w * (3 - 2 * w); // smoothstep from the old pose to the new one
      out = Object.assign(tween(fr, s.from, e), { kind: fr.kind, dir: fr.dir, frame: fr.frame });
    }
    out.turn = s.turn; out.lean = s.lean;
    s.last = out;
    return out;
  }


  window.Anim = { frame, FRAMES: N, GAIT, framesFor, TURN_KINDS };
})();
