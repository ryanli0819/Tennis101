// Tennis101 · Ball Physicist tests. Run: node tests/ball.test.mjs   (Node 18+)
// Loads src/ball/ball.js as it runs in the page, with cannon-es 0.20.0 from jsdelivr (cached in the
// OS temp folder). Offline, the engine tests are skipped and the rest run on the built-in step.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const SURFACES = require("../src/ball/surfaces.js");
const Ball = require("../src/ball/ball.js");
const { R } = Ball.CONST;

const CANNON_URL = "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";
async function loadCannon() {
  const dir = join(tmpdir(), "tennis101-cannon"), file = join(dir, "cannon-es-0.20.0.mjs");
  if (!existsSync(file)) {
    const r = await fetch(CANNON_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    mkdirSync(dir, { recursive: true }); writeFileSync(file, await r.text());
  }
  return import(pathToFileURL(file).href);
}
let CANNON = null;
try { CANNON = await loadCannon(); await Ball.init(CANNON); } catch (e) { console.warn("cannon-es not available, engine tests skipped:", e.message); }

const events = [];
Ball.onBounce(e => events.push({ type: "bounce", ...e }));
Ball.onNet(e => events.push({ type: "net", ...e }));

/* Fly the live ball; returns events and the sampled path. */
function fly(launch, surface, { until = "bounce2", tMax = 6 } = {}) {
  Ball.setSurface(surface);
  events.length = 0;
  Ball.launchBall(launch);
  const path = [];
  let prev = Ball.getBall();
  for (let t = 0; t < tMax; t += 1 / 120) {
    const b = Ball.stepBall(1 / 120);
    path.push({ ...b, py: prev.y, pz: prev.z }); prev = b;
    const nb = events.filter(e => e.type === "bounce").length;
    if (until === "bounce1" && nb >= 1) break;
    if (until === "bounce2" && nb >= 2) break;
    if (until === "apex" && nb >= 1 && b.vz < 0) break;
  }
  return { events: events.slice(), bounces: events.filter(e => e.type === "bounce"), nets: events.filter(e => e.type === "net"), path };
}
const V = (speed, deg, dir = { x: 0, y: 1 }) => {
  const L = Math.hypot(dir.x, dir.y), th = deg * Math.PI / 180;
  return { x: speed * Math.cos(th) * dir.x / L, y: speed * Math.cos(th) * dir.y / L, z: speed * Math.sin(th) };
};
const heightAt = (path, y) => { const s = path.find(p => p.y >= y); return s ? s.z : NaN; };
const peakAfter = (path, t) => Math.max(...path.filter(p => p.t > t).map(p => p.z));

test("engine: cannon-es is the live engine", { skip: !CANNON }, () => {
  assert.equal(Ball.engine, "cannon-es@0.20.0");
});

test("ITF drop test: 2.54 m onto each surface", () => {
  const rebound = {};
  for (const s of Object.keys(SURFACES)) {
    const r = fly({ from: { x: 0, y: -5, z: 2.54 + R }, vel: { x: 0, y: 0, z: 0 } }, s, { until: "apex" });
    rebound[s] = peakAfter(r.path, r.bounces[0].t) - R;          // bottom of the ball, as the ITF measures it
  }
  assert.ok(rebound.hard >= 1.35 && rebound.hard <= 1.47, `hard rebound ${rebound.hard.toFixed(3)} m, ITF wants 1.35–1.47`);
  assert.ok(rebound.clay > rebound.hard, `clay ${rebound.clay.toFixed(3)} should bounce higher than hard`);
  assert.ok(rebound.grass < rebound.hard, `grass ${rebound.grass.toFixed(3)} should bounce lower than hard`);
});

test("topspin lands shorter than flat (same launch)", () => {
  const launch = top => ({ from: { x: 0, y: -12, z: 1 }, vel: V(25, 11.5), spin: Ball.spinFor({ x: 0, y: 1 }, top) });
  const flat = fly(launch(0), "hard", { until: "bounce1" }).bounces[0];
  const top = fly(launch(2500), "hard", { until: "bounce1" }).bounces[0];
  const back = fly(launch(-1500), "hard", { until: "bounce1" }).bounces[0];
  assert.ok(top.y < flat.y - 1, `topspin ${top.y.toFixed(2)} vs flat ${flat.y.toFixed(2)}`);
  assert.ok(back.y > flat.y, `backspin ${back.y.toFixed(2)} floats past flat ${flat.y.toFixed(2)}`);
});

test("spin changes the bounce angle the right way (same incoming ball)", () => {
  const out = rpm => fly({ from: { x: 0, y: 3, z: R + 1e-4 }, vel: { x: 0, y: 20, z: -8 }, spin: Ball.spinFor({ x: 0, y: 1 }, rpm) }, "hard", { until: "bounce1" }).bounces[0].vout;
  const ang = v => Math.atan2(v.z, v.y) * 180 / Math.PI;
  const top = out(2500), flat = out(0), back = out(-1500);
  assert.ok(top.y > flat.y && flat.y > back.y, `forward speed after bounce: top ${top.y.toFixed(1)} > flat ${flat.y.toFixed(1)} > back ${back.y.toFixed(1)}`);
  assert.ok(ang(top) < ang(flat) && ang(flat) < ang(back), `angle: topspin skips through lower, backspin checks up steeper`);
});

const deuceBox = b => b.x >= -4.115 - R && b.x <= R && b.y >= 0 && b.y <= 6.40 + R;
for (const surface of Object.keys(SURFACES)) {
  test(`serves clear the net and land in the box (${surface})`, () => {
    Ball.setSurface(surface);
    const from = { x: 0.5, y: -12.3, z: 2.9 };
    const serves = [
      { name: "1st wide", speed: 40, top: 600, side: 1200, curveTo: -1, target: { x: -3.6, y: 5.6 } },
      { name: "1st T", speed: 44, top: 600, side: 1200, curveTo: -1, target: { x: -0.4, y: 5.6 } },
      { name: "2nd kick", speed: 32, top: 3800, side: 800, curveTo: 1, gyro: 1500, kickTo: 1, target: { x: -2.2, y: 5.0 } },
    ];
    for (const s of serves) {
      const sol = Ball.solveShot({ from, target: s.target, speed: s.speed, topRpm: s.top, sideRpm: s.side, curveTo: s.curveTo, gyroRpm: s.gyro || 0, kickTo: s.kickTo || 0 });
      assert.ok(sol.exact, `${s.name}: solver reached the target`);
      const r = fly({ from, vel: sol.vel, spin: sol.spin }, surface, { until: "bounce1" });
      assert.equal(r.nets.length, 0, `${s.name}: touched the net`);
      const cross = r.path.find(p => p.y >= 0);
      assert.ok(cross.z > Ball.netHeight(cross.x) + R, `${s.name}: over the net at ${cross.z.toFixed(2)} m`);
      assert.ok(deuceBox(r.bounces[0]), `${s.name}: landed at (${r.bounces[0].x.toFixed(2)}, ${r.bounces[0].y.toFixed(2)})`);
    }
  });
}

test("kick serve jumps up and sideways after the bounce", () => {
  const from = { x: 0.5, y: -12.3, z: 2.9 }, target = { x: -2.2, y: 5.0 };
  Ball.setSurface("hard");
  const kick = Ball.solveShot({ from, target, speed: 32, topRpm: 3800, sideRpm: 800, curveTo: 1, gyroRpm: 1500, kickTo: 1 });
  const flat = Ball.solveShot({ from, target, speed: 32, topRpm: 0 });
  const k = fly({ from, vel: kick.vel, spin: kick.spin }, "hard", { until: "bounce2" });
  const f = fly({ from, vel: flat.vel, spin: flat.spin }, "hard", { until: "bounce2" });
  // how much the bounce turns the ball's heading (degrees, + = toward +x)
  const turn = b => (Math.atan2(b.vout.x, b.vout.y) - Math.atan2(b.vin.x, b.vin.y)) * 180 / Math.PI;
  assert.ok(heightAt(k.path, 11) > heightAt(f.path, 11), "kick is higher at the baseline");
  assert.ok(turn(k.bounces[0]) > 4, `kick jumps sideways at the bounce (${turn(k.bounces[0]).toFixed(1)}°)`);
  assert.ok(Math.abs(turn(f.bounces[0])) < 1, "a flat serve keeps its line");
});

test("surfaces: clay slower and higher, grass faster and lower", () => {
  const pace = {}, high = {};
  for (const s of Object.keys(SURFACES)) {
    // ITF court-pace style shot: 30 m/s at 16°, no spin
    pace[s] = fly({ from: { x: 0, y: 3, z: R + 1e-4 }, vel: { x: 0, y: 30 * Math.cos(0.2793), z: -30 * Math.sin(0.2793) } }, s, { until: "bounce1" }).bounces[0].vout.y;
    // a topspin drive aimed 9 m past the net: how high is it when it reaches the baseline?
    Ball.setSurface(s);
    const from = { x: 1, y: -12, z: 1 }, sol = Ball.solveShot({ from, target: { x: -1.5, y: 9 }, speed: 28, topRpm: 1800 });
    high[s] = heightAt(fly({ from, vel: sol.vel, spin: sol.spin }, s).path, 12.4);
  }
  assert.ok(pace.clay < pace.hard && pace.hard < pace.grass, `pace ${JSON.stringify(pace)}`);
  assert.ok(high.clay > high.hard && high.hard > high.grass, `height at the baseline ${JSON.stringify(high)}`);
});

test("slice: low bounce, checks up on clay, skids on grass", () => {
  const from = { x: 1, y: -12, z: 1 }, res = {};
  for (const s of Object.keys(SURFACES)) {
    Ball.setSurface(s);
    const sol = Ball.solveShot({ from, target: { x: -1.5, y: 3.5 }, speed: 15, topRpm: -2400, maxDeg: 25 });
    const r = fly({ from, vel: sol.vel, spin: sol.spin }, s);
    res[s] = { peak: peakAfter(r.path, r.bounces[0].t), vy: r.bounces[0].vout.y, landY: r.bounces[0].y };
    assert.ok(res[s].peak < 1.3, `${s}: slice stays low (${res[s].peak.toFixed(2)} m)`);
    assert.ok(Math.abs(res[s].landY - 3.5) < 0.3, `${s}: slice lands short (${res[s].landY.toFixed(2)})`);
  }
  assert.ok(res.clay.vy < res.hard.vy && res.hard.vy < res.grass.vy, `after the bounce: ${JSON.stringify(res)}`);
});

test("net: cord balls roll over or drop back; cloth stops the ball", () => {
  const shot = z0 => fly({ from: { x: 0, y: -1, z: z0 }, vel: { x: 0, y: 14, z: 0.4 }, spin: Ball.spinFor({ x: 0, y: 1 }, 1500) }, "hard", { until: "bounce1" });
  const over = shot(0.93), back = shot(0.88), cloth = shot(0.80);
  assert.equal(over.nets[0]?.kind, "cord"); assert.ok(over.bounces[0].y > 0, "0.93 m: clips the cord and rolls over");
  assert.equal(back.nets[0]?.kind, "cord"); assert.ok(back.bounces[0].y < 0, "0.88 m: clips the cord and drops back");
  assert.equal(cloth.nets[0]?.kind, "cloth"); assert.ok(cloth.bounces[0].y < 0, "0.80 m: into the net");
  const clean = shot(0.97);
  assert.equal(clean.nets.length, 0, "0.97 m: clears it");
});

test("skill steps: speed off the racket is exactly the speed asked for", () => {
  Ball.setSurface("hard");
  const from = { x: 1, y: -12, z: 1 }, target = { x: -1.5, y: 9 };
  const a = Ball.solveShot({ from, target, speed: 30, topRpm: 1800 }), b = Ball.solveShot({ from, target, speed: 30.6, topRpm: 1800 });
  const sp = s => Math.hypot(s.vel.x, s.vel.y, s.vel.z);
  assert.ok(Math.abs(sp(a) - 30) < 1e-9 && Math.abs(sp(b) - 30.6) < 1e-9, "one Strength point = +0.6 m/s off the racket");
});

test("aiming: drives land within 10 cm of the target", () => {
  const from = { x: 1, y: -12, z: 1 };
  for (const s of Object.keys(SURFACES)) for (const target of [{ x: -3, y: 7 }, { x: 3.5, y: 10.5 }, { x: 0, y: 8 }]) {
    Ball.setSurface(s);
    const sol = Ball.solveShot({ from, target, speed: 30, topRpm: 2000, sideRpm: 200 });
    const b = fly({ from, vel: sol.vel, spin: sol.spin }, s, { until: "bounce1" }).bounces[0];
    assert.ok(Math.hypot(b.x - target.x, b.y - target.y) < 0.1, `${s} → (${target.x}, ${target.y}) landed (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
  }
});

test("engine and predictor agree within 2 cm", { skip: !CANNON }, () => {
  const from = { x: 1, y: -12, z: 1 };
  Ball.setSurface("clay");
  const sol = Ball.solveShot({ from, target: { x: -2, y: 8 }, speed: 30, topRpm: 2000, sideRpm: -300 });
  const pred = Ball.predict({ from, vel: sol.vel, spin: sol.spin });
  const live = fly({ from, vel: sol.vel, spin: sol.spin }, "clay");
  for (const k of [0, 1]) {
    const p = pred.bounces[k], l = live.bounces[k];
    assert.ok(Math.hypot(p.x - l.x, p.y - l.y) < 0.02, `bounce ${k + 1}: predicted (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) live (${l.x.toFixed(3)}, ${l.y.toFixed(3)})`);
  }
});
