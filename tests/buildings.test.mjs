// Scenery stays off the doubles court and inside the stadium bowl, and draw() only paints.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const Buildings = require("../src/buildings/buildings.js");

// Same numbers the court and the stadium use (index.html COURT and STADIUM).
const COURT = { x0: -5.485, x1: 5.485, y0: -11.885, y1: 11.885 };
const BOWL = { a: 12.6, b: 20.6, max: 0.9 };
const MARGIN = 0.35;

function footprint(p) {
  return { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.d };
}
function clearsCourt(p) {
  const f = footprint(p);
  const sepX = f.x1 <= COURT.x0 - MARGIN || f.x0 >= COURT.x1 + MARGIN;
  const sepY = f.y1 <= COURT.y0 - MARGIN || f.y0 >= COURT.y1 + MARGIN;
  return sepX || sepY;
}
function insideBowl(p) {
  const f = footprint(p);
  return [[f.x0, f.y0], [f.x1, f.y0], [f.x0, f.y1], [f.x1, f.y1]].every(([x, y]) =>
    (x * x) / (BOWL.a * BOWL.a) + (y * y) / (BOWL.b * BOWL.b) <= BOWL.max);
}
function overlaps(a, b) {
  const A = footprint(a), B = footprint(b);
  return A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0;
}

function mock() {
  const calls = { fill: 0 };
  const ctx = {
    fillStyle: "",
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() { calls.fill++; },
    save() {},
    restore() {},
  };
  return { ctx, calls };
}
function project(x, y, z = 0) {
  const d = Math.max(0.4, y + 19);
  return { x: 160 + x * 150 / d, y: 120 + (5 - z) * 150 / d, s: 150 / d };
}

test("every surface has the same buildings, outside the court and inside the bowl", () => {
  for (const surface of ["grass", "clay", "hard"]) {
    const list = Buildings.pieces(surface);
    assert.ok(list.length >= 8 && list.length <= 12, surface + " piece count");
    const ids = list.map(p => p.id);
    for (const id of ["clubhouse", "locker", "umpire", "stand", "tower"]) assert.ok(ids.includes(id), id);
    for (const p of list) {
      assert.ok(clearsCourt(p), p.id + " overlaps the doubles court");
      assert.ok(insideBowl(p), p.id + " sits outside the stadium bowl");
      assert.ok(p.w > 0 && p.d > 0 && p.h > 0);
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      assert.equal(overlaps(list[i], list[j]), false, list[i].id + " overlaps " + list[j].id);
    }
  }
  const geom = s => Buildings.pieces(s).map(p => [p.id, p.kind, p.x, p.y, p.w, p.d, p.h].join(","));
  assert.deepEqual(geom("grass"), geom("clay"));
  assert.deepEqual(geom("grass"), geom("hard"));
});

test("each surface has its own colours and an unknown surface uses the night palette", () => {
  const g = Buildings.palette("grass"), c = Buildings.palette("clay"), h = Buildings.palette("hard");
  assert.notEqual(g.roof, c.roof);
  assert.notEqual(c.roof, h.roof);
  assert.notEqual(g.wall, h.wall);
  assert.equal(Buildings.palette("nope").roof, h.roof);
  assert.ok(h.glass !== g.glass, "night windows are lit differently from daytime");
});

test("draw only paints, stays bounded, and does not throw up close", () => {
  const counts = {};
  for (const surface of ["grass", "clay", "hard"]) {
    const a = mock(), b = mock();
    Buildings.draw(a.ctx, project, surface, 19);
    Buildings.draw(b.ctx, project, surface, 19);
    assert.equal(a.calls.fill, b.calls.fill, "paint is stable across frames");
    assert.ok(a.calls.fill > 30 && a.calls.fill < 220, "fill count " + a.calls.fill);
    counts[surface] = a.calls.fill;
    const close = mock();
    assert.doesNotThrow(() => Buildings.draw(close.ctx, project, surface, 0.35));
    assert.doesNotThrow(() => Buildings.draw(close.ctx, project, surface, 5));
  }
  assert.equal(counts.grass, counts.clay);
  assert.equal(counts.grass, counts.hard);
  assert.doesNotThrow(() => Buildings.draw(null, project, "hard", 19));
});

test("index.html keeps a one-line hook and does not move scoring", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /src\/buildings\/buildings\.js\?v=0\.11\.0/);
  const hook = html.indexOf("Buildings.draw(b, proj, cfg.surface, CAM_BACK)");
  const stad = html.indexOf("drawStadium();");
  const surface = html.indexOf("playing surface");
  assert.ok(stad !== -1 && hook !== -1 && surface !== -1);
  assert.ok(stad < hook && hook < surface, "scenery paints after the bowl and before the court");
  assert.match(html, /function awardPoint/);
  assert.match(html, /function drawNet/);
  assert.match(html, /function drawBall/);
  assert.equal((html.match(/Buildings\.draw/g) || []).length, 1);
});
