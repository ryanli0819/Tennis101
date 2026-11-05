// Animator tests — run: node tests/animation.test.mjs
// Each animation kind triggers in the right situation, direction changes play their beats in order,
// frames cycle in order and faster runs cycle faster, and the animation never touches the physics.
// --- node loader --- (everything after "end node loader" is plain JS, so it also runs in other JS engines)
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/animation/run-cycle.js", import.meta.url), "utf8");
// --- end node loader ---

function loadAnim(reduced) {
  const win = { matchMedia: () => ({ matches: !!reduced }) };
  new Function("window", "matchMedia", "performance", SRC)(win, win.matchMedia, { now: () => 0 });
  return win.Anim;
}

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { failures.push(name); console.log("FAIL " + name + " — " + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const B = { top: 6.6, accel: 8.6, brake: 11.0 };          // bodyStats for a 1.85 m, 75 kg player
const DT = 1 / 60;
const body = (vx = 0, vy = 0) => ({ x: 0, y: -11, vx, vy, run: 0, air: 0, slide: 0, slideV: { x: 0, y: 0 }, plant: 0 });

// The same rules as moveBody() in index.html (accelerate toward the wanted velocity, brake harder against your
// momentum, p.plant on a hard change of direction), so the tests see the velocities the game produces.
function physics(p, ix, iy, dt) {
  p.plant = Math.max(0, p.plant - dt);
  const dx = ix * B.top - p.vx, dy = iy * B.top - p.vy, dl = Math.hypot(dx, dy);
  if (dl > 1e-4) {
    const braking = dx * p.vx + dy * p.vy < 0;
    if (braking && Math.hypot(p.vx, p.vy) > 2.4 && dl > B.top * 0.9) p.plant = 0.16;
    const dv = Math.min(dl, (braking ? B.brake : B.accel) * dt);
    p.vx += dx / dl * dv; p.vy += dy / dl * dv;
  }
  p.x += p.vx * dt; p.y += p.vy * dt; p.run += dt * (0.4 + Math.hypot(p.vx, p.vy) / 3);
}

// Drive a body with held input for `secs`; returns every frame drawn.
function drive(A, p, ix, iy, secs, clock, near = true, id = "sinner") {
  const out = [];
  for (let n = 0; n < Math.round(secs / DT); n++) {
    physics(p, ix, iy, DT); clock.t += DT;
    out.push(A.frame(p, B, near, id, clock.t));
  }
  return out;
}
// Hold a constant velocity (no physics) for `secs`.
function hold(A, p, secs, clock, id = "sinner") {
  const out = [], sp = Math.hypot(p.vx, p.vy);
  for (let n = 0; n < Math.round(secs / DT); n++) {
    p.run += DT * (0.4 + sp / 3); clock.t += DT;
    out.push(A.frame(p, B, true, id, clock.t));
  }
  return out;
}
const kinds = (frames) => frames.map(f => f.kind).filter((k, n, a) => k !== a[n - 1]);   // runs of the same kind collapsed
const order = (list, want) => { let at = -1; for (const w of want) { at = list.indexOf(w, at + 1); if (at < 0) return false; } return true; };

const A = loadAnim(false);

test("standing → ready", () => {
  const f = hold(A, body(), 0.5, { t: 0 });
  ok(f.every(x => x.kind === "ready"), "kinds: " + kinds(f));
});

test("short sideways move → shuffle; long fast one → side run, body turned", () => {
  const s = hold(A, body(2.5, 0), 0.5, { t: 0 });
  ok(s[s.length - 1].kind === "shuffle", "slow: " + s[s.length - 1].kind);
  const r = hold(A, body(6.2, 0), 0.5, { t: 0 });
  ok(r[r.length - 1].kind === "siderun", "fast: " + r[r.length - 1].kind);
  ok(r[r.length - 1].turn > 0.8, "turn " + r[r.length - 1].turn);
});

test("moving backward → back-pedal (near and far)", () => {
  const n = hold(A, body(0, -3), 0.5, { t: 0 });
  ok(n[n.length - 1].kind === "backpedal", "near: " + n[n.length - 1].kind);
  const p = body(0, 3), c = { t: 0 }; let f;
  for (let k = 0; k < 30; k++) { p.run += DT; c.t += DT; f = A.frame(p, B, false, "alcaraz", c.t); }
  ok(f.kind === "backpedal", "far: " + f.kind);
});

test("hard sideways reversal → decel → plant → crossover → side run", () => {
  const p = body(), c = { t: 0 };
  drive(A, p, 1, 0, 1.4, c);                               // full speed to the right
  const f = drive(A, p, -1, 0, 1.4, c);                    // then cut back left
  const k = kinds(f);
  ok(order(k, ["decel", "plant", "crossover"]), "kinds: " + k);
  ok(k.indexOf("ready") < 0, "no ready stop inside a reversal: " + k);
  ok(f[f.length - 1].kind === "siderun" && f[f.length - 1].dir === "left", "ends " + f[f.length - 1].kind + "/" + f[f.length - 1].dir);
  const dec = f.filter(x => x.kind === "decel");
  ok(dec[dec.length - 1].lean < -0.02, "leans back against the old way: " + dec[dec.length - 1].lean);
  ok(dec[dec.length - 1].crouch > dec[0].crouch, "sinks into the brake");
  const cross = f.filter(x => x.kind === "crossover");
  ok(cross[cross.length - 1].turn < -0.5, "hips and shoulders turn to the new way: " + cross[cross.length - 1].turn);
  ok(cross.some(x => x.feet[1].lift > 0.05), "the outside (right) leg swings across");
  ok(cross[cross.length - 1].feet[1].dx < 0, "and lands on the new side: " + cross[cross.length - 1].feet[1].dx);
});

test("forward → backward reversal → drop step (hip opens)", () => {
  const p = body(), c = { t: 0 };
  drive(A, p, 0, 1, 1.4, c);                               // run toward the net
  const f = drive(A, p, 0, -1, 1.2, c);                    // then go back for a lob
  const k = kinds(f);
  ok(order(k, ["decel", "plant", "dropstep"]), "kinds: " + k);
  const d = f.filter(x => x.kind === "dropstep");
  ok(Math.abs(d[d.length - 1].turn) > 0.3, "hip opens: " + d[d.length - 1].turn);
  ok(f[f.length - 1].kind === "backpedal", "then back-pedals: " + f[f.length - 1].kind);
});

test("backward → forward reversal → push-off, body tipped in", () => {
  const p = body(), c = { t: 0 };
  drive(A, p, 0, -1, 1.4, c);
  const f = drive(A, p, 0, 1, 1.2, c);
  const k = kinds(f);
  ok(order(k, ["decel", "plant", "pushoff"]), "kinds: " + k);
  ok(f.filter(x => x.kind === "pushoff").some(x => x.bend > 0.02), "tipped forward");
});

test("braking to a stop → decel → plant → ready, no cut step", () => {
  const p = body(), c = { t: 0 };
  drive(A, p, 1, 0, 1.4, c);
  const k = kinds(drive(A, p, 0, 0, 1.2, c));
  ok(order(k, ["decel", "plant", "ready"]), "kinds: " + k);
  ok(k.indexOf("crossover") < 0, "kinds: " + k);
});

test("acceleration lean: strong on the first steps, gone at top speed", () => {
  const p = body(), c = { t: 0 };
  const f = drive(A, p, 1, 0, 2.0, c).filter(x => x.accel != null);
  ok(f.length > 10, "running frames: " + f.length);
  const early = Math.max(...f.slice(0, 15).map(x => x.accel)), late = f[f.length - 1].accel;
  ok(early > 0.2, "early lean " + early);
  ok(late < 0.05, "late lean " + late);
});

test("frames cycle in order", () => {
  const f = hold(A, body(0, 5), 2.0, { t: 0 });
  let wraps = 0;
  for (let n = 1; n < f.length; n++) {
    const d = (f[n].frame - f[n - 1].frame + 20) % 20;
    ok(d <= 2, "jumped " + f[n - 1].frame + " → " + f[n].frame);
    if (f[n].frame < f[n - 1].frame) wraps++;
  }
  ok(wraps >= 1, "never completed a stride");
});

test("a faster run cycles faster", () => {
  const strides = (v) => {
    const f = hold(A, body(0, v), 3.0, { t: 0 });
    let adv = 0; for (let n = 1; n < f.length; n++) adv += (f[n].frame - f[n - 1].frame + 20) % 20;
    return adv / 20 / 3;                                  // strides per second
  };
  const slow = strides(2.5), fast = strides(6.5);
  ok(fast > slow * 1.15, "slow " + slow.toFixed(2) + "/s, fast " + fast.toFixed(2) + "/s");
});

test("every player gets the beats; numbers stay finite fractions of the body", () => {
  for (const id of ["sinner", "alcaraz", "someone-new"]) {
    const p = body(), c = { t: 0 };
    drive(A, p, 1, 0, 1.2, c, true, id);
    const f = drive(A, p, -1, 0, 1.2, c, true, id);
    ok(order(kinds(f), ["decel", "plant", "crossover"]), id + ": " + kinds(f));
    for (const x of f) for (const v of [x.bob, x.lean, x.crouch, x.turn, ...x.feet.flatMap(q => [q.dx, q.dy, q.lift])])
      ok(Number.isFinite(v) && Math.abs(v) < 1.5, id + " " + x.kind + " has " + v);
  }
});

test("animation never moves the body", () => {
  const p = body(4, 1); p.plant = 0.1;
  const before = JSON.stringify([p.x, p.y, p.vx, p.vy, p.plant, p.air, p.slide, p.run]);
  const c = { t: 0 }; for (let n = 0; n < 40; n++) { c.t += DT; A.frame(p, B, true, "sinner", c.t); }
  ok(JSON.stringify([p.x, p.y, p.vx, p.vy, p.plant, p.air, p.slide, p.run]) === before, "physics fields changed");
});

test("split step and slide still win over everything", () => {
  const p = body(5, 0); p.air = 0.1;
  ok(A.frame(p, B, true, "sinner", 0.1).kind === "split", "air");
  p.air = 0; p.slide = 0.2; p.slideV = { x: 5, y: 0 };
  ok(A.frame(p, B, true, "sinner", 0.2).kind === "slide", "slide");
});

test("prefers-reduced-motion: no bob, the reversal still reads", () => {
  const R = loadAnim(true), p = body(), c = { t: 0 };
  const run = drive(R, p, 1, 0, 1.4, c);
  ok(run.every(x => x.bob === 0 || x.kind === "ready"), "bob in reduced motion");
  const k = kinds(drive(R, p, -1, 0, 1.4, c));
  ok(order(k, ["decel", "plant", "crossover"]), "kinds: " + k);
});

console.log(passed + " passed, " + failures.length + " failed");
if (failures.length) throw new Error("animation tests failed: " + failures.join(", "));
