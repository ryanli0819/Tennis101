// Every agent in agents.json gets a campus building, and a LOG.md parses to a status.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const HQ = require("../agents/command-center/campus.js");
const agents = JSON.parse(fs.readFileSync(new URL("../agents/agents.json", import.meta.url), "utf8"));
const sups = JSON.parse(fs.readFileSync(new URL("../agents/supervisors.json", import.meta.url), "utf8"));

function fakeCanvas() {
  const ops = [];
  const g = {
    fillStyle: "",
    clearRect() {},
    fillRect(x, y, w, h) { ops.push({ x, y, w, h, c: g.fillStyle }); },
  };
  return { canvas: { width: 0, height: 0, getContext: () => g }, ops };
}

test("every agent has its own named building", () => {
  const ids = agents.agents.map(a => a.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 19);
  const kinds = new Set();
  for (const a of agents.agents) {
    const spec = HQ.kindFor(a.name, a.title);
    assert.equal(spec.place.length > 0, true, a.name);
    assert.ok(HQ.PLACES[a.name], a.name + " is missing from the campus");
    assert.equal(spec.kind, HQ.PLACES[a.name].kind);
    kinds.add(spec.kind);
    const { canvas, ops } = fakeCanvas();
    HQ.paintBuilding(canvas, spec, "idle", HQ.colors(false));
    assert.equal(canvas.width, 64);
    assert.ok(ops.length > 20, spec.kind);
    assert.ok(ops.some(o => o.c === HQ.colors(false).signInk), spec.kind + " paints its sign");
  }
  assert.ok(kinds.has("lab") && kinds.has("shed") && kinds.has("locker") && kinds.has("video"));
  const lab = fakeCanvas();
  const locker = fakeCanvas();
  HQ.paintBuilding(lab.canvas, HQ.kindFor("ball-physicist"), "running", HQ.colors(false));
  HQ.paintBuilding(locker.canvas, HQ.kindFor("locker-room-designer"), "running", HQ.colors(false));
  assert.notDeepEqual(lab.ops.map(o => o.c + o.x + o.y), locker.ops.map(o => o.c + o.x + o.y));
});

test("an agent that is not on the roster yet still gets a building", () => {
  const spec = HQ.kindFor("new-coach", "Net Play Coach");
  assert.equal(spec.kind, "hut");
  assert.equal(spec.place, "Clubhouse");
  const locker = HQ.kindFor("visitor", "Locker Room Helper");
  assert.equal(locker.kind, "locker");
});

test("neighborhoods cover every agent once, grouped by supervisor", () => {
  const list = agents.agents.map(a => {
    const sid = Object.entries(sups.supervisors).find(([, s]) => (s.members || []).includes(a.name));
    return { id: a.name, title: a.title, supervisor: sid ? sid[0] : null };
  });
  const groups = HQ.neighborhoods(list, sups.supervisors);
  const flat = groups.flatMap(g => g.agents.map(a => a.id));
  assert.deepEqual(flat.slice().sort(), list.map(a => a.id).sort());
  assert.equal(new Set(flat).size, flat.length);
  const gameplay = groups.find(g => g.id === "gameplay");
  assert.ok(gameplay.agents.some(a => a.id === "ball-physicist"));
  assert.equal(groups[0].id, "gameplay");
  assert.ok(groups.some(g => g.id === "product" && g.agents.some(a => a.id === "locker-room-designer")));
});

test("LOG.md status comes from the latest entry", () => {
  const ball = fs.readFileSync(new URL("../agents/ball-physicist/LOG.md", import.meta.url), "utf8");
  const parsed = HQ.parseLog(ball);
  assert.equal(parsed.status, "idle");
  assert.match(parsed.task, /No runs yet/);

  const anim = fs.readFileSync(new URL("../agents/animator/LOG.md", import.meta.url), "utf8");
  const animP = HQ.parseLog(anim);
  assert.equal(animP.status, "idle");
  assert.match(animP.task, /^Next:/);

  const blocked = HQ.parseLog("# Log\n\nOld note says blocked.\n\n## Nov 11\n\nWorking fine. Next: tune the bounce.");
  assert.equal(blocked.status, "idle");
  assert.match(blocked.task, /Next: tune the bounce/);

  const now = HQ.parseLog("briefSeen: 3\n\n## Nov 11\n\nExport is blocked on a missing clip.\nNext: ask Ryan.");
  assert.equal(now.status, "blocked");
  assert.equal(now.briefSeen, 3);
  assert.match(now.task, /Next: ask Ryan/);

  assert.equal(HQ.parseLog("").status, "idle");
});

test("light and dark palettes both keep a readable sign and distinct status lamps", () => {
  for (const dark of [false, true]) {
    const C = HQ.colors(dark);
    assert.notEqual(C.sign, C.signInk);
    assert.notEqual(C.lamps.running, C.lamps.blocked);
    assert.notEqual(C.lamps.review, C.lamps.idle);
    assert.notEqual(C.grassA, C.wall);
  }
  assert.notEqual(HQ.colors(false).wall, HQ.colors(true).wall);
  assert.notEqual(HQ.colors(false).grassA, HQ.colors(true).grassA);
});

test("ground and centre court paint without a document", () => {
  for (const paint of [HQ.paintGround, HQ.paintCourt]) {
    const ops = [];
    const canvas = {
      width: 0, height: 0, clientWidth: 300, clientHeight: 120,
      getContext: () => ({
        fillStyle: "",
        createPattern: null,
        fillRect(x, y, w, h) { ops.push(w > 0 && h > 0); },
      }),
    };
    // createPattern is null, so the grass fallback uses fillRect
    Object.defineProperty(canvas.getContext(), "createPattern", { value: undefined });
    paint(canvas, HQ.colors(false));
    assert.ok(canvas.width >= 8 && canvas.height >= 8);
    assert.ok(ops.length > 4);
  }
});
