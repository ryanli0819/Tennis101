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
    for (const c of live[id]) for (const mode of ["direction", "image"]) runs.push({ id, sk, clip: c.clip, live: true, mode, m: c.m, res: SK.solveMotion(c.m, sk, { mode, audit: true }) });
    for (const c of extra[id]) runs.push({ id, sk, clip: c.clip, live: false, mode: "image", m: c.m, res: SK.solveMotion(c.m, sk, { mode: "image", audit: true }) });
  }
  return runs;
}
export function lengthAndLimits(run) {
  let maxErr = 0, worst = null, viol = [];
  const rg = SK.ranges(null, run.m.hand || "R", run.sk);
  run.res.forEach((r, k) => {
    const bl = SK.boneLengths(r.joints);
    for (const b in bl) { const e = Math.abs(bl[b] - run.sk.L[SK.boneKey(b)]); if (e > maxErr) { maxErr = e; worst = { frame: k, bone: b }; } }
    for (const v of SK.violations(SK.measureAngles(r.joints, run.sk, { pelvisPitchDeg: r.pelvisPitchDeg }), rg)) viol.push({ frame: k, ...v });
  });
  return { maxErr, worst, viol };
}
// Ryan's case: Alcaraz poetry landing, right (back) leg. r2: every frame RYAN_FRAMES (325–342) is reported; `folded` = solved
// knee flexion ≥ 120°. For each camera: solved draw order; for topDown also the CAPTURE's own order and depth gap (MEASURED).
export const RYAN_FRAMES = [325, 342], FOLD_DEG = 120;
export const ryanCams = hm => ({
  topDown: SK.orthoCamera([0, -1, 0], [0, 0, 1]),
  slantLeft: SK.lookAtCamera([hm[0] - 4 * Math.sin(35 * D), hm[1] + 4 * Math.tan(40 * D), hm[2] - 4 * Math.cos(35 * D)], hm, 1),   // LOCAL EVIDENCE slants (no slant cam on main): 4 m behind, 35° to his left / right, 40° down
  slantRight: SK.lookAtCamera([hm[0] + 4 * Math.sin(35 * D), hm[1] + 4 * Math.tan(40 * D), hm[2] - 4 * Math.cos(35 * D)], hm, 1),
  serveCam: SK.lookAtCamera([hm[0], 2.4, hm[2] - 4.6], [hm[0], 2.4 - (2.4 - 1.0) * 1, hm[2] + 10], 1),   // game serve cam: 4.6 m behind, 2.4 m up, looking along the court
  broadcast: SK.lookAtCamera([hm[0], 5, hm[2] - 7.1], [hm[0], 5, hm[2] + 10], 1),                  // game broadcast: 19 m from the far baseline anchor, 5 m up
});
export function legOrder(J, cam, radiiM) {
  const o = SK.segmentsInDrawOrder(J, cam, radiiM), names = o.order.map(x => x.name);
  const pr = o.pairs.find(p => [p.far, p.near].includes("rightThigh") && [p.far, p.near].includes("rightShank"));
  const pl = (a, b) => { const A = cam.project(a), B = cam.project(b); return Math.hypot(A.x - B.x, A.y - B.y) / ((A.s + B.s) / 2); };
  return { thighIdx: names.indexOf("rightThigh"), shankIdx: names.indexOf("rightShank"), overlap: !!pr, shankOverThigh: names.indexOf("rightShank") > names.indexOf("rightThigh"),
    result: pr ? (names.indexOf("rightShank") > names.indexOf("rightThigh") ? "SHANK OVER THIGH" : "thigh over shank") : "no overlap",
    overlapDepthGapM: pr ? +pr.meanDepthGap.toFixed(3) : null, overlapSamples: pr ? pr.samples : 0, thighProjM: +pl(J.rightHip, J.rightKnee).toFixed(4), shankProjM: +pl(J.rightKnee, J.rightAnkle).toFixed(4), segments: names.length };
}
const R2D = 180 / Math.PI;
// world thigh angle behind vertical (sagittal, + = knee behind the hip), degrees
const thighBackDeg = J => Math.atan2(-(J.rightKnee[2] - J.rightHip[2]), J.rightHip[1] - J.rightKnee[1]) * R2D;
export function ryanCase(runs, mode = "direction") {
  const run = runs.find(r => r.id === "alcaraz" && /poetry/.test(r.clip) && r.mode === mode);
  const sk = run.sk, out = [];
  run.res.forEach((r, k) => {
    if (k < RYAN_FRAMES[0] || k > RYAN_FRAMES[1]) return;
    const cap = SK.frameToLocal(run.m.frames[k], sk.heightM), C = Object.fromEntries(Object.entries(cap).filter(([, v]) => v));
    const capA = SK.measureAngles(C, sk), A = SK.measureAngles(r.joints, sk, { pelvisPitchDeg: r.pelvisPitchDeg });
    const J = r.joints, cams = ryanCams(r.hipMid);
    const row = { frame: k, t: r.t, folded: A.rightKnee.flexion >= FOLD_DEG, kneeFlexCapturedDeg: +capA.rightKnee.flexion.toFixed(1), kneeFlexSolvedDeg: +A.rightKnee.flexion.toFixed(1),
      thigh3D: Math.hypot(...J.rightKnee.map((v, i) => v - J.rightHip[i])), shank3D: Math.hypot(...J.rightAnkle.map((v, i) => v - J.rightKnee[i])),
      capThighM: +Math.hypot(...C.rightKnee.map((v, i) => v - C.rightHip[i])).toFixed(3), capShankM: +Math.hypot(...C.rightAnkle.map((v, i) => v - C.rightKnee[i])).toFixed(3),
      trunkLeanCapturedDeg: +r.trunkLeanCapturedDeg.toFixed(1), pelvisPitchPriorDeg: +r.pelvisPitchPriorDeg.toFixed(1), pelvisPitchDeg: +r.pelvisPitchDeg.toFixed(1), pelvisYawSolvedDeg: r.pelvisYawSolvedDeg,
      thoraxFlexionDeg: +A.trunk.flexion.toFixed(1), hipFlexCapturedVsUprightDeg: +capA.rightHip.flexion.toFixed(1), hipFlexSolvedVsPitchedDeg: +A.rightHip.flexion.toFixed(1),
      thighBackCapturedDeg: +thighBackDeg(C).toFixed(1), thighBackSolvedDeg: +thighBackDeg(J).toFixed(1), airW: +r.legSolve.right.airW.toFixed(2),
      kneeMovedM: +Math.hypot(...J.rightKnee.map((v, i) => v - C.rightKnee[i])).toFixed(3), ankleMovedM: +Math.hypot(...J.rightAnkle.map((v, i) => v - C.rightAnkle[i])).toFixed(3),
      captureTopDown: legOrder(C, cams.topDown, sk.radiiM), cams: {} };
    for (const [cn, cam] of Object.entries(cams)) row.cams[cn] = legOrder(J, cam, sk.radiiM);
    out.push(row);
  });
  return out;
}
// RETURN fix 2: back-leg depth-sign audit. For each frame, thigh and shank: the capture's depth hint (sign of the captured
// bone's z), the two cos-rule candidates pick() sees (±sqrt(L² − L2D²)) with the clamp cost of each (MEASURED by the solver),
// the sign pick() would choose and why, and what r2 actually uses (the captured 3D direction when the bone's joints have
// depth; pick()'s choice only for a clip without depth).
export function depthSignAudit(runs, mode) {
  const run = runs.find(r => r.id === "alcaraz" && /poetry/.test(r.clip) && r.mode === mode), out = [];
  const sgn = v => v > 0 ? "+" : v < 0 ? "−" : "0";
  run.res.forEach((r, k) => {
    if (k < RYAN_FRAMES[0] || k > RYAN_FRAMES[1]) return;
    const cap = SK.frameToLocal(run.m.frames[k], run.sk.heightM);
    const row = { frame: k, t: +r.t.toFixed(4), mode, pelvisPitchDeg: +r.pelvisPitchDeg.toFixed(1), pelvisYawSolvedDeg: r.pelvisYawSolvedDeg, airW: +r.legSolve.right.airW.toFixed(2), bones: {} };
    for (const [b, a, c] of [["rightThigh", "rightHip", "rightKnee"], ["rightShank", "rightKnee", "rightAnkle"]]) {
      const p = r.picks[b], dz = cap[c][2] - cap[a][2], hint = Math.abs(dz) > 1e-9 ? Math.sign(dz) : 0;
      if (!p) { row.bones[b] = { captureDzM: +dz.toFixed(3), hint, cosRule: null, used: "IK to the planted ankle (no sign choice)", usedClampDeg: null, cosRuleAgainstHint: false, usedAgainstHint: false, why: "planted foot" }; continue; }
      const cr = p.cosRule, cs = cr ? cr.all.map(x => ({ sign: x.sign, clampDeg: +x.clampDeg.toFixed(1) })) : [];
      const crSign = cr ? cr.sign : null, crAgainst = !!(cr && hint && crSign && crSign !== hint);
      let why = cr ? (cr.why === "single" ? "cos rule: bone not foreshortened, one candidate" : "cos rule chose by " + cr.why) : "no audit";
      if (crAgainst) { const w = cs.find(x => x.sign === crSign), h = cs.find(x => x.sign === hint);
        why = `cos rule: hinted sign ${sgn(hint)} (${b === "rightThigh" ? (hint < 0 ? "knee behind the hip = hip extension" : "knee in front = hip flexion") : (hint < 0 ? "ankle behind the knee" : "ankle in front of the knee")}) clamps ${h.clampDeg}° vs ${w.clampDeg}° for the chosen sign at pelvis pitch ${row.pelvisPitchDeg}° (pick(): least clamping wins when the gap is > 1°). r2 does NOT use this pick here: the bone has captured depth, so its captured 3D direction is used`; }
      row.bones[b] = { captureDzM: +dz.toFixed(3), hint, cosRule: { candidates: cs, chosen: crSign, why: cr && cr.why }, used: p.why === "single" ? "captured 3D direction" : "cos rule pick " + sgn(p.sign), usedClampDeg: +p.all[0].clampDeg.toFixed(1), cosRuleAgainstHint: crAgainst, usedAgainstHint: p.why !== "single" && !!(hint && p.sign && p.sign !== hint), why };
    }
    out.push(row);
  });
  return out;
}
if (import.meta.url === "file://" + process.argv[1]) {
  const OUT = process.argv[2] || ".";
  fs.mkdirSync(OUT, { recursive: true });
  const runs = solveAll(), T = BJ.table, rep = { generatedLocal: new Date().toString(), tolerance: "bone length |L − L_fixed| ≤ 1e-6 m; joint limits ±1e-6°", limitsSource: T.source, widened: T.widened, dominantShoulderER: T.dominantShoulderER, unobserved: SK.UNOBSERVED, runs: [] };
  const clamp10 = [], er = [], movedAll = {}, knee = [], pitch = [];
  for (const run of runs) {
    const ll = lengthAndLimits(run), moved = {};
    run.res.forEach((r, k) => {
      for (const n in r.moved) { (moved[n] = moved[n] || []).push(r.moved[n].xyz != null ? r.moved[n].xyz : r.moved[n].xy); }
      for (const c of r.clamps) if (Math.abs(c.captured - c.solved) > 10) clamp10.push({ player: run.id, clip: run.clip, mode: run.mode, frame: k, t: +r.t.toFixed(4), joint: c.joint, axis: c.axis, capturedDeg: +c.captured.toFixed(1), solvedDeg: +c.solved.toFixed(1) });
    });
    // every frame whose knee flexion is cut at the SOURCED 137.7 (cdc_soucie; AAOS 135 is not wider, so no widening)
    run.res.forEach((r, k) => { for (const c of r.clamps) if (/Knee$/.test(c.joint) && c.axis === "flexion" && c.captured > c.solved) knee.push({ player: run.id, clip: run.clip, mode: run.mode, frame: k, t: +r.t.toFixed(4), knee: c.joint, capturedDeg: +c.captured.toFixed(1), solvedDeg: +c.solved.toFixed(1) }); });
    if (run.live) pitch.push({ player: run.id, clip: run.clip, mode: run.mode, minDeg: +Math.min(...run.res.map(r => r.pelvisPitchDeg)).toFixed(1), maxDeg: +Math.max(...run.res.map(r => r.pelvisPitchDeg)).toFixed(1),
      maxStepDeg: +Math.max(0, ...run.res.slice(1).map((r, k) => Math.abs(r.pelvisPitchDeg - run.res[k].pelvisPitchDeg))).toFixed(2), framesOffPrior5deg: run.res.filter(r => Math.abs(r.pelvisPitchDeg - r.pelvisPitchPriorDeg) > 5).length, frames: run.res.length });
    // every frame whose shoulder ER (captured direction, before clamping) passes the limit: dominant 105.4, other 90
    run.res.forEach((r, k) => { for (const c of r.clamps) if (/Shoulder$/.test(c.joint) && c.axis === "rotation" && c.captured > 0) er.push({ player: run.id, clip: run.clip, mode: run.mode, frame: k, t: +r.t.toFixed(4), shoulder: c.joint, dominant: c.joint === ((run.m.hand || "R") === "L" ? "leftShoulder" : "rightShoulder"), capturedERdeg: +c.captured.toFixed(1), solvedERdeg: +c.solved.toFixed(1) }); });
    const st = {}; for (const n in moved) { const a = moved[n].sort((x, y) => x - y); st[n] = { medianM: +a[a.length >> 1].toFixed(4), maxM: +a[a.length - 1].toFixed(4) }; }
    if (run.live) movedAll[run.id + " | " + run.clip + " | " + run.mode] = st;
    rep.runs.push({ player: run.id, clip: run.clip, live: run.live, mode: run.mode, frames: run.res.length, maxBoneErrM: ll.maxErr, worst: ll.worst, limitViolations: ll.viol.length, clampsTotal: run.res.reduce((a, r) => a + r.clamps.length, 0), lifts: run.res.filter(r => r.lift > 0).length, maxLiftM: +Math.max(...run.res.map(r => r.lift || 0)).toFixed(4) });
  }
  const ry = ryanCase(runs), ryImg = ryanCase(runs, "image"), audit = { direction: depthSignAudit(runs, "direction"), image: depthSignAudit(runs, "image") };
  fs.writeFileSync(path.join(OUT, "ryan-case-image-mode.json"), JSON.stringify(ryImg, null, 1));
  fs.writeFileSync(path.join(OUT, "depth-sign-audit.json"), JSON.stringify(audit, null, 1));
  fs.writeFileSync(path.join(OUT, "skeleton-report.json"), JSON.stringify(rep, null, 1));
  fs.writeFileSync(path.join(OUT, "skeleton-moved-from-capture.json"), JSON.stringify(movedAll, null, 1));
  fs.writeFileSync(path.join(OUT, "clamps-over-10deg.json"), JSON.stringify(clamp10, null, 0).replace(/},{/g, "},\n{"));
  fs.writeFileSync(path.join(OUT, "shoulder-ER-over-limit.json"), JSON.stringify(er, null, 0).replace(/},{/g, "},\n{"));
  fs.writeFileSync(path.join(OUT, "ryan-case.json"), JSON.stringify(ry, null, 1));
  fs.writeFileSync(path.join(OUT, "knee-clamp-137.7.json"), JSON.stringify(knee, null, 0).replace(/},{/g, "},\n{"));
  fs.writeFileSync(path.join(OUT, "pelvis-pitch-summary.json"), JSON.stringify(pitch, null, 1));
  // TXT summary
  const L = [];
  L.push("HQ-20261117-002.PM.1 skeleton evidence — " + rep.generatedLocal, "Tolerance: " + rep.tolerance, "Limits: " + rep.limitsSource, "");
  L.push("Per run: player | clip | mode | frames | max bone error (m) | limit violations | clamps | ground lifts (max m)");
  for (const r of rep.runs) L.push([r.player, r.clip, r.mode, r.frames, r.maxBoneErrM.toExponential(2), r.limitViolations, r.clampsTotal, r.lifts + " (" + r.maxLiftM + ")"].join(" | "));
  L.push("", "CDC means widened to AAOS (rule 3):"); for (const w of T.widened) L.push(`  ${w.joint}.${w.axis} ${w.side}: CDC ${w.cdcMeanDeg} → ${w.usedDeg} (${w.sourceId}, ${w.where})`);
  L.push("", "Clamps > 10° (all runs): " + clamp10.length + " (live serves: " + clamp10.filter(c => !/2D/.test(c.clip)).length + ")");
  L.push("Knee flexion cut at 137.7 (SOURCED cdc_soucie): " + knee.length + " rows (live: " + knee.filter(c => !/2D/.test(c.clip)).length + "); see knee-clamp-137.7.json");
  L.push("Pelvis pitch (solved, NOT clamped — null row): " + pitch.map(p => `${p.player} ${p.clip.split(" ")[0]} ${p.mode} ${p.minDeg}..${p.maxDeg}° max step ${p.maxStepDeg}°`).join(" | "));
  L.push("Shoulder ER frames past limit: dominant > " + T.dominantShoulderER.deg + ": " + er.filter(e => e.dominant).length + " rows; non-dominant > 90: " + er.filter(e => !e.dominant).length + " rows");
  L.push("", "Ryan's case (alcaraz-poetry first, right leg, frames " + RYAN_FRAMES.join("–") + ", direction mode = the in-page mode; folded = solved knee ≥ " + FOLD_DEG + "°):");
  for (const r of ry) L.push(`  frame ${r.frame} t=${r.t.toFixed(3)} ${r.folded ? "FOLDED" : "      "} knee cap ${r.kneeFlexCapturedDeg}° solved ${r.kneeFlexSolvedDeg}° | pitch ${r.pelvisPitchDeg}° | capture topDown: ${r.captureTopDown.result} (gap ${r.captureTopDown.overlapDepthGapM}) | ` + Object.entries(r.cams).map(([k, v]) => `${k}: ${v.result} (gap ${v.overlapDepthGapM})`).join(" ; "));
  fs.writeFileSync(path.join(OUT, "skeleton-report.txt"), L.join("\n") + "\n");
  console.log(L.join("\n"));
}
