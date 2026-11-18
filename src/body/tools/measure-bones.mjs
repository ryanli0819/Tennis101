// Re-measures the bone table (body-height ratios) and the neutral neck angle from the live serves. Prints JSON.
// Run: node src/body/tools/measure-bones.mjs
import { createRequire } from "node:module";
import { liveMotions, extraMotions, measurementClips } from "./load-motions.mjs";
const require = createRequire(import.meta.url);
const SK = require("../skeleton.js");
const live = liveMotions(), extra = extraMotions(), out = {};
for (const id of ["alcaraz", "sinner"]) {
  const ms = measurementClips(id).map(c => c.m);
  const r = SK.measureBoneRatios(ms);
  const frames = ms.reduce((a, m) => a + m.frames.length, 0);
  // 2D cross-check: 95th percentile of the 2D length over the not-loaded 2D clips (foreshortening only shortens)
  const p95 = {};
  for (const [, a, b, key] of SK.BONE_DEFS) for (const c of extra[id]) for (const f of c.m.frames) {
    const J = f.j || f.joints; const P = n => n === "hipMid" ? (J.leftHip && J.rightHip ? [(J.leftHip[0] + J.rightHip[0]) / 2, (J.leftHip[1] + J.rightHip[1]) / 2] : null) : n === "shoulderMid" ? (J.leftShoulder && J.rightShoulder ? [(J.leftShoulder[0] + J.rightShoulder[0]) / 2, (J.leftShoulder[1] + J.rightShoulder[1]) / 2] : null) : (Array.isArray(J[n]) ? J[n] : null);
    const A = P(a), B = P(b); if (!A || !B) continue; (p95[key] = p95[key] || []).push(Math.hypot(B[0] - A[0], B[1] - A[1]));
  }
  for (const k in p95) { const s = p95[k].sort((x, y) => x - y); p95[k] = { p95: +s[Math.floor(0.95 * (s.length - 1))].toFixed(4), n: s.length }; }
  out[id] = { clips: measurementClips(id).map(c => c.clip), frames, ratios: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ratio: +v.ratio.toFixed(4), n: v.n }])), neckNeutralDeg: +SK.measureNeckNeutral(ms).toFixed(1), ankleNeutralDeg: +SK.measureAnkleNeutral(ms).toFixed(1), crossCheck2D_p95: p95 };
}
console.log(JSON.stringify(out, null, 1));

// CROSS-CHECK from datasets/serves/alcaraz/*.keypoints.json (2D pixels, Alcaraz only): thigh/shank and upper-arm/forearm
// ratios on frames where that limb is straight in 2D (angle > 165°, so both segments share one out-of-plane angle and
// foreshortening cancels) and all three points have confidence ≥ 0.6. Median per clip and pooled.
import { readFileSync, readdirSync } from "node:fs";
const KP = new URL("../../../datasets/serves/alcaraz/", import.meta.url);
const xc = { pooled: { thighOverShank: [], upperOverForearm: [] } };
for (const f of readdirSync(KP).filter(n => n.endsWith(".keypoints.json"))) {
  const d = JSON.parse(readFileSync(new URL(f, KP), "utf8")), W = d.width || 1, H = d.height || 1, per = { thighOverShank: [], upperOverForearm: [] };
  for (const fr of d.frames) { const J = fr.joints || {};
    for (const s of ["left", "right"]) for (const [k, a, b, c] of [["thighOverShank", "Hip", "Knee", "Ankle"], ["upperOverForearm", "Shoulder", "Elbow", "Wrist"]]) {
      const A = J[s + a], B = J[s + b], C = J[s + c]; if (!A || !B || !C || A[2] < 0.6 || B[2] < 0.6 || C[2] < 0.6) continue;
      const u = [(A[0] - B[0]) * W, (A[1] - B[1]) * H], v = [(C[0] - B[0]) * W, (C[1] - B[1]) * H], lu = Math.hypot(...u), lv = Math.hypot(...v);
      if (lu < 5 || lv < 5) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / lu / lv))) * 180 / Math.PI;
      if (ang > 165) { per[k].push(lu / lv); xc.pooled[k].push(lu / lv); } } }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
  xc[f] = { thighOverShank: { median: med(per.thighOverShank), n: per.thighOverShank.length }, upperOverForearm: { median: med(per.upperOverForearm), n: per.upperOverForearm.length } };
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
xc.pooled = { thighOverShank: { median: med(xc.pooled.thighOverShank), n: xc.pooled.thighOverShank.length }, upperOverForearm: { median: med(xc.pooled.upperOverForearm), n: xc.pooled.upperOverForearm.length } };
console.log(JSON.stringify({ alcarazKeypointsCrossCheck: xc }, null, 1));
