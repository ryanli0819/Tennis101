/* Touch gestures for the moves that had only on-screen buttons (Controls Designer, HQ-20261118-002.GP.1).
   GAME-DESIGN: no buttons and no text during play, so the free finger does the moves:
     double-tap            → Split step   (splitStep(0), same as Shift)
     short flick DOWN      → Slide        (slide(0), same as Space; slides the way you are moving, not the flick's way)
     short flick SIDEWAYS  → Slice        (toggles the armed slice, same as the Slice button; disarms after one shot)
   Reserved, so they do nothing here: a flick UP / toward the opponent (shot aiming, coming), a two-finger tap
   (pause, Front-end Menus Builder), a long press (nothing; selection/callouts are suppressed there), any other hold.
   A one-finger drag is still the move stick; this file never reads or changes the stick.
   Pure logic, no DOM: index.html feeds it pointer events and calls the move it returns.
   Works in the browser (window.TouchGestures) and in node (module.exports). */
(function (root) {
  const G = {
    TAP_MS: 250,        // a tap is shorter than this …
    TAP_PX: 12,         // … and moves less than this
    DOUBLE_GAP_MS: 300, // second tap must start within this of the first one ending …
    DOUBLE_PX: 80,      // … and land this close to it
    FLICK_MS: 250,      // a flick is a quick throw: down to up within this …
    FLICK_PX: 40,       // … travelling at least this far …
    FLICK_RATIO: 1.5,   // … clearly along one axis (diagonals do nothing)
    TOGETHER_MS: 300,   // two fingers that land within this of each other, while both are down, are a multi-finger gesture (pause etc.)
  };
  function create() {
    const live = new Map();           // pointerId → { x0, y0, t0, x, y, dirty }
    let lastTap = null;               // { x, y, t } of the last clean tap (not yet part of a double)
    function down(id, x, y, t) {
      const g = { x0: x, y0: y, t0: t, x, y, dirty: false };
      for (const [, o] of live) {     // another finger landed with this one: a multi-finger gesture, not ours
        if (Math.abs(o.t0 - t) <= G.TOGETHER_MS) { o.dirty = true; g.dirty = true; }
      }
      if (live.size >= 2) { g.dirty = true; for (const [, o] of live) o.dirty = true; }   // three fingers: never ours
      live.set(id, g);
    }
    function move(id, x, y) { const g = live.get(id); if (g) { g.x = x; g.y = y; } }
    function cancel(id) { live.delete(id); }
    /* Returns "split" | "slide" | "slice" | null. */
    function up(id, x, y, t) {
      const g = live.get(id); if (!g) return null;
      live.delete(id);
      if (x != null) { g.x = x; g.y = y; }
      if (g.dirty) { lastTap = null; return null; }
      const dt = t - g.t0, dx = g.x - g.x0, dy = g.y - g.y0, d = Math.hypot(dx, dy);
      if (dt <= G.TAP_MS && d < G.TAP_PX) {                      // a tap
        if (lastTap && g.t0 - lastTap.t <= G.DOUBLE_GAP_MS && Math.hypot(g.x - lastTap.x, g.y - lastTap.y) <= G.DOUBLE_PX) {
          lastTap = null; return "split";
        }
        lastTap = { x: g.x, y: g.y, t };
        return null;
      }
      lastTap = null;
      if (dt <= G.FLICK_MS && d >= G.FLICK_PX) {                 // a flick (screen y grows downward)
        if (dy > 0 && dy >= G.FLICK_RATIO * Math.abs(dx)) return "slide";
        if (Math.abs(dx) >= G.FLICK_RATIO * Math.abs(dy)) return "slice";
      }
      return null;                                               // up-flick, diagonal, hold, long press, slow drag: nothing
    }
    return { down, move, up, cancel, reset() { live.clear(); lastTap = null; } };
  }
  const api = { G, create };
  root.TouchGestures = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
