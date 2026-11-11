// Captured serves for the 22 roster players. Contract: SERVE_MOTIONS[id] = { first, second }.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const IDS = ["zverev", "sinner", "alcaraz", "shelton", "medvedev", "cobolli", "fils", "tiafoe", "de-minaur", "jodar", "djokovic", "fritz", "auger-aliassime", "paul", "lehecka", "mensik", "davidovich-fokina", "nakashima", "tien", "federer", "nadal", "kyrgios"];
const LEFTIES = new Set(["shelton", "nadal", "tien"]);
const EVENTS = ["tossRelease", "trophy", "contact", "finish"];
const JOINTS = ["nose", "neck", "head", "chest", "pelvis", "root", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle", "leftToe", "rightToe"];

const ctx = { window: { ROSTER: [{ id: "sinner", lefty: undefined }, { id: "alcaraz" }] } };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../src/serve/motion/roster-serves.js", import.meta.url), "utf8"), ctx);
const motions = ctx.window.SERVE_MOTIONS;
const catalog = ctx.window.SERVE_CATALOG;

test("every roster id has a first and a second captured serve", () => {
  assert.deepEqual([...catalog].map((p) => String(p.id)), IDS);
  assert.deepEqual([...Object.keys(motions)].map(String).sort(), [...IDS].sort());
  for (const id of IDS) {
    assert.ok(motions[id].first.frames.length >= 8, id + " first");
    assert.ok(motions[id].second.frames.length >= 8, id + " second");
    assert.equal(motions[id].first.player, id);
    assert.equal(motions[id].second.player, id);
  }
});

test("speed, spin and serve type are not invented", () => {
  for (const p of catalog) for (const m of p.serves) {
    assert.equal(m.speed_kmh, null, m.id);
    assert.equal(m.spin_rpm, null, m.id);
    assert.equal(m.serveType, null, m.id);
  }
});

test("kneeBend and backArch stay inside 0..1", () => {
  for (const p of catalog) for (const m of p.serves) {
    for (const k of ["kneeBend", "backArch"]) {
      if (m[k] == null) continue;
      assert.ok(m[k] >= 0 && m[k] <= 1, m.id + " " + k + " " + m[k]);
    }
  }
  const fils = motions.fils.first;
  assert.equal(fils.backArchRaw, 1.5);
  assert.equal(fils.backArch, 1);
});

test("thin players are labeled, not filled in", () => {
  assert.equal(motions.fils.second.reused, true);
  assert.equal(motions.fils.first.frames, motions.fils.second.frames);
  assert.match(motions.fils.second.note, /reused/i);
  assert.match(motions.nakashima.first.note, /2021/);
  assert.equal(catalog.find((p) => p.id === "nakashima").serves.some((s) => s.lowConfidence), true);
  assert.equal(motions.nakashima.first.lowConfidence, false);
  assert.equal(motions.nakashima.second.lowConfidence, false);
  assert.match(motions.kyrgios.first.note, /underarm/i);
  assert.equal(motions.kyrgios.first.serveType, null);
  for (const id of ["sinner", "medvedev", "cobolli", "lehecka", "tien"]) {
    assert.notEqual(motions[id].first.id, motions[id].second.id, id);
    assert.equal(motions[id].second.reused, false);
  }
});

test("events and joints match the serve-motion contract", () => {
  for (const id of IDS) {
    const m = motions[id].first;
    assert.equal(m.hand, LEFTIES.has(id) ? "L" : "R");
    for (const ev of EVENTS) assert.equal(typeof m.events[ev], "number", id + " " + ev);
    assert.ok(m.events.contact >= m.events.tossRelease, id);
    assert.ok(m.events.finish >= m.events.contact, id);
    const j = m.frames[0].joints;
    for (const n of JOINTS) {
      assert.equal(typeof j[n].x, "number", n);
      assert.ok(Number.isFinite(j[n].x + j[n].y + j[n].z), id + " " + n);
    }
    const hit = m.hand === "L" ? "leftWrist" : "rightWrist";
    const contact = m.frames.reduce((a, b) => Math.abs(b.t - m.events.contact) < Math.abs(a.t - m.events.contact) ? b : a);
    assert.ok(contact.joints[hit].y > 0.9, id + " contact wrist " + contact.joints[hit].y);
  }
});

test("players missing from the roster are appended, existing entries are kept", () => {
  const roster = ctx.window.ROSTER;
  assert.equal(roster.length, 22);
  assert.equal(roster[0].id, "sinner");
  assert.equal(roster.find((p) => p.id === "nadal").lefty, true);
  assert.equal(roster.find((p) => p.id === "federer").servePlaceholder, true);
});

test("the game page loads the captured serves", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /src\/serve\/motion\/roster-serves\.js/);
  assert.match(html, /function frameJoints/);
  assert.match(html, /m\.hand === "L"/);
});
