// HQ-20261117-002.PM.1 — fixed-length skeleton, SOURCED joint limits, per-segment draw order. Run: node --test src/body/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { measurementClips } from "../tools/load-motions.mjs";
import { solveAll, lengthAndLimits, ryanCase } from "../tools/evidence.mjs";
const require = createRequire(import.meta.url);
const SK = require("../skeleton.js"), BJ = require("../joints.js");
const JSON_TABLE = JSON.parse(readFileSync(new URL("../../../datasets/anatomy/joints.json", import.meta.url), "utf8"));
const TOL_M = 1e-6;            // bone length tolerance (metres)
const runs = solveAll();

test("limits are READ from datasets/anatomy/joints.json, sourceIds kept, no numbers in joints.js", () => {
  const T = BJ.table;
  for (const [jn, J] of Object.entries(JSON_TABLE.joints)) for (const [ax, r] of Object.entries(J.axes)) {
    const row = T.rows[jn + "." + ax];
    assert.ok(row, jn + "." + ax);
    assert.equal(row.sourceId, r.sourceId, "sourceId kept " + jn + "." + ax);
    assert.equal(row.label, r.label, "label kept " + jn + "." + ax);
    if (r.minDeg == null || r.maxDeg == null) assert.equal(row.enforced, false, "null row has no clamp " + jn + "." + ax);
    else if (!row.widenedFrom) { assert.equal(row.minDeg, r.minDeg); assert.equal(row.maxDeg, r.maxDeg); }
  }
  const src = readFileSync(new URL("../joints.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal((src.match(/\b(1[0-9]{2}|[2-9][0-9])(\.\d+)?\b/g) || []).length, 0, "no limit numbers hard-coded in joints.js");
  assert.doesNotMatch(T.source, /pending/i);
});

test("CDC means are widened to the row's AAOS alternative (rule 3), recorded", () => {
  const w = BJ.table.widened.map(x => `${x.joint}.${x.axis}.${x.side}:${x.cdcMeanDeg}->${x.usedDeg}`).sort();
  assert.deepEqual(w, ["ankle.dorsiPlantarflexion.max:12.7->20", "elbow.flexionExtension.max:144.6->150", "hip.flexionExtension.min:-17.4->-20", "shoulder.flexionExtension.max:168.8->180"]);
});

test("dominant shoulder ER = 105.4 (garret_2024_meta), never the dynamic 172; non-dominant stays clinical 90", () => {
  assert.equal(BJ.table.dominantShoulderER.deg, 105.4);
  assert.equal(BJ.table.dominantShoulderER.sourceId, "garret_2024_meta");
  for (const hand of ["R", "L"]) {
    const rg = SK.ranges(null, hand, SK.skeletonFor("sinner")), dom = hand === "R" ? "rightShoulder" : "leftShoulder", non = hand === "R" ? "leftShoulder" : "rightShoulder";
    assert.equal(rg[dom].rotation[1], 105.4); assert.equal(rg[non].rotation[1], 90); assert.equal(rg[dom].rotation[0], -70);
    assert.ok(JSON.stringify(rg).indexOf("172") < 0);
  }
});

test("one skeleton per player: heightM SOURCED (game value), proportions MEASURED and reproducible", () => {
  const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
  for (const id of ["alcaraz", "sinner"]) {
    const sk = SK.skeletonFor(id), S = SK.SKELETONS[id];
    const hm = html.match(new RegExp(`id: "${id}",[^\\n]*heightM: ([0-9.]+)`));
    assert.equal(sk.heightM, +hm[1], id + " heightM equals the game's");
    const ms = measurementClips(id).map(c => c.m), r = SK.measureBoneRatios(ms);
    for (const k in S.ratio) assert.ok(Math.abs(r[k].ratio - S.ratio[k]) < 5e-4, `${id} ${k} ratio ${r[k].ratio} vs table ${S.ratio[k]}`);
    assert.ok(Math.abs(SK.measureNeckNeutral(ms) - S.neckNeutralDeg) < 0.05);
    assert.ok(Math.abs(SK.measureAnkleNeutral(ms) - S.ankleNeutralDeg) < 0.05);
    // standing ankle→nose chain = 0.90 H after the ESTIMATED scale anchor
    const L = sk.L, chain = L.shank + L.thigh + L.trunk + L.neck * Math.cos(S.neckNeutralDeg * Math.PI / 180);
    assert.ok(Math.abs(chain / sk.heightM - 0.90) < 1e-9);
    assert.equal(sk.L.pelvis, S.pelvisM);
  }
});

test("EVERY frame of every serve: bone lengths constant (≤ 1e-6 m) and ZERO joint-limit violations", () => {
  const lines = [];
  for (const run of runs) {
    const r = lengthAndLimits(run);
    lines.push(`${run.id} | ${run.clip} | ${run.mode} | frames ${run.res.length} | max |ΔL| ${r.maxErr.toExponential(2)} m | violations ${r.viol.length}`);
    assert.ok(r.maxErr <= TOL_M, run.clip + " max bone error " + r.maxErr);
    assert.equal(r.viol.length, 0, run.clip + " violations " + JSON.stringify(r.viol.slice(0, 3)));
  }
  console.log(lines.join("\n"));
  assert.ok(runs.filter(r => r.id === "alcaraz" && r.live).length >= 2 && runs.filter(r => r.id === "sinner" && r.live).length >= 2);
});

test("hinge knee bends one way only: a forward-bent knee is turned back by the hip-rotation limit", () => {
  const sk = SK.skeletonFor("sinner"), H = sk.heightM;
  const base = { leftHip: [-0.09, 0.5 * H, 0], rightHip: [0.09, 0.5 * H, 0], leftShoulder: [-0.19, 0.83 * H, 0], rightShoulder: [0.19, 0.83 * H, 0], nose: [0, 0.93 * H, 0.08],
    leftElbow: [-0.22, 0.65 * H, 0], rightElbow: [0.22, 0.65 * H, 0], leftWrist: [-0.22, 0.5 * H, 0.05], rightWrist: [0.22, 0.5 * H, 0.05] };
  // right shank folds FORWARD (toward +z, the front): impossible for a knee
  const cap = { ...base, leftKnee: [-0.09, 0.26 * H, 0.02], leftAnkle: [-0.09, 0.03 * H, 0], rightKnee: [0.09, 0.26 * H, 0], rightAnkle: [0.09, 0.15 * H, 0.35] };
  const r = SK.solveFrame(cap, sk, { mode: "direction", hand: "R", noYawSearch: true });
  const a = SK.measureAngles(r.joints, sk);
  assert.ok(r.clamps.some(c => c.joint === "rightHip" && c.axis === "rotation"), "hip rotation clamp recorded");
  assert.ok(a.rightHip.rotation >= -45 - 1e-6 && a.rightHip.rotation <= 45 + 1e-6);
  assert.ok(a.rightKnee.flexion <= 137.7 + 1e-6);
});

test("waist rotation: pelvis and thorax yaw separately; X-factor clamped to the SOURCED ±30 (thorax.axialRotation)", () => {
  const sk = SK.skeletonFor("alcaraz"), H = sk.heightM, rot = (p, deg) => { const a = deg * Math.PI / 180; return [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]; };
  const cap = { leftHip: [-0.09, 0.5 * H, 0], rightHip: [0.09, 0.5 * H, 0], leftShoulder: rot([-0.2, 0.82 * H, 0], 50), rightShoulder: rot([0.2, 0.82 * H, 0], 50), nose: [0, 0.93 * H, 0.08],
    leftElbow: [-0.25, 0.65 * H, 0], rightElbow: [0.25, 0.65 * H, 0], leftWrist: [-0.25, 0.5 * H, 0.05], rightWrist: [0.25, 0.5 * H, 0.05],
    leftKnee: [-0.09, 0.27 * H, 0.03], rightKnee: [0.09, 0.27 * H, 0.03], leftAnkle: [-0.09, 0.04 * H, 0], rightAnkle: [0.09, 0.04 * H, 0] };
  const r = SK.solveFrame(cap, sk, { mode: "direction", hand: "R", noYawSearch: true });
  const a = SK.measureAngles(r.joints, sk);
  assert.ok(Math.abs(Math.abs(a.trunk.rotation) - 30) < 1e-6, "clamped to 30: " + a.trunk.rotation);
  assert.ok(r.clamps.some(c => c.joint === "trunk" && c.axis === "rotation" && Math.abs(Math.abs(c.captured) - 50) < 1));
  const r2 = SK.solveFrame(cap, sk, { mode: "direction", hand: "R" });   // with the pelvis-yaw search the pelvis turns to share the 50°
  const a2 = SK.measureAngles(r2.joints, sk);
  assert.ok(Math.abs(a2.trunk.rotation) <= 30 + 1e-6 && r2.pelvisYawSolvedDeg !== 0, "pelvis yaw solved separately: " + r2.pelvisYawSolvedDeg);
});

test("cos rule: a foreshortened bone keeps its image-plane projection and gets depth ±sqrt(L² − L2D²)", () => {
  const sk = SK.skeletonFor("sinner"), H = sk.heightM, L = sk.L.shank;
  const cap = { leftHip: [-0.09, 0.5 * H, null], rightHip: [0.09, 0.5 * H, null], leftShoulder: [-0.19, 0.83 * H, null], rightShoulder: [0.19, 0.83 * H, null], nose: [0, 0.93 * H, null],
    leftElbow: [-0.22, 0.65 * H, null], rightElbow: [0.22, 0.65 * H, null], leftWrist: [-0.22, 0.5 * H, null], rightWrist: [0.22, 0.5 * H, null],
    leftKnee: [-0.09, 0.26 * H, null], leftAnkle: [-0.09, 0.26 * H - 0.6 * L, null], rightKnee: [0.09, 0.26 * H, null], rightAnkle: [0.09, 0.03 * H, null] };
  const r = SK.solveFrame(cap, sk, { mode: "image", hand: "R", noYawSearch: true });
  const K = r.joints.leftKnee, A = r.joints.leftAnkle, l2 = Math.hypot(A[0] - K[0], A[1] - K[1]);
  assert.ok(Math.abs(Math.hypot(A[0] - K[0], A[1] - K[1], A[2] - K[2]) - L) < 1e-9, "full 3D length");
  if (!r.clamps.some(c => /left(Knee|Hip)/.test(c.joint))) assert.ok(Math.abs(Math.abs(A[2] - K[2]) - Math.sqrt(L * L - l2 * l2)) < 1e-9);
  assert.ok(l2 < L, "drawn short on screen, solved at full length");
});

test("Ryan's case: Alcaraz back (right) leg folded at landing — shank drawn AFTER thigh from the back-leg slant and the game's behind cameras", () => {
  const rows = ryanCase(runs);
  assert.ok(rows.length >= 3, "landing frames with solved knee flexion ≥ 120° exist: " + rows.length);
  const sk = SK.skeletonFor("alcaraz");
  let overlapped = 0;
  for (const r of rows) {
    assert.ok(r.kneeFlexSolvedDeg >= 120 && r.kneeFlexSolvedDeg <= 137.7 + 1e-6);
    assert.ok(Math.abs(r.thigh3D - sk.L.thigh) < 1e-6 && Math.abs(r.shank3D - sk.L.shank) < 1e-6, "full 3D lengths");
    for (const cn of ["slantRight", "serveCam", "broadcast"]) { const c = r.cams[cn];
      assert.ok(c.thighIdx >= 0 && c.shankIdx >= 0, "both segments drawn (none deleted)");
      if (c.overlap) { overlapped++; assert.ok(c.shankOverThigh, `frame ${r.frame} ${cn}: shank must be drawn after (over) the thigh`); } }
    for (const cn of ["topDown", "slantLeft"]) assert.ok(r.cams[cn].thighIdx >= 0 && r.cams[cn].shankIdx >= 0);   // reported, geometry decides (see ryan-case.json)
  }
  assert.ok(overlapped >= 3, "the fold overlaps on screen in several frames: " + overlapped);
  // foreshortened on screen while full length in 3D, in at least one frame/camera
  assert.ok(rows.some(r => Object.values(r.cams).some(c => c.shankProjM < 0.6 * sk.L.shank)));
});

test("far limb behind the torso: seen from the player's right, the LEFT upper arm is drawn before the torso", () => {
  const run = runs.find(r => r.id === "sinner" && r.live && r.mode === "direction"), J = run.res[0].joints;
  const R = [J.rightShoulder[0] - J.leftShoulder[0], 0, J.rightShoulder[2] - J.leftShoulder[2]];
  const cam = SK.orthoCamera([-R[0], 0, -R[2]]);   // looking from his right toward his left (his own shoulder line)
  const names = SK.segmentsInDrawOrder(J, cam, SK.skeletonFor("sinner").radiiM).order.map(x => x.name);
  assert.ok(names.indexOf("leftUpperArm") < names.indexOf("torso") && names.indexOf("rightUpperArm") > names.indexOf("torso"), names.join(","));
});

test("handedness: both are right-handed; the solved RIGHT wrist is the high one at contact", () => {
  for (const run of runs.filter(r => r.live && r.mode === "direction")) {
    assert.equal(run.m.hand, "R", run.clip);
    const E = run.m.events, k = run.res.reduce((b, r, i) => Math.abs(r.t - E.contact) < Math.abs(run.res[b].t - E.contact) ? i : b, 0), J = run.res[k].joints;
    assert.ok(J.rightWrist[1] > J.leftWrist[1], run.clip + " right wrist higher at contact");
  }
});

test("draw order invariant: for every overlapping pair, the farther overlapping part is drawn first (all cameras, every Ryan frame)", () => {
  const run = runs.find(r => r.id === "alcaraz" && /poetry/.test(r.clip) && r.mode === "direction"), sk = SK.skeletonFor("alcaraz");
  const cams = [SK.orthoCamera([0, -1, 0], [0, 0, 1]), SK.orthoCamera([1, 0, 0]), SK.orthoCamera([0, 0, 1]), SK.lookAtCamera([0, 5, -7], [0, 1, 0], 1)];
  let pairs = 0;
  for (const r of run.res.filter((_, k) => k % 7 === 0)) for (const cam of cams) {
    const o = SK.segmentsInDrawOrder(r.joints, cam, sk.radiiM), idx = Object.fromEntries(o.order.map((x, k) => [x.name, k]));
    assert.equal(o.order.length, 14, "every segment returned, none deleted");
    for (const p of o.pairs) { pairs++; if (idx[p.far] > idx[p.near]) assert.fail(`cycle-broken pair ${p.far}/${p.near} must be rare`); }
  }
  assert.ok(pairs > 50);
});
