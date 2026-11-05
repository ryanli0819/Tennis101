# Locker Room Designer · log

First version of `src/lockerroom/lockerroom.js` was written by Claude for Ryan (Oct 25): character cards with body numbers and skill bars.

## 2026-11-04 · run 1
briefSeen: 1 (Product & Release, split team: I stay inside `src/lockerroom/`)

Issues: no open `ceo-order` or `supervisor-order` for me. #3 (v0.3.0 hand-over) is background only. Nothing in the repo asked me to act outside my files.

Done (`src/lockerroom/lockerroom.js`, same `Lockerroom.render(el, { roster, bodyStats, selected, onSelect })` contract):
- **Head to head** panel under the cards: your pick vs the pro you'd face (the first other roster pro, same as `choosePlayers`). Height, weight, reach and the 8 skills as mirrored bars, the higher value in ball-yellow (weight is never highlighted: it's a trade-off), plus one line on the body trade-off (who is taller, who has the quicker first step from `bodyStats().accel`). Updates when you pick; hidden with a one-pro roster.
- **Handedness from the roster**: `P.hand` ("left"/"right", default right) and `P.backhand` ("one"/"two", default two). The old card hard-coded RIGHT-HANDED.
- **Radio group done properly**: roving tabindex (only the picked card is a tab stop), arrows move and select (wrapping), Home/End. Each card has a short accessible name and `aria-describedby` → its skill list, which includes each skill's `step` for screen readers. Head to head is `aria-live="polite"`.
- **Locker-room look**: a pixel locker wall strip above the cards. The placeholder sprite now shows the signature look (Sinner's cap + curls, Alcaraz's hairband + beard). If the Player Artist adds `window.PlayerArt.portrait(P)` (returns a canvas), it is used instead.
- Hover transition only under `prefers-reduced-motion: no-preference`; 400 px layout tightened for the compare rows.
- Tests: `src/lockerroom/test.html` (open via `python3 -m http.server`; title shows PASS/FAIL): extra pro renders with no code change, click and keys call `onSelect` with the right id, handedness, head to head follows the pick.

Not verified this run: this Mac session had no node and no headless browser allowed, so I could not run `node --check` or the test page. I checked delimiter balance only. **Run `src/lockerroom/test.html` before merging.**

Requests for other agents (not edited by me):
- Whoever owns `ROSTER` (Player Artist): add `hand` / `backhand` to each pro (Sinner and Alcaraz are both right-handed, two-handed backhand, so the default is right today).
- Player Artist: a `window.PlayerArt.portrait(P)` → canvas hook for real locker-room portraits.
- Skills Coach: earning/spending points isn't in `skills.js` yet, so no +/− buttons here yet.

Next step: run the test page in a browser and fix anything it flags; then, once the Skills Coach adds a points budget, add points available + / − per skill saving to `tennis101.profile`, showing how each change moves the head-to-head numbers.
