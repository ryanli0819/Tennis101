// Quick checks for the roster data. Run: node src/players/roster.test.mjs
import fs from "fs";
import vm from "vm";
import assert from "assert";

const window = { PLAYER_SKILLS: { sinner: {}, alcaraz: {} } };
vm.runInNewContext(fs.readFileSync(new URL("./roster.js", import.meta.url), "utf8"), { window });
const rest = window.ROSTER_REST;
assert.equal(rest.length, 20, "20 pros besides Sinner and Alcaraz");
const ids = rest.map(p => p.id);
assert.equal(new Set(ids).size, 20);
for (const banned of ["sinner", "alcaraz"]) assert.ok(!ids.includes(banned));
const lefties = rest.filter(p => p.lefty).map(p => p.id).sort();
assert.deepEqual(lefties, ["nadal", "shelton", "tien"]);
assert.equal(rest.find(p => p.id === "federer").backhand, "one");
assert.ok(rest.every(p => p.backhand === "two" || p.id === "federer"));
for (const p of rest) {
  assert.ok(p.heightM >= 1.7 && p.heightM <= 2.05, p.id + " height");
  assert.ok(p.weightKg >= 60 && p.weightKg <= 100, p.id + " weight");
  assert.ok(p.look && p.look.style, p.id + " look");
  for (const s of ["grass", "hard", "clay"]) {
    const o = p.outfits[s];
    assert.ok(/^#[0-9a-f]{6}$/i.test(o.shirt), p.id + " " + s + " shirt");
    assert.ok(o.hexKind, p.id + " " + s + " hexKind");
  }
  const sk = window.ROSTER_SKILLS[p.id];
  for (const k of ["speed", "agility", "endurance", "strength", "serve", "control", "reflexes", "netPlay"]) {
    assert.ok(sk[k] >= 1 && sk[k] <= 20, p.id + " " + k);
  }
}
assert.equal(rest.find(p => p.id === "zverev").heightM, 1.98);
assert.equal(rest.find(p => p.id === "tien").heightM, 1.80);
assert.equal(rest.find(p => p.id === "medvedev").look.torso < 0.8, true);
console.log("roster.test.mjs ok", rest.length, "players");
