// Body Animator tests: node src/body/test/body.test.mjs (Node 18+).
// Loads the classic scripts in a sandbox, drives the footwork state the way the game does, and checks:
// segment lengths add up to each player's height; knee and elbow stay inside their ranges through a run cycle;
// planted toes never slide; bones keep their length; cadence rises with speed; lean follows acceleration;
// the split-step hops; playMotion plays a captured serve unchanged; three.js CCDIKSolver agrees with the exact IK.
// The CCD check fetches three@0.170.0 once into the temp folder (skipped offline).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, "../../..");
const ctx = vm.createContext({ console, Math, Promise, URLSearchParams });
ctx.window = ctx;
for (const f of ["src/body/skeleton.js", "src/body/ik.js", "src/body/body.js", "src/serve/motion/sinner-serve.js"])
  vm.runInContext(fs.readFileSync(path.join(repo, f), "utf8"), ctx, { filename: f });
const { BodySkeleton: SK, BodyIK: IK, Body } = ctx;

let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log("FAIL", msg); } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const PLAYERS = [{ id: "sinner", heightM: 1.91, side: "near" }, { id: "alcaraz", heightM: 1.83, side: "far" }];

// 1. segment lengths add up to the height
for (const P of PLAYERS) {
  const L = SK.segments(P);
  const sum = L.ankle + L.shank + L.thigh + L.trunk + L.neck + L.head;
  ok(Math.abs(sum - P.heightM) < 1e-9, `${P.id}: column ${sum} ≠ ${P.heightM}`);
  ok(Math.abs(L.topZ - P.heightM) < 1e-9, `${P.id}: top of head ${L.topZ}`);
}
{ const L = SK.segments({ heightM: 1.91, armSpanM: 1.98 });
  ok(Math.abs(L.shoulderWidth + 2 * (L.upperArm + L.forearm + L.hand) - 1.98) < 1e-9, "armSpanM rescales the arms"); }

