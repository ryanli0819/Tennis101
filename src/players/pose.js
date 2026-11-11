// =====================================================================
// POSE FALLBACK — getPose(i) until Body Animator ships src/body/.
// Joints are a standing skeleton in court metres, scaled to heightM,
// plus the racket from racketPose when the match is running.
// The animated sprite still comes from drawPlayer (index.html); this is
// the contract the other agents can call. Names match agents/README.md.
// =====================================================================
(function () {
  const JOINTS = ["head", "neck", "chest", "pelvis",
    "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist",
    "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle", "leftToe", "rightToe"];

  function getPose(i) {
    const P = (window.PLAYERS || [])[i];
    const p = (window.pos || [])[i] || { x: 0, y: i === 1 ? 12.4 : -12.4 };
    if (!P) return null;
    const h = P.heightM || 1.85;
    const side = P.side === "far" ? -1 : 1;
    const hand = P.lefty ? -1 : 1;
    const x = p.x || 0, y = p.y;
    // Fractions of height. Shoulder width follows look.torso (a visual scale, not a measured biacromial width).
    const torso = (P.look && P.look.torso) || 1;
    const sw = 0.13 * h * torso, hip = 0.09 * h * torso;
    const at = (dx, z) => ({ x: x + side * hand * dx, y, z });
    const joints = {
      head: at(0, 0.93 * h), neck: at(0, 0.86 * h), chest: at(0, 0.75 * h), pelvis: at(0, 0.53 * h),
      leftShoulder: at(-sw, 0.82 * h), rightShoulder: at(sw, 0.82 * h),
      leftElbow: at(-sw * 1.15, 0.62 * h), rightElbow: at(sw * 1.05, 0.64 * h),
      leftWrist: at(-sw, 0.45 * h), rightWrist: at(sw * 0.7, 0.48 * h),
      leftHip: at(-hip, 0.52 * h), rightHip: at(hip, 0.52 * h),
      leftKnee: at(-hip, 0.28 * h), rightKnee: at(hip, 0.28 * h),
      leftAnkle: at(-hip, 0.05 * h), rightAnkle: at(hip, 0.05 * h),
      leftToe: at(-hip * 1.4, 0.02 * h), rightToe: at(hip * 1.4, 0.02 * h),
    };
    let racket = null;
    if (typeof window.racketPose === "function") {
      const rp = window.racketPose(i, p);
      if (rp && rp.g && rp.u) {
        const len = 0.685;
        racket = {
          grip: rp.g,
          head: { x: rp.g.x + rp.u.x * len, y: rp.g.y + rp.u.y * len, z: rp.g.z + rp.u.z * len },
          face: rp.n,
        };
      }
    }
    return { joints, racket };
  }

  window.JOINTS = JOINTS;
  window.getPose = getPose;
})();
