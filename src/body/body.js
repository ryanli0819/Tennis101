/* BODY · ANIMATOR (Body Animator, agents/body-animator/).
   A jointed skeleton for each player that FOLLOWS the gameplay and never drives it: every frame it reads the
   footwork (pos[i]: position, velocity, split-step air time, slide, return stance), the Racket Coach's grip
   (racketPose) and, while a captured serve plays, the serve's joints (pos[i].motion.world), and builds a pose.
   Nothing here writes to pos[], swing[] or the rally.
   - Legs: the feet are PLANTED (a planted toe never slides); a foot lifts when its phase in the stride comes round
     (cadence = speed / stride length, stride from leg length: Alexander 1984, λ/L = 2.3·Fr^0.3), or when the hip
     has run past it and the leg is fully stretched (toe-off), and lands where the hip will be half a stance later
     (Raibert 1986 foot placement). The heel lifts (up to 50° plantar flexion) before the pelvis has to drop.
   - Lean: the trunk tilts by atan(a / g), the angle that keeps the ground force through the body as it
     speeds up or brakes, plus a forward bend in the return stance.
   - Split-step: a ballistic hop (height g·T²/8 for the air time T), feet spreading, a crouch on landing.
   - Knees and elbows are solved by IK (src/body/ik.js: three.js CCDIKSolver, exact fallback) inside their
     ranges (src/body/skeleton.js). The racket hand holds the Racket Coach's grip; the shoulders turn only as far
     as the arm needs to reach it.
   - playMotion(i, motion) plays a keyframed motion (a serve from src/serve/motion/) joint for joint, and the
     body blends into it (0.2 s) and back out (0.25 s). A serve the game is already playing (pos[i].motion) is
     picked up the same way, unchanged.
   API: Body.update(dt, { pos, PLAYERS, racket(i) }), getPose(i), playMotion(i, frames), JOINTS. */
