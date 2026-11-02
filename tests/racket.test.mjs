// Racket Coach tests. Run from the repo root: node tests/racket.test.mjs
// Loads src/racket/racket.js with a stub of the game's globals and checks the swing contracts:
//   1. the slice starts near 2 o'clock and ends at SLICE_END ± 0.5 h (mirrored 10 → 12 − SLICE_END on the backhand),
//   2. the contact pose's height follows the ball,
//   3. the backswing is complete (racket behind the body) before the time until contact is 0.3 s.
import { readFileSync } from "node:fs";

const src = readFileSync("src/racket/racket.js", "utf8");
const V3 = { norm: v => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; },
             lerp: (a, c, t) => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, z: a.z + (c.z - a.z) * t }) };
const env = {
  V3, PLAYERS: [{ id: "sinner", side: "near" }, { id: "alcaraz", side: "far" }],
  rally: null, clock: 0, S: { server: 1 }, ROUTINE: { seconds: 1, toss: 1 }, ball: null,
  input: { keys: new Set(), slice: false },
};
// eslint-disable-next-line no-new-func
const R = new Function("env", `with (env) {\n${src}\nreturn { racketPose, poseTrack, SLICE_END, RACKET }; }`)(env);

let fails = 0, passes = 0;
const check = (ok, msg) => { if (ok) passes++; else { fails++; console.log("FAIL", msg); } };
const side = i => env.PLAYERS[i].side === "near" ? 1 : -1;
const oclock = (i, u) => { const a = Math.atan2(side(i) * u.x, u.z) * 6 / Math.PI; return (a + 12) % 12; };
const clockDiff = (a, b) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); };
const at = i => ({ x: 0.3 * side(i), y: -11 * side(i), hitZ: 1.0 });

// The ball is coming to player i: ttc seconds to go, landing at end (court space). slice = hold E / planSlice.
function incoming(i, ttc, end, slice) {
  env.clock = 0; env.ball = {};
  env.rally = { shot: { recv: i, t1: 1, t2: 0.5, t: 1 + 0.85 * 0.5 - ttc, end } };
  env.input = { keys: new Set(slice && i === 0 ? ["e"] : []), slice: false };
  const p = at(i); p.planSlice = !!slice && i === 1; p.hitT = -9;
  return { p, pose: R.racketPose(i, p) };
}
// Player i hit tt seconds ago with this stroke (strokeSide 1 = forehand, -1 = backhand).
function justHit(i, tt, strokeType, strokeSide) {
  env.rally = {}; env.clock = 10; env.ball = {};
  const p = { ...at(i), hitT: 10 - tt, strokeType, strokeSide };
  return R.racketPose(i, p);
}
const fhEnd = i => ({ x: at(i).x + 1.2 * side(i), y: at(i).y, z: 1.0 });   // lands on the racket side
const bhEnd = i => ({ x: at(i).x - 1.2 * side(i), y: at(i).y, z: 1.0 });

// 1. Slice clock
for (const i of [0, 1]) {
  const id = env.PLAYERS[i].id, se = R.SLICE_END[id];
  const fStart = oclock(i, incoming(i, 0.3, fhEnd(i), true).pose.u);
  const bStart = oclock(i, incoming(i, 0.3, bhEnd(i), true).pose.u);
  check(clockDiff(fStart, 2) <= 0.5, `${id} forehand slice starts at ${fStart.toFixed(2)} o'clock, want ~2`);
  check(clockDiff(bStart, 10) <= 0.5, `${id} backhand slice starts at ${bStart.toFixed(2)} o'clock, want ~10`);
  const fEnd = oclock(i, justHit(i, 0.44, "slice", 1).u), bEnd = oclock(i, justHit(i, 0.44, "slice", -1).u);
  check(clockDiff(fEnd, se) <= 0.5, `${id} forehand slice ends at ${fEnd.toFixed(2)} o'clock, want ${se} ± 0.5`);
  check(clockDiff(bEnd, 12 - se) <= 0.5, `${id} backhand slice ends at ${bEnd.toFixed(2)} o'clock, want ${12 - se} ± 0.5`);
  check(justHit(i, 0.44, "slice", 1).slice === true, `${id} slice pose is flagged slice`);
}

// 2. Contact height follows the ball (clamped to the reachable 0.45–1.75 m)
for (const i of [0, 1]) for (const slice of [false, true]) for (const mk of [fhEnd, bhEnd]) for (const z of [0.3, 0.6, 1.0, 1.4, 2.2]) {
  const g = incoming(i, 0, { ...mk(i), z }, slice).pose.g, want = Math.max(0.45, Math.min(1.75, z));
  check(Math.abs(g.z - want) < 1e-9, `player ${i} slice=${slice} ball at ${z} m: grip at ${g.z.toFixed(3)} m, want ${want}`);
}
// … and the contact is in front of the body
for (const i of [0, 1]) {
  const { p, pose } = incoming(i, 0, fhEnd(i), false);
  check((pose.g.y - p.y) * side(i) > 0.2, `player ${i} contact is in front of the body`);
}

// 3. Backswing done before ttc 0.3 s: from 0.3 s down to the start of the forward swing the racket stays behind the body
for (const i of [0, 1]) for (const slice of [false, true]) for (const mk of [fhEnd, bhEnd]) for (const ttc of [0.45, 0.4, 0.35, 0.3, 0.25, 0.2]) {
  const { p, pose } = incoming(i, ttc, mk(i), slice), back = (pose.g.y - p.y) * side(i);
  check(back <= -0.08, `player ${i} slice=${slice} ttc ${ttc}: grip ${back.toFixed(2)} m from the body, want behind (≤ −0.08)`);
}
// … and it has not started back yet a full second out (unit turn from ready)
for (const i of [0, 1]) {
  const far = incoming(i, 1.5, fhEnd(i), false).pose, ready = R.racketPose(i, { ...at(i), hitT: -9 }, 0);
  check(Math.abs(far.g.y - ready.g.y) < 1e-9, `player ${i} is still in the ready pose 1.5 s before contact`);
}

console.log(`racket tests: ${passes} passed, ${fails} failed`);
if (fails && typeof process !== "undefined") process.exit(1);
