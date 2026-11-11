/* BODY · SKELETON (Body Animator, agents/body-animator/).
   The jointed skeleton every pro shares, scaled to his real height.
   SEGMENT LENGTHS: Drillis R, Contini R. Body Segment Parameters. Tech. Rep. 1166-03, New York University, 1966,
   as tabled in Winter DA, Biomechanics and Motor Control of Human Movement, 4th ed. (Wiley, 2009), fig. 4.1.
   Fractions of standing height H. The same table is in datasets/anatomy/joints.json (Biomechanics Coach).
   The standing column adds up exactly: ankle 0.039 + shank 0.246 + thigh 0.245 + trunk 0.288 (hip → shoulder)
   + neck 0.052 (shoulder → chin) + head 0.130 (chin → top) = 1.000 H.
   JOINT LIMITS (flexion, degrees): AAOS, Joint Motion: Method of Measuring and Recording (1965), tabled in
   Norkin & White, Measurement of Joint Motion, 5th ed. (2016); the knee and elbow ranges match joints.json. */
(function (root) {
  const RATIO = {
    ankle: 0.039, shank: 0.246, thigh: 0.245, trunk: 0.288, neck: 0.052, head: 0.130,   // the standing column
    chest: 0.720,                                     // sternum height (the chest joint)
    upperArm: 0.186, forearm: 0.146, hand: 0.108,     // shoulder → elbow → wrist → fingertip
    foot: 0.152, shoulderWidth: 0.259, hipWidth: 0.191
  };
  /* The Pose contract (agents/README.md). Names follow the serve motions (src/serve/motion/), so a captured
     serve maps joint for joint; pelvis = the serve's "root", head = its "nose". */
  const JOINTS = ["head", "neck", "chest", "pelvis",
    "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist",
    "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle", "leftToe", "rightToe"];
  /* Bones drawn between joints (for a stick figure or a debug view). */
  const BONES = [["head", "neck"], ["neck", "chest"], ["chest", "pelvis"],
    ["leftShoulder", "rightShoulder"], ["leftHip", "rightHip"],
    ["leftShoulder", "leftElbow"], ["leftElbow", "leftWrist"], ["rightShoulder", "rightElbow"], ["rightElbow", "rightWrist"],
    ["leftHip", "leftKnee"], ["leftKnee", "leftAnkle"], ["leftAnkle", "leftToe"],
    ["rightHip", "rightKnee"], ["rightKnee", "rightAnkle"], ["rightAnkle", "rightToe"]];
  const LIMITS = { knee: [0, 135], elbow: [0, 150] };   // flexion in degrees: 0 = straight

  /* Segment lengths in metres for a player P ({ heightM, armSpanM? }). An optional armSpanM (fingertip to
     fingertip, arms out) rescales the three arm segments so shoulderWidth + 2 × arm = armSpanM. */
  function segments(P) {
    const H = P.heightM, L = {};
    for (const k in RATIO) L[k] = RATIO[k] * H;
    if (P.armSpanM > 0) {
      const arm = (P.armSpanM - L.shoulderWidth) / 2, k = arm / (L.upperArm + L.forearm + L.hand);
      L.upperArm *= k; L.forearm *= k; L.hand *= k;
    }
    L.H = H;
    L.ankleZ = L.ankle;                                // standing joint heights
    L.kneeZ = L.ankle + L.shank;
    L.hipZ = L.kneeZ + L.thigh;
    L.shoulderZ = L.hipZ + L.trunk;
    L.chinZ = L.shoulderZ + L.neck;
    L.topZ = L.chinZ + L.head;
    L.leg = L.thigh + L.shank;
    L.arm = L.upperArm + L.forearm;
    return L;
  }
  /* Flexion (degrees) of the middle joint of a limb a → b → c: 0 = straight, 180 = folded flat. */
  function flexion(a, b, c) {
    const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }, v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const d = (u.x * v.x + u.y * v.y + u.z * v.z) / ((Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z)) || 1);
    return 180 - Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
  }
  root.BodySkeleton = { RATIO, JOINTS, BONES, LIMITS, segments, flexion };
})(typeof window !== "undefined" ? window : globalThis);
