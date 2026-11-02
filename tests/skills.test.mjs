// Skill points: run with `node tests/skills.test.mjs`. Owner: Skills Coach.
// Checks Ryan's rule (one point = one constant step), 10 = neutral, values stay in 1–20, floors hold.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const store = {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
new Function(readFileSync(new URL("../src/skills/skills.js", import.meta.url), "utf8"))();
const { SKILLS, SKILL_STEP, SKILL_FLOOR, PLAYER_SKILLS, getSkills, applySkills } = globalThis;

const BODY = { top: 7, accel: 6, brake: 9, drain: 1, reach: 1.9 };
const IDS = SKILLS.map(s => s.id);
const at = (id, v) => applySkills(BODY, { ...Object.fromEntries(IDS.map(k => [k, 10])), [id]: v });
const FIELDS = ["top", "accel", "brake", "slideMul", "drain", "recoverMul", "shotBonus", "serveBonus", "errMul",
                "aimBonus", "splitPerfect", "splitGood", "reactionCut", "volleyReach", "volleyErrMul"];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("8 skills, each with a step text", () => {
  assert.equal(SKILLS.length, 8);
  for (const s of SKILLS) assert.ok(s.step && /per point/.test(s.step), s.id);
});

test("10 is neutral", () => {
  const b = applySkills(BODY, {});
  for (const k of ["top", "accel", "brake", "drain"]) near(b[k], BODY[k], k);
  for (const k of ["slideMul", "recoverMul", "errMul", "volleyReach", "volleyErrMul"]) near(b[k], 1, k);
  for (const k of ["shotBonus", "serveBonus", "aimBonus", "reactionCut"]) near(b[k], 0, k);
  near(b.splitPerfect, 0.07, "splitPerfect"); near(b.splitGood, 0.16, "splitGood");
});

test("each point is a constant step (11→12 equals 15→16, 1→2 equals 19→20)", () => {
  for (const id of IDS) for (const f of FIELDS) {
    const d = (a, b) => at(id, b)[f] - at(id, a)[f];
    near(d(11, 12), d(15, 16), `${id}.${f} 11→12 vs 15→16`);
    near(d(1, 2), d(19, 20), `${id}.${f} 1→2 vs 19→20`);
    near(d(9, 10), d(10, 11), `${id}.${f} below vs above 10`);
  }
});

test("the step text matches the numbers", () => {
  near(at("strength", 11).shotBonus, SKILL_STEP.shot, "Strength m/s");
  near(at("serve", 11).serveBonus, SKILL_STEP.serve, "Serve m/s");
  near(at("speed", 11).top / BODY.top - 1, SKILL_STEP.top, "Speed %");
  assert.match(SKILLS.find(s => s.id === "strength").step, /\+0\.6 m\/s/);
  assert.match(SKILLS.find(s => s.id === "serve").step, /\+0\.9 m\/s/);
  assert.match(SKILLS.find(s => s.id === "speed").step, /\+2% top speed/);
});

test("more is better in the right direction", () => {
  assert.ok(at("speed", 20).top > at("speed", 1).top);
  assert.ok(at("endurance", 20).drain < at("endurance", 1).drain);
  assert.ok(at("control", 20).errMul < at("control", 1).errMul);
  assert.ok(at("reflexes", 20).splitPerfect > at("reflexes", 1).splitPerfect);
});

test("no multiplier goes below its floor; windows stay positive", () => {
  for (const id of IDS) for (const v of [1, 20]) {
    const b = at(id, v);
    for (const k of ["top", "accel", "brake", "drain"]) assert.ok(b[k] / BODY[k] >= SKILL_FLOOR.mul, `${id}=${v} ${k}`);
    for (const k of ["slideMul", "recoverMul", "volleyReach"]) assert.ok(b[k] >= SKILL_FLOOR.mul, `${id}=${v} ${k}`);
    for (const k of ["errMul", "volleyErrMul"]) assert.ok(b[k] >= SKILL_FLOOR.err && b[k] <= 2, `${id}=${v} ${k}`);
    assert.ok(b.splitPerfect > 0 && b.splitGood > b.splitPerfect, `${id}=${v} split windows`);
    assert.ok(Math.abs(b.reactionCut) < 0.1, `${id}=${v} reaction`);
  }
});

test("values stay within 1–20, out-of-range input is clamped", () => {
  near(at("speed", 99).top, at("speed", 20).top, "above 20");
  near(at("speed", -5).top, at("speed", 1).top, "below 1");
  for (const id of Object.keys(PLAYER_SKILLS)) for (const k of IDS) {
    const v = getSkills(id)[k];
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 20, `${id}.${k}=${v}`);
  }
});

test("saved profile overrides defaults, and a broken save can't make NaN", () => {
  store["tennis101.profile"] = JSON.stringify({ players: { sinner: { skills: { speed: 20, serve: "abc", control: null, bogus: 5, agility: 25 } } } });
  const s = getSkills("sinner");
  assert.equal(s.speed, 20);
  assert.equal(s.serve, PLAYER_SKILLS.sinner.serve);
  assert.equal(s.control, PLAYER_SKILLS.sinner.control);
  assert.equal(s.agility, 20);
  assert.ok(!("bogus" in s));
  store["tennis101.profile"] = "{not json";
  assert.deepEqual(getSkills("alcaraz"), PLAYER_SKILLS.alcaraz);
  for (const f of FIELDS) assert.ok(Number.isFinite(applySkills(BODY, { speed: "x", serve: undefined })[f]), f);
  delete store["tennis101.profile"];
});

console.log(`${n} tests passed`);
