// Evidence for HQ-20261117-002.PM.1: solves every frame of every in-repo Alcaraz/Sinner serve onto the fixed skeleton and
// writes JSON + TXT reports. Run: node src/body/tools/evidence.mjs <outDir>
import { createRequire } from "node:module";
import fs from "node:fs"; import path from "node:path";
import { liveMotions, extraMotions } from "./load-motions.mjs";
const require = createRequire(import.meta.url);
const SK = require("../skeleton.js"), BJ = require("../joints.js");
export const D = Math.PI / 180;
export function solveAll() {
  const live = liveMotions(), extra = extraMotions(), runs = [];
  for (const id of ["alcaraz", "sinner"]) {
    const sk = SK.skeletonFor(id);
    for (const c of live[id]) for (const mode of ["direction", "image"]) runs.push({ id, sk, clip: c.clip, live: true, mode, m: c.m, res: SK.solveMotion(c.m, sk, { mode }) });
    for (const c of extra[id]) runs.push({ id, sk, clip: c.clip, live: false, mode: "image", m: c.m, res: SK.solveMotion(c.m, sk, { mode: "image" }) });
  }
  return runs;
}
export function lengthAndLimits(run) {
  let maxErr = 0, worst = null, viol = [];
  const rg = SK.ranges(null, run.m.hand || "R", run.sk);
  run.res.forEach((r, k) => {
    const bl = SK.boneLengths(r.joints);
    for (const b in bl) { const e = Math.abs(bl[b] - run.sk.L[SK.boneKey(b)]); if (e > maxErr) { maxErr = e; worst = { frame: k, bone: b }; } }
    for (const v of SK.violations(SK.measureAngles(r.joints, run.sk), rg)) viol.push({ frame: k, ...v });
  });
  return { maxErr, worst, viol };
}
// Ryan's case: Alcaraz poetry landing, right (back) leg folded
export function ryanCase(runs) {
  const run = runs.find(r => r.id === "alcaraz" && /poetry/.test(r.clip) && r.mode === "direction");
  const E = run.m.events, sk = run.sk, out = [];
  run.res.forEach((r, k) => {
    if (r.t < E.contact || r.t > E.finish) return;
    const cap = SK.frameToLocal(run.m.frames[k], sk.heightM);
    const capA = SK.measureAngles(Object.fromEntries(Object.entries(cap).filter(([, v]) => v)), sk), A = SK.measureAngles(r.joints, sk);
    if (A.rightKnee.flexion < 120) return;
    const hm = r.hipMid, J = r.joints;
    const cams = {
      topDown: SK.orthoCamera([0, -1, 0], [0, 0, 1]),
      slantLeft: SK.lookAtCamera([hm[0] - 4 * Math.sin(35 * D), hm[1] + 4 * Math.tan(40 * D), hm[2] - 4 * Math.cos(35 * D)], hm, 1),   // LOCAL EVIDENCE slants (no slant cam on main): 4 m behind, 35° to his left / right, 40° down
      slantRight: SK.lookAtCamera([hm[0] + 4 * Math.sin(35 * D), hm[1] + 4 * Math.tan(40 * D), hm[2] - 4 * Math.cos(35 * D)], hm, 1),
      serveCam: SK.lookAtCamera([hm[0], 2.4, hm[2] - 4.6], [hm[0], 2.4 - (2.4 - 1.0) * 1, hm[2] + 10], 1),   // game serve cam: 4.6 m behind, 2.4 m up, looking along the court
      broadcast: SK.lookAtCamera([hm[0], 5, hm[2] - 7.1], [hm[0], 5, hm[2] + 10], 1),                  // game broadcast: 19 m from the far baseline anchor, 5 m up
    };
    const row = { frame: k, t: r.t, kneeFlexCapturedDeg: +capA.rightKnee.flexion.toFixed(1), kneeFlexSolvedDeg: +A.rightKnee.flexion.toFixed(1),
      thigh3D: Math.hypot(...J.rightKnee.map((v, i) => v - J.rightHip[i])), shank3D: Math.hypot(...J.rightAnkle.map((v, i) => v - J.rightKnee[i])), cams: {} };
    for (const [cn, cam] of Object.entries(cams)) {
      const o = SK.segmentsInDrawOrder(J, cam, sk.radiiM), names = o.order.map(x => x.name);
      const pr = o.pairs.find(p => [p.far, p.near].includes("rightThigh") && [p.far, p.near].includes("rightShank"));
      const pl = (a, b) => { const A = cam.project(a), B = cam.project(b); return Math.hypot(A.x - B.x, A.y - B.y) / ((A.s + B.s) / 2); };
      row.cams[cn] = { thighIdx: names.indexOf("rightThigh"), shankIdx: names.indexOf("rightShank"), overlap: !!pr, shankOverThigh: names.indexOf("rightShank") > names.indexOf("rightThigh"),
        overlapDepthGapM: pr ? +pr.meanDepthGap.toFixed(3) : null, thighProjM: +pl(J.rightHip, J.rightKnee).toFixed(4), shankProjM: +pl(J.rightKnee, J.rightAnkle).toFixed(4), segments: names.length };
    }
    out.push(row);
  });
  return out;
}
if (import.meta.url === "file://" + process.argv[1]) {
  const OUT = process.argv[2] || ".";
  fs.mkdirSync(OUT, { recursive: true });
  const runs = solveAll(), T = BJ.table, rep = { generatedLocal: new Date().toString(), tolerance: "bone length |L − L_fixed| ≤ 1e-6 m; joint limits ±1e-6°", limitsSource: T.source, widened: T.widened, dominantShoulderER: T.dominantShoulderER, unobserved: SK.UNOBSERVED, runs: [] };
  const clamp10 = [], er = [], movedAll = {};
  for (const run of runs) {
    const ll = lengthAndLimits(run), moved = {};
    run.res.forEach((r, k) => {
      for (const n in r.moved) { (moved[n] = moved[n] || []).push(r.moved[n].xyz != null ? r.moved[n].xyz : r.moved[n].xy); }
      for (const c of r.clamps) if (Math.abs(c.captured - c.solved) > 10) clamp10.push({ player: run.id, clip: run.clip, mode: run.mode, frame: k, t: +r.t.toFixed(4), joint: c.joint, axis: c.axis, capturedDeg: +c.captured.toFixed(1), solvedDeg: +c.solved.toFixed(1) });
    });
    // every frame whose shoulder ER (captured direction, before clamping) passes the limit: dominant 105.4, other 90
    run.res.forEach((r, k) => { for (const c of r.clamps) if (/Shoulder$/.test(c.joint) && c.axis === "rotation" && c.captured > 0) er.push({ player: run.id, clip: run.clip, mode: run.mode, frame: k, t: +r.t.toFixed(4), shoulder: c.joint, dominant: c.joint === ((run.m.hand || "R") === "L" ? "leftShoulder" : "rightShoulder"), capturedERdeg: +c.captured.toFixed(1), solvedERdeg: +c.solved.toFixed(1) }); });
    const st = {}; for (const n in moved) { const a = moved[n].sort((x, y) => x - y); st[n] = { medianM: +a[a.length >> 1].toFixed(4), maxM: +a[a.length - 1].toFixed(4) }; }
    if (run.live) movedAll[run.id + " | " + run.clip + " | " + run.mode] = st;
    rep.runs.push({ player: run.id, clip: run.clip, live: run.live, mode: run.mode, frames: run.res.length, maxBoneErrM: ll.maxErr, worst: ll.worst, limitViolations: ll.viol.length, clampsTotal: run.res.reduce((a, r) => a + r.clamps.length, 0), lifts: run.res.filter(r => r.lift > 0).length, maxLiftM: +Math.max(...run.res.map(r => r.lift || 0)).toFixed(4) });
  }
  const ry = ryanCase(runs);
  fs.writeFileSync(path.join(OUT, "skeleton-report.json"), JSON.stringify(rep, null, 1));
  fs.writeFileSync(path.join(OUT, "skeleton-moved-from-capture.json"), JSON.stringify(movedAll, null, 1));
  fs.writeFileSync(path.join(OUT, "clamps-over-10deg.json"), JSON.stringify(clamp10, null, 0).replace(/},{/g, "},\n{"));
  fs.writeFileSync(path.join(OUT, "shoulder-ER-over-limit.json"), JSON.stringify(er, null, 0).replace(/},{/g, "},\n{"));
  fs.writeFileSync(path.join(OUT, "ryan-case.json"), JSON.stringify(ry, null, 1));
  // TXT summary
  const L = [];
  L.push("HQ-20261117-002.PM.1 skeleton evidence — " + rep.generatedLocal, "Tolerance: " + rep.tolerance, "Limits: " + rep.limitsSource, "");
  L.push("Per run: player | clip | mode | frames | max bone error (m) | limit violations | clamps | ground lifts (max m)");
  for (const r of rep.runs) L.push([r.player, r.clip, r.mode, r.frames, r.maxBoneErrM.toExponential(2), r.limitViolations, r.clampsTotal, r.lifts + " (" + r.maxLiftM + ")"].join(" | "));
  L.push("", "CDC means widened to AAOS (rule 3):"); for (const w of T.widened) L.push(`  ${w.joint}.${w.axis} ${w.side}: CDC ${w.cdcMeanDeg} → ${w.usedDeg} (${w.sourceId}, ${w.where})`);
  L.push("", "Clamps > 10° (all runs): " + clamp10.length + " (live serves: " + clamp10.filter(c => !/2D/.test(c.clip)).length + ")");
  L.push("Shoulder ER frames past limit: dominant > " + T.dominantShoulderER.deg + ": " + er.filter(e => e.dominant).length + " rows; non-dominant > 90: " + er.filter(e => !e.dominant).length + " rows");
  L.push("", "Ryan's case (alcaraz-poetry first, right leg, landing frames with solved knee flexion ≥ 120°):");
  for (const r of ry) L.push(`  frame ${r.frame} t=${r.t.toFixed(3)} knee captured ${r.kneeFlexCapturedDeg}° solved ${r.kneeFlexSolvedDeg}° thigh3D ${r.thigh3D.toFixed(4)} shank3D ${r.shank3D.toFixed(4)} | ` + Object.entries(r.cams).map(([k, v]) => `${k}: ${v.overlap ? (v.shankOverThigh ? "SHANK OVER THIGH" : "thigh over shank") : "no overlap"} (gap ${v.overlapDepthGapM}) proj thigh ${v.thighProjM} shank ${v.shankProjM}`).join(" ; "));
  fs.writeFileSync(path.join(OUT, "skeleton-report.txt"), L.join("\n") + "\n");
  console.log(L.join("\n"));
}
