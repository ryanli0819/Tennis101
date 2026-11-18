// HQ-20261116-001: every one of the 22 pros has an explicit, SOURCED lefty; no default; the racket ends up in the
// right hand at the near and the far end. Run: node --test src/players/handedness.test.mjs
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const here = p => new URL(p, import.meta.url);
const read = p => readFileSync(here(p), "utf8");
// The 22 ids of PR #44 (src/players/roster.js @ 7744b21), in roster order.
const IDS = ["zverev", "sinner", "alcaraz", "shelton", "medvedev", "cobolli", "fils", "tiafoe", "de-minaur", "jodar", "djokovic", "fritz", "auger-aliassime", "paul", "lehecka", "mensik", "davidovich-fokina", "nakashima", "tien", "federer", "nadal", "kyrgios"];
// What each ATP profile's "Plays:" said on Nov 17, 2026 (PlayHand.Description in /en/-/www/players/hero/<code>).
const ATP_PLAYS = { zverev: "R", sinner: "R", alcaraz: "R", shelton: "L", medvedev: "R", cobolli: "R", fils: "R", tiafoe: "R", "de-minaur": "R", jodar: "R", djokovic: "R", fritz: "R", "auger-aliassime": "R", paul: "R", lehecka: "R", mensik: "R", "davidovich-fokina": "R", nakashima: "R", tien: "L", federer: "R", nadal: "L", kyrgios: "R" };

function loadTable() {
  const errors = [];
  const ctx = { console: { error: (...a) => errors.push(a.join(" ")), log() {}, warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(read("./handedness.js"), ctx);
  return { H: ctx.HANDEDNESS, errors };
}

test("all 22 ids carry an explicit boolean lefty that matches the sourced ATP table", () => {
  const { H } = loadTable();
  assert.deepEqual([...H.ids], IDS);
  for (const id of IDS) {
    const row = H.TABLE[id];
    assert.equal(typeof row.lefty, "boolean", id);
    assert.equal(row.lefty, ATP_PLAYS[id] === "L", id);
    assert.equal(H.lefty(id), row.lefty, id);
    assert.equal(row.label, "SOURCED", id);
    assert.match(row.source, /^https:\/\/www\.atptour\.com\/en\/players\/[a-z-]+\/[a-z0-9]{4}\/overview$/, id);
    assert.equal(row.plays, row.lefty ? "Left-Handed" : "Right-Handed", id);
  }
  assert.deepEqual(IDS.filter(id => H.lefty(id)).sort(), ["nadal", "shelton", "tien"]);
  assert.equal(H.lefty("sinner"), false);
});

test("a missing or unknown id fails loudly (console.error + throw), never defaults to right-handed", () => {
  for (const bad of ["sinnner", "", undefined, null, "toString", "__proto__"]) {
    const { H, errors } = loadTable();
    assert.throws(() => H.lefty(bad), /no sourced handedness/, String(bad));
    assert.equal(errors.length, 1, String(bad));
  }
});

test("the captured-serve hand tags (roster-serves.js) agree with the sourced table", () => {
  const { H } = loadTable();
  const ctx = { window: { ROSTER: [] } };
  vm.createContext(ctx);
  vm.runInContext(read("../serve/motion/roster-serves.js"), ctx);
  const cat = [...ctx.window.SERVE_CATALOG];
  assert.deepEqual(cat.map(p => p.id).sort(), [...IDS].sort());
  for (const p of cat) {
    assert.equal(p.hand, H.lefty(p.id) ? "L" : "R", p.id);
    for (const m of p.serves) assert.equal(m.hand, p.hand, m.id);
  }
});

test("the game reads the table: script hook, explicit lefty on the main ROSTER, no !!p.lefty / || false default", () => {
  const html = read("../../index.html");
  assert.match(html, /<script src="src\/players\/handedness\.js[^"]*"><\/script>/);
  assert.match(html, /id: "sinner",[^\n]*lefty: HANDEDNESS\.lefty\("sinner"\)/);
  assert.match(html, /id: "alcaraz",[^\n]*lefty: HANDEDNESS\.lefty\("alcaraz"\)/);
  assert.doesNotMatch(html, /!!\s*[\w.]*lefty/);
  assert.doesNotMatch(html, /lefty\s*\|\|\s*false/);
  assert.match(html, /lefty: handed\(P\)/);
});

// Pull the mirror chain out of index.html and run it in node.
function mirrorChain(players) {
  const html = read("../../index.html");
  const grab = (re) => { const m = html.match(re); assert.ok(m, String(re)); return m[0]; };
  const src = [
    grab(/function handed\(P\) \{[\s\S]*?\n\}/),
    grab(/const handSign = P => [^\n]*/),
    grab(/function frameJoints\(f\)[^\n]*/),
    grab(/function jointVec\(j\) \{[\s\S]*?\n\}/),
    grab(/function poseToWorld\(i, p, pose, t\) \{[\s\S]*?\n\}/),
    grab(/function serveFlip\(i, m\) \{[\s\S]*?\n\}/),
    grab(/function flipAt\(i, mo, t\) \{[\s\S]*?\n\}/),
  ].join("\n");
  const { H } = loadTable();
  const ctx = { HANDEDNESS: H, PLAYERS: players, console, Math };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.api = { poseToWorld, serveFlip, flipAt };", ctx);
  return ctx.api;
}

test("racket hand: every pro, near and far, with his own clip or a mirrored one, at every moment of the serve", () => {
  const { H } = loadTable();
  for (const id of IDS) for (const side of ["near", "far"]) for (const clipHand of ["R", "L"]) {
    const players = [{ id, side, heightM: 1.9 }];
    const api = mirrorChain(players);
    const hit = clipHand === "L" ? "left" : "right", toss = clipHand === "L" ? "right" : "left";
    // Probe pose in the clips' units: x + = the player's own right. The racket wrist sits on the hitting side.
    const pose = { [hit + "Wrist"]: [clipHand === "L" ? -0.3 : 0.3, 1.1, 0], [toss + "Wrist"]: [clipHand === "L" ? 0.3 : -0.3, 1.1, 0] };
    const m = { hand: clipHand, events: { trophy: 0.5, contact: 0.9 } };
    const p = { x: 0, y: side === "near" ? -12 : 12, motion: null };
    p.motion = { m, t: 0, flip: api.serveFlip(0, m) };
    const own = side === "near" ? 1 : -1;                   // court-x sign of the player's own right
    const want = H.lefty(id) ? -1 : 1;                       // his racket side, in his own frame
    for (const t of [0, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1.1]) {
      const W = api.poseToWorld(0, p, pose, t);
      const got = Math.sign((W[hit + "Wrist"].x - p.x) * own);
      assert.equal(got, want, `${id} ${side} clip ${clipHand} t=${t}: racket wrist on his ${got > 0 ? "right" : "left"}`);
    }
  }
});
