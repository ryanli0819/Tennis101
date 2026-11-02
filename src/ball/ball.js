/* Tennis101 · Ball Physicist — the real tennis ball.
   Contract (agents/README.md): Ball.launchBall({ from, vel, spin }), Ball.stepBall(dt), Ball.getBall(),
   Ball.onBounce(cb), Ball.onNet(cb). Court coords: x left/right, y along the court (net at 0), z up.
   Metres, seconds, rad/s. The surface table is src/ball/surfaces.js (load it first).

   ENGINE. The live ball is a rigid body in cannon-es (pure JS, MIT, loaded from jsdelivr, pinned).
   cannon-es integrates it: gravity, our air forces, spin decay (angular damping). The court and the net
   are static cannon bodies with collisionResponse off: cannon's own contact friction is capped at
   μ·m·g per step, far too weak for a 4 ms impact, and a 5 mm net is crossed in one step at 50 m/s.
   So the contact laws are tennis ones, applied after each step: the grip-slip bounce from
   surfaces.js, and a swept test against the net cloth and its cord.
   The aim solver needs hundreds of flights per shot, so it uses a predictor that does exactly what
   cannon's step does (same order, same fixed step); tests check the two agree within 2 cm.
   If cannon-es can't load (offline file), the live ball runs on the predictor: same physics.

   AIR. Drag F = ½ρCdAv² (Cd 0.55, ρ 1.2 kg/m³). Magnus lift F = ½ρClAv² along ω×v, with
   Cl = 1/(2 + v/(Rω)) capped at 0.35 (the fit used by Cross & Lindsey and Goodwill et al. for
   spinning tennis balls). Topspin dips, backspin floats, sidespin curves. Spin decays with τ ≈ 6 s
   (estimate). Ball: 57.7 g, 6.7 cm diameter (ITF). */
