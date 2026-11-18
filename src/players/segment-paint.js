/* src/players/segment-paint.js — PER-SEGMENT PAINT ORDER for the skeleton figure (Alcaraz, Sinner). Owner: player-artist.
   Task HQ-20261117-002.PM.1 (paint half). Standard: skill `human-body-folding-and-foreshortening` §3 (draw in depth order,
   far first; a hidden segment is drawn behind, never deleted).

   What this file does (pure logic, no drawing; index.html drawCapturedFigure paints):
   1. order(): asks the Body Motion Engineer's BodySkeleton.segmentsInDrawOrder(J, camera, radii) for the far→near order of
      the 13 limb segments + torso for THIS camera, then applies NEAR-TIE HYSTERESIS to its overlapping pairs and re-sorts.
      When nothing is held, the order IS the skeleton's order, untouched.
   2. Two painted parts that are not skeleton segments — the skull (anchored to "neck") and the racket (anchored to the
      hitting hand) — are slotted into that order by the same pairwise rule (overlap on screen → farther part first).
   3. HYSTERESIS (GAME-DESIGN): an overlapping pair keeps last frame's order unless the new order's mean depth gap over the
      overlap is at least HYST_M. State is per player, per view, per segment pair; it resets when the camera (view key)
      or the motion changes. HYST_M = 0.02 m: the r2 solve's signed thigh/shank gap from above swings by 0.015 m between
      Ryan's frames 332 (+0.011, thigh over) and 333 (−0.004, calf over) (MEASURED, body-motion-engineer r2
      ryan-case.json), so 0.02 m holds that tie with margin; and it is below the smallest painted limb radius
      (hand/foot 0.03 m, GAME-DESIGN in skeleton.js radiiM), so a limb that really passes another by more than its own
      thickness still swaps.
   Works in the browser (window.SegmentPaint) and in node (module.exports). Declared + pinned in index.html (API 1). */
