// HQ-20261118-002.GP.1: touch gesture classifier. Run: node --test src/controls/gestures.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { create } = createRequire(import.meta.url)("./gestures.js");

const tap = (g, id, x, y, t, ms = 80) => { g.down(id, x, y, t); return g.up(id, x, y, t + ms); };
const swipe = (g, id, x, y, dx, dy, t, ms = 120) => { g.down(id, x, y, t); g.move(id, x + dx / 2, y + dy / 2); return g.up(id, x + dx, y + dy, t + ms); };

test("double-tap = split; a single tap does nothing", () => {
  const g = create();
  assert.equal(tap(g, 1, 300, 500, 0), null);
  assert.equal(tap(g, 2, 304, 503, 250), "split");
  assert.equal(tap(g, 3, 300, 500, 420), null, "a third tap starts over");
});
test("taps too far apart in time or space are not a double-tap", () => {
  const g = create();
  tap(g, 1, 300, 500, 0); assert.equal(tap(g, 2, 300, 500, 700), null);
  const h = create();
  tap(h, 1, 100, 500, 0); assert.equal(tap(h, 2, 300, 500, 150), null);
});
test("flick down = slide, sideways = slice, up and diagonals = nothing", () => {
  const g = create();
  assert.equal(swipe(g, 1, 300, 400, 0, 80, 0), "slide");
  assert.equal(swipe(g, 2, 300, 400, 90, 10, 1000), "slice");
  assert.equal(swipe(g, 3, 300, 400, -90, 5, 2000), "slice");
  assert.equal(swipe(g, 4, 300, 400, 0, -90, 3000), null, "up / toward the opponent is reserved for aiming");
  assert.equal(swipe(g, 5, 300, 400, 60, 60, 4000), null, "diagonal");
});
test("long press, slow drag and short wiggle do nothing", () => {
  const g = create();
  assert.equal(tap(g, 1, 300, 500, 0, 600), null, "long press");
  assert.equal(swipe(g, 2, 300, 400, 0, 120, 1000, 600), null, "slow drag = stick");
  assert.equal(swipe(g, 3, 300, 400, 0, 25, 2000), null, "under the flick distance");
});
test("two-finger tap (pause) and its second finger never count", () => {
  const g = create();
  g.down(1, 100, 500, 0); g.down(2, 300, 500, 30);
  assert.equal(g.up(1, 100, 500, 120), null); assert.equal(g.up(2, 300, 500, 140), null);
  // a two-finger tap right after a one-finger tap must not complete a double-tap either
  const h = create();
  tap(h, 9, 300, 500, 0);
  h.down(1, 300, 500, 150); h.down(2, 320, 500, 170);
  assert.equal(h.up(1, 300, 500, 230), null); assert.equal(h.up(2, 320, 500, 240), null);
  // two two-finger taps in a row are not a double-tap
  const k = create();
  k.down(1, 100, 500, 0); k.down(2, 300, 500, 20); k.up(1, 100, 500, 100); k.up(2, 300, 500, 110);
  k.down(3, 100, 500, 250); k.down(4, 300, 500, 260);
  assert.equal(k.up(3, 100, 500, 330), null); assert.equal(k.up(4, 300, 500, 340), null);
});
test("free finger works while the stick finger is held", () => {
  const g = create();
  g.down(1, 80, 600, 0); g.move(1, 120, 600);              // stick held since t=0
  assert.equal(tap(g, 2, 300, 500, 1000), null);
  assert.equal(tap(g, 3, 300, 500, 1200), "split");
  assert.equal(swipe(g, 4, 300, 400, 0, 80, 2000), "slide");
  assert.equal(swipe(g, 5, 300, 400, 80, 0, 3000), "slice");
  assert.equal(g.up(1, 120, 600, 4000), null, "the stick finger lifting after a long hold is not a gesture");
});
test("three fingers: nothing", () => {
  const g = create();
  g.down(1, 80, 600, 0);
  g.down(2, 200, 500, 1000); g.down(3, 300, 500, 1400);
  assert.equal(g.up(2, 200, 500, 1450), null); assert.equal(g.up(3, 300, 500, 1460), null);
});
test("cancel forgets the finger", () => {
  const g = create();
  g.down(1, 300, 500, 0); g.cancel(1);
  assert.equal(g.up(1, 300, 500, 50), null);
});