(function (root) {
  const SURF_TABLE = root.BALL_SURFACES || (typeof require === "function" ? require("./surfaces.js") : {});

  const M = 0.0577, R = 0.0335, G = 9.81;
  const RHO = 1.2, CD = 0.55, AREA = Math.PI * R * R;
  const KD = 0.5 * RHO * CD * AREA / M;          // drag: a = −KD·|v|·v
  const KL = 0.5 * RHO * AREA / M;               // lift: a = KL·Cl·|v|²  along ω×v
  const CL_MAX = 0.35;
  const SPIN_TAU = 6.0;                           // s: spin decays as e^(−t/τ)
  const ALPHA = 0.55;                             // I = α m R², thin pressurised shell
  const H = 1 / 480;                              // fixed physics step (s)
  const NET_C = 0.914, NET_P = 1.07, POST_X = 6.40;   // net height at the centre / posts; posts 0.914 m outside the doubles lines
  const CORD_R = 0.02;                            // the cord + tape, as a round bar under the top of the net
  const CANNON_URL = "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";
  const RPM = 2 * Math.PI / 60;

  let surfName = "hard";
  const surf = () => SURF_TABLE[surfName] || SURF_TABLE.hard;
  const netHeight = x => NET_C + (NET_P - NET_C) * Math.min(1, Math.abs(x) / POST_X);

  /* ---------- the physics both the engine and the predictor share ---------- */

  function aero(v, w, out) {                       // air acceleration without gravity
    const sp = Math.hypot(v.x, v.y, v.z);
    out.x = -KD * sp * v.x; out.y = -KD * sp * v.y; out.z = -KD * sp * v.z;
    const wm = Math.hypot(w.x, w.y, w.z);
    if (wm > 1e-6 && sp > 1e-6) {
      const cl = Math.min(CL_MAX, 1 / (2 + sp / (R * wm)));
      const cx = w.y * v.z - w.z * v.y, cy = w.z * v.x - w.x * v.z, cz = w.x * v.y - w.y * v.x;
      const cm = Math.hypot(cx, cy, cz);
      if (cm > 1e-9) { const f = KL * cl * sp * sp / cm; out.x += f * cx; out.y += f * cy; out.z += f * cz; }
    }
    return out;
  }

  /* Ground: the grip-slip bounce. Returns the event, or null. */
  function bounce(s, sf) {
    const v = s.v, w = s.w, vin = { x: v.x, y: v.y, z: v.z };
    const vn = -v.z;
    const e = Math.max(0.5, sf.e - sf.eSlope * Math.max(0, vn - 7));
    const cx = v.x - R * w.y, cy = v.y + R * w.x;          // velocity of the bottom of the ball
    const cs = Math.hypot(cx, cy), k = 1 + 1 / ALPHA;
    let grip = false;
    if (cs > 1e-9) {
      const jSlide = sf.mu * (1 + e) * vn;                 // Coulomb limit (per unit mass)
      const jGrip = (1 + sf.ex) * cs / k;                  // what stops the slide and springs it back by ex
      grip = jGrip <= jSlide;
      const j = Math.min(jSlide, jGrip), jx = -j * cx / cs, jy = -j * cy / cs;
      v.x += jx; v.y += jy;
      const I = ALPHA * R * R;
      w.x += R * jy / I; w.y -= R * jx / I;
    }
    v.z = e * vn;
    s.p.z = Math.max(s.p.z, R);
    s.bounces++;
    return { n: s.bounces, x: s.p.x, y: s.p.y, z: 0, t: s.t, vin, vout: { x: v.x, y: v.y, z: v.z }, grip, surface: surfName };
  }

  /* Net: swept test of this step's path against the cord (round bar) and the cloth below it. */
  function hitNet(s, prev) {
    const p = s.p, v = s.v, w = s.w;
    const reach = R + CORD_R + 0.05;
    if (Math.sign(prev.y) === Math.sign(p.y) && Math.min(Math.abs(prev.y), Math.abs(p.y)) > reach) return null;
    const N = 8;
    for (let i = 0; i <= N; i++) {                         // cord first: where along the step does the ball touch it?
      const u = i / N, x = prev.x + (p.x - prev.x) * u;
      if (Math.abs(x) > POST_X) continue;
      const y = prev.y + (p.y - prev.y) * u, z = prev.z + (p.z - prev.z) * u;
      const az = netHeight(x) - CORD_R, d = Math.hypot(y, z - az);
      if (d >= R + CORD_R || d < 1e-9) continue;
      const ny = y / d, nz = (z - az) / d, vn = v.y * ny + v.z * nz;
      if (vn >= 0) return null;                            // already leaving the cord
      const ty = -nz, tz = ny, vt = v.y * ty + v.z * tz;
      const vn2 = -0.3 * vn, vt2 = 0.8 * vt;               // a dead, grabbing contact: little bounce, some slip
      v.y = vn2 * ny + vt2 * ty; v.z = vn2 * nz + vt2 * tz; v.x *= 0.85;
      w.x *= 0.5; w.y *= 0.5; w.z *= 0.5;
      const r = R + CORD_R + 1e-3;
      p.x = x; p.y = ny * r; p.z = az + nz * r;
      return { kind: "cord", x: p.x, y: p.y, z: p.z, t: s.t };
    }
    if ((prev.y < 0) !== (p.y < 0)) {                      // crossed the net plane below the cord: into the cloth
      const u = prev.y / (prev.y - p.y), x = prev.x + (p.x - prev.x) * u, z = prev.z + (p.z - prev.z) * u;
      if (Math.abs(x) <= POST_X && z < netHeight(x) - CORD_R) {
        const back = prev.y > 0 ? 1 : -1;
        p.x = x; p.y = back * (R + 0.01); p.z = z;
        v.x *= 0.25; v.y = -0.1 * v.y; v.z = Math.min(v.z, 0) * 0.3;
        w.x *= 0.3; w.y *= 0.3; w.z *= 0.3;
        return { kind: "cloth", x: p.x, y: p.y, z: p.z, t: s.t };
      }
    }
    return null;
  }

  function contacts(s, prev, sf, emit) {
    const n = hitNet(s, prev);
    if (n) emit("net", n);
    if (s.p.z < R && s.v.z < 0) emit("bounce", bounce(s, sf));
  }

  const newState = (from, vel, spin) => ({
    p: { x: from.x, y: from.y, z: from.z }, v: { x: vel.x, y: vel.y, z: vel.z },
    w: spin ? { x: spin.x || 0, y: spin.y || 0, z: spin.z || 0 } : { x: 0, y: 0, z: 0 }, t: 0, bounces: 0,
  });
  const DECAY = Math.exp(-H / SPIN_TAU);
  const _a = { x: 0, y: 0, z: 0 };

  /* One predictor step: exactly cannon's order (forces from the state at the start of the step,
     angular damping, then v += a·dt, x += v·dt). */
  function shadowStep(s) {
    aero(s.v, s.w, _a); _a.z -= G;
    s.w.x *= DECAY; s.w.y *= DECAY; s.w.z *= DECAY;
    s.v.x += _a.x * H; s.v.y += _a.y * H; s.v.z += _a.z * H;
    s.p.x += s.v.x * H; s.p.y += s.v.y * H; s.p.z += s.v.z * H;
    s.t += H;
  }

  /* ---------- the engine (cannon-es) ---------- */

  let C = null, world = null, body = null, F = null;
  function buildWorld(CANNON) {
    C = CANNON;
    world = new C.World({ gravity: new C.Vec3(0, 0, -G) });
    world.allowSleep = false;
    body = new C.Body({ mass: M, shape: new C.Sphere(R), linearDamping: 0, angularDamping: 1 - Math.exp(-1 / SPIN_TAU) });
    body.collisionResponse = false;
    const ground = new C.Body({ mass: 0, shape: new C.Plane() });          // the court, z = 0, normal +z
    const net = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(POST_X, 0.005, NET_P / 2)), position: new C.Vec3(0, 0, NET_P / 2) });
    for (const b of [ground, net]) { b.collisionResponse = false; b.isTrigger = true; }   // detected, never pushed by the solver
    world.addBody(ground); world.addBody(net); world.addBody(body);
    F = new C.Vec3();
  }
  function engineStep(s) {
    body.position.set(s.p.x, s.p.y, s.p.z);
    body.velocity.set(s.v.x, s.v.y, s.v.z);
    body.angularVelocity.set(s.w.x, s.w.y, s.w.z);
    aero(s.v, s.w, _a);
    F.set(_a.x * M, _a.y * M, _a.z * M);
    body.applyForce(F);                                   // at the centre: no torque
    world.step(H);                                        // one fixed step (gravity is the world's)
    s.p.x = body.position.x; s.p.y = body.position.y; s.p.z = body.position.z;
    s.v.x = body.velocity.x; s.v.y = body.velocity.y; s.v.z = body.velocity.z;
    s.w.x = body.angularVelocity.x; s.w.y = body.angularVelocity.y; s.w.z = body.angularVelocity.z;
    s.t += H;
  }

  /* ---------- the live ball ---------- */

  let live = null, acc = 0;
  const bounceCbs = [], netCbs = [];
  const emitLive = (kind, e) => (kind === "net" ? netCbs : bounceCbs).forEach(cb => cb(e));

  function launchBall({ from, vel, spin }) {
    live = newState(from, vel, spin); acc = 0;
    return getBall();
  }
  function stepBall(dt) {
    if (!live) return null;
    acc += Math.min(Math.max(dt, 0), 0.1);
    while (acc >= H) {
      acc -= H;
      const prev = { x: live.p.x, y: live.p.y, z: live.p.z };
      if (world) engineStep(live); else shadowStep(live);
      contacts(live, prev, surf(), emitLive);
    }
    return getBall();
  }
  function getBall() {
    if (!live) return null;
    const { p, v, w } = live;
    return { x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, spin: { x: w.x, y: w.y, z: w.z }, t: live.t, bounces: live.bounces };
  }
  const onBounce = cb => { bounceCbs.push(cb); return () => bounceCbs.splice(bounceCbs.indexOf(cb) >>> 0, 1); };
  const onNet = cb => { netCbs.push(cb); return () => netCbs.splice(netCbs.indexOf(cb) >>> 0, 1); };

  /* ---------- prediction and aiming ---------- */

  /* Fly a ball without touching the live one. stop: "bounce" (first bounce or into the cloth) or "rest"
     (second bounce, or past maxY). Returns { bounces, nets, samples, t }. */
  function predict({ from, vel, spin }, { stop = "rest", tMax = 6, samples = false, maxY = 22 } = {}) {
    const s = newState(from, vel, spin), sf = surf();
    const out = { bounces: [], nets: [], samples: samples ? [] : null, t: 0 };
    const emit = (kind, e) => (kind === "net" ? out.nets : out.bounces).push(e);
    while (s.t < tMax) {
      const prev = { x: s.p.x, y: s.p.y, z: s.p.z };
      shadowStep(s);
      contacts(s, prev, sf, emit);
      if (out.samples) out.samples.push({ t: s.t, x: s.p.x, y: s.p.y, z: s.p.z, vz: s.v.z });
      if (stop === "bounce" && (out.bounces.length || out.nets.some(n => n.kind === "cloth"))) break;
      if (out.bounces.length >= 2 || Math.abs(s.p.y) > maxY) break;
    }
    out.t = s.t;
    return out;
  }

  /* Spin vector for a shot travelling along dir {x,y}: topRpm > 0 topspin, < 0 backspin;
     sideRpm > 0 (about the vertical) curves the ball to the left of its path in the air (seen from
     the hitter); gyroRpm > 0 (rifle spin, about the line of flight) does nothing in the air but kicks
     the ball to the right at the bounce. A kick serve has both topspin and gyro spin. */
  function spinFor(dir, topRpm, sideRpm = 0, gyroRpm = 0) {
    const L = Math.hypot(dir.x, dir.y) || 1, dx = dir.x / L, dy = dir.y / L;
    return { x: (-dy * topRpm + dx * gyroRpm) * RPM, y: (dx * topRpm + dy * gyroRpm) * RPM, z: sideRpm * RPM };
  }

  /* Launch velocity so the ball first bounces at target {x,y}, for a given speed off the racket (m/s,
     kept exactly: Strength / Serve skill steps stay constant) and spin. Elevation by bisection on the
     carry (a ball into the net counts as short), direction by correcting the sideways miss (curve).
     curveTo / kickTo (optional, ±1): which way along x the sidespin bends the ball in the air / the
     gyro spin kicks it at the bounce. Always returns a shot; exact = false when the target can't be
     reached at this speed. */
  function solveShot({ from, target, speed, topRpm = 0, sideRpm = 0, gyroRpm = 0, curveTo = 0, kickTo = 0, minDeg = -20, maxDeg = 40 }) {
    const aim = { x: target.x, y: target.y };
    let best = null;
    for (let round = 0; round < 4; round++) {
      const dx = aim.x - from.x, dy = aim.y - from.y, L = Math.hypot(dx, dy) || 1, d = { x: dx / L, y: dy / L };
      const side = curveTo ? Math.abs(sideRpm) * Math.sign(curveTo * -d.y || 1) : sideRpm;
      const gyro = kickTo ? Math.abs(gyroRpm) * Math.sign(kickTo * d.y || 1) : gyroRpm;
      const spin = spinFor(d, topRpm, side, gyro);
      const want = (target.x - from.x) * d.x + (target.y - from.y) * d.y;
      const fly = th => {
        const vel = { x: speed * Math.cos(th) * d.x, y: speed * Math.cos(th) * d.y, z: speed * Math.sin(th) };
        const r = predict({ from, vel, spin }, { stop: "bounce", tMax: 5 });
        const b = r.bounces[0];
        const net = r.nets.length > 0 || !b || Math.sign(b.y) !== Math.sign(target.y);   // never aim to clip the cord
        return { vel, spin, land: b || null, carry: net ? -1 : (b.x - from.x) * d.x + (b.y - from.y) * d.y, net, th };
      };
      let lo = minDeg * Math.PI / 180, hi = maxDeg * Math.PI / 180;
      for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (fly(mid).carry < want) lo = mid; else hi = mid; }
      let f = fly((lo + hi) / 2);
      if (f.net) f = fly(hi);
      if (!f.land) { best = best || f; break; }
      best = f;
      const ex = target.x - f.land.x, ey = target.y - f.land.y;
      if (Math.hypot(ex, ey) < 0.03) break;
      aim.x += ex; aim.y += ey;
    }
    const land = best.land;
    return { vel: best.vel, spin: best.spin, landing: land ? { x: land.x, y: land.y } : null, theta: best.th,
             exact: !!land && Math.hypot(target.x - land.x, target.y - land.y) < 0.1 };
  }

  /* ---------- setup ---------- */

  const Ball = {
    launchBall, stepBall, getBall, onBounce, onNet,
    predict, solveShot, spinFor, netHeight,
    setSurface(name) { if (SURF_TABLE[name]) surfName = name; return surfName; },
    getSurface: () => surfName,
    engine: "built-in",                       // "cannon-es@0.20.0" once the engine is loaded
    CONST: { M, R, G, RHO, CD, H, NET_C, NET_P, POST_X, CORD_R, ALPHA, SPIN_TAU, KD, KL },
    /* Load cannon-es (or take a module that's already loaded, e.g. in tests). Safe to call twice. */
    init(mod) {
      if (Ball._init) return Ball._init;
      Ball._init = (mod ? Promise.resolve(mod) : import(CANNON_URL))
        .then(CANNON => { buildWorld(CANNON); Ball.engine = "cannon-es@0.20.0"; return Ball; })
        .catch(err => { Ball.engine = "built-in"; if (root.console) console.warn("Ball: cannon-es not loaded, using the built-in step", err); return Ball; });
      return Ball._init;
    },
    /* Tests: run the live ball on the predictor even when cannon is loaded. */
    useEngine(on) { if (!on) world = null; else if (C) buildWorld(C); Ball.engine = world ? "cannon-es@0.20.0" : "built-in"; },
  };

  root.Ball = Ball;
  if (typeof module !== "undefined" && module.exports) module.exports = Ball;
})(typeof globalThis !== "undefined" ? globalThis : this);