(function (root) {
  const SK = root.BodySkeleton, IK = root.BodyIK, { sub, add, len, scl, norm } = IK.v;
  const G = 9.81, TAU = Math.PI * 2, D2R = Math.PI / 180;
  const RACKET = 0.686;                     // a 27-inch racket, butt to tip (m)
  const MOVE = 0.35;                        // m/s: slower than this the body stands (steps only to re-balance)
  const HEEL_MAX = 50;                      // plantar flexion range, degrees (AAOS)
  const BLEND_IN = 0.2, BLEND_OUT = 0.25;   // seconds to blend into / out of a keyframed motion
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = u => u * u * (3 - 2 * u);
  const lerp3 = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
  const Z = { x: 0, y: 0, z: 1 };

  const st = [], poses = [], segCache = {};
  let broken = false;
  const segs = P => segCache[P.heightM + "/" + (P.armSpanM || 0)] || (segCache[P.heightM + "/" + (P.armSpanM || 0)] = SK.segments(P));

  /* ---------- feet ---------- */
  /* A foot: its ankle's resting spot (x, y, heel down), the way it points, and whether it is planted.
     The toe (ball of the foot) is what stays fixed while planted; the heel may rise around it. */
  function footGeom(L) { const a = 0.7 * L.foot, toeZ = 0.02; return { a, toeZ, rho: Math.hypot(a, L.ankleZ - toeZ), b0: Math.atan2(L.ankleZ - toeZ, a) }; }
  function toeOf(f, L) { const F = footGeom(L); return { x: f.x + f.dir.x * F.a, y: f.y + f.dir.y * F.a, z: F.toeZ }; }
  function ankleAt(f, L, heel) {                       // ankle with the heel raised by `heel` radians around the planted toe
    const F = footGeom(L), T = toeOf(f, L), b = F.b0 + heel;
    return { x: T.x - f.dir.x * F.rho * Math.cos(b), y: T.y - f.dir.y * F.rho * Math.cos(b), z: T.z + F.rho * Math.sin(b) };
  }
  /* Highest pelvis that still lets the leg reach this planted foot: try the heel flat first, then raise it. */
  function reachFoot(f, hip, pz, L, legMax) {
    for (let d = 0; d <= HEEL_MAX; d += 5) {
      const A = ankleAt(f, L, d * D2R), h = Math.hypot(hip.x - A.x, hip.y - A.y);
      if (h >= legMax) continue;
      const zMax = A.z + Math.sqrt(legMax * legMax - h * h);
      if (zMax >= pz || d === HEEL_MAX) return { heel: d * D2R, zMax, ankle: A };
    }
    return { heel: HEEL_MAX * D2R, zMax: -1, ankle: ankleAt(f, L, HEEL_MAX * D2R) };   // out of reach: must step
  }
  const footDir = (h, r, sd) => norm({ x: h.x + r.x * sd * 0.18, y: h.y + r.y * sd * 0.18, z: 0 });   // ~10° toe-out

  function fresh() {
    return { t: 0, phase: 0, freq: 0, yaw: 0, acc: { x: 0, y: 0 }, vPrev: null, feet: null, px: null, py: null,
             air: false, airT: 0, landAt: -9, sliding: false, mw: 0, last: null, own: null, wasMotion: false, steps: 0 };
  }

  /* ---------- one player, one frame ---------- */
  function stepPlayer(i, dt, ctx) {
    const p = ctx.pos[i], P = ctx.PLAYERS[i], L = segs(P), H = L.H;
    const R = P.side === "far" ? -1 : 1;              // near: right = +x, forward = +y; far: the mirror
    const s = st[i] || (st[i] = fresh());
    if (s.H !== H || s.px == null || Math.hypot(p.x - s.px, p.y - s.py) > 1.0) {   // new player, or put back in place
      s.H = H; s.feet = null; s.yaw = 0; s.vPrev = null; s.phase = 0;
    }
    s.px = p.x; s.py = p.y; s.t += dt;

    /* velocity, smoothed acceleration */
    const v = { x: p.vx || 0, y: p.vy || 0 }, sp = Math.hypot(v.x, v.y);
    if (s.vPrev && dt > 0) {
      const k = 1 - Math.exp(-dt / 0.08);
      s.acc.x += ((v.x - s.vPrev.x) / dt - s.acc.x) * k; s.acc.y += ((v.y - s.vPrev.y) / dt - s.acc.y) * k;
    }
    s.vPrev = v;

    /* heading: square to the net, turned toward a fast side run */
    const h0 = { x: 0, y: R }, r0 = { x: R, y: 0 };
    const lat = v.x * r0.x + v.y * r0.y, fwd = v.x * h0.x + v.y * h0.y;
    const sideRun = sp > 3 && Math.abs(lat) > 1.5 * Math.abs(fwd);
    s.yaw += ((sideRun ? -Math.sign(lat) * 50 * D2R : 0) - s.yaw) * (1 - Math.exp(-dt * 8));
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
    const h = { x: h0.x * cy - h0.y * sy, y: h0.x * sy + h0.y * cy, z: 0 }, r = { x: h.y, y: -h.x, z: 0 };

    /* gait numbers from the body: stride from leg length (Alexander 1984), cadence = speed / stride */
    const legL = L.hipZ, run = clamp(sp / 4, 0, 1);
    let stride = legL * 2.3 * Math.pow(Math.max(sp * sp / (G * legL), 1e-6), 0.3);
    if (!sideRun && Math.abs(lat) > Math.abs(fwd)) stride *= 0.6;          // side shuffle: short, quick steps
    const moving = sp > MOVE;
    const freq = moving ? sp / stride : 0;                                 // strides per second
    const duty = clamp(0.62 - 0.05 * sp, 0.25, 0.62);                       // share of a stride a foot is down
    const swingDur = moving ? clamp((1 - duty) / freq, 0.12, 0.5) : 0.2;
    const half = (p.receiving ? 0.2 : 0.16) * H * (1 - run) + 0.05 * H * run;   // half the stance width
    const legMax = 0.985 * L.leg;

    /* pelvis height wanted: ready knees, return stance, running dip and bob, the racket's crouch, landing, slide */
    const air = (p.air || 0) > 0, slideOn = (p.slide || 0) > 0, splitAir = ctx.splitAir || 0.22;
    let rk = null;
    try { rk = ctx.racket ? ctx.racket(i) : null; } catch (e) { rk = null; }
    const sinceLand = s.t - s.landAt;
    const crouch = (p.receiving ? 0.075 : 0.03) * H * (1 - run) + 0.045 * H * run
      + (rk && rk.crouch ? rk.crouch * H : 0)
      + (sinceLand < 0.6 ? 0.07 * H * Math.exp(-sinceLand / 0.15) : 0)
      + (slideOn ? 0.12 * H : 0);
    const bob = moving ? -0.012 * H * run * Math.cos(2 * TAU * (s.phase - (1 - duty / 2))) : 0;   // lowest at mid-stance
    let hop = 0;
    if (air) {
      if (!s.air) { s.air = true; s.airT = 0; s.feet && s.feet.forEach(f => { f.planted = false; f.sw = null; f.lift = 0; f.from = { x: f.x, y: f.y }; }); }
      s.airT += dt;
      const u = clamp(s.airT / splitAir, 0, 1);
      hop = 4 * (G * splitAir * splitAir / 8) * u * (1 - u);              // ballistic: peak g·T²/8
    } else if (s.air) { s.air = false; s.landAt = s.t; s.feet && s.feet.forEach(f => { f.planted = true; f.liftT = s.t; }); }
    let pz = L.hipZ - crouch + bob + hop;

    const pg = { x: p.x, y: p.y, z: 0 };                                   // pelvis over the ground
    const lead = moving ? Math.min(duty / freq / 2, 0.25) : 0;              // Raibert: land half a stance ahead
    const home = (sd, ahead) => {
      const vz = pz - L.ankleZ, maxAhead = 0.85 * Math.sqrt(Math.max(0, legMax * legMax - vz * vz));
      let dx = v.x * ahead, dy = v.y * ahead; const m = Math.hypot(dx, dy);
      if (m > maxAhead) { dx *= maxAhead / m; dy *= maxAhead / m; }
      return { x: pg.x + r.x * sd * half + dx, y: pg.y + r.y * sd * half + dy };
    };
    const hipOf = sd => ({ x: p.x + r.x * sd * L.hipWidth / 2, y: p.y + r.y * sd * L.hipWidth / 2 });
    if (!s.feet) s.feet = [-1, 1].map(sd => { const o = home(sd, 0); return { sd, x: o.x, y: o.y, dir: footDir(h, r, sd), planted: !air, sw: null, liftT: -9, lift: 0 }; });
    const F = s.feet;
    const lift = (f, dur) => { f.planted = false; f.slid = false; f.sw = { from: { x: f.x, y: f.y }, u: 0, dur }; f.liftT = s.t; };

    /* cadence: each foot's phase in the stride; it lifts when its phase comes round */
    if (moving && !s.freq) {                                               // starting off: the foot further from home goes first
      const far = F.map(f => { const o = home(f.sd, lead); return Math.hypot(f.x - o.x, f.y - o.y); });
      const k = far[0] >= far[1] ? 0 : 1;
      s.phase = (1.9999 - 0.5 * k) % 1;
    }
    s.freq = freq;
    const phBefore = s.phase;
    if (moving && !air && !slideOn) s.phase = (s.phase + freq * dt) % 1;
    F.forEach((f, k) => {
      if (air || slideOn) return;
      const a = (phBefore + 0.5 * k) % 1, b = (s.phase + 0.5 * k) % 1;
      if (moving && b < a && f.planted && s.t - f.liftT > 0.5 / freq) lift(f, swingDur);
    });

    /* SLIDE: the lead foot skids out in front, the back foot drags (the only time feet slide) */
    if (slideOn && p.slideV) {
      const dv = norm({ x: p.slideV.x, y: p.slideV.y, z: 0 }), side = Math.sign(dv.x * r.x + dv.y * r.y) || 1;
      F.forEach(f => {
        const leadFoot = f.sd === side, o = leadFoot ? 0.55 * L.leg : -0.25 * L.leg;
        f.x = pg.x + dv.x * o + r.x * f.sd * 0.06 * H; f.y = pg.y + dv.y * o + r.y * f.sd * 0.06 * H;
        f.planted = false; f.sw = null; f.slid = true; f.lift = 0;
      });
      s.sliding = true;
    } else if (s.sliding) { s.sliding = false; F.forEach(f => { f.planted = true; f.slid = false; f.liftT = s.t; }); }

    /* SPLIT-STEP: both feet leave the ground together and spread to land wide */
    if (air) F.forEach(f => {
      const u = smooth(clamp(s.airT / splitAir, 0, 1)), o = { x: pg.x + r.x * f.sd * 0.19 * H, y: pg.y + r.y * f.sd * 0.19 * H };
      const from = f.from || { x: f.x, y: f.y };
      f.x = from.x + (o.x - from.x) * u; f.y = from.y + (o.y - from.y) * u; f.dir = footDir(h, r, f.sd);
    });

    /* standing: step to re-balance when a foot is far from where it belongs (one foot at a time) */
    if (!moving && !air && !slideOn) F.forEach((f, k) => {
      const o = home(f.sd, 0), other = F[1 - k];
      if (f.planted && other.planted && Math.hypot(f.x - o.x, f.y - o.y) > 0.11 * H) lift(f, 0.2);
    });

    /* the pelvis can only be as high as the planted legs reach (heel raised first); a stretched leg toes off */
    const heel = [0, 0];
    F.forEach((f, k) => {
      if (!f.planted) return;
      const hp = hipOf(f.sd), R0 = reachFoot(f, hp, pz, L, legMax);
      const drop = pz - R0.zMax;
      const other = F[1 - k];
      if (drop > 0.02 * H && (moving || drop > 0.06 * H) && !(other.sw && other.sw.u < 0.3 && !moving)) { lift(f, Math.min(swingDur, 0.3)); return; }
      heel[k] = R0.heel; pz = Math.min(pz, Math.max(R0.zMax, pz - 0.06 * H));
    });
    pz = Math.max(pz, L.ankleZ + 1.05 * IK.reachRange(L.thigh, L.shank, SK.LIMITS.knee[1]).min);

    /* swinging feet: travel to where the body will be at touch-down, lifted on an arc, then plant */
    F.forEach(f => {
      if (!f.sw) return;
      f.sw.u = Math.min(1, f.sw.u + (dt > 0 ? dt / f.sw.dur : 0));
      const rem = (1 - f.sw.u) * f.sw.dur, o = home(f.sd, lead);
      const tg = { x: o.x + v.x * rem, y: o.y + v.y * rem }, e = smooth(f.sw.u);
      f.x = f.sw.from.x + (tg.x - f.sw.from.x) * e; f.y = f.sw.from.y + (tg.y - f.sw.from.y) * e;
      f.dir = norm(lerp3(f.dir, footDir(h, r, f.sd), Math.min(1, e + 0.2)));
      f.lift = (0.05 + 0.05 * run) * H * Math.sin(Math.PI * f.sw.u);
      if (f.sw.u >= 1) { f.sw = null; f.planted = true; f.lift = 0; s.steps++; }
    });

    /* ---------- joints ---------- */
    const J = {};
    const pel = { x: p.x, y: p.y, z: pz };
    J.pelvis = pel;
    J.leftHip = { ...hipOf(-1), z: pz }; J.rightHip = { ...hipOf(1), z: pz };
    // trunk: lean = a / g (speeding up or braking), a little forward when running, bent over in the return stance
    const leanA = clamp(Math.hypot(s.acc.x, s.acc.y) / G, 0, 0.45), am = Math.hypot(s.acc.x, s.acc.y) || 1;
    let lx = s.acc.x / am * leanA + (sp > 0.01 ? v.x / sp * 0.06 * run : 0), ly = s.acc.y / am * leanA + (sp > 0.01 ? v.y / sp * 0.06 * run : 0);
    const bend = (p.receiving ? 0.36 : 0.08) + (rk && rk.crouch ? rk.crouch * 3 : 0) + (sinceLand < 0.6 ? 0.25 * Math.exp(-sinceLand / 0.15) : 0);
    lx += h.x * bend; ly += h.y * bend;
    if (slideOn && p.slideV) { const m = Math.hypot(p.slideV.x, p.slideV.y) || 1; lx -= p.slideV.x / m * 0.3; ly -= p.slideV.y / m * 0.3; }
    const lm = Math.hypot(lx, ly); if (lm > 0.7) { lx *= 0.7 / lm; ly *= 0.7 / lm; }   // at most ~35°
    const up = norm({ x: lx, y: ly, z: 1 });
    J.chest = add(pel, up, (SK.RATIO.chest * H) - L.hipZ);
    const sm = add(pel, up, L.trunk);                                      // between the shoulders
    J.neck = add(sm, up, L.neck);
    J.head = add(J.neck, norm(add(up, Z)), L.head * 0.5);                 // the head stays more upright than the trunk

    // shoulders: roll by the racket's tilt, turn only as far as the racket arm needs to reach the grip
    const tilt = rk && rk.tilt ? rk.tilt * H : 0;
    const wristR = rk ? add(rk.g, rk.u, -0.4 * L.hand) : null;
    const wristL = rk && rk.twoHands ? add(rk.g, rk.u, 0.09 - 0.4 * L.hand) : rk && rk.throat ? add(rk.g, rk.u, 0.22) : null;
    const shoulders = tw => {
      const c = Math.cos(tw), sn = Math.sin(tw), rc = { x: r.x * c - r.y * sn, y: r.x * sn + r.y * c, z: 0 };
      return [add(add(sm, rc, -L.shoulderWidth / 2), Z, tilt / 2), add(add(sm, rc, L.shoulderWidth / 2), Z, -tilt / 2)];
    };
    let twist = 0;
    if (wristR) {
      const ok = tw => { const [sl, sr] = shoulders(tw); return len(sub(wristR, sr)) <= 0.98 * L.arm && (!wristL || len(sub(wristL, sl)) <= 0.98 * L.arm); };
      if (!ok(0)) for (let d = 5; d <= 60; d += 5) { if (ok(d * D2R)) { twist = d * D2R; break; } if (ok(-d * D2R)) { twist = -d * D2R; break; } }
    }
    [J.leftShoulder, J.rightShoulder] = shoulders(twist);

    // arms: IK to the hands; a free hand swings against the legs when running
    const armSwing = 0.35 * run * Math.sin(TAU * s.phase);
    const freeHand = (sh, sd) => add(add(add(sh, Z, -(0.92 - 0.25 * run) * L.arm), h, sd * armSwing * L.arm), r, sd * 0.06);   // left arm back while the left leg swings forward
    const arm = (sd, target) => {
      const sh = sd < 0 ? J.leftShoulder : J.rightShoulder;
      const pole = { x: -h.x * 0.3 + r.x * sd * 0.5, y: -h.y * 0.3 + r.y * sd * 0.5, z: -1 };
      return IK.solve(sh, target || freeHand(sh, sd), L.upperArm, L.forearm, pole, SK.LIMITS.elbow[1]);
    };
    const aR = arm(1, wristR), aL = arm(-1, wristL);
    J.rightElbow = aR.mid; J.rightWrist = aR.end; J.leftElbow = aL.mid; J.leftWrist = aL.end;

    // legs: IK from each hip to its ankle; the knee points over the toes
    F.forEach((f, k) => {
      const nm = f.sd < 0 ? "left" : "right", hp = f.sd < 0 ? J.leftHip : J.rightHip;
      let A = f.planted ? ankleAt(f, L, heel[k]) : { x: f.x, y: f.y, z: L.ankleZ + (air ? hop : 0) + (f.lift || 0) };
      const d = sub(A, hp), dl = len(d);
      if (!f.planted && dl > legMax) A = add(hp, d, legMax / dl);         // a foot in the air is pulled into reach
      const pole = { x: f.dir.x + r.x * f.sd * 0.15, y: f.dir.y + r.y * f.sd * 0.15, z: 0.1 };
      const leg = IK.solve(hp, A, L.thigh, L.shank, pole, SK.LIMITS.knee[1]);
      J[nm + "Knee"] = leg.mid; J[nm + "Ankle"] = leg.end;
      J[nm + "Toe"] = f.planted ? toeOf(f, L) : { ...add(leg.end, f.dir, footGeom(L).a), z: Math.max(0, leg.end.z - (L.ankleZ - 0.02)) };
    });

    /* captured / keyframed motion: the game's own serve playback, or one started with playMotion */
    let M = null;
    if (p.motion && p.motion.world) M = fromMotionWorld(p.motion.world, h, L);
    else if (s.own) M = sampleOwn(s, dt, p, R, h, L);
    if (M) { s.last = M; s.mw = Math.min(1, s.mw + (dt > 0 ? dt / BLEND_IN : 0)); s.wasMotion = true; }
    else {
      if (s.wasMotion && s.last) {                                         // motion over: the feet start where it left them
        F.forEach(f => { const A = s.last[f.sd < 0 ? "leftAnkle" : "rightAnkle"]; if (A) { f.x = A.x; f.y = A.y; f.planted = true; f.sw = null; f.liftT = s.t; } });
        s.wasMotion = false;
      }
      s.mw = Math.max(0, s.mw - (dt > 0 ? dt / BLEND_OUT : 0));
      if (s.mw === 0) s.last = null;
    }
    if (s.mw > 0 && s.last) for (const n in s.last) J[n] = s.mw >= 1 ? { ...s.last[n] } : lerp3(J[n] || s.last[n], s.last[n], smooth(s.mw));

    const racket = rk ? { grip: { ...rk.g }, head: add(rk.g, rk.u, RACKET), face: { ...rk.n } } : null;
    return { joints: J, racket, source: s.mw >= 1 ? "motion" : s.mw > 0 ? "blend" : "gait", solver: IK.engine,
             feet: F.map(f => ({ planted: !!f.planted, slid: !!f.slid, toe: toeOf(f, L) })) };
  }

  /* ---------- keyframed motions ---------- */
  const MOTION_NAMES = { nose: "head", root: "pelvis" };   // serve-file names → Pose contract names (others are the same)
  /* The game's own serve playback (pos[i].motion.world, court metres): copied joint for joint. */
  function fromMotionWorld(W, h, L) {
    const J = {};
    for (const n in W) { const k = MOTION_NAMES[n] || n; if (SK.JOINTS.includes(k)) J[k] = { x: W[n].x, y: W[n].y, z: W[n].z }; }
    return complete(J, h, L);
  }
  /* Joints a motion file doesn't have (chest, toes) come from the ones it does. */
  function complete(J, h, L) {
    if (!J.chest && J.pelvis && J.neck) J.chest = lerp3(J.pelvis, J.neck, (SK.RATIO.chest - (L.hipZ / L.H)) / (SK.RATIO.trunk + SK.RATIO.neck));
    const a = footGeom(L).a;
    for (const s of ["left", "right"]) if (!J[s + "Toe"] && J[s + "Ankle"]) {
      const A = J[s + "Ankle"]; J[s + "Toe"] = { x: A.x + h.x * a, y: A.y + h.y * a, z: Math.max(0, A.z - (L.ankleZ - 0.02)) };
    }
    return J;
  }
  /* Catmull-Rom between the frames around t (same curve as the game's motionPose). Frames hold joints in body
     heights: `j: { name: [side, up] }` (the serve files) or `[side, fwd, up]`, or `joints: { name: {x, y, z} }`. */
  function sampleOwn(s, dt, p, R, h, L) {
    const o = s.own, fr = o.m.frames, t0 = fr[0].t || 0, t1 = fr[fr.length - 1].t || 0;
    o.t += dt;
    if (o.t > t1) { if (o.loop && t1 > t0) o.t = t0 + (o.t - t0) % (t1 - t0); else { s.own = null; return null; } }
    let k = 1; while (k < fr.length - 1 && fr[k].t < o.t) k++;
    const a = fr[k - 1] || fr[0], c = fr[k] || fr[0], a0 = fr[Math.max(0, k - 2)], c1 = fr[Math.min(fr.length - 1, k + 1)];
    const u = clamp((o.t - a.t) / ((c.t - a.t) || 1), 0, 1);
    const cr = (q0, q1, q2, q3) => 0.5 * (2 * q1 + (q2 - q0) * u + (2 * q0 - 5 * q1 + 4 * q2 - q3) * u * u + (3 * q1 - q0 - 3 * q2 + q3) * u * u * u);
    const vec = f => { const src = f.joints || f.j || {}, out = {};
      for (const n in src) { const q = src[n]; out[n] = Array.isArray(q) ? (q.length > 2 ? [q[0], q[1], q[2]] : [q[0], 0, q[1]]) : [q.x, q.y, q.z]; }
      return out; };
    const A0 = vec(a0), A = vec(a), C = vec(c), C1 = vec(c1), W = {};
    for (const n in C) {
      const q1 = A[n] || C[n], q2 = C[n], q0 = A0[n] || q1, q3 = C1[n] || q2;
      const side = cr(q0[0], q1[0], q2[0], q3[0]) * o.flip, fwd = cr(q0[1], q1[1], q2[1], q3[1]), upz = cr(q0[2], q1[2], q2[2], q3[2]);
      W[n] = { x: p.x + R * side * L.H, y: p.y + R * fwd * L.H, z: Math.max(0, upz * L.H) };
    }
    return fromMotionWorld(W, h, L);
  }
  /* Play a keyframed motion on player i: a Motion ({ frames, events }) or a bare frame list. It plays unchanged and
     the body blends in and out. Options: { loop, flip } (flip = -1 mirrors left/right). playMotion(i, null) stops. */
  function playMotion(i, frames, opts = {}) {
    const s = st[i] || (st[i] = fresh());
    const m = Array.isArray(frames) ? { frames } : frames;
    if (!m || !m.frames || !m.frames.length) { s.own = null; return false; }
    s.own = { m, t: (m.frames[0].t || 0) - 1e-9, loop: !!opts.loop, flip: opts.flip === -1 ? -1 : 1 };
    return true;
  }

  /* ---------- the frame hook ---------- */
  function update(dt, ctx) {
    if (broken || !ctx || !ctx.pos || !ctx.PLAYERS) return;
    try {
      for (let i = 0; i < ctx.pos.length; i++) if (ctx.PLAYERS[i]) poses[i] = stepPlayer(i, Math.max(0, dt || 0), ctx);
    } catch (e) { broken = true; console.warn("Body animator stopped (the game carries on without it):", e); }
  }
  /* Pose of player i: { joints: { name: {x, y, z} }, racket: { grip, head, face } } in court metres (read-only). */
  const getPose = i => poses[i] || null;

  /* Skeleton view for checking (?body=skeleton): bones over the sprite, on the actor layer. */
  function drawDebug(b, proj, i, px = 1 / 3) {
    const pose = poses[i]; if (!pose) return;
    const J = pose.joints, P = n => J[n] && proj(J[n].x, J[n].y, J[n].z);
    b.save(); b.lineWidth = px; b.lineCap = "round";
    for (const [a, c] of SK.BONES) {
      const A = P(a), C = P(c); if (!A || !C) continue;
      b.strokeStyle = /^left/.test(a) || /^left/.test(c) ? "#58c4ff" : /^right/.test(a) || /^right/.test(c) ? "#ff7a59" : "#f4f6f8";
      b.beginPath(); b.moveTo(A.x, A.y); b.lineTo(C.x, C.y); b.stroke();
    }
    if (pose.racket) { const A = proj(pose.racket.grip.x, pose.racket.grip.y, pose.racket.grip.z), C = proj(pose.racket.head.x, pose.racket.head.y, pose.racket.head.z);
      b.strokeStyle = "#d8ee4c"; b.beginPath(); b.moveTo(A.x, A.y); b.lineTo(C.x, C.y); b.stroke(); }
    b.fillStyle = "#d8ee4c";
    for (const f of pose.feet || []) if (f.planted) { const T = proj(f.toe.x, f.toe.y, 0); b.fillRect(T.x - px, T.y - px, 2 * px, 2 * px); }
    b.restore();
  }

  const api = { update, getPose, playMotion, drawDebug, JOINTS: SK.JOINTS, debug: false,
                reset() { st.length = 0; poses.length = 0; broken = false; }, _state: i => st[i] };
  root.Body = api; root.getPose = getPose; root.playMotion = playMotion;
  if (typeof location !== "undefined" && typeof document !== "undefined") {
    const q = new URLSearchParams(location.search).get("body");
    api.debug = q === "skeleton";
    if (q !== "analytic") IK.load();                                      // three.js CCDIKSolver, in the background
  }
})(typeof window !== "undefined" ? window : globalThis);
