// =====================================================================
// PROFILE — what stays with you between matches. Owner: Serve Controller (agents/serve-controller/).
//
// localStorage "tennis101.profile":
//   { players: { <id>: { skills: {...},                       ← Skills Coach (getSkills reads these overrides)
//                        serve: { skill, stats: { serves, aces, faults, doubleFaults, sweetSum, best } } } } }
// The serve skill itself is the Skills Coach's: Profile.serveSkill(id) = getSkills(id).serve (1–20, 10 neutral).
// Writes merge, so one owner never wipes another's part. Storage can be missing (private window): then nothing persists.
// =====================================================================
(function (root) {
  const KEY = "tennis101.profile";
  const store = () => { try { return root.localStorage || null; } catch { return null; } };

  function load() {
    try { return JSON.parse(store()?.getItem(KEY) || "{}") || {}; } catch { return {}; }
  }
  function save(p) {
    try { store()?.setItem(KEY, JSON.stringify(p)); } catch {}
  }
  /* Change the profile in place: fn(profile) edits it, then it's saved. */
  function update(fn) {
    const p = load();
    fn(p);
    save(p);
    return p;
  }
  const playerOf = (p, id) => ((p.players ||= {})[id] ||= {});

  function serveSkill(id) {
    const fromSkills = typeof root.getSkills === "function" ? root.getSkills(id).serve : null;
    return fromSkills ?? load().players?.[id]?.serve?.skill ?? 10;
  }

  /* One serve by player id: { sweetSpot, ace, fault, doubleFault }. */
  function recordServe(id, { sweetSpot = 0, ace = false, fault = false, doubleFault = false } = {}) {
    return update(p => {
      const sv = (playerOf(p, id).serve ||= {});
      const st = (sv.stats ||= { serves: 0, aces: 0, faults: 0, doubleFaults: 0, sweetSum: 0, best: 0 });
      st.serves++; st.sweetSum = +(st.sweetSum + sweetSpot).toFixed(3);
      st.best = Math.max(st.best, sweetSpot);
      if (ace) st.aces++;
      if (fault) st.faults++;
      if (doubleFault) st.doubleFaults++;
    });
  }
  function serveStats(id) {
    const st = load().players?.[id]?.serve?.stats;
    if (!st || !st.serves) return { serves: 0, aces: 0, faults: 0, doubleFaults: 0, avgSweet: 0, best: 0 };
    return { ...st, avgSweet: +(st.sweetSum / st.serves).toFixed(3) };
  }

  root.Profile = { KEY, load, save, update, serveSkill, recordServe, serveStats };
})(typeof window !== "undefined" ? window : globalThis);
