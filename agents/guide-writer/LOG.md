# Guide Writer · log

## 2026-10-26 · run 1 (local, cwork)
Done
- `src/guide/guide.js`: "How to play" overlay (`window.Guide = { open, close, isOpen }`).
  Sections: keys, feet/momentum, split step, reach, volleys + net camera, stamina, serving, winning a point, scoring, skill points, courts.
- Keys come from `CONTROL_SCHEMES`, with the chosen scheme (`getScheme()`) shown first. Touch comes first on coarse pointers.
  `src/controls/` is not on main yet, so a local `FALLBACK_SCHEMES` mirrors `userInput()` and the keydown handler (WASD/arrows, Shift, Space, Z; drag on touch).
- Skills are read live from `SKILLS` / `SKILL_BASE`, so the guide never goes stale.
- Opening: a "?" button next to ← Home on the match screen. Over the start flow it becomes "? How to play" (top-right).
  Esc or a click on the backdrop closes it. While it is open, a capture-phase keydown listener stops every key from reaching the game.
- Hook in `index.html`: one `<script src="src/guide/guide.js">` after `flow.js`.
- Answered issue #3 (WASD, skills, volleys/net camera, surfaces).

Checked against the code today
- Split windows 0.07 / 0.16 s (Reflexes widens them). Stamina recovery is 35% / 65% changeover / 80% set break, and the ceiling drops. Serve is automatic. Out = point to the receiver. Double bounce = point to the hitter.
- Surface feel taken from `SURFACES` pace/bounce: clay 0.88 / 1.2, grass 1.12 / 0.78.

Open problems
- Neither Node nor a browser was available on this machine, so I could not run `node --check` or a headless page load. The code was reviewed by hand only.
- Request for Start Page Builder: add a "How to play" link on the Welcome screen that calls `Guide.open()`. Until then, the floating button covers it.
- Serving will need a rewrite once Serve Controller lands toss/power/aim/sweet spot/spin.
- Surface text is hand-written. Read it from a shared table if Court Designer or Ball Physicist exports one.

Next step
- Rebase. If `src/controls/schemes.js` is on main, delete `FALLBACK_SCHEMES` usage only if the real list covers every action. Re-check all numbers above against `index.html`. Then write the serve section from the Serve Controller contract.
- Note: I found no repo content that asked for anything outside these files.

## 2026-11-05 · run 2 (HQ sync, order "Run all the queued tasks", round 2 changes)
Done
- Merged origin/main into `agent/guide-writer` (no force-push). Kept main's index.html; the only hook is
  `<script src="src/guide/guide.js?v=0.10.0">` after `flow.js`.
- Guide brought up to date with v0.10.0: no key starts a point (READY → GET SET → bounces → windup);
  Space = slide (clay 2.4 / hard 1.6 / grass 1.3 m); Esc = pause; E = slice; arrows / tap the box aim; V = serve cam ↔ first person;
  faults, double faults, lets and the ace chance; the crowd; each court's light.
- "?" button now sits first in the match's button row (`.controls`), so it wraps on phones and needs no free corner.
  It is hidden while the start flow is open: Welcome's "? How to play" (Start Page Builder, PR #31) calls `Guide.open()`.

Open problems
- Needs PR #31 merged together with this one, or the start page has no way into the guide.
- Still no node here: syntax-checked with JavaScriptCore only.

Next step
- When `src/controls/` lands, check `CONTROL_SCHEMES` covers slide, slice, aim, V and Esc before dropping `FALLBACK_SCHEMES`.
