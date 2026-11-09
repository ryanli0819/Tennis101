// Anatomy checks (Biomechanics Coach). Run: node --test tests/anatomy.test.mjs
// Hard checks fail the test: a joint past its range, legs crossing in a stance, a knee driving backward, a serve
// whose contact is not the racket hand's high point. Advice (poses that are possible but not like the real players)
// is printed, not failed: GAME_CHECK.md in datasets/anatomy/ says who owns each fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const json = (p) => JSON.parse(read(p));
const joints = json("datasets/anatomy/joints.json");
const KNEE_MAX = joints.joints.knee.range.flexion[1];
const ELBOW_MAX = joints.joints.elbow.range.flexion[1];

// Run a game script in a sandbox with just enough browser to define its globals.
function load(file) {
  const window = {};
  const ctx = { window, matchMedia: () => ({ matches: false }), performance: { now: () => 0 }, console };
  window.matchMedia = ctx.matchMedia;
  vm.runInNewContext(read(file), ctx, { filename: file });
  return window;
}

// Flexion (0 = straight) at b between segments b→a and b→c, in the picture plane.
function flex(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (!n) return 0;
  return 180 - (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180) / Math.PI;
}

test("joints.json: every range is a real range of motion with a source", () => {
  for (const [name, j] of Object.entries(joints.joints)) {
    assert.ok(j.source, `${name} has a source`);
    assert.ok(j.bends, `${name} says which way it bends`);
    for (const [motion, r] of Object.entries(j.range)) {
      assert.equal(r.length, 2, `${name}.${motion}`);
      assert.ok(r[0] >= 0 && r[0] < r[1] && r[1] <= 180, `${name}.${motion} ${r}`);
    }
  }
  assert.ok(KNEE_MAX <= 150 && ELBOW_MAX <= 160);
  for (const k of Object.keys(joints.sources)) assert.ok(joints.sources[k].length > 10, `source ${k}`);
});

test("joints.json: body proportions stack up from the ankle to the eyes", () => {
  const h = joints.bodyProportions.heights, l = joints.bodyProportions.lengths;
  const order = ["ankle", "knee", "hip", "shoulder", "chin", "eye"];
  for (let k = 1; k < order.length; k++) assert.ok(h[order[k]] > h[order[k - 1]], `${order[k]} above ${order[k - 1]}`);
  assert.ok(h.eye < 1);
  assert.ok(Math.abs(h.hip - h.knee - l.thigh) < 0.01, "thigh = hip − knee");
  assert.ok(Math.abs(h.knee - h.ankle - l.shank) < 0.01, "shank = knee − ankle");
});

test("movements: angles stay inside joints.json, events run in order", () => {
  const files = readdirSync(new URL("datasets/anatomy/movements/", root)).filter((f) => f.endsWith(".json"));
  for (const want of ["serve.json", "split-step.json", "return-stance.json"]) assert.ok(files.includes(want), want);
  for (const f of files) {
    const m = json(`datasets/anatomy/movements/${f}`);
    assert.ok(m.movement && m.about && m.sources && m.sources.length, `${f} has movement, about, sources`);
    // every knee/elbow flexion anywhere in the file
    const walk = (o, path) => {
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        const at = `${f}:${path}.${k}`;
        if (/kneeflex/i.test(k) && typeof v === "number") assert.ok(v >= 0 && v <= KNEE_MAX, at);
        if (/elbowflex/i.test(k) && typeof v === "number") assert.ok(v >= 0 && v <= ELBOW_MAX, at);
        walk(v, `${path}.${k}`);
      }
    };
    walk(m, "");
  }
  const serve = json("datasets/anatomy/movements/serve.json");
  const t = serve.events.map((e) => e.t);
  for (let k = 1; k < t.length; k++) assert.ok(t[k] > t[k - 1], `serve event ${serve.events[k].name} after ${serve.events[k - 1].name}`);
  assert.equal(serve.events.find((e) => e.name === "contact").t, 0);
  const split = json("datasets/anatomy/movements/split-step.json");
  assert.ok(split.measured.landingStanceWidthH.median > joints.bodyProportions.lengths.shoulderWidth, "split step lands wider than the shoulders");
});

test("US Open players: only the two players are kept, and every serve is Alcaraz's (right-handed, near court)", () => {
  const p = json("datasets/anatomy/uso/players.json");
  let serves = 0;
  for (const c of p.clips) {
    assert.ok(c.dropped.crowd > 0, `${c.file} dropped the crowd`);
    for (const t of c.tracks) {
      assert.ok(["court", "closeup"].includes(t.kind));
      for (const s of t.serves || []) {
        serves++;
        assert.equal(s.toss, "left"); assert.equal(s.hand, "right");
        assert.equal(t.player, "alcaraz");
      }
    }
  }
  assert.ok(serves >= 7, `found ${serves} serves`);
});

// The sprite's legs (index.html drawPlayer): hip 0.5 H up minus the drop, ankle 0.06 H up, hips ±0.06 H, feet at
// dx × 0.30 H (sprite width = 0.30 H). Standing hip→ankle = 0.44 H; thigh = shin, so knee flexion = 2·acos(d / 0.44).
function spriteKnee(fr, k) {
  const drop = fr.crouch - fr.bob, f = fr.feet[k], side = k ? 1 : -1;
  const v = 0.5 - drop - 0.06 - (f.lift || 0), lat = f.dx * 0.3 - side * 0.06;
  return (2 * Math.acos(Math.min(1, Math.hypot(v, lat) / 0.44)) * 180) / Math.PI;
}

