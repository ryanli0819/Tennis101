/* src/body/joints.js — JOINT LIMITS LOADER. Owner: body-motion-engineer. Task HQ-20261117-002.PM.1.
   The numbers are NOT here. They are read from datasets/anatomy/joints.json (Anatomy & Biomechanics Lab,
   commit e93398b, SOURCED per row with its sourceId). Node: read synchronously from disk. Browser: fetched once
   (static file, no build step) — BodyJoints.ready is a promise; until it resolves the solver is off.
   Swapping the table = replacing the JSON file. This file only turns rows into effective limits:
   - CDC rows (sourceId cdc_soucie) are population MEANS of passive end range, not maxima. Where the same row lists
     an AAOS alternative (sourceId aaos_botman) that is wider on the same side, the wider AAOS value is used and the
     widening is recorded in `widened` (Event 17 rule 3).
   - The dominant (racket) shoulder's external rotation uses shoulder.athleteNotes.serverRange.staticPassiveER90abd
     (105.4, garret_2024_meta). The dynamic 172 (kovacs_2011) is never used.
   - Rows labelled ESTIMATED keep that label. Rows with null limits get NO clamp (enforced: false) and say why. */
(function (root) {
  const PATH = "datasets/anatomy/joints.json";
  const SIDE_MOTION = {   // which motion word in an `alternatives[].motion` belongs to the max (positive) or min (negative) side
    max: ["flexion", "abduction", "external rotation", "pronation", "ulnar deviation", "dorsiflexion", "inversion"],
    min: ["extension", "adduction", "internal rotation", "supination", "radial deviation", "plantarflexion", "eversion"],
  };
  function build(json) {
    const rows = {}, widened = [];
    for (const [jn, J] of Object.entries(json.joints || {})) for (const [ax, r] of Object.entries(J.axes || {})) {
      const row = { joint: jn, axis: ax, minDeg: r.minDeg, maxDeg: r.maxDeg, label: r.label, sourceId: r.sourceId, where: r.where || null, positive: r.positive,
        enforced: r.minDeg != null && r.maxDeg != null, widenedFrom: null };
      if (!row.enforced) row.why = "null row in datasets/anatomy/joints.json (" + (r.note || "value unknown") + "): NO clamp.";
      if (row.enforced && r.sourceId === "cdc_soucie") for (const alt of r.alternatives || []) {
        if (alt.sourceId !== "aaos_botman" || typeof alt.deg !== "number") continue;
        const m = String(alt.motion || "").toLowerCase();
        if (SIDE_MOTION.max.includes(m) && alt.deg > row.maxDeg) { widened.push({ joint: jn, axis: ax, side: "max", cdcMeanDeg: row.maxDeg, usedDeg: alt.deg, sourceId: alt.sourceId, where: alt.where }); row.widenedFrom = { ...(row.widenedFrom || {}), max: row.maxDeg }; row.maxDeg = alt.deg; }
        if (SIDE_MOTION.min.includes(m) && -alt.deg < row.minDeg) { widened.push({ joint: jn, axis: ax, side: "min", cdcMeanDeg: row.minDeg, usedDeg: -alt.deg, sourceId: alt.sourceId, where: alt.where }); row.widenedFrom = { ...(row.widenedFrom || {}), min: row.minDeg }; row.minDeg = -alt.deg; }
      }
      rows[jn + "." + ax] = row;
    }
    const srv = json.joints && json.joints.shoulder && json.joints.shoulder.athleteNotes && json.joints.shoulder.athleteNotes.serverRange && json.joints.shoulder.athleteNotes.serverRange.staticPassiveER90abd;
    return { schema: json.schema, convention: json.convention, path: PATH, rows, widened,
      dominantShoulderER: srv ? { deg: srv.deg, label: srv.label, sourceId: srv.sourceId, where: srv.where } : null,
      source: "SOURCED per row: datasets/anatomy/joints.json (Anatomy & Biomechanics Lab, commit e93398b); each row keeps its sourceId; ESTIMATED / null rows as labelled there" };
  }
  const T = { PATH, build, table: null, ready: null };
  T.use = json => (T.table = build(json));
  if (typeof module === "object" && module.exports && typeof require === "function") {
    const fs = require("fs"), path = require("path");
    T.use(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", PATH), "utf8")));
    T.ready = Promise.resolve(T.table);
    module.exports = T;
  } else if (typeof fetch === "function") {
    T.ready = fetch(PATH, { cache: "no-cache" }).then(r => r.json()).then(T.use).catch(e => { T.error = String(e); return null; });
  }
  root.BodyJoints = T;
})(typeof window !== "undefined" ? window : globalThis);
