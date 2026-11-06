// Serve control tests: node src/serve/control/serve-control.test.mjs
// A perfect input gives sweetSpot ≈ 1, a bad toss lowers it, ace chance rises with skill and is zero when the
// requirements aren't met, and the computer's serves land near real ATP rates.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(here, "serve-control.js"));
await import(path.join(here, "../../profile/profile.js"));
const SC = globalThis.ServeControl;

// Sinner's 1st-serve events (src/serve/motion/sinner-serve.js)
const EVENTS = { start: 0.038, tossRelease: 0.297, trophy: 0.599, contact: 0.947 };
const H = 1.91, DT = 0.001;
const zero = () => 0.5;                                  // gauss() = 0: no random error
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* A human serve: hold the toss for tossMul × the ideal hold, then load fully and let go so contact lands
   `late` seconds after the ideal moment. */
function humanServe({ tossMul = 1, late = 0, brush = "flat", load = 1, rng = zero } = {}) {
  const c = SC.create({ events: EVENTS, heightM: H, human: true, rng });
  const s = c.state, LOAD = SC.TUNING.power.load * load;
  let holding = true, loadStart = null;
  for (let k = 0; k < 5000 && !c.result; k++) {
    let held = false;
    if (s.phase === "wait" || s.phase === "toss") held = s.hold + DT < s.idealHold * tossMul - 1e-9;
    if (s.phase === "flight" || s.phase === "load") {
      const disc = s.rel.vz ** 2 - 2 * 9.81 * (s.contactZ - s.rel.z);
      const ideal = disc > 0 ? (s.rel.vz + Math.sqrt(disc)) / 9.81 : s.rel.vz / 9.81;
      if (loadStart == null) loadStart = ideal - s.swingT - LOAD + late;
      held = s.tt >= loadStart - 1e-9 && s.load + DT <= LOAD + 1e-9;
    }
    if (s.phase === "wait" && !holding) held = false;
    const ev = c.step(DT, { held, brush });
    if (ev.includes("release")) c.launchToss(1.05 * H);
  }
  return c.result;
}

// sweet spot
assert.ok(Math.abs(SC.reachTop(1.91) - 2.93) < 0.05, "Sinner's sweet spot ≈ 2.93 m");
const perfect = humanServe();
assert.ok(perfect.sweetSpot > 0.97, `perfect input → sweetSpot ≈ 1 (got ${perfect.sweetSpot})`);
assert.equal(perfect.spin.type, "flat");
assert.ok(perfect.power > 0.95, "a full load gives full power");
const low = humanServe({ tossMul: 0.6 }), high = humanServe({ tossMul: 1.6 });
assert.ok(low.sweetSpot < perfect.sweetSpot - 0.3, `a low toss lowers it (${low.sweetSpot})`);
assert.ok(high.sweetSpot < perfect.sweetSpot - 0.3, `a high toss lowers it (${high.sweetSpot})`);
const late = humanServe({ late: 0.12 });
assert.ok(late.sweetSpot < perfect.sweetSpot - 0.2, `a late swing lowers it (${late.sweetSpot})`);
assert.equal(humanServe({ brush: "kick" }).spin.type, "kick");
assert.equal(humanServe({ brush: "slice" }).spin.type, "slice");

// the frame rate doesn't change the result: a perfect plan scores ≈ 1 at 1 ms, 60 fps and 30 fps steps
for (const dt of [0.001, 1 / 60, 1 / 30]) {
  const c = SC.create({ events: EVENTS, heightM: H, human: false, rng: zero });
  for (let k = 0; k < 20000 && !c.result; k++) if (c.step(dt).includes("release")) c.launchToss(1.05 * H);
  assert.ok(c.result.sweetSpot > 0.9, `steps of ${dt.toFixed(3)} s → sweetSpot ${c.result.sweetSpot}`);
}

// auto: nobody presses → the serve goes by itself, medium and unable to ace
{
  const c = SC.create({ events: EVENTS, heightM: H, human: true, rng: zero });
  for (let k = 0; k < 5000 && !c.result; k++) { if (c.step(DT, {}).includes("release")) c.launchToss(2.0); }
  assert.ok(c.result && c.result.auto, "an untouched serve still goes, marked auto");
  assert.equal(SC.aceChance({ result: c.result, perfect: true, wrongSide: true, skill: 20 }).chance, 0, "auto serves can't ace");
}

