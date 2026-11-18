// Ball drawn at true size (HQ-20261118-003): the ball, its shadow and the court lines go through the same proj().s,
// so a ball landing exactly on the far baseline (ITF Rule 12: a ball touching a line is in) is drawn overlapping it.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = html.match(re); assert.ok(m, String(re)); return m[0]; };
const SRC = [
  grab(/const COURT = [^\n]*/),
  grab(/const CAMS = \{[\s\S]*?\n\};/),
  grab(/const horizonFor = [^\n]*/),
  grab(/function proj\(x, y, z = 0\) \{[\s\S]*?\n\}/),
  grab(/const BALL_R = [\s\S]*?function ballRadiusPx\(p\)[^\n]*/),
].join("\n").replace(/^(const|let) /gm, "var ");
const REAL_R = 0.0335;                     // SOURCED: ITF Rules of Tennis 2026 Appendix I, 6.54–6.86 cm diameter
const L = 11.885;

// One camera set up the way the game does it (resize + updateCamera at rest, drawServeInset for the inset).
function camera(cam, PXv, W = 1280, H = 720) {
  const ctx = { Math, PX: PXv, pos: [{ x: 0, y: -L - 0.05 }, { x: 0, y: L + 0.05 }], PLAYERS: [{ heightM: 1.88 }] };
  vm.createContext(ctx);
  vm.runInContext(SRC + `
    var basePx = W < 700 ? 2 : 3; BW = Math.ceil(W / basePx) * PX; BH = Math.ceil(H / basePx) * PX; F = Math.min(BW * 0.63, BH * 0.95);
    var t = CAMS[cam === "inset" ? "broadcast" : cam](); CAM_BACK = t.back; CAM_H = t.h; CAM_X = t.x; HZ = horizonFor(t);
    if (cam === "inset") { PX = 1; var p = pos[1], d = p.y + CAM_BACK; F = 0.86 * 78 * d / 3.5; BW = 60; BH = 78; CAM_X = p.x; HZ = 78 * 0.93 - CAM_H * F / d; }
    this.api = {
      line(y) { const a = proj(0, y); return cam === "inset" ? { y0: a.y - 0.5, y1: a.y + 0.5 }     // inset baseline: fillRect(a.y - 0.5, 1)
        : { y0: Math.round(a.y) + (PX % 2 ? 0.5 : 0) - PX / 2, y1: Math.round(a.y) + (PX % 2 ? 0.5 : 0) + PX / 2 }; },   // line(): lineWidth PX
      ball(y, z = 0) { const p = proj(0, y, z); return { y: p.y, r: ballRadiusPx(p), s: p.s }; },
      PX: () => PX, BH: () => BH,
    };`, Object.assign(ctx, { cam, W, H }));
  return ctx.api;
}
const overlaps = (b, l) => b.y + b.r > l.y0 && b.y - b.r < l.y1;
const CASES = [["broadcast", 2], ["serve", 2], ["inset", 2], ["broadcast", 1], ["serve", 1], ["inset", 1]];

test("a ball landing exactly on the far baseline is drawn overlapping the line, per camera, at PX 2 and 1", () => {
  for (const [cam, PXv] of CASES) {
    const c = camera(cam, PXv), b = c.ball(L), l = c.line(L);
    assert.ok(b.y >= 0 && b.y <= c.BH(), `${cam} PX${PXv}: far baseline on screen`);
    assert.ok(overlaps(b, l), `${cam} PX${PXv}: ball ${b.y.toFixed(2)}±${b.r.toFixed(2)} vs line ${l.y0}..${l.y1}`);
    // its shadow at the bounce (z = 0) is the same disc on the ground: drawShadows uses ballRadiusPx(proj(sx, sy))
    assert.ok(overlaps({ y: b.y, r: b.r * 0.42 }, l), `${cam} PX${PXv}: shadow`);
  }
  assert.match(html, /g = proj\(sx, sy\), r = ballRadiusPx\(g\)/, "shadow sized by ballRadiusPx");
  assert.match(html, /const p = proj\(ball\.x, ball\.y, ball\.z\), r = ballRadiusPx\(p\)/, "ball sized by ballRadiusPx");
});

test("drawn radius = real 3.35 cm through proj().s; the only floor is GAME-DESIGN and never wider than a court line", () => {
  for (const [cam, PXv] of CASES) {
    const c = camera(cam, PXv), PXc = c.PX();
    for (const y of [-L, -6.4, 0, 6.4, L]) {
      const b = c.ball(y), real = REAL_R * b.s;
      assert.ok(Math.abs(b.r - Math.max(real, 0.5 * PXc)) < 1e-9, `${cam} PX${PXv} y=${y}: r ${b.r} vs real ${real}`);
      assert.ok(2 * b.r <= Math.max(2 * real, PXc) + 1e-9, `${cam} PX${PXv} y=${y}: never bigger than max(real, one line width)`);
    }
  }
});

test("on broadcast a ball 1 m past the far baseline no longer touches the drawn line (the old 3x ball did)", () => {
  for (const PXv of [2, 1]) {
    const c = camera("broadcast", PXv);
    assert.ok(!overlaps(c.ball(L + 1.0), c.line(L)), `PX${PXv}`);
  }
});
