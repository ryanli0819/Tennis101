# Tennis101 — instructions for Claude Code

## What this game is
A tennis game for phone, tablet, PC and console where the player plays **in a real pro's shoes**. Each pro's real body (height, weight, arm span, strength, speed) drives how they move, reach, serve and tire. No automated movement, no "animation lock" that carries the player to the ball, no stamina that refills every point. Every physical trait is a trade-off the player can feel, never just a bigger number.

Visual style: pixel art ("pixelized"). Long-term camera goal: first-person view at the pro's real eye height.

## Build order (from Ryan's notebook)
1. **Match screen + scoreboard** ← done in `index.html`
2. Footsteps (player-controlled movement, split-step, momentum, can be wrong-footed) ← done (first pass)
3. Positioning
4. Ball hitting (timing, contact point relative to the body)
5. Returns (read the serve; a wrong guess costs you)
6. Rally
7. Volleys
8. Home page (lowest priority, build last; it only needs buttons that route to the other pages)

Real physics engine covers three things: **ball** (spin, speed, bounce), **players** (body-driven movement and reach), **courts** (surface changes bounce and footing).

Player trait mapping:
- Height → reach length, stride length, serve angle (taller = steeper serve, different bounce), and camera eye height in first-person.
- Weight → speed / acceleration / change of direction.
- Play style → "hardcore" (aggressive) or "wise" (smarter placement); spin/control focus or power focus.

