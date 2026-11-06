// First-person camera tests. Run: node src/camera/pov.test.mjs
// Eye height scales with heightM; first person is on during your READY and toss and off within 0.5 s after
// contact; it is never on while you receive; where it looks during the serve.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;                         // the game's scripts attach to window
for (const f of ["pov.js", "../serve/motion/sinner-serve.js", "../serve/motion/alcaraz-serve.js"])
  (0, eval)(readFileSync(join(here, f), "utf8"));
const { Pov, SERVE_MOTIONS } = globalThis;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("eye height is 94% of the pro's real height, nothing hard-coded", () => {
  const at = { x: 1.2, y: -12.2 };
  for (const h of [1.70, 1.83, 1.91, 2.11]) {
    const c = Pov.cam({ heightM: h }, at);
    assert.ok(Math.abs(c.h - h * 0.94) < 1e-9);
    assert.equal(c.anchor, null);
    assert.equal(c.x, at.x);
  }
  assert.ok(Pov.cam({ heightM: 1.91 }, at).h > Pov.cam({ heightM: 1.83 }, at).h);   // Sinner sees from higher than Alcaraz
});

test("the head offset follows the motion but stays small", () => {
  const W0 = { neck: { x: 0, z: 1.5 }, root: { x: 0, z: 0.9 } };
  const c = Pov.cam({ heightM: 1.91 }, { x: 0, y: -12 }, Pov.headOffset({ neck: { x: 0.1, z: 1.6 }, root: { x: 0.1, z: 1.0 } }, W0));
  assert.ok(c.h > 1.91 * 0.94 && c.x > 0);
  const big = Pov.headOffset({ neck: { x: 3, z: 3 }, root: { x: 3, z: 3 } }, W0);
  assert.ok(Math.abs(big.x) <= 0.16 && Math.abs(big.z) <= 0.16);
  assert.deepEqual(Pov.headOffset(null, W0), { x: 0, z: 0 });
});

const base = { firstPerson: true, server: 0, over: false, rally: null, nextServe: null, clock: 0 };
test("first person is on during your READY (GET SET) and your toss", () => {
  assert.equal(Pov.wanted({ ...base, nextServe: { ready: true } }), true);
  assert.equal(Pov.wanted({ ...base, nextServe: { ready: false } }), false);   // between points, before GET SET
  assert.equal(Pov.wanted({ ...base, rally: { serve: { t: 0.5 } } }), true);
});

test("first person is off within 0.5 s after contact", () => {
  const r = { serve: null, serveClock: 3, shot: { isServe: true } };
  assert.equal(Pov.wanted({ ...base, rally: r, clock: 3.1 }), true);
  assert.equal(Pov.wanted({ ...base, rally: r, clock: 3.5 }), false);
  assert.ok(Pov.AFTER < 0.5);
  assert.equal(Pov.wanted({ ...base, rally: { serve: null, serveClock: 3, shot: { isServe: false } }, clock: 3.1 }), false);
});

test("first person is never on while you receive, or when V is off, or after the match", () => {
  for (const st of [{ nextServe: { ready: true } }, { rally: { serve: { t: 1 } } }, { rally: { shot: { isServe: true }, serveClock: 0 }, clock: 0.1 }]) {
    assert.equal(Pov.wanted({ ...base, ...st, server: 1 }), false);
    assert.equal(Pov.wanted({ ...base, ...st, firstPerson: false }), false);
    assert.equal(Pov.wanted({ ...base, ...st, over: true }), false);
  }
});

const E = SERVE_MOTIONS.sinner.first.events;
const eye = { y: -12.55, z: 1.80 }, ballAt = (y, z) => ({ x: 0, y, z });
const look = (t, extra = {}) => Pov.look({ on: true, reduce: false, t, events: E, ball: ballAt(-12.2, 1.0), eye, fwd: 1, ...extra });
test("looks down at the bounce, at the box before the toss, up with the toss, back down after contact", () => {
  assert.equal(look(null).pitch, 0);                                          // GET SET
  assert.ok(look(E.start - 0.5).pitch < -0.3);                                // bouncing
  assert.equal(look((E.start + E.tossRelease) / 2).pitch, 0);
  const up = look((E.tossRelease + E.contact) / 2, { ball: ballAt(-11.9, 3.2) }).pitch;
  assert.ok(up > 0.3 && up <= Pov.LOOK_UP_MAX);
  assert.equal(look(E.contact + 0.1).pitch, 0);
  assert.equal(Pov.look({ on: false, t: 0.5, events: E }).pitch, 0);
});

test("reduced motion: fixed angles, cut (rate 0), never tracking the ball", () => {
  const a = look((E.tossRelease + E.contact) / 2, { reduce: true, ball: ballAt(-11.9, 2.4) });
  const c = look((E.tossRelease + E.contact) / 2, { reduce: true, ball: ballAt(-11.9, 3.4) });
  assert.equal(a.rate, 0); assert.equal(a.pitch, c.pitch);
  for (const t of [null, E.start - 0.5, E.contact + 0.1]) assert.equal(look(t, { reduce: true }).rate, 0);
});

test("every serve motion has the events the camera needs, and the racket arm goes back then through", () => {
  for (const id in SERVE_MOTIONS) for (const k of ["first", "second"]) {
    const m = SERVE_MOTIONS[id][k]; if (!m) continue;
    const ev = m.events;
    assert.ok(ev.tossRelease < ev.trophy && ev.trophy < ev.contact, `${id} ${k}`);
    assert.ok(Pov.armDepth(ev.trophy, ev).rightWrist < 0, `${id} ${k}: behind the head at the trophy`);
    assert.ok(Pov.armDepth(ev.contact, ev).rightWrist > 0.3, `${id} ${k}: in front at contact`);
    assert.ok(Pov.armDepth(ev.tossRelease, ev).leftWrist > 0, `${id} ${k}: tossing hand in front`);
  }
});

console.log(`${n} tests passed`);
