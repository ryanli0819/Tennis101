/* src/body/skeleton.js — ONE FIXED-LENGTH 3D SKELETON PER PLAYER (Alcaraz, Sinner). Owner: body-motion-engineer.
   Task HQ-20261117-002.PM.1. Standard: skill `human-body-folding-and-foreshortening`.

   Rules this file enforces (skill §1, §2, §4, §5):
   - Bones are rigid. Each bone's 3D length is fixed per player (BONES below); poses change angles, never lengths.
   - Each captured frame is SOLVED onto the skeleton: the root (hip midpoint) comes from the capture, every bone
     takes its direction from the capture, gets its fixed length, and each joint is clamped to its limit
     (src/body/joints.js, swappable). The skeleton wins; how far each joint moved from the capture is logged.
   - Where depth is missing or weak ("image" mode), the image-plane part of a bone is kept and the depth is
     L_2D = L_3D cos θ  →  dz = ±sqrt(L² − L_2D²); the sign is chosen by the joint limits, then the depth hint,
     then continuity with the previous frame.
   - Pelvis and thorax are solved separately (waist rotation = thorax yaw about the spine relative to the pelvis).
   - r2 (RETURN of r1): the pelvis also PITCHES (anterior/posterior tilt), solved with the yaw as the root rotation; hip and
     trunk angles are measured against the pitched pelvis; pelvis.tiltObliquity is a NULL row, so the pitch is not clamped.
   - r2: a leg whose captured ankle is in the air takes its bones' directions from the capture (direction mode) or the cos
     rule (image mode); IK to the captured ankle is kept only for a planted foot (see AIR_LO_M / AIR_HI_M).
   - Hinges (knee, elbow) bend one way: the knee folds toward the back of the thigh, with the kneecap direction set
     by hip rotation, so a sideways/forward knee would need an impossible hip rotation and is clamped.
   - segmentsInDrawOrder(): far-to-near order of limb segments and the torso for any camera, so a folded calf is
     drawn over (after) the thigh when it is nearer, and a far limb behind the torso. Hidden segments are kept.

   Local body coordinates (same as the capture, MOTION_NOTES.md): x = player's right, y = up, z = into the court
   (forward), in METRES (capture body-heights × heightM). Court world (index.html): x across, y along the court,
   z up — fitWorld() converts.
   Works in the browser (window.BodySkeleton) and in node (module.exports). */
