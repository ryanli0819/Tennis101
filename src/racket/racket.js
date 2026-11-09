// =====================================================================
// RACKET — where the racket is and how it is drawn. Owner: Racket Coach (agents/racket-coach/).
//
// Moved out of index.html unchanged (same names, plain script, globals): RACKET, drawRacket,
// SLICE_END, poseTrack, racketPose. They are only called from index.html's frame loop, so they use its
// globals at call time (proj, CAM_X/CAM_BACK/CAM_H, b, AS, q, V3, PLAYERS, rally, clock, S, ROUTINE,
// ball, input). Tests: tests/racket.test.mjs.
// =====================================================================
/* The racket is a real object in court space: grip point, shaft direction u, string-face normal n.
   Projected like the court, so its length, angle and how "open" the face looks are right from any camera:
   face-on = a full oval with strings, edge-on = a thin line. (ox, oy) shifts it with the body's bob/crouch. */
const RACKET = { len: 0.685, handle: 0.2, headL: 0.33, headW: 0.26 };
function drawRacket(grip, u, n, look, ox = 0, oy = 0) {
  const at = t => ({ x: grip.x + u.x * t, y: grip.y + u.y * t, z: grip.z + u.z * t });
  const pp = w => { const r = proj(w.x, w.y, w.z); return { x: r.x + ox, y: r.y + oy, s: r.s }; };
  const c = at(RACKET.len - RACKET.headL / 2), top = pp(at(RACKET.len)), bot = pp(at(RACKET.len - RACKET.headL)), hc = pp(c);
  const g0 = pp(at(-0.03)), g1 = pp(at(RACKET.handle)), s = hc.s;
  const camz = { x: CAM_X, y: -CAM_BACK, z: CAM_H }, vd = V3.norm({ x: c.x - camz.x, y: c.y - camz.y, z: c.z - camz.z });
  const open = Math.abs(n.x * vd.x + n.y * vd.y + n.z * vd.z);          // 1 = strings face the camera, 0 = edge-on
  const major = Math.max(1 / AS, Math.hypot(top.x - bot.x, top.y - bot.y) / 2);
  const minor = Math.max(0.6 / AS, RACKET.headW / 2 * s * open);
  const rot = Math.atan2(top.y - bot.y, top.x - bot.x), lw = Math.max(1 / AS, 0.024 * s);
  b.lineCap = "round";
  b.strokeStyle = "#2b2b31"; b.lineWidth = Math.max(1 / AS, 0.04 * s);  // grip (tape)
  b.beginPath(); b.moveTo(g0.x, g0.y); b.lineTo(g1.x, g1.y); b.stroke();
  b.fillStyle = look.accent; b.fillRect(q(g0.x) - 0.5 / AS, q(g0.y) - 0.5 / AS, 1 / AS, 1 / AS);   // butt cap
  const nx = Math.cos(rot + Math.PI / 2) * minor * 0.8, ny = Math.sin(rot + Math.PI / 2) * minor * 0.8;
  b.strokeStyle = look.frame; b.lineWidth = lw;                          // throat: the open V into the head
  b.beginPath(); b.moveTo(g1.x, g1.y); b.lineTo(bot.x + nx, bot.y + ny); b.moveTo(g1.x, g1.y); b.lineTo(bot.x - nx, bot.y - ny); b.stroke();
  b.save(); b.translate(hc.x, hc.y); b.rotate(rot);
  b.beginPath(); b.ellipse(0, 0, major, minor, 0, 0, Math.PI * 2);
  if (minor > 1.5 / AS) {                                                // strings: a pale bed with a cross-hatch
    b.fillStyle = "rgba(236,236,226,0.22)"; b.fill();
    b.save(); b.clip(); b.strokeStyle = "rgba(246,246,238,0.6)"; b.lineWidth = 1 / AS; b.beginPath();
    for (let k = -3; k <= 3; k++) { const yy = k * minor / 3.6; b.moveTo(-major, yy); b.lineTo(major, yy); }
    for (let k = -4; k <= 4; k++) { const xx = k * major / 4.6; b.moveTo(xx, -minor); b.lineTo(xx, minor); }
    b.stroke(); b.restore();
  }
  b.strokeStyle = look.frame; b.lineWidth = lw; b.beginPath(); b.ellipse(0, 0, major, minor, 0, 0, Math.PI * 2); b.stroke();
  b.strokeStyle = look.accent; b.lineWidth = Math.max(1 / AS, lw * 0.5);  // a painted accent along the top of the frame
  b.beginPath(); b.ellipse(0, 0, major, minor, 0, -0.55, 0.55); b.stroke();
  b.restore();
}