// a small footwork driver: same state fields the game's moveBody writes
const newBody = y => ({ x: 0, y, vx: 0, vy: 0, air: 0, slide: 0, slideV: { x: 0, y: 0 }, receiving: false });
function drive(script, opts = {}) {
  Body.reset();
  const pos = [newBody(-12), newBody(12)], dt = 1 / 60, frames = [];
  const racket = i => { const p = pos[i], R = PLAYERS[i].side === "near" ? 1 : -1;
    return { g: { x: p.x + R * 0.4, y: p.y + R * 0.18, z: 0.96 }, u: { x: R * 0.34 / 1.05, y: R * 0.3 / 1.05, z: 0.89 / 1.05 }, n: { x: 0, y: -R, z: 0 }, throat: true }; };
  for (let t = 0; t < script.T; t += dt) {
    for (let i = 0; i < 2; i++) {
      const p = pos[i], w = script.vel(t, i);              // wanted velocity
      const dvx = w.x - p.vx, dvy = w.y - p.vy, dl = Math.hypot(dvx, dvy), rate = (dvx * p.vx + dvy * p.vy < 0 ? 11 : 8.6) * dt;
      if (dl > 1e-9 && !(p.air > 0)) { const k = Math.min(1, rate / dl); p.vx += dvx * k; p.vy += dvy * k; }
      if (script.air && script.air(t, i) && !(p.air > 0)) p.air = 0.22;
      if (p.air > 0) p.air -= dt;
      if (script.slide && script.slide(t, i) && !(p.slide > 0)) { p.slide = 0.32; p.slideV = { x: p.vx * 1.4, y: p.vy * 1.4 }; }
      if (p.slide > 0) { p.slide = Math.max(0, p.slide - dt); const k = p.slide / 0.32; p.vx = p.slideV.x * k; p.vy = p.slideV.y * k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    Body.update(dt, { pos, PLAYERS, racket: opts.noRacket ? null : racket });
    frames.push({ t, pos: pos.map(p => ({ ...p })), pose: [0, 1].map(i => JSON.parse(JSON.stringify(Body.getPose(i)))) });
  }
  return frames;
}
function checkLimbs(frames, label) {
  let kMax = 0, eMax = 0, kMin = 999, eMin = 999, slide = 0, boneErr = 0;
  frames.forEach((f, n) => [0, 1].forEach(i => {
    const J = f.pose[i].joints, L = SK.segments(PLAYERS[i]);
    for (const s of ["left", "right"]) {
      const k = SK.flexion(J[s + "Hip"], J[s + "Knee"], J[s + "Ankle"]), e = SK.flexion(J[s + "Shoulder"], J[s + "Elbow"], J[s + "Wrist"]);
      kMax = Math.max(kMax, k); kMin = Math.min(kMin, k); eMax = Math.max(eMax, e); eMin = Math.min(eMin, e);
      boneErr = Math.max(boneErr, Math.abs(dist(J[s + "Hip"], J[s + "Knee"]) - L.thigh), Math.abs(dist(J[s + "Knee"], J[s + "Ankle"]) - L.shank),
                         Math.abs(dist(J[s + "Shoulder"], J[s + "Elbow"]) - L.upperArm), Math.abs(dist(J[s + "Elbow"], J[s + "Wrist"]) - L.forearm));
    }
    if (n) f.pose[i].feet.forEach((ft, k) => { const pr = frames[n - 1].pose[i].feet[k];
      if (ft.planted && pr.planted && !ft.slid) slide = Math.max(slide, Math.hypot(ft.toe.x - pr.toe.x, ft.toe.y - pr.toe.y)); });
  }));
  ok(kMin >= 0 && kMax <= SK.LIMITS.knee[1] + 0.5, `${label}: knee ${kMin.toFixed(1)}–${kMax.toFixed(1)}°`);
  ok(eMin >= 0 && eMax <= SK.LIMITS.elbow[1] + 0.5, `${label}: elbow ${eMin.toFixed(1)}–${eMax.toFixed(1)}°`);
  ok(slide < 1e-9, `${label}: a planted toe slid ${slide} m`);
  ok(boneErr < 1e-3, `${label}: a bone changed length by ${boneErr} m`);
  console.log(`  ${label}: knee ${kMin.toFixed(0)}–${kMax.toFixed(0)}°, elbow ${eMin.toFixed(0)}–${eMax.toFixed(0)}°`);
}

// 2. run cycle: sprint sideways, brake, sprint back, run forward, back-pedal, shuffle, split-step, slide
const rally = {
  T: 9,
  vel: (t, i) => t < 1.5 ? { x: 6.6, y: 0 } : t < 3 ? { x: -6.6, y: 0 } : t < 4.5 ? { x: 0, y: (i ? -1 : 1) * 5 } : t < 6 ? { x: 0, y: (i ? 1 : -1) * 3 } : t < 7.5 ? { x: 2 * Math.sin(t * 3), y: 0 } : { x: 4, y: 0 },
  air: t => Math.abs(t - 7.6) < 0.01,
  slide: t => Math.abs(t - 8.4) < 0.01
};
const R1 = drive(rally);
checkLimbs(R1, "rally footwork");
checkLimbs(drive(rally, { noRacket: true }), "free arms");

// 3. cadence rises with speed (Alexander: stride grows slower than speed)
const steps = sp => { drive({ T: 3, vel: () => ({ x: 0, y: sp }) }); return Body._state(0).steps; };   // running forward (no side shuffle)
const s2 = steps(2), s6 = steps(6);
ok(s6 > s2, `cadence: ${s2} steps at 2 m/s vs ${s6} at 6 m/s`);
console.log(`  cadence: ${s2} steps in 3 s at 2 m/s, ${s6} at 6 m/s`);

// 4. lean: chest ahead of the pelvis while speeding up, behind it while braking
{ const f = drive({ T: 1.2, vel: t => ({ x: t < 0.7 ? 6.6 : 0, y: 0 }) });
  const at = t => f.find(q => q.t >= t).pose[0].joints, a = at(0.2), b = at(0.85);
  ok(a.chest.x - a.pelvis.x > 0.03, `lean forward when speeding up (${(a.chest.x - a.pelvis.x).toFixed(3)} m)`);
  ok(b.chest.x - b.pelvis.x < -0.01, `lean back when braking (${(b.chest.x - b.pelvis.x).toFixed(3)} m)`); }

// 5. split-step: the pelvis rises ~g·T²/8 and both feet leave the ground, then a crouch on landing
{ const f = drive({ T: 1.2, vel: () => ({ x: 0, y: 0 }), air: t => Math.abs(t - 0.5) < 0.01 });
  const z = t => f.find(q => q.t >= t).pose[0].joints.pelvis.z, base = z(0.45), top = z(0.61), land = z(0.8);
  ok(top - base > 0.04, `split-step hop ${(top - base).toFixed(3)} m`);
  ok(land < base - 0.02, `crouch on landing ${(base - land).toFixed(3)} m`);
  ok(f.find(q => q.t >= 0.61).pose[0].feet.every(ft => !ft.planted), "both feet off the ground in the hop"); }

// 6. playMotion: Sinner's captured serve plays joint for joint after the blend-in
{ Body.reset();
  const m = ctx.SERVE_MOTIONS.sinner.first, pos = [newBody(-12), newBody(12)], dt = 1 / 120;
  Body.update(dt, { pos, PLAYERS });
  Body.playMotion(0, m);
  let t = m.frames[0].t;
  for (let k = 0; k < 60; k++) { Body.update(dt, { pos, PLAYERS }); t += dt; }
  const fr = m.frames.reduce((a, c) => Math.abs(c.t - t) < Math.abs(a.t - t) ? c : a);
  const J = Body.getPose(0).joints, H = 1.91;
  ok(Body.getPose(0).source === "motion", "motion fully blended in after 0.5 s");
  const e = Math.max(...["rightWrist", "leftAnkle", "neck"].map(n => Math.abs(J[n].z - fr.j[n][1] * H)));
  ok(e < 0.03, `serve joints follow the capture (max ${e.toFixed(3)} m between frames)`);
  for (let k = 0; k < 400; k++) Body.update(dt, { pos, PLAYERS });
  ok(Body.getPose(0).source === "gait", "back to the body's own animation after the motion"); }

// 7. three.js CCDIKSolver agrees with the exact IK (needs the network once)
try {
  const dir = path.join(os.tmpdir(), "tennis101-three-0.170.0");
  fs.mkdirSync(dir, { recursive: true });
  const get = async (url, file) => { const f = path.join(dir, file); if (!fs.existsSync(f)) fs.writeFileSync(f, await (await fetch(url)).text()); return f; };
  const core = await get("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three.module.js");
  const solverSrc = await get("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/animation/CCDIKSolver.js", "CCDIKSolver.raw.js");
  const solverFile = path.join(dir, "CCDIKSolver.js");
  fs.writeFileSync(solverFile, fs.readFileSync(solverSrc, "utf8").replace(/from\s+['"]three['"]/g, "from './three.module.js'"));
  const THREE = await import(pathToFileURL(core)), { CCDIKSolver } = await import(pathToFileURL(solverFile));
  ok(await IK.load({ THREE, CCDIKSolver }), "CCDIKSolver loads");
  let worst = 0; const before = { ...IK.stats };
  for (let k = 0; k < 200; k++) {
    const a = { x: Math.random(), y: Math.random(), z: 1 }, t = { x: a.x + Math.random() - 0.5, y: a.y + Math.random() - 0.5, z: a.z - 0.3 - 0.6 * Math.random() };
    const pole = { x: 0, y: 1, z: 0 }, r = IK.solve(a, t, 0.47, 0.47, pole, 135), ex = IK.twoBone(a, t, 0.47, 0.47, pole, 135);
    worst = Math.max(worst, dist(r.end, ex.end));
  }
  ok(worst < 0.011, `CCD lands within 1 cm of the exact answer (worst ${worst.toFixed(4)} m)`);
  const used = IK.stats.ccd - before.ccd, rej = IK.stats.rejected - before.rejected;
  ok(used > rej, `CCD answers used ${used}, rejected ${rej}`);
  console.log(`  three.js CCDIKSolver: ${used} used, ${rej} fell back to the exact IK`);
} catch (e) { console.log("  (CCD check skipped: three.js could not be fetched:", e.message + ")"); }

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