(function (root) {
  const BJ = root.BodyJoints || (typeof require === "function" ? require("./joints.js") : null);
  const LIMT = () => BJ && BJ.table;   // effective limits built from datasets/anatomy/joints.json (null until loaded in the browser)
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ---------- the bone table (metres = MEASURED ratio × SOURCED heightM, unless labelled) ----------
     Ratios measured by measureBoneRatios() below over every frame of the player's MediaPipe world-landmark serves on
     main @ 4ba74ac (roster-serves.js: Alcaraz second, 24 frames; Sinner first + second, 61 frames; alcaraz-poetry.js
     is solved but not measured — see src/body/tools/load-motions.mjs measurementClips), using
     only frames where the bone is within 25° of the image plane (|dz|/L ≤ sin 25°), median of the 3D length,
     both sides pooled (one length per bone: left = right). src/body/test/skeleton.test.mjs re-measures and checks
     these numbers. Scale: the clip's own body-height unit (nose-to-ankle ≈ 0.90 H normalisation) × heightM; not
     re-anchored to stature (see BONE_TABLE.md height check). neckNeutralDeg = MEASURED median, same clips. heightM is the value the game uses (index.html PLAYERS @ 4ba74ac), never changed here. */
  const PR42 = "PR #42 BODIES (git show 291918c:src/players/bodies.js), ESTIMATED per datasets/players/BODY_SOURCES.md";
  const SKELETONS = {
    alcaraz: {
      heightM: 1.83, heightLabel: "SOURCED: index.html PLAYERS heightM @ 4ba74ac (ATP official)",
      ratio: { trunk: 0.3333, neck: 0.1446, shoulder: 0.2348, upperArm: 0.16, forearm: 0.156, hand: 0.0559,
               thigh: 0.2683, shank: 0.2546, foot: 0.1015 },
      pelvisM: 0.174, pelvisLabel: "ESTIMATED: " + PR42 + " segments.hipJointSpacingM. Not measured: pose trackers put 'hip' near the outside of the hips (index.html anatomize() note), so the clip width (~0.14 H) is not the femoral-head spacing.",
      neckNeutralDeg: 48.2, ankleNeutralDeg: 68.3,
      radiiM: { thigh: 0.098, shank: 0.0586, upperArm: 0.0494, forearm: 0.0403, hand: 0.03, foot: 0.03, neck: 0.0576, torsoDepth: 0.241 },
    },
    sinner: {
      heightM: 1.91, heightLabel: "SOURCED: index.html PLAYERS heightM @ 4ba74ac (ATP official)",
      ratio: { trunk: 0.3339, neck: 0.1495, shoulder: 0.2096, upperArm: 0.1698, forearm: 0.1627, hand: 0.0474,
               thigh: 0.2611, shank: 0.2457, foot: 0.0997 },
      pelvisM: 0.181, pelvisLabel: "ESTIMATED: " + PR42 + " segments.hipJointSpacingM (same reason as Alcaraz).",
      neckNeutralDeg: 37.0, ankleNeutralDeg: 66.8,
      radiiM: { thigh: 0.0907, shank: 0.0573, upperArm: 0.0497, forearm: 0.0411, hand: 0.03, foot: 0.03, neck: 0.0592, torsoDepth: 0.246 },
    },
  };
  /* radiiM: half of PR #42 proportions × heightM (thighW, calfW, upperArmW, forearmW, neckW) and segments.chestDepthM —
     ESTIMATED (PR #42). hand/foot 0.03 m = GAME-DESIGN (only used to decide overlap for draw order, never drawn here). */

  const BONE_DEFS = [   // name, parent joint (or midpoint), child joint, ratio key
    ["trunk", "hipMid", "shoulderMid", "trunk"], ["neck", "shoulderMid", "nose", "neck"],
    ["pelvis", "leftHip", "rightHip", "pelvis"], ["shoulders", "leftShoulder", "rightShoulder", "shoulder"],
    ["leftUpperArm", "leftShoulder", "leftElbow", "upperArm"], ["rightUpperArm", "rightShoulder", "rightElbow", "upperArm"],
    ["leftForearm", "leftElbow", "leftWrist", "forearm"], ["rightForearm", "rightElbow", "rightWrist", "forearm"],
    ["leftHand", "leftWrist", "leftIndex", "hand"], ["rightHand", "rightWrist", "rightIndex", "hand"],
    ["leftThigh", "leftHip", "leftKnee", "thigh"], ["rightThigh", "rightHip", "rightKnee", "thigh"],
    ["leftShank", "leftKnee", "leftAnkle", "shank"], ["rightShank", "rightKnee", "rightAnkle", "shank"],
    ["leftFoot", "leftAnkle", "leftToe", "foot"], ["rightFoot", "rightAnkle", "rightToe", "foot"],
  ];

  /* SCALE ANCHOR. The clip's body-height unit is not stature (standing nose of the skeleton built from the raw ratios
     would sit at ~0.99 H). The ratios are therefore scaled by one factor k per player so that the standing
     ankle→nose chain (shank + thigh + trunk + neck·cos(neutral)) = 0.90 H — the capture tool's own normalisation,
     "nose-to-ankle ≈ 90% of height" (datasets/serves/tools/export_motion.py:76; ESTIMATED there). Proportions stay
     MEASURED; k is ESTIMATED; heightM is SOURCED. */
  const NOSE_TO_ANKLE_H = 0.90;
  function scaleK(S) { const r = S.ratio; return NOSE_TO_ANKLE_H / (r.shank + r.thigh + r.trunk + r.neck * Math.cos(S.neckNeutralDeg * D2R)); }
  function skeletonFor(id) {
    const S = SKELETONS[id];
    if (!S) return null;
    const H = S.heightM, L = {}, k = scaleK(S);
    for (const key in S.ratio) L[key] = S.ratio[key] * k * H;
    L.pelvis = S.pelvisM;
    const labels = {};
    for (const key in S.ratio) labels[key] = "MEASURED ratio " + S.ratio[key] + " × ESTIMATED scale k " + k.toFixed(4) + " × SOURCED heightM " + H;
    labels.pelvis = S.pelvisLabel;
    return { id, heightM: H, heightLabel: S.heightLabel, scaleK: k, L, labels, neckNeutralDeg: S.neckNeutralDeg, ankleNeutralDeg: S.ankleNeutralDeg, radiiM: S.radiiM, limits: LIMT() };
  }

  /* ---------- vector helpers (arrays [x, y, z]) ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const unit = (a, fb) => { const l = len(a); return l > 1e-9 ? mul(a, 1 / l) : (fb || [0, 1, 0]); };
  const perp = (a, axis) => sub(a, mul(axis, dot(a, axis)));          // part of a perpendicular to unit axis
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const angBetween = (a, b) => Math.acos(clamp(dot(unit(a), unit(b)), -1, 1)) * R2D;
  function rotAbout(v, axis, ang) {                                    // Rodrigues
    const c = Math.cos(ang), s = Math.sin(ang);
    return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
  }
  const UP = [0, 1, 0];
  const smooth01 = x => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  /* Captured ankle height above the court where a foot counts as in the air (GAME-DESIGN): below AIR_LO_M the leg is IK'd to
     the captured ankle (planted foot), above AIR_HI_M each leg bone takes its captured direction, blended in between.
     A standing ankle joint sits ~0.07–0.09 m up (ESTIMATED), a raised heel ~0.12–0.15 m. */
  const AIR_LO_M = 0.15, AIR_HI_M = 0.30;
  const mid = (a, b) => mul(add(a, b), 0.5);

  /* ---------- joint-angle maths (shared by the solver and the checker) ---------- */
  /* Pelvis frame. R = left→right hip. pitchDeg = pelvic tilt about R (+ = anterior: the pelvis's up axis tips forward).
     r1 had no pitch (U = world up ⊥ R). r2 (RETURN fix 1): pitch is part of the root rotation, solved in solveFrame;
     hip and trunk angles are measured against the pitched frame. pelvis.tiltObliquity is a NULL row in
     datasets/anatomy/joints.json, so the pitch has NO clamp; PELVIS_PITCH_MIN/MAX only bound the search (GAME-DESIGN). */
  function pelvisFrame(lh, rh, pitchDeg = 0) {
    const R = unit(sub(rh, lh), [1, 0, 0]);
    const U0 = unit(perp(UP, R), UP), F0 = cross(R, U0), a = (pitchDeg || 0) * D2R;
    const U = pitchDeg ? unit(add(mul(U0, Math.cos(a)), mul(F0, Math.sin(a)))) : U0;
    return { R, U, F: cross(R, U), pitchDeg: pitchDeg || 0 };
  }
  /* Sagittal trunk lean vs an UNPITCHED pelvis frame (deg, + = forward): the quantity fix 1 splits between pelvic tilt
     and thorax.flexionExtension. Measured on the capture's own hip line and shoulder midpoint. */
  function trunkLeanDeg(lh, rh, sm) { const P = pelvisFrame(lh, rh, 0), t = unit(sub(sm, mid(lh, rh))); return Math.atan2(dot(t, P.F), dot(t, P.U)) * R2D; }
  function trunkAngles(t, P) { return { flexion: Math.atan2(dot(t, P.F), dot(t, P.U)) * R2D, sideBend: Math.asin(clamp(dot(t, P.R), -1, 1)) * R2D }; }
  function trunkFromAngles(fl, sb, P) {
    const a = fl * D2R, b = sb * D2R;
    return add(mul(add(mul(P.U, Math.cos(a)), mul(P.F, Math.sin(a))), Math.cos(b)), mul(P.R, Math.sin(b)));
  }
  function thoraxRef(t, P) { return unit(perp(P.R, t), unit(perp([1, 0, 0], t))); }
  function waistRotation(t, Rt, P) { const Rr = thoraxRef(t, P); return Math.atan2(dot(cross(Rr, Rt), t), dot(Rr, Rt)) * R2D; }
  function thoraxFrame(t, Rt) { return { U: t, R: Rt, F: cross(Rt, t) }; }
  // hip: sagittal flexion and abduction of the thigh in the pelvis frame
  function hipAngles(a, P, O) { return { flexion: Math.atan2(dot(a, P.F), -dot(a, P.U)) * R2D, abduction: Math.asin(clamp(dot(a, O), -1, 1)) * R2D }; }
  function hipFromAngles(fl, ab, P, O) {
    const f = fl * D2R, b = ab * D2R;
    return add(mul(add(mul(P.U, -Math.cos(f)), mul(P.F, Math.sin(f))), Math.cos(b)), mul(O, Math.sin(b)));
  }
  function thighRefs(fl, a, P, O) {   // kneecap reference (anterior) and outward reference, both ⊥ thigh
    const f = fl * D2R, r0 = unit(perp(add(mul(P.F, Math.cos(f)), mul(P.U, Math.sin(f))), a));
    const oo = unit(perp(perp(O, a), r0), cross(a, r0));
    return { r0, oo };
  }
  // shoulder: swing (from hanging) + twist
  function shoulderSwing(d, T, O) {
    const down = mul(T.U, -1);
    let axis = cross(down, d);
    if (len(axis) < 1e-6) axis = cross(down, O);
    axis = unit(axis);
    const ang = Math.acos(clamp(dot(down, d), -1, 1));
    return { r0: unit(perp(rotAbout(T.F, axis, ang), d)), oo: unit(perp(rotAbout(O, axis, ang), d)), elevation: ang * R2D };
  }
  const twistOf = (front, r0, oo) => Math.atan2(dot(front, oo), dot(front, r0)) * R2D;
  const fromTwist = (tw, r0, oo) => add(mul(r0, Math.cos(tw * D2R)), mul(oo, Math.sin(tw * D2R)));

  /* All joint angles of a solved pose (local metres). Returns { name: { axis: deg } } with null where undefined. */
  function measureAngles(J, sk, o = {}) {   // o.pelvisPitchDeg: the solved pelvic tilt (not observable from two hip points; 0 for a raw capture)
    const out = {};
    const P = pelvisFrame(J.leftHip, J.rightHip, o.pelvisPitchDeg || 0), hm = mid(J.leftHip, J.rightHip), sm = mid(J.leftShoulder, J.rightShoulder);
    const t = unit(sub(sm, hm)), Rt = unit(perp(sub(J.rightShoulder, J.leftShoulder), t));
    out.trunk = { ...trunkAngles(t, P), rotation: waistRotation(t, Rt, P) };
    out.pelvis = { yawDeg: Math.atan2(P.R[2], P.R[0]) * R2D, pitchDeg: P.pitchDeg };   // reported only: pelvis.axialRotation ESTIMATED and pelvis.tiltObliquity NULL — neither is clamped
    const T = thoraxFrame(t, Rt);
    if (J.nose) { const n = unit(sub(J.nose, sm)); out.neck = { flexion: Math.atan2(dot(n, T.F), dot(n, T.U)) * R2D - sk.neckNeutralDeg, sideBend: Math.asin(clamp(dot(n, T.R), -1, 1)) * R2D }; }
    for (const s of ["left", "right"]) {
      const O = s === "right" ? T.R : mul(T.R, -1), Sh = J[s + "Shoulder"], El = J[s + "Elbow"], Wr = J[s + "Wrist"];
      const d = unit(sub(El, Sh)), f = unit(sub(Wr, El));
      const sw = shoulderSwing(d, T, O), flex = angBetween(d, f), fr = perp(f, d);
      const tw = (flex >= 20 && sw.elevation < 165 && len(fr) > 1e-6) ? twistOf(unit(fr), sw.r0, sw.oo) : null;
      out[s + "Shoulder"] = { extensionBehind: Math.asin(clamp(Math.max(0, -dot(d, T.F)), 0, 1)) * R2D, adductionAcross: Math.asin(clamp(Math.max(0, -dot(d, O)), 0, 1)) * R2D, elevation: sw.elevation, rotation: tw };
      out[s + "Elbow"] = { flexion: flex };
      if (J[s + "Index"]) out[s + "Wrist"] = { total: angBetween(f, sub(J[s + "Index"], Wr)) };
      const Oh = s === "right" ? P.R : mul(P.R, -1), Hp = J[s + "Hip"], Kn = J[s + "Knee"], An = J[s + "Ankle"];
      const a = unit(sub(Kn, Hp)), sh = unit(sub(An, Kn)), ha = hipAngles(a, P, Oh), kf = angBetween(a, sh);
      const refs = thighRefs(ha.flexion, a, P, Oh), back = perp(sh, a);
      const htw = (kf >= 15 && len(back) > 1e-6) ? twistOf(mul(unit(back), -1), refs.r0, refs.oo) : null;
      out[s + "Hip"] = { ...ha, rotation: htw };
      out[s + "Knee"] = { flexion: kf };
      if (J[s + "Toe"]) out[s + "Ankle"] = { shankFootAngle: angBetween(sh, sub(J[s + "Toe"], An)) };
    }
    return out;
  }

  /* Limit ranges as [lo, hi] per measured axis, from the effective table (src/body/joints.js ← datasets/anatomy/joints.json).
     hand: "R" | "L" — the dominant (racket) shoulder gets the server ER (105.4, garret_2024_meta).
     Conventions (joints.json `convention`): anatomical position = 0; shoulder rotation 0 = forearm pointing anterior at 90°
     abduction, elbow 90°, + = external (forearm toward the head) — our swing-twist equals this at 90° abduction.
     Rows that cannot be measured from joint points are listed in UNOBSERVED (not solved, not clamped). */
  const UNOBSERVED = {
    "forearm.pronationSupination": "needs the hand/racket plane; the capture has only wrist and index points — not solved, not clamped",
    "wrist.flexionExtension": "flexion and deviation cannot be separated from wrist→index alone; the total hand-forearm angle is held ≤ max(|flex/ext|, |radial/ulnar|) of the two SOURCED rows (80°)",
    "wrist.radialUlnarDeviation": "see wrist.flexionExtension (combined cone)",
    "ankle.inversionEversion": "ESTIMATED row; needs foot width (heel/toe of one foot give no inversion axis reliably) — not solved, not clamped",
    "neck.axialRotation": "needs a face plane; one nose point gives no head yaw — not solved, not clamped",
    "pelvis.axialRotation": "ESTIMATED row (pelvis vs ground/feet). The pelvis is the free root; its yaw is measured and reported, NOT clamped (clamping it would re-solve the feet on the ground) — known gap",
    "pelvis.tiltObliquity": "null row: NO clamp. Pelvic tilt is not observable from two hip points, so r2 SOLVES the sagittal tilt (pitch) as part of the root rotation (solveFrame: split prior + search, GAME-DESIGN) and reports it per frame (angles.pelvis.pitchDeg, result.pelvisPitchDeg); obliquity is not solved",
    "shoulder.horizontalAbductionAdduction": "null row: NO clamp",
    "knee.flexionExtension(min)": "hyperextension (−1°) is not observable from three points (angle 0..180); only the flexion max is enforced",
    "elbow.flexionExtension(min)": "hyperextension (−0.8°) not observable from three points; only the flexion max is enforced",
  };
  function ranges(T, hand, sk) {
    T = T || LIMT();
    const ankN = sk && sk.ankleNeutralDeg != null ? sk.ankleNeutralDeg : 90;
    const R = k => T.rows[k], mm = k => [R(k).minDeg, R(k).maxDeg];
    const er = T.dominantShoulderER ? T.dominantShoulderER.deg : R("shoulder.internalExternalRotation").maxDeg;
    const fe = R("shoulder.flexionExtension"), aa = R("shoulder.abductionAdduction"), wr1 = R("wrist.flexionExtension"), wr2 = R("wrist.radialUlnarDeviation");
    const shoulder = dom => ({ extensionBehind: [0, -fe.minDeg], adductionAcross: [0, -aa.minDeg], elevation: [0, Math.max(fe.maxDeg, aa.maxDeg)],
      rotation: [R("shoulder.internalExternalRotation").minDeg, dom ? er : R("shoulder.internalExternalRotation").maxDeg] });
    const ank = R("ankle.dorsiPlantarflexion");
    const tl = R("thorax.lateralFlexion"), nl = R("neck.lateralFlexion");
    const dom = (hand || "R") === "L" ? "left" : "right";
    return {
      dominant: dom,
      trunk: { flexion: mm("thorax.flexionExtension"), sideBend: [tl.minDeg, tl.maxDeg], rotation: mm("thorax.axialRotation") },
      neck: { flexion: mm("neck.flexionExtension"), sideBend: [nl.minDeg, nl.maxDeg] },
      leftShoulder: shoulder(dom === "left"), rightShoulder: shoulder(dom === "right"),
      elbow: { flexion: [Math.min(0, R("elbow.flexionExtension").minDeg), R("elbow.flexionExtension").maxDeg] },
      wrist: { total: [0, Math.max(-wr1.minDeg, wr1.maxDeg, -wr2.minDeg, wr2.maxDeg)] },
      hip: { flexion: mm("hip.flexionExtension"), abduction: mm("hip.abductionAdduction"), rotation: mm("hip.internalExternalRotation") },
      knee: { flexion: [Math.min(0, R("knee.flexionExtension").minDeg), R("knee.flexionExtension").maxDeg] },
      ankle: { shankFootAngle: [ankN - ank.maxDeg, ankN - ank.minDeg] },   // dorsiflexion = neutral − angle (MEASURED neutral)
    };
  }
  const kindOf = n => /Shoulder$/.test(n) ? n : n.replace(/^(left|right)/, "").replace(/^./, c => c.toLowerCase());
  function violations(angles, rg, tol = 1e-6) {
    const v = [];
    for (const n in angles) { const R = rg[kindOf(n)]; if (!R) continue;
      for (const ax in angles[n]) { const val = angles[n][ax], r = R[ax]; if (val == null || !r) continue;
        if (val < r[0] - tol || val > r[1] + tol) v.push({ joint: n, axis: ax, value: val, range: r }); } }
    return v;
  }

  /* ---------- the solver ---------- */
  /* dirFor: one bone's direction candidates. "direction" mode keeps the captured 3D direction. "image" mode keeps
     the image-plane (x, y) part and solves depth by the cos rule (two signs when foreshortened). */
  function candidates(v, Lb, mode) {
    if (mode !== "image" || v[2] == null) return [{ d: unit([v[0], v[1], v[2] || 0]), hint: 0 }];
    const d2 = Math.hypot(v[0], v[1]);
    if (d2 >= Lb) return [{ d: [v[0] / d2, v[1] / d2, 0], hint: 0 }];
    const dz = Math.sqrt(Lb * Lb - d2 * d2);
    const hint = Math.abs(v[2]) > 1e-9 ? Math.sign(v[2]) : 0;
    return [{ d: [v[0] / Lb, v[1] / Lb, dz / Lb], sign: 1, hint }, { d: [v[0] / Lb, v[1] / Lb, -dz / Lb], sign: -1, hint }];
  }
  /* Choose among candidates: least clamping (degrees) → depth-hint sign → previous frame's sign → +. */
  function pick(cands, cost, prevSign) {
    if (cands.length === 1) { const c = { ...cands[0], ...cost(cands[0].d) }; return { ...c, all: [{ sign: c.sign || 0, hint: c.hint || 0, clampDeg: c.clampDeg }], why: "single" }; }
    const r = cands.map(c => ({ ...c, ...cost(c.d) }));
    r.sort((A, B) => {
      if (Math.abs(A.clampDeg - B.clampDeg) > 1) return A.clampDeg - B.clampDeg;
      const h = A.hint || 0;
      if (h) return (B.sign === h) - (A.sign === h);
      if (prevSign) return (B.sign === prevSign) - (A.sign === prevSign);
      return B.sign - A.sign;
    });
    // why the winner won (depth-sign audit, RETURN fix 2): "clamp" = the other sign clamps > 1° more; else hint / prev / default
    const w = r[0], o = r[1], why = Math.abs(w.clampDeg - o.clampDeg) > 1 ? "clamp" : (w.hint ? "hint" : (prevSign ? "prev" : "default"));
    return { ...w, all: r.map(c => ({ sign: c.sign, hint: c.hint || 0, clampDeg: c.clampDeg })), why };
  }

  /* Two-bone IK with fixed lengths (skill §1: solve angles, never stretch): the middle joint sits in the plane of
     (root, target, captured middle joint). If the target is out of reach the limb straightens toward it. */
  function ik2(P, L1, L2, T, pole, fbPole) {
    const v = sub(T, P); let d = len(v); const a = unit(v, [0, -1, 0]);
    d = clamp(d, Math.abs(L1 - L2) + 1e-9, L1 + L2 - 1e-9);
    const u = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - u * u));
    let w = pole ? perp(sub(pole, P), a) : [0, 0, 0]; if (len(w) < 1e-6) w = perp(fbPole, a); w = unit(w, unit(perp([0, 0, 1], a)));
    return add(P, add(mul(a, u), mul(w, h)));
  }
  /* solveFrame(cap, sk, opts) — cap: { joint: [x, y, z|null] } in local METRES.
     opts: { mode: "direction" | "image", server: true, prev: previous solve result (continuity) }.
     Returns { joints, angles, clamps: [{ joint, axis, captured, solved }], moved: { joint: metres }, signs }. */
  /* In image mode the pelvis and shoulder-line depth signs have no joint of their own, so the frame is solved for each
     sign pair. With a depth hint (captured or game z) the hinted signs win. Without one (2D clips) the pair with the
     least total clamping wins (skill §4 step 4: re-solve with the other depth sign); within 5° the previous frame decides. */
  /* PELVIS YAW IS SOLVED, not copied. The capture's hip line is noisy (and on Alcaraz's poetry trophy it was hand-set
     side-on while the knees point into the court, which reads as 60°+ hip abduction). The pelvis is turned about the
     vertical through the hip midpoint by δ ∈ PELVIS_YAW_TRIES and the solve with the lowest cost wins:
     cost = total clamping (deg) + YAW_COST_PER_M × mean joint displacement from the capture (m) + |δ| × YAW_COST_PER_DEG.
     The weights are GAME-DESIGN (1 cm of displacement ≈ 1° of clamping; 0.05 per degree of turn so ties keep the capture). */
  const PELVIS_YAW_TRIES = [0, -10, 10, -20, 20, -30, 30, -45, 45, -60, 60], YAW_COST_PER_M = 100, YAW_COST_PER_DEG = 0.05;
  /* PELVIS PITCH IS SOLVED TOO (r2, RETURN fix 1). Two hip points give no pelvic tilt, so it is a free part of the root
     rotation, like the yaw. Rule (GAME-DESIGN, stated in JOINT_LIMITS.md):
     - split prior: the capture's sagittal trunk lean λ (shoulder midpoint vs hip midpoint, against an upright pelvis) is
       split PITCH_SPLIT = 0.5 to the pelvis (θ0 = 0.5 λ) and the rest to thorax.flexionExtension (trunk vs pitched pelvis);
     - search: after the yaw search, θ = θ0 + PITCH_OFFSETS and θ_prev + steps are tried at the winning yaw and at yaw 0, same cost as
       the yaw plus |θ − θ0| × PITCH_COST_PER_DEG, so the pelvis tips only where that cuts clamping clearly (e.g. a back leg
       past hip extension) and drifts back to the split prior otherwise;
     - no snapping (skill §2): with a previous frame, |θ − θ_prev| ≤ PITCH_RATE_DEG_S × dt (dt from the frame times; 5° per
       frame if unknown);
     - θ stays within PELVIS_PITCH_MIN..MAX (search bound only; pelvis.tiltObliquity is a NULL row: NO clamp, not a limit). */
  const PITCH_SPLIT = 0.5, PITCH_OFFSETS = [-20, -10, -5, 5, 10, 20, 30, 40], PITCH_COST_PER_DEG = 0.25, PITCH_RATE_DEG_S = 300, PELVIS_PITCH_MIN = -30, PELVIS_PITCH_MAX = 60;
  function solveFrame(cap, sk, opts = {}) {
    const lh = cap.leftHip, rh = cap.rightHip, z0 = p => [p[0], p[1], p[2] || 0];
    const smC = cap.leftShoulder && cap.rightShoulder ? mid(z0(cap.leftShoulder), z0(cap.rightShoulder)) : null;
    const lean = smC ? trunkLeanDeg(z0(lh), z0(rh), smC) : 0;
    const theta0 = opts.pelvisPitchDeg != null ? opts.pelvisPitchDeg : clamp(PITCH_SPLIT * lean, PELVIS_PITCH_MIN, PELVIS_PITCH_MAX);
    const fin = r => { r.trunkLeanCapturedDeg = lean; r.pelvisPitchPriorDeg = theta0; return r; };
    if (opts.noYawSearch) return fin(Object.assign(solveFrameSigns(cap, sk, { ...opts, pelvisPitchDeg: theta0 }), { pelvisYawSolvedDeg: 0 }));
    let best = null;
    const prevPitch = opts.prev && opts.prev.pelvisPitchDeg != null ? opts.prev.pelvisPitchDeg : null;
    const dt = opts.t != null && opts.prev && opts.prev.t != null ? Math.abs(opts.t - opts.prev.t) : null;
    const maxStep = prevPitch == null ? Infinity : (dt != null && dt > 0 ? Math.max(0.5, PITCH_RATE_DEG_S * dt) : 5);
    const lim = th => prevPitch == null ? th : clamp(th, prevPitch - maxStep, prevPitch + maxStep);
    const th1 = clamp(lim(theta0), PELVIS_PITCH_MIN, PELVIS_PITCH_MAX);
    const tryOne = (dDeg, pitch) => {
      let c2 = cap;
      if (dDeg) {
        const a = dDeg * D2R, cx = (lh[0] + rh[0]) / 2, cz = ((lh[2] || 0) + (rh[2] || 0)) / 2, rot = p => p && [cx + (p[0] - cx) * Math.cos(a) + ((p[2] || 0) - cz) * Math.sin(a), p[1], p[2] == null ? null : cz - (p[0] - cx) * Math.sin(a) + ((p[2] || 0) - cz) * Math.cos(a)];
        c2 = { ...cap, leftHip: rot(lh), rightHip: rot(rh) };
        if (lh[2] == null) { c2.leftHip[2] = null; c2.rightHip[2] = null; }   // 2D clips: only the image-plane part turns
      }
      const r = solveFrameSigns(c2, sk, { ...opts, pelvisPitchDeg: pitch });
      let mv = 0, n = 0; for (const k in r.joints) { const C = cap[k]; if (!C) continue; mv += Math.hypot(r.joints[k][0] - C[0], r.joints[k][1] - C[1], C[2] == null ? 0 : r.joints[k][2] - C[2]); n++; }
      r.pelvisYawSolvedDeg = dDeg;
      r.cost = r.clamps.reduce((a, c) => a + Math.abs(c.captured - c.solved), 0) + YAW_COST_PER_M * mv / Math.max(1, n) + Math.abs(dDeg) * YAW_COST_PER_DEG + Math.abs(pitch - theta0) * PITCH_COST_PER_DEG;
      if (!best || r.cost < best.cost - 1e-9) best = r;
    };
    for (const dDeg of PELVIS_YAW_TRIES) tryOne(dDeg, th1);
    // the pitch only changes angles measured in the pelvis frame (hips, trunk): with none of those clamped and θ already at
    // the prior, no other θ can lower the cost, so the search is skipped (speed; same result)
    const pitchMatters = best.clamps.some(c => /Hip$|^trunk$/.test(c.joint)) || Math.abs(th1 - theta0) > 1e-9;
    if (!opts.noPitchSearch && pitchMatters) { const y = best.pelvisYawSolvedDeg;
      const ths = new Set(PITCH_OFFSETS.map(o => theta0 + o));
      if (prevPitch != null) for (const f of [-1, -0.5, 0, 0.5, 1]) ths.add(prevPitch + f * Math.min(maxStep, 40));
      for (const yy of y ? [y, 0] : [0]) for (const th0 of ths) { const th = clamp(lim(th0), PELVIS_PITCH_MIN, PELVIS_PITCH_MAX); if (Math.abs(th - th1) > 1e-9) tryOne(yy, th); } }
    fin(best);
    // moved is always measured against the ORIGINAL capture
    for (const k in best.joints) { const C = cap[k]; if (!C) continue; best.moved[k] = { xy: Math.hypot(best.joints[k][0] - C[0], best.joints[k][1] - C[1]), xyz: C[2] == null ? null : Math.hypot(best.joints[k][0] - C[0], best.joints[k][1] - C[1], best.joints[k][2] - C[2]) }; }
    return best;
  }
  function solveFrameSigns(cap, sk, opts = {}) {
    if (opts.mode !== "image" || opts._forced) return solveFrameOnce(cap, sk, opts);
    const prev = opts.prev, tries = [];
    for (const ps of [1, -1]) for (const ss of [1, -1]) {
      const r = solveFrameOnce(cap, sk, { ...opts, _forced: true, forcePelvis: ps, forceShoulders: ss, _front: undefined });
      r.clampSum = r.clamps.reduce((a, c) => a + Math.abs(c.captured - c.solved), 0);
      const hp = cap.leftHip && cap.rightHip && cap.leftHip[2] != null && cap.rightHip[2] != null ? Math.sign(cap.rightHip[2] - cap.leftHip[2]) : 0;
      const hs = cap.leftShoulder && cap.rightShoulder && cap.leftShoulder[2] != null && cap.rightShoulder[2] != null ? Math.sign(cap.rightShoulder[2] - cap.leftShoulder[2]) : 0;
      r.pref = (hp ? (r.signs.pelvis === hp) : (prev ? r.signs.pelvis === prev.signs.pelvis : r.signs.pelvis > 0)) * 2 + (hs ? (r.signs.shoulders === hs) : (prev ? r.signs.shoulders === prev.signs.shoulders : r.signs.shoulders > 0));
      tries.push(r);
    }
    const hinted = cap.leftHip && cap.leftHip[2] != null && cap.rightHip && cap.rightHip[2] != null;
    if (hinted) {   // the capture (or the game) has a depth for the hips/shoulders: its sign wins; clamping does the rest
      tries.sort((a, b) => b.pref - a.pref || a.clampSum - b.clampSum); return tries[0];
    }
    const best = Math.min(...tries.map(r => r.clampSum));
    const near = tries.filter(r => r.clampSum <= best + 5).sort((a, b) => b.pref - a.pref || a.clampSum - b.clampSum);
    return near[0];
  }
  function solveFrameOnce(cap, sk, opts = {}) {
    const mode = opts.mode || "direction", prev = opts.prev || null, L = sk.L, rg = ranges(sk.limits || LIMT(), opts.hand, sk);
    const clamps = [], signs = {}, J = {}, legSolve = {}, picks = {}; let front = null;
    const prevSign = k => prev && prev.signs ? prev.signs[k] : 0;
    const note = (joint, axis, captured, solved) => { if (Math.abs(captured - solved) > 1e-9) clamps.push({ joint, axis, captured, solved }); };
    const cl = (joint, axis, v, r) => { const c = clamp(v, r[0], r[1]); note(joint, axis, v, c); return c; };
    const get = n => cap[n] ? [cap[n][0], cap[n][1], cap[n][2] == null ? null : cap[n][2]] : null;
    const vec = (a, b) => { const A = get(a), B = get(b); if (!A || !B) return null; return [B[0] - A[0], B[1] - A[1], (A[2] == null || B[2] == null) ? (mode === "image" ? 0 : 0) : B[2] - A[2]]; };
    const hasZ = n => cap[n] && cap[n][2] != null;
    const imgVec = (a, b) => { const v = vec(a, b); if (!v) return null; if (mode === "image" && !(hasZ(a) && hasZ(b))) v[2] = 0; return v; };

    // 1. ROOT: hip midpoint from the capture; pelvis direction (free yaw, the root's own rotation)
    const lh0 = get("leftHip"), rh0 = get("rightHip");
    const c = mid([lh0[0], lh0[1], lh0[2] || 0], [rh0[0], rh0[1], rh0[2] || 0]);
    const forceC = (cands, f) => f && cands.length > 1 ? cands.filter(c => c.sign === f) : cands;
    const pc = pick(forceC(candidates(imgVec("leftHip", "rightHip"), L.pelvis, mode), opts.forcePelvis), () => ({ clampDeg: 0 }), prevSign("pelvis"));
    signs.pelvis = pc.sign || 0;
    J.leftHip = sub(c, mul(pc.d, L.pelvis / 2)); J.rightHip = add(c, mul(pc.d, L.pelvis / 2));
    const P = pelvisFrame(J.leftHip, J.rightHip, opts.pelvisPitchDeg || 0);

    // 2. TRUNK (spine): flexion / side bend in the pelvis frame
    const smCap = mid(get("leftShoulder"), get("rightShoulder"));
    const tv = sub(smCap.map((x, k) => (x == null || isNaN(x)) ? 0 : x), c);
    if (mode === "image" && !(hasZ("leftShoulder") && hasZ("rightShoulder"))) tv[2] = 0;
    const trunkCost = d => { const a = trunkAngles(d, P), r = rg.trunk;
      return { clampDeg: Math.max(0, r.flexion[0] - a.flexion, a.flexion - r.flexion[1]) + Math.max(0, Math.abs(a.sideBend) - r.sideBend[1]) }; };
    const tc = pick(candidates(tv, L.trunk, mode), trunkCost, prevSign("trunk")); signs.trunk = tc.sign || 0;
    const ta = trunkAngles(tc.d, P);
    const t = unit(trunkFromAngles(cl("trunk", "flexion", ta.flexion, rg.trunk.flexion), cl("trunk", "sideBend", ta.sideBend, rg.trunk.sideBend), P));
    const sm = add(c, mul(t, L.trunk));

    // 3. THORAX: waist rotation about the spine relative to the pelvis (X-factor), clamped
    const sc = pick(forceC(candidates(imgVec("leftShoulder", "rightShoulder"), L.shoulder, mode), opts.forceShoulders), () => ({ clampDeg: 0 }), prevSign("shoulders"));
    signs.shoulders = sc.sign || 0;
    let Rt = perp(sc.d, t); Rt = len(Rt) > 1e-6 ? unit(Rt) : thoraxRef(t, P);
    const rot = cl("trunk", "rotation", waistRotation(t, Rt, P), rg.trunk.rotation), Rr = thoraxRef(t, P);
    Rt = unit(add(mul(Rr, Math.cos(rot * D2R)), mul(cross(t, Rr), Math.sin(rot * D2R))));
    J.leftShoulder = sub(sm, mul(Rt, L.shoulder / 2)); J.rightShoulder = add(sm, mul(Rt, L.shoulder / 2));
    const T = thoraxFrame(t, Rt);

    // 4. NECK (shoulder-mid → nose), relative to the measured neutral
    const nv = get("nose") ? sub(get("nose").map((x, k) => x == null ? smCap[k] : x), smCap) : null;
    if (nv) {
      if (mode === "image" && !hasZ("nose")) nv[2] = 0;
      const neckCost = d => { const f = Math.atan2(dot(d, T.F), dot(d, T.U)) * R2D - sk.neckNeutralDeg, s = Math.asin(clamp(dot(d, T.R), -1, 1)) * R2D;
        return { clampDeg: Math.max(0, rg.neck.flexion[0] - f, f - rg.neck.flexion[1]) + Math.max(0, Math.abs(s) - rg.neck.sideBend[1]) }; };
      const ncd = pick(candidates(nv, L.neck, mode), neckCost, prevSign("neck")); signs.neck = ncd.sign || 0;
      const f = cl("neck", "flexion", Math.atan2(dot(ncd.d, T.F), dot(ncd.d, T.U)) * R2D - sk.neckNeutralDeg, rg.neck.flexion) + sk.neckNeutralDeg;
      const s = cl("neck", "sideBend", Math.asin(clamp(dot(ncd.d, T.R), -1, 1)) * R2D, rg.neck.sideBend);
      const n = add(mul(add(mul(T.U, Math.cos(f * D2R)), mul(T.F, Math.sin(f * D2R))), Math.cos(s * D2R)), mul(T.R, Math.sin(s * D2R)));
      J.nose = add(sm, mul(unit(n), L.neck));
    }

    for (const side of ["left", "right"]) {
      // 5. ARM: shoulder (ball, extension cone + twist), elbow (hinge), wrist (cone)
      const O = side === "right" ? T.R : mul(T.R, -1), Sh = J[side + "Shoulder"];
      const RS = rg[side + "Shoulder"];
      const behind = d => Math.asin(clamp(Math.max(0, -dot(d, T.F)), 0, 1)) * R2D, across = d => Math.asin(clamp(Math.max(0, -dot(d, O)), 0, 1)) * R2D;
      const shCost = d => ({ clampDeg: Math.max(0, behind(d) - RS.extensionBehind[1]) + Math.max(0, across(d) - RS.adductionAcross[1]) });
      const has3 = (...ns) => ns.every(n => cap[n] && cap[n][2] != null);
      const armIK = has3(side + "Elbow", side + "Wrist") ? ik2(Sh, L.upperArm, L.forearm, get(side + "Wrist"), get(side + "Elbow"), T.F) : null;
      const uc = armIK ? { d: unit(sub(armIK, Sh)) } : pick(candidates(imgVec(side + "Shoulder", side + "Elbow"), L.upperArm, mode), shCost, prevSign(side + "UpperArm")); signs[side + "UpperArm"] = uc.sign || 0;
      let d = uc.d;
      // extension (behind the coronal plane) and adduction (across the midline) are cones: tilt the arm back to the limit
      for (const [ax, val, axisV, lim] of [["extensionBehind", behind, mul(T.F, -1), RS.extensionBehind[1]], ["adductionAcross", across, mul(O, -1), RS.adductionAcross[1]]]) {
        const v0 = val(d); if (v0 <= lim) continue;
        const dc = unit(perp(d, axisV), mul(T.U, -1)), L0 = lim * D2R;
        d = unit(add(mul(dc, Math.cos(L0)), mul(axisV, Math.sin(L0)))); note(side + "Shoulder", ax, v0, lim);
      }
      const El = add(Sh, mul(d, L.upperArm)); J[side + "Elbow"] = El;
      const sw = shoulderSwing(d, T, O);
      const elbowCost = f => { const fl = angBetween(d, f), fr = perp(f, d); let c2 = Math.max(0, fl - rg.elbow.flexion[1]);
        if (fl >= 20 && sw.elevation < 165 && len(fr) > 1e-6) { const tw = twistOf(unit(fr), sw.r0, sw.oo); c2 += Math.max(0, RS.rotation[0] - tw, tw - RS.rotation[1]); }
        return { clampDeg: c2 }; };
      const fc = armIK ? { d: unit(sub(get(side + "Wrist"), El)) } : pick(candidates(imgVec(side + "Elbow", side + "Wrist"), L.forearm, mode), elbowCost, prevSign(side + "Forearm")); signs[side + "Forearm"] = fc.sign || 0;
      let f = fc.d;
      const flex = cl(side + "Elbow", "flexion", angBetween(d, f), rg.elbow.flexion);
      let fr = perp(f, d), tw = null;
      if (len(fr) > 1e-6) fr = unit(fr); else fr = prev && prev.front && prev.front[side] ? unit(perp(prev.front[side], d)) : sw.r0;
      if (flex >= 20 && sw.elevation < 165) { tw = cl(side + "Shoulder", "rotation", twistOf(fr, sw.r0, sw.oo), RS.rotation); fr = fromTwist(tw, sw.r0, sw.oo); }
      f = unit(add(mul(d, Math.cos(flex * D2R)), mul(fr, Math.sin(flex * D2R))));
      const Wr = add(El, mul(f, L.forearm)); J[side + "Wrist"] = Wr;
      if (get(side + "Index")) {
        const hc = pick(candidates(imgVec(side + "Wrist", side + "Index"), L.hand, mode), h => ({ clampDeg: Math.max(0, angBetween(f, h) - rg.wrist.total[1]) }), prevSign(side + "Hand"));
        signs[side + "Hand"] = hc.sign || 0;
        const tot = cl(side + "Wrist", "total", angBetween(f, hc.d), rg.wrist.total);
        let hp = perp(hc.d, f); hp = len(hp) > 1e-6 ? unit(hp) : fr;
        J[side + "Index"] = add(Wr, mul(unit(add(mul(f, Math.cos(tot * D2R)), mul(hp, Math.sin(tot * D2R)))), L.hand));
      }

      // 6. LEG: hip (ball: flexion/abduction + rotation via the kneecap), knee (hinge, folds backward), ankle
      const Oh = side === "right" ? P.R : mul(P.R, -1), Hp = J[side + "Hip"];
      const hipCost = a => { const h = hipAngles(a, P, Oh), r = rg.hip; return { clampDeg: Math.max(0, r.flexion[0] - h.flexion, h.flexion - r.flexion[1]) + Math.max(0, r.abduction[0] - h.abduction, h.abduction - r.abduction[1]) }; };
      /* r2 (RETURN, root cause): r1 always ran two-bone IK to the CAPTURED ANKLE when knee and ankle had depth. On a clip whose
         leg bones are far shorter than the fixed ones (alcaraz-poetry landing: captured hip→ankle 0.15–0.25 m), the fixed
         bones can only reach that ankle by folding the knee to the limit and swinging it 0.20–0.27 m off the captured knee,
         forward of the hip (hip flexion the capture does not have). IK is right for a PLANTED foot (it keeps the foot on the
         court); a foot in the air has no position to keep. So: weight w = smoothstep of the captured ankle height above the
         court from AIR_LO_M to AIR_HI_M (GAME-DESIGN). w = 0 → r1's IK; w = 1 → each bone takes its own captured direction
         (direction mode) or the cos rule with the capture's depth sign as the hint (image mode, pick()); in between the two
         directions are blended and renormalised (lengths stay fixed). Every angle then goes through the same clamps. */
      const capAn = get(side + "Ankle"), airW = capAn && opts.groundY != null ? smooth01((capAn[1] - opts.groundY - AIR_LO_M) / (AIR_HI_M - AIR_LO_M)) : 1;
      const legIK = has3(side + "Knee", side + "Ankle") && airW < 1 ? ik2(Hp, L.thigh, L.shank, capAn, get(side + "Knee"), P.F) : null;
      const thP = legIK && airW <= 0 ? null : pick(candidates(imgVec(side + "Hip", side + "Knee"), L.thigh, mode), hipCost, prevSign(side + "Thigh"));
      const thc = !legIK ? thP : !thP ? { d: unit(sub(legIK, Hp)) } : { d: unit(add(mul(unit(sub(legIK, Hp)), 1 - airW), mul(thP.d, airW))), sign: thP.sign };
      signs[side + "Thigh"] = thc.sign || 0; legSolve[side] = { airW, ik: !!legIK }; if (thP) picks[side + "Thigh"] = { all: thP.all, sign: thP.sign || 0, why: thP.why || "single", w: airW };
      const ha = hipAngles(thc.d, P, Oh);
      const hf = cl(side + "Hip", "flexion", ha.flexion, rg.hip.flexion), hb = cl(side + "Hip", "abduction", ha.abduction, rg.hip.abduction);
      const a = unit(hipFromAngles(hf, hb, P, Oh)), Kn = add(Hp, mul(a, L.thigh)); J[side + "Knee"] = Kn;
      const refs = thighRefs(hf, a, P, Oh);
      const kneeCost = s => { const kf = angBetween(a, s), bk = perp(s, a); let c2 = Math.max(0, kf - rg.knee.flexion[1]);
        if (kf >= 15 && len(bk) > 1e-6) { const tw2 = twistOf(mul(unit(bk), -1), refs.r0, refs.oo); c2 += Math.max(0, rg.hip.rotation[0] - tw2, tw2 - rg.hip.rotation[1]); }
        return { clampDeg: c2 }; };
      const shP = legIK && airW <= 0 ? null : pick(candidates(imgVec(side + "Knee", side + "Ankle"), L.shank, mode), kneeCost, prevSign(side + "Shank"));
      const skc = !legIK ? shP : !shP ? { d: unit(sub(capAn, Kn)) } : { d: unit(add(mul(unit(sub(capAn, Kn)), 1 - airW), mul(shP.d, airW))), sign: shP.sign };
      signs[side + "Shank"] = skc.sign || 0; if (shP) picks[side + "Shank"] = { all: shP.all, sign: shP.sign || 0, why: shP.why || "single", w: airW };
      const kf = cl(side + "Knee", "flexion", angBetween(a, skc.d), rg.knee.flexion);
      let bk = perp(skc.d, a), kc;
      if (kf >= 15 && len(bk) > 1e-6) {
        const htw = cl(side + "Hip", "rotation", twistOf(mul(unit(bk), -1), refs.r0, refs.oo), rg.hip.rotation);
        kc = fromTwist(htw, refs.r0, refs.oo);
      } else kc = len(bk) > 1e-6 ? mul(unit(bk), -1) : refs.r0;
      const s = unit(add(mul(a, Math.cos(kf * D2R)), mul(kc, -Math.sin(kf * D2R))));
      const An = add(Kn, mul(s, L.shank)); J[side + "Ankle"] = An;
      if (get(side + "Toe")) {
        const rA = rg.ankle.shankFootAngle;
        const tcd = pick(candidates(imgVec(side + "Ankle", side + "Toe"), L.foot, mode), ft => { const x = angBetween(s, ft); return { clampDeg: Math.max(0, rA[0] - x, x - rA[1]) }; }, prevSign(side + "Foot"));
        signs[side + "Foot"] = tcd.sign || 0;
        const al = cl(side + "Ankle", "shankFootAngle", angBetween(s, tcd.d), rA);
        let hp = perp(tcd.d, s); hp = len(hp) > 1e-6 ? unit(hp) : kc;
        J[side + "Toe"] = add(An, mul(unit(add(mul(s, Math.cos(al * D2R)), mul(hp, Math.sin(al * D2R)))), L.foot));
      }
      (front = front || {})[side] = fr;
    }

    // GROUND: a longer fixed bone must not push a foot through the court. Only lift (rigid translation, lengths kept).
    // First the ankles: if one is below the court the whole body is lifted (rigid). Then a toe below the court is
    // turned up about its ankle to lie on the court, only if that keeps the ankle inside its limit (else it stays, logged).
    let lift = 0; const toeBelow = {};
    if (opts.groundY != null) { let lo = Infinity; for (const n of ["leftAnkle", "rightAnkle"]) if (J[n]) lo = Math.min(lo, J[n][1]);
      if (lo < opts.groundY) { lift = opts.groundY - lo; for (const n in J) J[n] = [J[n][0], J[n][1] + lift, J[n][2]]; }
      const rA = rg.ankle.shankFootAngle;
      for (const side of ["left", "right"]) { const A = J[side + "Ankle"], T0 = J[side + "Toe"], K = J[side + "Knee"]; if (!A || !T0 || T0[1] >= opts.groundY) continue;
        const f = sub(T0, A), hz = Math.hypot(f[0], f[2]) || 1, dy = clamp((opts.groundY - A[1]) / L.foot, -1, 1), hm = Math.sqrt(1 - dy * dy);
        const nd = [f[0] / hz * hm, dy, f[2] / hz * hm], ang = angBetween(sub(A, K), nd);
        if (ang >= rA[0] - 1e-9 && ang <= rA[1] + 1e-9) J[side + "Toe"] = add(A, mul(nd, L.foot)); else toeBelow[side] = opts.groundY - T0[1]; } }
    const smL = [sm[0], sm[1] + lift, sm[2]], cL = [c[0], c[1] + lift, c[2]];
    // how far the skeleton moved each joint from the capture (MEASURED): 3D (if captured z) and image-plane
    const moved = {};
    for (const n in J) { const C = get(n); if (!C) continue;
      moved[n] = { xy: Math.hypot(J[n][0] - C[0], J[n][1] - C[1]), xyz: C[2] == null ? null : Math.hypot(J[n][0] - C[0], J[n][1] - C[1], J[n][2] - C[2]) }; }
    return { joints: J, clamps, moved, signs, front, hipMid: cL, shoulderMid: smL, lift, toeBelow, pelvisPitchDeg: P.pitchDeg, legSolve, picks };
  }

  /* boneLengths of a pose: { boneName: metres } */
  function boneLengths(J) {
    const out = {};
    const pt = n => n === "hipMid" ? mid(J.leftHip, J.rightHip) : n === "shoulderMid" ? mid(J.leftShoulder, J.rightShoulder) : J[n];
    for (const [name, a, b] of BONE_DEFS) { const A = pt(a), B = pt(b); if (A && B) out[name] = len(sub(B, A)); }
    return out;
  }
  const boneKey = name => BONE_DEFS.find(b => b[0] === name)[3];

  /* ---------- capture frames → local metres ---------- */
  function frameToLocal(f, H) {
    const J = f.joints || f.j || {}, out = {};
    for (const n in J) { const v = J[n]; out[n] = Array.isArray(v) ? [v[0] * H, v[1] * H, null] : [v.x * H, v.y * H, v.z == null ? null : v.z * H]; }
    return out;
  }
  function solveMotion(m, sk, opts = {}) {
    const res = []; let prev = null;
    for (const f of m.frames) { const r = solveFrame(frameToLocal(f, sk.heightM), sk, { hand: m.hand || "R", groundY: 0, ...opts, prev, t: f.t }); r.t = f.t; res.push(r); prev = r; }
    return res;
  }

  /* measureBoneRatios(motions): the bone-table method (see top). Returns { key: { ratio, n } } in body heights. */
  function measureBoneRatios(motions, maxOutOfPlaneDeg = 25) {
    const S = {}, lim = Math.sin(maxOutOfPlaneDeg * D2R);
    const push = (k, v) => (S[k] = S[k] || []).push(v);
    for (const m of motions) for (const f of m.frames) {
      const J = f.joints || f.j; const P = n => { const v = J[n]; return v ? (Array.isArray(v) ? null : [v.x, v.y, v.z]) : null; };
      const pt = n => n === "hipMid" ? (P("leftHip") && P("rightHip") ? mid(P("leftHip"), P("rightHip")) : null) : n === "shoulderMid" ? (P("leftShoulder") && P("rightShoulder") ? mid(P("leftShoulder"), P("rightShoulder")) : null) : P(n);
      for (const [, a, b, key] of BONE_DEFS) { const A = pt(a), B = pt(b); if (!A || !B) continue; const v = sub(B, A), l = len(v); if (l < 1e-6) continue; if (Math.abs(v[2]) / l <= lim) push(key, l); }
    }
    const out = {};
    for (const k in S) { const a = S[k].sort((x, y) => x - y); out[k] = { ratio: a[a.length >> 1], n: a.length }; }
    return out;
  }
  function measureAnkleNeutral(motions) {   // median shank→foot (knee→ankle vs ankle→toe) angle, both sides (MEASURED), degrees
    const v = [];
    for (const m of motions) for (const f of m.frames) { const J = f.joints; if (!J) continue;
      for (const s of ["left", "right"]) { const K = J[s + "Knee"], A = J[s + "Ankle"], T = J[s + "Toe"]; if (!K || !A || !T) continue;
        v.push(angBetween([A.x - K.x, A.y - K.y, A.z - K.z], [T.x - A.x, T.y - A.y, T.z - A.z])); } }
    v.sort((a, b) => a - b); return v[v.length >> 1];
  }
  function measureNeckNeutral(motions) {   // median sagittal nose angle in the thorax frame (MEASURED), degrees
    const v = [];
    for (const m of motions) for (const f of m.frames) { const J = f.joints; if (!J || !J.nose) continue;
      const g = n => [J[n].x, J[n].y, J[n].z]; const hm = mid(g("leftHip"), g("rightHip")), sm = mid(g("leftShoulder"), g("rightShoulder"));
      const t = unit(sub(sm, hm)), Rt = unit(perp(sub(g("rightShoulder"), g("leftShoulder")), t)), F = cross(Rt, t), n = unit(sub(g("nose"), sm));
      v.push(Math.atan2(dot(n, F), dot(n, t)) * R2D); }
    v.sort((a, b) => a - b); return v[v.length >> 1];
  }

  /* ---------- per-segment depth order (criterion 4) ---------- */
  /* Cameras. project(p) → { x, y, depth, s } with depth larger = farther, s = screen units per metre at p.
     orthoCamera(viewDir): parallel view along viewDir (e.g. [0,-1,0] = top-down in local coords).
     lookAtCamera(eye, target, f): perspective pinhole. gameCamera(cam): index.html proj() in COURT WORLD coords
     ({ x, y, z } objects or arrays [x, y(court), z(up)]): depth = y + back. */
  function basisFor(dir, upHint) {
    const fwd = unit(dir); let r = cross(fwd, upHint || [0, 1, 0]); if (len(r) < 1e-6) r = cross(fwd, [0, 0, 1]); r = unit(r);
    const u = cross(r, fwd); return { fwd, r, u };
  }
  function orthoCamera(viewDir, upHint) {
    const B = basisFor(viewDir, upHint);
    return { kind: "ortho", viewDir: B.fwd, project: p => ({ x: dot(p, B.r), y: -dot(p, B.u), depth: dot(p, B.fwd), s: 1 }) };
  }
  function lookAtCamera(eye, target, f = 1, upHint) {
    const B = basisFor(sub(target, eye), upHint);
    return { kind: "perspective", eye, project: p => { const v = sub(p, eye), z = Math.max(1e-3, dot(v, B.fwd)); return { x: f * dot(v, B.r) / z, y: -f * dot(v, B.u) / z, depth: z, s: f / z }; } };
  }
  function gameCamera(c) {   // c: { back, h, x, F } — same formula as index.html proj()
    return { kind: "game", project: p => { const P = Array.isArray(p) ? p : [p.x, p.y, p.z]; const d = Math.max(0.4, P[1] + c.back); return { x: (P[0] - (c.x || 0)) * (c.F || 1) / d, y: (c.h - P[2]) * (c.F || 1) / d, depth: d, s: (c.F || 1) / d }; } };
  }
  const SEGMENTS = [   // name, from, to, radius key
    ["leftThigh", "leftHip", "leftKnee", "thigh"], ["leftShank", "leftKnee", "leftAnkle", "shank"], ["leftFoot", "leftAnkle", "leftToe", "foot"],
    ["rightThigh", "rightHip", "rightKnee", "thigh"], ["rightShank", "rightKnee", "rightAnkle", "shank"], ["rightFoot", "rightAnkle", "rightToe", "foot"],
    ["leftUpperArm", "leftShoulder", "leftElbow", "upperArm"], ["leftForearm", "leftElbow", "leftWrist", "forearm"], ["leftHand", "leftWrist", "leftIndex", "hand"],
    ["rightUpperArm", "rightShoulder", "rightElbow", "upperArm"], ["rightForearm", "rightElbow", "rightWrist", "forearm"], ["rightHand", "rightWrist", "rightIndex", "hand"],
    ["neck", "shoulderMid", "nose", "neck"],
  ];
  /* segmentsInDrawOrder(J, camera, radiiM) → { order: [{ name, from, to, midDepth }], pairs: [...] } far → near.
     Pairwise rule: where two segments overlap on screen (sample points closer than the sum of their projected
     radii, ignoring the shared joint), the one whose overlapping part is farther is drawn first. The torso is a
     slab (shoulder/hip quad, thickness radiiM.torsoDepth); a limb point that lands inside the torso's outline is
     behind it if it is farther than the torso's mid-surface there. No overlap → midpoint depth decides.
     Every segment is returned (hidden ones too: drawn first, never deleted). */
  function segmentsInDrawOrder(Jin, camera, radiiM = {}) {
    const J = {}; for (const n in Jin) { const v = Jin[n]; if (v) J[n] = Array.isArray(v) ? v : [v.x, v.y, v.z]; }
    if (J.leftShoulder && J.rightShoulder) J.shoulderMid = mid(J.leftShoulder, J.rightShoulder);
    const items = [];
    const N = 9;
    for (const [name, a, b, rk] of SEGMENTS) {
      if (!J[a] || !J[b]) continue;
      const pts = []; for (let k = 0; k <= N; k++) { const p = add(J[a], mul(sub(J[b], J[a]), k / N)); pts.push({ p, q: camera.project(p), u: k / N }); }
      items.push({ name, from: a, to: b, r: radiiM[rk] || 0.04, pts, mid: camera.project(mid(J[a], J[b])).depth, ends: [a, b] });
    }
    // torso slab
    const corners = ["leftShoulder", "rightShoulder", "rightHip", "leftHip"];
    let torso = null;
    if (corners.every(n => J[n])) {
      const pts = []; const M = 6;
      for (let i = 0; i <= M; i++) for (let k = 0; k <= M; k++) {
        const top = add(J.leftShoulder, mul(sub(J.rightShoulder, J.leftShoulder), k / M)), bot = add(J.leftHip, mul(sub(J.rightHip, J.leftHip), k / M));
        const p = add(top, mul(sub(bot, top), i / M)); pts.push({ p, q: camera.project(p), u: 0.5 });
      }
      torso = { name: "torso", from: "shoulders", to: "hips", r: (radiiM.torsoDepth || 0.24) / 2, pts, mid: camera.project(mid(mid(J.leftShoulder, J.rightShoulder), mid(J.leftHip, J.rightHip))).depth, ends: corners, torso: true };
      items.push(torso);
    }
    const pairs = [], before = items.map(() => new Set()), indeg = items.map(() => 0);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      const shared = A.ends.filter(e => B.ends.includes(e)).concat(A.torso || B.torso ? (A.torso ? [B.from] : [A.from]).filter(e => corners.includes(e) || e === "shoulderMid") : []);
      const near = p => shared.some(e => J[e] && len(sub(p, J[e])) < 1.6 * Math.max(A.r, B.r));
      let sum = 0, n = 0;
      for (const a of A.pts) { if (near(a.p)) continue;
        for (const b of B.pts) { if (near(b.p)) continue;
          const dpx = Math.hypot(a.q.x - b.q.x, a.q.y - b.q.y), lim = (A.torso || B.torso) ? (A.torso ? B.r * a.q.s + 0.6 * A.r * a.q.s : A.r * b.q.s + 0.6 * B.r * b.q.s) : A.r * a.q.s + B.r * b.q.s;
          if (dpx < lim) { sum += a.q.depth - b.q.depth; n++; } } }
      if (!n) continue;
      const farI = sum / n > 0;   // A's overlapping part farther → A drawn first
      const [f, nr] = farI ? [i, j] : [j, i];
      before[nr].add(f); indeg[nr]++;
      pairs.push({ far: items[f].name, near: items[nr].name, meanDepthGap: Math.abs(sum / n), samples: n });
    }
    // Kahn topological sort; among ready items, the farthest midpoint first. Cycles: break by midpoint depth.
    const done = new Array(items.length).fill(false), order = [];
    const succ = items.map(() => []); before.forEach((s, k) => s.forEach(f => succ[f].push(k)));
    const deg = indeg.slice();
    while (order.length < items.length) {
      let ready = items.map((_, k) => k).filter(k => !done[k] && deg[k] === 0);
      if (!ready.length) ready = items.map((_, k) => k).filter(k => !done[k]);   // cycle
      ready.sort((a, b) => items[b].mid - items[a].mid);
      const k = ready[0]; done[k] = true; order.push(k); for (const s of succ[k]) deg[s]--;
    }
    return { order: order.map(k => ({ name: items[k].name, from: items[k].from, to: items[k].to, midDepth: items[k].mid })), pairs };
  }

  /* ---------- game hook: refit the displayed world joints (court metres) onto the fixed skeleton ----------
     fitWorld(i, player, p, W, mo): W is mo.world after the game's own steps (poseToWorld, sideOn, anatomize, the
     bounce routine). The figure keeps the game's screen-plane (x across, z up) shape; depth along the court is
     the cos rule with the game's own depth as the sign hint. The game's mirror (flipAt) is undone into the
     player's own left/right before solving and re-applied after, so handedness is exactly the game's.
     Joints without a bone (ears, heels, head, neck, chest, pelvis, root, hands) move with their parent. */
  const _state = {};
  function fitWorld(i, player, p, W, mo, o = {}) {   // o: { t: time for flipAt (default mo.t), stateless: true = no continuity state }
    const sk = player && skeletonFor(player.id);
    if (!sk || !sk.limits || !W || !W.leftHip || !W.rightHip || !W.leftShoulder || !W.rightShoulder) return null;
    const near = player.side === "near" ? 1 : -1, t = o.t != null ? o.t : mo && mo.t;
    const right = near * (mo && typeof root.flipAt === "function" ? root.flipAt(i, mo, t) : 1);
    const st = o.stateless ? { prev: null, sR: Math.sign(right) || near }
      : (_state[i] = (_state[i] && _state[i].m === (mo && mo.m)) ? _state[i] : { m: mo && mo.m, prev: null, sR: Math.sign(right) || near });
    const sR = Math.sign(right) || st.sR; st.sR = sR;
    const fwd = near, cap = {};
    for (const n in W) { const v = W[n]; if (v && typeof v.x === "number") cap[n] = [(v.x - p.x) * sR, v.z, (v.y - p.y) * fwd]; }
    const mode = mo && mo.m && mo.m.measuredDepth ? "direction" : "image";
    const r = solveFrame(cap, sk, { mode, groundY: 0, prev: st.prev, t, hand: (mo && mo.m && mo.m.hand) || (player.lefty ? "L" : "R") }); r.t = t; st.prev = r;
    const delta = {}, toW = q => ({ x: p.x + q[0] * sR, y: p.y + q[2] * fwd, z: q[1] });
    for (const n in r.joints) { const w = toW(r.joints[n]), o = W[n]; if (!o) continue; delta[n] = { x: w.x - o.x, y: w.y - o.y, z: w.z - o.z }; o.x = w.x; o.y = w.y; o.z = w.z; }
    const follow = { leftEar: "nose", rightEar: "nose", head: "nose", leftEye: "nose", rightEye: "nose", leftHeel: "leftAnkle", rightHeel: "rightAnkle",
      leftHand: "leftWrist", rightHand: "rightWrist", neck: "shoulderMid", chest: "shoulderMid" };
    const smOld = W._smOld;
    const smNew = toW(r.shoulderMid);
    for (const n in follow) { const o = W[n]; if (!o || typeof o.x !== "number") continue;
      let d = delta[follow[n]];
      if (follow[n] === "shoulderMid") { const lsO = { x: W.leftShoulder.x - delta.leftShoulder.x, y: W.leftShoulder.y - delta.leftShoulder.y, z: W.leftShoulder.z - delta.leftShoulder.z }, rsO = { x: W.rightShoulder.x - delta.rightShoulder.x, y: W.rightShoulder.y - delta.rightShoulder.y, z: W.rightShoulder.z - delta.rightShoulder.z };
        d = { x: smNew.x - (lsO.x + rsO.x) / 2, y: smNew.y - (lsO.y + rsO.y) / 2, z: smNew.z - (lsO.z + rsO.z) / 2 }; }
      if (d) { o.x += d.x; o.y += d.y; o.z += d.z; } }
    void smOld;
    if (W._pelvis) { const lh = W.leftHip, rh = W.rightHip, dx = rh.x - lh.x, dy = rh.y - lh.y, dl = Math.hypot(dx, dy) || 1;
      Object.assign(W._pelvis, { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: (lh.z + rh.z) / 2, dx: dx / dl, dy: dy / dl }); }
    W._skeleton = { id: sk.id, clamps: r.clamps.length, mode };
    return delta;
  }

  const API = { PELVIS_YAW_TRIES, YAW_COST_PER_M, YAW_COST_PER_DEG, PITCH_SPLIT, PITCH_OFFSETS, PITCH_COST_PER_DEG, PITCH_RATE_DEG_S, PELVIS_PITCH_MIN, PELVIS_PITCH_MAX, AIR_LO_M, AIR_HI_M, pelvisFrame, trunkLeanDeg, SKELETONS, NOSE_TO_ANKLE_H, scaleK, BONE_DEFS, SEGMENTS, skeletonFor, solveFrame, solveMotion, measureAngles, ranges, violations, boneLengths, boneKey,
    frameToLocal, measureBoneRatios, measureNeckNeutral, measureAnkleNeutral, segmentsInDrawOrder, orthoCamera, lookAtCamera, gameCamera, fitWorld, UNOBSERVED, limitsTable: LIMT };
  if (typeof module === "object" && module.exports) module.exports = API;
  root.BodySkeleton = API;
})(typeof window !== "undefined" ? window : globalThis);
