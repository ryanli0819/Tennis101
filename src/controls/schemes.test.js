// Quick test for the control schemes: run `node src/controls/schemes.test.js`.
// Every scheme binds every required action, and no key means two things in one scheme.
const assert = require("assert");
const C = require("./schemes.js");

let fails = 0;
const check = (name, fn) => { try { fn(); console.log("ok  ", name); } catch (e) { fails++; console.log("FAIL", name, "-", e.message); } };

const ids = C.CONTROL_SCHEMES.map(s => s.id);
check("the four schemes exist", () => assert.deepStrictEqual(ids.sort(), ["arrows", "gamepad", "touch", "wasd"]));

for (const s of C.CONTROL_SCHEMES) {
  check(`${s.id}: has id, label, devices, bindings`, () => {
    assert.ok(s.id && s.label && s.devices.length && s.bindings.length);
    s.bindings.forEach(b => assert.ok(b.action && b.keys.length && b.text, JSON.stringify(b)));
  });
  check(`${s.id}: every required action is bound`, () => {
    const bound = new Set(s.bindings.map(b => b.action));
    const missing = C.REQUIRED_ACTIONS.filter(a => !bound.has(a));
    assert.deepStrictEqual(missing, []);
  });
  check(`${s.id}: no action is bound twice`, () => {
    const seen = s.bindings.map(b => b.action);
    assert.strictEqual(new Set(seen).size, seen.length);
  });
  check(`${s.id}: no two actions share a key`, () => {
    const owner = new Map();
    s.bindings.forEach(b => b.keys.forEach(k => {
      assert.ok(!owner.has(k), `"${k}" is both ${owner.get(k)} and ${b.action}`);
      owner.set(k, b.action);
    }));
  });
  check(`${s.id}: test keys 1, 2, Z stay free`, () => {
    const keys = s.bindings.flatMap(b => b.keys);
    ["1", "2", "z"].forEach(k => assert.ok(!keys.includes(k), k));
  });
}

check("wasd keeps today's layout", () => {
  C.setScheme("wasd", { save: false });
  const map = { w: "moveForward", s: "moveBack", a: "moveLeft", d: "moveRight", Shift: "splitStep", Space: "slide",
                e: "slice", Escape: "pause", v: "toggleView", ArrowLeft: "aimLeft", ArrowUp: "aimLong" };
  Object.entries(map).forEach(([k, a]) => assert.strictEqual(C.actionFor(k), a, k));
});

check("getMoveInput: W = toward the net, diagonals stay unit length", () => {
  C.setScheme("wasd", { save: false });
  C.press("w"); assert.deepStrictEqual(C.getMoveInput(), { x: 0, y: 1 });
  C.press("d"); const m = C.getMoveInput(); assert.ok(Math.abs(Math.hypot(m.x, m.y) - 1) < 1e-9 && m.x > 0 && m.y > 0);
  C.release("w"); C.release("d"); assert.deepStrictEqual(C.getMoveInput(), { x: 0, y: 0 });
});

check("arrows scheme: arrows move, arrows no longer aim", () => {
  C.setScheme("arrows", { save: false });
  C.press("ArrowLeft"); assert.deepStrictEqual(C.getMoveInput(), { x: -1, y: 0 });
  assert.deepStrictEqual(C.getAimInput(), { x: 0, y: 0 });
  C.clearHeld();
});

check("keyboard keys do nothing in the touch scheme; the stick does", () => {
  C.setScheme("touch", { save: false });
  assert.strictEqual(C.press("w"), null);
  C.setStick(0.5, -0.5); assert.deepStrictEqual(C.getMoveInput(), { x: 0.5, y: -0.5 });
  C.clearHeld();
});

check("keyOf uses the physical key (Shift+W is still w)", () => {
  assert.strictEqual(C.keyOf({ code: "KeyW", key: "W" }), "w");
  assert.strictEqual(C.keyOf({ code: "Space", key: " " }), "Space");
  assert.strictEqual(C.keyOf({ code: "Slash", key: "?" }), "/");
  assert.strictEqual(C.keyOf({ code: "ShiftLeft", key: "Shift" }), "Shift");
});

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