test("run cycle: legs never cross, knees drive forward, every knee inside its range", () => {
  const { Anim } = load("src/animation/run-cycle.js");
  assert.ok(Anim && Anim.framesFor, "Anim loaded");
  for (const id of ["sinner", "alcaraz", "other"]) {
    for (const [kind, dirs] of [["run", ["away", "toward"]], ["backpedal", ["away", "toward"]], ["shuffle", ["left", "right"]], ["siderun", ["left", "right"]]]) {
      for (const dir of dirs) {
        for (const fr of Anim.framesFor(id, kind, dir)) {
          const at = `${id} ${kind} ${dir} frame ${fr.frame}`;
          if (kind !== "siderun") assert.ok(fr.feet[0].dx < fr.feet[1].dx, `${at}: left foot stays left of the right foot`);
          for (const f of fr.feet) assert.ok(f.lift >= 0, `${at}: feet never go below the court`);
          const s = dir === "away" || dir === "right" ? 1 : -1;
          // (a backpedal faces against its travel, so its knee should rise the other way: advice in GAME_CHECK.md)
          if (kind !== "backpedal") for (const kn of fr.knees) {
            const drive = kind === "siderun" ? kn.dx : kn.dy;
            assert.ok(s * drive >= -1e-9, `${at}: knee drives the way he runs, never backward`);
          }
          for (const k of [0, 1]) assert.ok(spriteKnee(fr, k) <= KNEE_MAX, `${at}: knee ${k}`);
        }
      }
    }
  }
});

test("stances: ready, return, split, plant, slide stay inside the joints (advice printed)", () => {
  const { Anim } = load("src/animation/run-cycle.js");
  const base = { vx: 0, vy: 0, run: 0, slide: 0, air: 0, plant: 0, receiving: false, slideV: { x: 1, y: 0 } };
  const poses = {
    ready: { ...base },
    receive: { ...base, receiving: true },
    split: { ...base, air: 0.1 },
    plant: { ...base, vx: 3, plant: 0.1 },
    slide: { ...base, slide: 0.3 },
  };
  const want = { receive: json("datasets/anatomy/movements/return-stance.json").stance.feetWidthH.range,
                 split: json("datasets/anatomy/movements/split-step.json").measured.landingStanceWidthH.range };
  for (const [name, p] of Object.entries(poses)) {
    const fr = Anim.frame(p, { top: 6 }, true, "alcaraz");
    assert.equal(fr.kind, name);
    assert.ok(fr.feet[0].dx < fr.feet[1].dx, `${name}: feet not crossed`);
    const knees = [0, 1].map((k) => spriteKnee(fr, k));
    for (const kn of knees) assert.ok(kn <= KNEE_MAX, `${name}: knee ${kn.toFixed(0)}°`);
    const width = (fr.feet[1].dx - fr.feet[0].dx) * 0.3;
    const w = want[name];
    const note = w && (width < w[0] || width > w[1]) ? `  ← real: ${w[0]}–${w[1]} H` : "";
    console.log(`  ${name.padEnd(8)} feet ${width.toFixed(2)} H apart, knees ~${knees.map((k) => k.toFixed(0)).join("/")}°${note}`);
  }
});

test("serve motions: knees in range, contact is the racket hand's high point (elbow folds printed)", () => {
  const files = readdirSync(new URL("src/serve/motion/", root)).filter((f) => f.endsWith("-serve.js"));
  const all = {};
  for (const f of files) Object.assign(all, load(`src/serve/motion/${f}`).SERVE_MOTIONS);
  assert.ok(Object.keys(all).length >= 2);
  for (const [pid, set] of Object.entries(all)) {
    for (const [name, mo] of Object.entries(set)) {
      if (!mo || !mo.frames) continue;
      const at = `${pid}.${name}`, ev = mo.events;
      const order = ["start", "tossRelease", "trophy", "contact", "finish"].filter((e) => e in ev);
      for (let k = 1; k < order.length; k++) assert.ok(ev[order[k]] > ev[order[k - 1]], `${at}: ${order[k]} after ${order[k - 1]}`);
      let folded = 0;
      for (const fr of mo.frames) {
        const j = fr.j;
        for (const s of ["left", "right"]) {
          assert.ok(flex(j[s + "Hip"], j[s + "Knee"], j[s + "Ankle"]) <= KNEE_MAX, `${at} t=${fr.t}: ${s} knee`);
          if (flex(j[s + "Shoulder"], j[s + "Elbow"], j[s + "Wrist"]) > ELBOW_MAX) folded++;
        }
      }
      const c = mo.frames.reduce((a, f) => (Math.abs(f.t - ev.contact) < Math.abs(a.t - ev.contact) ? f : a));
      const hand = (set.hand || "right") + "Wrist";
      assert.ok(c.j[hand][1] > c.j.nose[1], `${at}: racket hand above the head at contact`);
      const near = mo.frames.filter((f) => Math.abs(f.t - ev.contact) <= 0.04);
      const straight = Math.min(...near.map((f) => flex(f.j[hand.replace("Wrist", "Shoulder")], f.j[hand.replace("Wrist", "Elbow")], f.j[hand])));
      assert.ok(straight <= 60, `${at}: racket arm nearly straight at contact (${straight.toFixed(0)}°)`);
      console.log(`  ${at.padEnd(20)} racket elbow at contact ${straight.toFixed(0)}° (real ≈ 13°), elbow drawn past ${ELBOW_MAX}° in ${folded} joint-frames`);
    }
  }
});