// ace chance: rises with skill, zero without the requirements
{
  const at = skill => SC.aceChance({ result: perfect, perfect: true, wrongSide: true, skill }).chance;
  assert.ok(at(5) < at(10) && at(10) < at(15) && at(15) < at(20), "ace chance rises with the Serve skill");
  assert.ok(at(10) > 0.1, "a perfect flat serve to the open side is a real ace chance");
  assert.equal(SC.aceChance({ result: perfect, perfect: false, wrongSide: true, skill: 20 }).chance, 0, "no perfect spot → 0");
  assert.equal(SC.aceChance({ result: low, perfect: true, wrongSide: true, skill: 20 }).chance, 0, "bad toss → 0");
  const soft = humanServe({ load: 0.5 });
  assert.equal(SC.aceChance({ result: soft, perfect: true, wrongSide: true, skill: 20 }).chance, 0, "a soft flat serve → 0");
  const kick = humanServe({ brush: "kick", load: 0.7 });
  assert.ok(SC.aceChance({ result: kick, perfect: true, wrongSide: true, skill: 10 }).chance > 0, "a well-brushed kick can ace at lower power");
}

// computer serves vs real ATP numbers: ~35–40% 1st-serve faults, ~3% double faults per point, ~6–9% aces, ~1–3% lets
{
  const rng = mulberry32(7);
  const box = { xlo: -4.115, xhi: 0, ylo: 0, yhi: 6.4, wide: -4.115, t: 0, back: 6.4, sy: 1, mid: -2.0575 };
  const N = 20000; let first = 0, firstFaults = 0, seconds = 0, dfs = 0, aces = 0, lets = 0, serves = 0;
  const serve = second => {
    const c = SC.create({ events: EVENTS, heightM: H, human: false, second, rng });
    for (let k = 0; k < 4000 && !c.result; k += 1) if (c.step(0.004).includes("release")) c.launchToss(1.05 * H);
    const recvX = box.mid + (rng() < 0.5 ? -1 : 1) * 4.115 * 0.25;
    serves++;
    return SC.resolveServe({ result: c.result, target: SC.aiAim(box, second, rng), box, receiverX: recvX, second,
                             errMul: 1 - 0.04 * 7, letRate: 0.02, skill: 16, rng });
  };
  for (let n = 0; n < N; n++) {
    let r; do { r = serve(false); if (r.let) lets++; } while (r.let);
    first++;
    if (r.ace) { aces++; continue; }
    if (!r.fault) continue;
    firstFaults++; seconds++;
    do { r = serve(true); if (r.let) lets++; } while (r.let);
    if (r.ace) aces++;
    if (r.fault) dfs++;
  }
  const pct = v => +(100 * v).toFixed(1);
  const stats = { firstFault: pct(firstFaults / first), secondFault: pct(dfs / seconds), dfPerPoint: pct(dfs / N), acePerPoint: pct(aces / N), letPerServe: pct(lets / serves) };
  console.log("computer serve rates (%):", stats);
  assert.ok(stats.firstFault > 30 && stats.firstFault < 42, "1st-serve faults ~36%");
  assert.ok(stats.dfPerPoint > 1.5 && stats.dfPerPoint < 5, "double faults ~3% of points");
  assert.ok(stats.acePerPoint > 4 && stats.acePerPoint < 12, "aces ~6–9% of points");
  assert.ok(stats.letPerServe > 0.8 && stats.letPerServe < 3, "lets ~1–3% of serves");
}

// profile: serve stats persist and merge with the Skills Coach's part
{
  const mem = {};
  globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  mem["tennis101.profile"] = JSON.stringify({ players: { sinner: { skills: { serve: 18 } } } });
  Profile.recordServe("sinner", { sweetSpot: 0.9, ace: true });
  Profile.recordServe("sinner", { sweetSpot: 0.5, fault: true });
  const st = Profile.serveStats("sinner");
  assert.equal(st.serves, 2); assert.equal(st.aces, 1); assert.equal(st.faults, 1); assert.equal(st.avgSweet, 0.7);
  assert.equal(Profile.load().players.sinner.skills.serve, 18, "the Skills Coach's overrides survive");
  assert.equal(Profile.serveSkill("sinner"), 10, "no getSkills loaded → the profile / neutral fallback");
}

console.log("serve-control: all tests passed");