/* Where the racket is: ready position, backswing as the ball comes, contact, follow-through; forehand on the
   racket side, two-handed backhand on the other; overhead for a serve; SLICE high-back to low-front.
   In player space: dx = to their right, dy = forward (toward the net), z = height.
   Owners: Racket Coach (agents/racket-coach/) for the swing paths, Animator for the body.
   TIMING: the swing is keyed to the time until contact (ttc), so the racket meets the ball on the beat:
   unit turn ~1.1 s out, racket back by ~0.45 s, forward swing in the last ~0.2 s, contact, follow-through.
   Poses are joined by a Catmull-Rom spline (pose track), so a stroke is one flowing motion, not stop-start blends.
   SLICE CLOCK (seen from behind the player): the racket top starts at ~2 o'clock (high and back) and finishes
   at SLICE_END o'clock (low and in front), 10 → 8/7 on the backhand side; shoulders tilt with the swing. */
const SLICE_END = { sinner: 4, alcaraz: 5 };              // Sinner finishes higher and shorter, Alcaraz lower and longer
function poseTrack(keys, t) {                              // keys: [[time, pose], ...] sorted by time
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let k = 0; while (t > keys[k + 1][0]) k++;
  const u = (t - keys[k][0]) / (keys[k + 1][0] - keys[k][0]);
  const P = [keys[Math.max(0, k - 1)][1], keys[k][1], keys[k + 1][1], keys[Math.min(n - 1, k + 2)][1]];
  const cr = (a, b1, c, d) => 0.5 * (2 * b1 + (c - a) * u + (2 * a - 5 * b1 + 4 * c - d) * u * u + (3 * b1 - a - 3 * c + d) * u * u * u);
  const v = f => ({ x: cr(...P.map(p => p[f].x)), y: cr(...P.map(p => p[f].y)), z: cr(...P.map(p => p[f].z)) });
  const num = f => cr(...P.map(p => p[f] || 0));
  return { g: v("g"), u: V3.norm(v("u")), n: V3.norm(v("n")), tilt: num("tilt"), crouch: num("crouch"),
           throat: u < 0.5 ? P[1].throat : P[2].throat, slice: P[1].slice || P[2].slice };
}
function racketPose(i, p, ago = 0) {
  const R = PLAYERS[i].side === "near" ? 1 : -1;        // near player's right is +x and forward is +y; far is the mirror
  const W = (dx, dy, z) => ({ x: p.x + R * dx, y: p.y + R * dy, z });
  const D = (dx, dy, dz) => V3.norm({ x: R * dx, y: R * dy, z: dz });
  const clk = (c, fwd) => D(Math.sin(c * Math.PI / 6), fwd, Math.cos(c * Math.PI / 6));   // racket top pointing at c o'clock
  const hz = Math.max(0.45, Math.min(1.75, p.hitZ ?? 1.0));                              // contact height of the last ball
  const se = SLICE_END[PLAYERS[i].id] ?? 4.5;
  const POSE = {
    ready:  p.receiving
          ? { g: W(0.22, 0.42, 0.8), u: D(0.12, 0.62, 0.78), n: D(0.9, 0, -0.1), throat: true }   // return stance: racket out in front, head up, both hands on it
          : { g: W(0.40, 0.18, 0.96), u: D(0.34, 0.30, 0.89), n: D(0.6, -0.8, 0), throat: true },  // head up beside the right side, strings toward the back
    fhBack: { g: W(0.55, -0.15, 1.15), u: D(0.45, -0.55, 0.62), n: D(0, 1, 0.35) },
    fhLoop: { g: W(0.62, -0.25, 0.85), u: D(0.55, -0.70, -0.20), n: D(0, 1, 0.1) },                 // racket drops below the ball before the swing up
    fhHit:  { g: W(0.60, 0.40, hz), u: D(0.90, 0.45, 0.10), n: D(0, 1, 0) },
    fhEnd:  { g: W(-0.35, 0.15, 1.55), u: D(-0.35, -0.60, 0.72), n: D(0.7, 0, 0.3) },
    bhBack: { g: W(-0.50, -0.10, 1.15), u: D(-0.50, -0.55, 0.62), n: D(0, 1, 0.35) },
    bhLoop: { g: W(-0.58, -0.22, 0.85), u: D(-0.55, -0.70, -0.20), n: D(0, 1, 0.1) },
    bhHit:  { g: W(-0.55, 0.40, hz), u: D(-0.90, 0.45, 0.10), n: D(0, 1, 0) },
    bhEnd:  { g: W(0.35, 0.15, 1.55), u: D(0.35, -0.60, 0.72), n: D(-0.7, 0, 0.3) },
    // SLICE: open face (strings tilted up), high back → contact → low in front, shoulders tilting through it
    fsBack: { g: W(0.50, -0.20, 1.50), u: clk(2, -0.08), n: D(0, 0.55, 0.85), tilt: -0.06, crouch: 0.01, slice: true },
    fsHit:  { g: W(0.60, 0.40, hz), u: clk(3, 0.12), n: D(0, 0.6, 0.8), tilt: 0.025, crouch: 0.045, slice: true },
    fsEnd:  { g: W(0.30, 0.70, Math.max(0.55, hz - 0.35)), u: clk(se, 0.08), n: D(0, 0.3, 0.95), tilt: 0.07, crouch: 0.07, slice: true },
    bsBack: { g: W(-0.50, -0.20, 1.50), u: clk(10, -0.08), n: D(0, 0.55, 0.85), tilt: 0.06, crouch: 0.01, slice: true },
    bsHit:  { g: W(-0.60, 0.40, hz), u: clk(9, 0.12), n: D(0, 0.6, 0.8), tilt: -0.025, crouch: 0.045, slice: true },
    bsEnd:  { g: W(-0.30, 0.70, Math.max(0.55, hz - 0.35)), u: clk(12 - se, 0.08), n: D(0, 0.3, 0.95), tilt: -0.07, crouch: 0.07, slice: true },
    // SERVE: trophy (racket up behind), racket drop (head down the back), contact high, follow through across
    trophy: { g: W(0.40, -0.10, 1.50), u: D(0.25, -0.45, -0.55), n: D(1, 0, 0), tilt: -0.04 },
    drop:   { g: W(0.30, -0.20, 1.70), u: D(0.15, -0.35, -0.92), n: D(1, 0, 0), tilt: -0.05, crouch: 0.03 },
    srvHit: { g: W(0.15, 0.25, 2.30), u: D(0.05, 0.25, 0.97), n: D(0, 1, 0.1), tilt: -0.02 },
    srvEnd: { g: W(-0.30, 0.25, 0.85), u: D(-0.35, -0.20, -0.90), n: D(0.8, 0, 0.2), tilt: 0.03, crouch: 0.05 },
  };
  const out = (pose, twoHands) => ({ ...pose, twoHands, throat: !twoHands && !!pose.throat });
  const tt = (rally ? clock - (p.hitT ?? -9) : 9) - ago, fh = (p.strokeSide || 1) > 0;
  if (rally && rally.serve && S.server === i && !rally.serve.captured) {          // serve routine: bounce, toss, trophy, drop, hit
    const k = (rally.serve.t - ago - ROUTINE.seconds) / ROUTINE.toss;
    return out(poseTrack([[0, POSE.ready], [0.55, POSE.trophy], [0.86, POSE.drop], [1, POSE.srvHit]], k), false);
  }
  if (p.hitServe && tt >= 0 && tt < 0.8)                                          // serve: contact up high, follow through down across
    return out(poseTrack([[0, POSE.srvHit], [0.3, POSE.srvEnd], [0.8, POSE.ready]], tt), false);
  if (p.strokeType === "slice" && tt >= 0 && tt < 1.0)                            // slice: one long readable sweep, held a moment
    return out(poseTrack(fh ? [[0, POSE.fsHit], [0.36, POSE.fsEnd], [0.52, POSE.fsEnd], [1.0, POSE.ready]]
                            : [[0, POSE.bsHit], [0.36, POSE.bsEnd], [0.52, POSE.bsEnd], [1.0, POSE.ready]], tt), false);
  const [H, E] = fh ? [POSE.fhHit, POSE.fhEnd] : [POSE.bhHit, POSE.bhEnd];
  if (tt >= 0 && tt < 0.8)                                                        // just hit: contact → follow-through → back to ready
    return out(poseTrack([[0, H], [0.26, E], [0.8, POSE.ready]], tt), !fh);
  const sh = rally && rally.shot;
  if (sh && sh.recv === i && !rally.serve && ball) {                              // the ball is coming: swing on the beat of its arrival
    const ttc = sh.t1 + 0.85 * sh.t2 - sh.t + ago;                                // ≈ time left until contact
    const side = (sh.end.x - p.x) * R >= 0;                                       // forehand if it comes to the racket side
    const slice = i === 0 ? (input.keys.has("e") || input.slice) : !!p.planSlice; // you hold E; the computer decided early
    const zc = Math.max(0.45, Math.min(1.75, sh.end.z));
    const set = (pz) => ({ ...pz, g: { ...pz.g, z: zc } });                       // aim the contact pose at the ball's height
    const keys = slice
      ? (side ? [[-1.1, POSE.ready], [-0.45, POSE.fsBack], [-0.2, POSE.fsBack], [0, set(POSE.fsHit)]]
              : [[-1.1, POSE.ready], [-0.45, POSE.bsBack], [-0.2, POSE.bsBack], [0, set(POSE.bsHit)]])
      : (side ? [[-1.1, POSE.ready], [-0.45, POSE.fhBack], [-0.18, POSE.fhLoop], [0, set(POSE.fhHit)]]
              : [[-1.1, POSE.ready], [-0.45, POSE.bhBack], [-0.18, POSE.bhLoop], [0, set(POSE.bhHit)]]);
    return out(poseTrack(keys, -Math.max(-0.02, ttc)), !side && !slice);
  }
  return out(POSE.ready, false);
}