## Current file: `index.html` (single self-contained page, no build step)
Sections in the script, top to bottom:
1. `PLAYERS` — index 0 = **Jannik Sinner** (user's side, near court, 1.91 m, ITA), index 1 = **Carlos Alcaraz** (opponent, far court, 1.83 m, ESP). Sprite height is scaled from `heightM`. Keep these as the single source of truth for player data.
2. **Scoring engine** (pure state, no drawing): `freshState`, `awardPoint`, `finishGame`, `finishSet`, `pointLabels`, `umpireCall`. Do not mix rendering into these functions.
3. `renderScore` — builds the scoreboard DOM from state.
4. Court + camera — `proj(x, y, z)` maps court metres to screen. Court coords: x left/right, y along court (near baseline −11.885, far baseline +11.885, net at 0), z height. Everything is drawn into a low-res buffer (`buf`) and scaled up with smoothing off for the pixel look.
5. **Footwork** — `bodyStats` turns height/weight into `BODY[i]` (top speed, first-step accel, brake, reach, stamina drain). `moveBody` is the one physics step for both players (accel toward the wanted velocity, the higher brake rate when fighting momentum, tiredness scales speed and accel). `splitStep` / `gradeSplit`: a 0.22 s hop; landing within ±0.07 s of the opponent's contact = PERFECT (1.8× first step), ±0.16 s = GOOD (1.45×), otherwise EARLY/LATE and you just lost time in the air. WRONG-FOOTED shows when you are running the wrong way at contact. Alcaraz is driven by `aiInput` through the same physics (reaction delay, brakes to stop on target).
6. **Point flow** (`startRally`, `stepRally`, `hitBall`, `planShot`, `endPoint`). Ball flight is still a scripted arc (no physics yet). Contact is **placeholder hitting**: you hit automatically if the ball comes within your reach ring, at the ideal point or as it starts to pass you. Shot quality `q` rewards being set (slow feet, ball not at full stretch); error chance rises with stretch and tiredness. Out ball → point to receiver; ball bounces twice → point to hitter. Stamina only partly recovers between points (35%, changeover 65%, set break 80%) and its ceiling (`cap`) slowly drops with effort. Keep the hook `awardPoint(winner)` → `afterPoint()`.
7. Main loop `frame` — draws in depth order (far player → net → Sinner's reach ring → near player, ball sorted by y), then `renderHud` (stamina bars with cap marker, speed, split feedback, top-right).
8. UI wiring — buttons, keys, drag-to-move stick.

## Scoring rules (must stay exactly like this)
- Points in a game: **0 (said "love"), 15, 30, 40**. The board shows `0`; the umpire call line says `LOVE`.
- 40–40 is **DEUCE**. Next point gives advantage: **AD IN** if the server leads, **AD OUT** if the receiver leads. The player with advantage shows `AD` (highlighted ball-yellow), the other shows blank. Winning the next point after AD wins the game; losing it returns to DEUCE.
- Game is won at 4+ points with a 2-point lead.
- **Set**: first to 6 games with a 2-game lead (6–0 … 6–4, or 7–5). At **6–6** a tiebreak is played.
- **Tiebreak**: first to **7** or **10** (user picks before the match), win by 2. Tiebreak score shows as plain numbers. Set records as 7–6 with the loser's tiebreak points as a superscript (e.g. 7–6⁵).
- **Match**: user picks **3 sets (first to win 2)** or **5 sets (first to win 3)**.
- **Serve rotation**: server alternates every game. In a tiebreak, the player due to serve serves point 1, then serve changes after point 1 and every 2 points after. The player who received the first tiebreak point serves the first game of the next set.
- Deuce/ad court: even number of points played in the game (or tiebreak) → server stands on the deuce (right) side; odd → ad side. Near player's right is +x, far player's right is −x.
- Umpire call says the **server's score first** ("30–15", "15 ALL", "LOVE ALL").

## Scoreboard layout (must stay like this)
- Fixed to the **bottom-left corner**, raised **1/8 of the screen height** from the bottom (`bottom: 12.5%`), with a 16 px side gutter.
- Header row: `SET n` (or `TIEBREAK · FIRST TO 7/10` in ball-yellow) and `BEST OF 3/5`.
- One row per player: serve dot (yellow ball, shown only next to the current server), color stripe, surname, country code, one column per finished set (winner's games bright, loser's dim), current-set games (shaded), current points (light chip).
- Footer: umpire call on the left, `<NAME> TO SERVE` on the right.
- **While a point is being played the scoreboard goes semi-transparent (`.live` → opacity 0.34) but stays visible.** It returns to full opacity ~0.9 s after the point ends.

## Controls (temporary, for testing until real gameplay exists)
- Space / "Play point": starts the point (serve is automatic for now).
- Arrow keys (up = toward the net) or drag on the court (touch/mouse): move Sinner.
- Shift / "Split step": split-step hop.
- A / "Point Sinner", L / "Point Alcaraz": award a point manually.
- Z / "Undo": restores the previous state (history stack of JSON snapshots).
- "New match": reopens the setup card (match length, tiebreak to 7 or 10, first server: Sinner / Alcaraz / coin toss).
- "← Home": placeholder, shows a toast. Wire it to the home page when that exists.

## Conventions
- Units are metres and seconds everywhere in game logic.
- Colors are CSS tokens in `:root`; the page is a deliberate single dark look (night match).
- Keep it working at phone width (~400 px) as well as desktop; controls wrap.
- Respect `prefers-reduced-motion`.
- When this grows past one file, split into `scoring.js`, `render.js`, `players.js`, `rally.js` without changing the scoring behavior. Keep a quick test of the scoring rules (deuce, AD in/out, 7–5, tiebreak to 7 and 10, serve after tiebreak, best-of-3 and best-of-5 finish).

## Agent team
Nightly cloud agents build parts of the game in parallel. Ownership, branches, and shared contracts are in `docs/agents/TEAM.md`; read it before editing.

## Next task for Claude Code
Footwork (step 2) has a first pass. Next: **positioning** (step 3), then replace the placeholder auto-hit with real **ball hitting** (step 4: swing timing and contact point relative to the body). The movement numbers in `bodyStats` are first guesses; tune them by feel. The file has `<!doctype html>` and a `[hidden]` rule so it also runs as a plain local file (`python3 -m http.server` in this folder). The pre-footwork version is in `backup/`.
