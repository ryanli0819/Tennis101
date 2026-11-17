// node --test src/players/segment-paint.test.mjs — HQ-20261117-002.PM.1 paint: draw order + near-tie hysteresis.
// Ryan's case = alcaraz-poetry first serve, frames 325–342, solved in direction mode (= the in-page mode) by the Body Motion
// Engineer's skeleton, cameras = src/body/tools/evidence.mjs ryanCams (topDown, slantRight).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const SK = require("../body/skeleton.js");
const SP = require("./segment-paint.js");
const { liveMotions } = await import("../body/tools/load-motions.mjs");
const { ryanCams } = await import("../body/tools/evidence.mjs");

const m = liveMotions().alcaraz[0].m, sk = SK.skeletonFor("alcaraz");
const res = SK.solveMotion(m, sk, { mode: "direction" });
const legPair = o => o.pairs.find(p => [p.far, p.near].includes("rightThigh") && [p.far, p.near].includes("rightShank"));
const calfOver = names => names.indexOf("rightShank") > names.indexOf("rightThigh");
function run(view, f0, f1, o = {}) {
  SP.reset("t");
  const rows = [];
  for (let k = f0; k <= f1; k++) {
    const r = res[k], cam = ryanCams(r.hipMid)[view];
    const out = SP.order(r.joints, cam, sk.radiiM, { player: "t", view, camKey: o.camKey ? o.camKey(k) : view, thr: o.thr });
    const pr = legPair(out);
    rows.push({ k, overlap: !!pr, calf: calfOver(out.names), rawCalf: calfOver(out.raw), gap: pr ? pr.meanDepthGap : null, held: pr ? pr.held : false, out });
  }
  return rows;
}

test("threshold is the stated GAME-DESIGN value (0.02 m) and the API is pinned", () => {
  assert.equal(SP.HYST_M, 0.02);
  assert.equal(SP.API, 1);
});

test("no state → exactly the skeleton's own order, every segment kept (hidden ones drawn first, not deleted)", () => {
  for (const view of ["topDown", "slantRight"]) for (let k = 325; k <= 342; k++) {
    const r = res[k], cam = ryanCams(r.hipMid)[view];
    const ref = SK.segmentsInDrawOrder(r.joints, cam, sk.radiiM).order.map(x => x.name);
    const o = SP.order(r.joints, cam, sk.radiiM);
    assert.deepEqual(o.names, ref, `${view} f${k}`);
    assert.equal(o.names.length, 14, "13 limb segments + torso");
  }
});

test("Ryan's case from above, 330–335: the thigh/calf order never flickers; 333's 0.004 m near-tie is held", () => {
  const rows = run("topDown", 325, 342).filter(r => r.k >= 330 && r.k <= 335);
  const ov = rows.filter(r => r.overlap);
  assert.ok(ov.length >= 4, "330–333 overlap");
  assert.equal(new Set(ov.map(r => r.calf)).size, 1, "one order across every overlapping frame 330–335");
  assert.equal(ov[0].calf, false, "thigh over, as the capture's own depth has it on 330–333");
  const f333 = rows.find(r => r.k === 333);
  assert.equal(f333.rawCalf, true, "the skeleton alone flips to calf-over on 333…");
  assert.ok(f333.gap < SP.HYST_M, "…by less than the threshold");
  assert.equal(f333.held, true); assert.equal(f333.calf, false, "…and the paint holds thigh-over");
});

test("without hysteresis (thr 0) the same frames DO flicker 332 → 333 (the test can fail)", () => {
  const rows = run("topDown", 325, 342, { thr: 0 });
  const a = rows.find(r => r.k === 332), b = rows.find(r => r.k === 333);
  assert.notEqual(a.calf, b.calf);
});