(function (root) {
  const API = 1, VERSION = "0.14.0-paint.1";
  const HYST_M = 0.02;                                   // GAME-DESIGN, see header
  const views = new Map();                               // `${player}|${view}` → { camKey, motion, pairs: Map }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const mid = (a, b) => mul(add(a, b), 0.5);
  const arr = v => (v ? (Array.isArray(v) ? v : [v.x, v.y, v.z]) : null);
  const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  function stateFor(player, view, camKey, motion) {
    const k = player + "|" + view;
    let s = views.get(k);
    if (!s || s.camKey !== camKey || (motion !== undefined && s.motion !== motion)) {
      s = { camKey, motion, pairs: new Map(), resets: (s ? s.resets + 1 : 0) };
      views.set(k, s);
    }
    return s;
  }
  function reset(player) { for (const k of [...views.keys()]) if (player == null || k.startsWith(player + "|")) views.delete(k); }

  /* hold(state, pairs, thr): pairs = [{ far, near, meanDepthGap }] (gap ≥ 0, along the fresh decision). Returns the pairs
     to sort by, with held = true where last frame's order was kept because the fresh gap is below thr. */
  function hold(state, pairs, thr = HYST_M) {
    const out = [];
    for (const pr of pairs) {
      const key = pairKey(pr.far, pr.near), prev = state ? state.pairs.get(key) : null;
      let far = pr.far, near = pr.near, held = false;
      if (prev && prev.far !== pr.far && pr.meanDepthGap < thr) { far = prev.far; near = prev.near; held = true; }
      if (state) state.pairs.set(key, { far, near });
      out.push({ ...pr, far, near, held, freshFar: pr.far });
    }
    return out;
  }

  /* Kahn sort, same rule as BodySkeleton.segmentsInDrawOrder: among ready items, the farthest midpoint first; a cycle
     is broken by midpoint depth. items: [{ name, midDepth }] in the skeleton's order. */
  function sortBy(items, pairs) {
    const idx = new Map(items.map((it, k) => [it.name, k])), deg = items.map(() => 0), succ = items.map(() => []);
    for (const p of pairs) { const f = idx.get(p.far), n = idx.get(p.near); if (f == null || n == null) continue; succ[f].push(n); deg[n]++; }
    const done = items.map(() => false), order = [];
    while (order.length < items.length) {
      let ready = items.map((_, k) => k).filter(k => !done[k] && deg[k] === 0);
      if (!ready.length) ready = items.map((_, k) => k).filter(k => !done[k]);
      ready.sort((a, b) => items[b].midDepth - items[a].midDepth || a - b);
      const k = ready[0]; done[k] = true; order.push(items[k]); for (const s of succ[k]) deg[s]--;
    }
    return order;
  }

  /* Screen samples of a painted part: [{ p, q: projected, r: metres }]. */
  function samplesSeg(A, B, r, camera, N = 9) {
    if (!A || !B) return [];
    const out = []; for (let k = 0; k <= N; k++) { const p = add(A, mul(sub(B, A), k / N)); out.push({ p, q: camera.project(p), r }); }
    return out;
  }
  function samplesTorso(J, camera, r) {
    const ls = arr(J.leftShoulder), rs = arr(J.rightShoulder), lh = arr(J.leftHip), rh = arr(J.rightHip); if (!ls || !rs || !lh || !rh) return [];
    const out = [], M = 6;
    for (let i = 0; i <= M; i++) for (let k = 0; k <= M; k++) {
      const top = add(ls, mul(sub(rs, ls), k / M)), bot = add(lh, mul(sub(rh, lh), k / M)), p = add(top, mul(sub(bot, top), i / M));
      out.push({ p, q: camera.project(p), r: 0.6 * r });
    }
    return out;
  }
  /* mean depth of A minus B over the screen overlap (A farther → > 0), or null when they do not overlap */
  function overlapGap(SA, SB) {
    let sum = 0, n = 0;
    for (const a of SA) for (const b of SB) {
      if (Math.hypot(a.q.x - b.q.x, a.q.y - b.q.y) < a.r * a.q.s + b.r * b.q.s) { sum += a.q.depth - b.q.depth; n++; }
    }
    return n ? { gap: sum / n, n } : null;
  }

  /* place(order, extra, rel, state, thr): slot one extra part into `order` (array of names, mutated).
     rel: [{ item, gap }] signed gap (extra minus item; > 0 = extra farther → drawn BEFORE item). Hysteresis per pair.
     The anchor (must come after) weighs 1; each occlusion relation weighs 2 (occlusion wins over the anchor: a racket
     behind the back is drawn before the torso even if the hand is in front). Ties → the slot nearest after the anchor. */
  function place(order, extra, rel, state, thr = HYST_M) {
    const want = [];
    for (const r of rel) {
      const fresh = r.gap > 0 ? { far: extra.name, near: r.item } : { far: r.item, near: extra.name };
      const [h] = hold(state, [{ ...fresh, meanDepthGap: Math.abs(r.gap) }], thr);
      want.push({ item: r.item, before: h.far === extra.name, held: h.held, gap: +r.gap.toFixed(4) });
    }
    const ai = extra.anchor ? order.indexOf(extra.anchor) : -1;
    let best = null;
    for (let k = 0; k <= order.length; k++) {   // insert before order[k]
      let cost = 0;
      if (ai >= 0 && k <= ai) cost += 1;
      for (const w of want) { const j = order.indexOf(w.item); if (j < 0) continue; if (w.before ? k > j : k <= j) cost += 2; }
      const pref = ai >= 0 ? Math.abs(k - (ai + 1)) : order.length - k;
      if (!best || cost < best.cost || (cost === best.cost && pref < best.pref)) best = { k, cost, pref };
    }
    order.splice(best.k, 0, extra.name);
    return { name: extra.name, at: best.k, cost: best.cost, relations: want };
  }

  const RK = { Thigh: "thigh", Shank: "shank", Foot: "foot", UpperArm: "upperArm", Forearm: "forearm", Hand: "hand", neck: "neck" };
  /* order(J, camera, radii, o) → { names (far → near, extras included), raw (skeleton's own order), pairs, held, extras }
     J: joints ({x,y,z} or [x,y,z]) in the camera's space; camera.project(p) → { x, y, depth (larger = farther), s }.
     o: { player, view, camKey, motion, thr, extras: [{ name, anchor, samples: [{ p: [x,y,z], r }], skip: [names] }] } */
  function order(J, camera, radii, o = {}) {
    const BS = root.BodySkeleton || (typeof require === "function" ? require("../body/skeleton.js") : null);
    const res = BS.segmentsInDrawOrder(J, camera, radii);
    const thr = o.thr != null ? o.thr : HYST_M;
    const st = o.player != null ? stateFor(o.player, o.view || "main", o.camKey || "", o.motion) : null;
    const pairs = hold(st, res.pairs, thr);
    const held = pairs.filter(p => p.held);
    const items = held.length ? sortBy(res.order, pairs) : res.order;   // nothing held → exactly the skeleton's order
    const names = items.map(x => x.name), raw = res.order.map(x => x.name);
    const placed = [];
    if (o.extras && o.extras.length) {
      const segOf = new Map(res.order.map(x => [x.name, x])), extraS = new Map();
      const ls = arr(J.leftShoulder), rs = arr(J.rightShoulder), sm = ls && rs ? mid(ls, rs) : null;
      const pt = n => (n === "shoulderMid" ? sm : arr(J[n]));
      const geo = name => {
        if (name === "torso") return samplesTorso(J, camera, (radii.torsoDepth || 0.24) / 2);
        const s = segOf.get(name); if (!s) return extraS.get(name) || [];
        return samplesSeg(pt(s.from), pt(s.to), radii[RK[name.replace(/^(left|right)/, "")] || "neck"] || 0.04, camera);
      };
      for (const ex of o.extras) {
        const S = ex.samples.map(s => ({ p: s.p, q: camera.project(s.p), r: s.r }));
        const rel = [];
        for (const n of names) {
          if (n === ex.anchor || (ex.skip && ex.skip.includes(n))) continue;
          const g = overlapGap(S, geo(n)); if (g) rel.push({ item: n, gap: g.gap });
        }
        placed.push(place(names, ex, rel, st, thr));
        extraS.set(ex.name, S);
      }
    }
    const out = { names, raw, pairs, held, extras: placed, view: o.view, camKey: o.camKey, resets: st ? st.resets : 0, thr };
    if (root.SegmentPaint) { root.SegmentPaint.last = root.SegmentPaint.last || {}; root.SegmentPaint.last[(o.player != null ? o.player : "?") + "|" + (o.view || "main")] = out; }
    return out;
  }

  const SP = { API, VERSION, HYST_M, order, hold, sortBy, place, reset, pairKey, overlapGap, _views: views };
  if (typeof module === "object" && module.exports) module.exports = SP;
  root.SegmentPaint = SP;
})(typeof window !== "undefined" ? window : globalThis);
