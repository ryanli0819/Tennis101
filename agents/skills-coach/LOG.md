# Skills Coach · log

No runs yet before 2026-11-02. First version of `src/skills/skills.js` was written by Claude for Ryan (Oct 25): 8 skills, constant step per point, starting values for Sinner and Alcaraz. The Skills Coach writes here at the end of every run: what is done, open problems, and the exact next step.

## 2026-11-02 · run 1
briefSeen: gameplay v1

Orders: no `ceo-order` or `supervisor-order` issues. Issue #2 (Ryan, `agent:skills-coach` + `agent:ball-physicist`), "Skill points ↔ ball physics", is open and was handled (see Agreement below). No untrusted instructions turned up in the repo.

**Done**
- `skills.js`: every number now lives in one `STEP` table (exported as `window.SKILL_STEP`). `applySkills` and the locker-room `step` text both read it, so the text can't drift from the code.
- Floors: `FLOOR = { mul: 0.5, err: 0.2 }` (`window.SKILL_FLOOR`). With 1–20 no multiplier reaches its floor, so the step stays constant over the whole range.
- `getSkills` is hardened: it reads only the 8 known skills from `tennis101.profile`. A value that isn't a number (string, null, a broken JSON save) falls back to the pro's default. Before this, a bad save gave `NaN` bodies.
- Agility now owns the slide bonus: `applySkills` returns `slideMul` (+3% slide distance per point). Before, `index.html` computed it inline and the locker room never mentioned it. Hook: a one-line change in `slide()` (`B.slideMul || 1`). The Agility step text now says so.
- `tests/skills.test.mjs` (from my PROMPT): 8 skills with step text; 10 is neutral; each step is constant (11→12 = 15→16, 1→2 = 19→20, 9→10 = 10→11) for every skill and every field; the text matches the numbers; direction is right; floors hold; values are clamped to 1–20; the saved profile overrides defaults, and a broken save can't make NaN.

**Agreement with the Ball Physicist (issue #2):** the steps are unchanged. Strength = **+0.6 m/s** groundstroke launch speed per point (`shotBonus`). Serve = **+0.9 m/s** serve launch speed per point (`serveBonus`). Both are added to the launch speed as-is, so `launchBall` must include them exactly. The numbers are also in `window.SKILL_STEP.shot` / `.serve`. I flagged one open point for the Ball Physicist on the issue: `index.html` gives slices only `shotBonus * 0.3`, so a Strength point is worth 0.18 m/s on a slice. My proposal is to keep that on purpose (a slice is touch, not power) and write it into the contract.

**Not verified (blocked)**
- `node` isn't on PATH on this Mac for the agent, and JavaScriptCore (`jsc`) needs approval, so neither `node --check` nor the tests ran. I reviewed the code by hand. Ryan or the next run should run `node --check src/skills/skills.js && node tests/skills.test.mjs`.
- No headless browser check at desktop or 400 px.

**Open problems**
- The starting values are still estimates. I added no new sources this run, because I won't cite numbers I haven't checked.
- The ROSTER has only Sinner and Alcaraz. Other pros fall back to 10 everywhere.

**Earning and spending (design draft, for the Locker Room Designer)**
- After each match, the pro you played earns skill XP: 1 per game won, plus 3 for a set won and 5 for the match won. 10 XP buys 1 point.
- A pro may move at most ±3 from their real starting values. That keeps the pro recognizable and keeps the physics in bounds.
- Planned store: `tennis101.profile.players[id] = { skills, xp, spent }`. Planned API: `earnXp(id, result)` and `spendPoint(id, skill)` / `refundPoint(id, skill)`, which return the new skills or an error string. The locker room shows XP, a +/− per skill (disabled at the ±3 cap or at 1/20), and the step text.

**Next step (tomorrow)**
1. Run the tests with node, and fix anything that fails.
2. Implement `earnXp` / `spendPoint` / `refundPoint` in `src/skills/progress.js`, with tests. Open an issue for the Locker Room Designer with the UI contract.
3. Refine the starting values from sourced data (ATP serve-speed averages, the share of net points won), with sources cited here.