test("a real swap goes through when the gap is large (≥ threshold)", () => {
  // synthetic leg seen from straight above (local coords, y = up): the thigh lies low, the shank crosses OVER it 0.2 m higher
  const cam = SK.orthoCamera([0, -1, 0], [0, 0, 1]);
  const base = { leftShoulder: [-0.2, 1.0, -0.6], rightShoulder: [0.2, 1.0, -0.6], leftHip: [-0.09, 0.5, -0.3], rightHip: [0.09, 0.5, 0],
    leftKnee: [-0.09, 0.3, -0.3], leftAnkle: [-0.09, 0.05, -0.3], nose: [0, 1.2, -0.5] };
  const over = { ...base, rightKnee: [0.6, 0.5, 0], rightAnkle: [0.15, 0.25, -0.05] };    // thigh flat at 0.5 m, calf folded back UNDER it → thigh over
  const under = { ...base, rightKnee: [0.6, 0.5, 0], rightAnkle: [0.15, 0.75, -0.05] };   // calf folded back ABOVE it (0.25 m higher) → calf over
  SP.reset("s");
  const o1 = SP.order(over, cam, sk.radiiM, { player: "s", view: "v", camKey: "v" });
  const p1 = legPair(o1); assert.ok(p1, "overlap"); assert.equal(calfOver(o1.names), false);
  const o2 = SP.order(under, cam, sk.radiiM, { player: "s", view: "v", camKey: "v" });
  const p2 = legPair(o2); assert.ok(p2.meanDepthGap >= SP.HYST_M, "large gap");
  assert.equal(p2.held, false); assert.equal(calfOver(o2.names), true, "swapped: calf over");
});

test("hold(): keeps the previous order only below the threshold", () => {
  const st = { pairs: new Map() };
  SP.hold(st, [{ far: "A", near: "B", meanDepthGap: 0.05 }]);
  assert.equal(SP.hold(st, [{ far: "B", near: "A", meanDepthGap: 0.019 }])[0].far, "A", "0.019 < 0.02 → held");
  assert.equal(SP.hold(st, [{ far: "B", near: "A", meanDepthGap: 0.02 }])[0].far, "B", "0.02 → swaps");
  assert.equal(SP.hold(st, [{ far: "A", near: "B", meanDepthGap: 0.001 }])[0].far, "B", "now B far is held");
});

test("state is per player and per view, and resets on camera change", () => {
  run("topDown", 325, 332);                                   // player "t" leaves thigh-over in its state
  const r = res[333], cam = ryanCams(r.hipMid).topDown;
  const other = SP.order(r.joints, cam, sk.radiiM, { player: "u", view: "topDown", camKey: "topDown" });
  assert.equal(calfOver(other.names), true, "another player starts fresh");
  const same = SP.order(r.joints, cam, sk.radiiM, { player: "t", view: "topDown", camKey: "topDown" });
  assert.equal(calfOver(same.names), false, "same player, same camera: held");
  run("topDown", 325, 332);
  const moved = SP.order(r.joints, cam, sk.radiiM, { player: "t", view: "topDown", camKey: "otherCam" });
  assert.equal(moved.resets >= 1, true); assert.equal(calfOver(moved.names), true, "camera changed → fresh order");
});

test("extras: the skull follows the neck; a racket behind the torso is drawn before it even if the hand is in front", () => {
  const cam = SK.orthoCamera([0, 0, 1], [0, 1, 0]);           // looking along +z (forward): depth = z, farther = larger z
  const J = { leftShoulder: [-0.2, 1.4, 0], rightShoulder: [0.2, 1.4, 0], leftHip: [-0.09, 0.9, 0], rightHip: [0.09, 0.9, 0],
    leftKnee: [-0.09, 0.45, 0], rightKnee: [0.09, 0.45, 0], leftAnkle: [-0.09, 0.05, 0], rightAnkle: [0.09, 0.05, 0],
    leftElbow: [-0.3, 1.15, 0], leftWrist: [-0.3, 0.9, 0], rightElbow: [0.3, 1.2, -0.15], rightWrist: [0.25, 1.05, -0.3], rightIndex: [0.22, 1.0, -0.35], nose: [0, 1.62, -0.12] };
  const racket = [0.12, 0.22, 0.32, 0.42, 0.52, 0.62].map(t => ({ p: [0.25 - 0.3 * t, 1.05 - 0.1 * t, -0.3 + 0.9 * t], r: t < 0.36 ? 0.025 : 0.13 }));   // grip in front, head behind the back
  const o = SP.order(J, cam, sk.radiiM, { extras: [{ name: "head", anchor: "neck", samples: [{ p: [0, 1.62, -0.02], r: 0.19 }] }, { name: "racket", anchor: "rightHand", skip: ["rightForearm"], samples: racket }] });
  assert.ok(o.names.indexOf("head") > o.names.indexOf("neck"));
  assert.ok(o.names.indexOf("racket") < o.names.indexOf("torso"), "racket head behind the back → before the torso");
  assert.ok(o.names.indexOf("rightHand") > o.names.indexOf("torso"), "the hand in front stays after the torso");
  assert.equal(o.names.length, o.raw.length + 2, "every segment + skull + racket");
});
