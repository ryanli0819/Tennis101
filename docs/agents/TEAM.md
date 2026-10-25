# Tennis101 agent team

Ten cloud agents build the game in parallel, one run each per night. Every agent:
- reads `CLAUDE.md`, this file, and its own log `docs/agents/<name>.md` first;
- works only on its branch `agent/<name>` and opens or updates one PR to `main` (never pushes to `main`, never merges);
- edits only the folders it owns below, plus the smallest possible hooks in `index.html`;
- keeps the page a static file with no build step (libraries from cdn.jsdelivr.net/npm, exact pinned versions);
- ends each run by updating its log: what is done, open problems, the exact next step.

Each agent's full instructions are in `docs/agents/prompts/` (shared rules in `_common.md`).

| # | Agent | Branch | Owns | Runs (UTC) |
|---|---|---|---|---|
| 1 | Ball physics | `agent/ball-physics` | `src/ball/`, `tests/ball.test.mjs` | 05:00 |
| 2 | Courts, nets, ball look | `agent/court-detail` | `src/court/`, reads `datasets/courts/` | 06:00 |
| 3 | Player and racket art | `agent/player-art` | `src/players/` | 07:00 |
| 4 | Serve motion | `agent/serve-motion` | `src/serve/motion/`, reads `datasets/serves/` | 08:00 |
| 5 | Serve control (player's view) | `agent/serve-control` | `src/serve/control/`, `src/profile/` | 09:00 |
| 6 | Version history | `agent/version-history` | `CHANGELOG.md`, `versions/` | after every push to `main`, and 15:00 |
| 7 | Body motion (joints) | `agent/body-motion` | `src/body/` | 10:00 |
| 8 | Control systems | `agent/controls` | `src/controls/` | 11:00 |
| 9 | Start page | `agent/start-page` | `src/start/` | 12:00 |
| 10 | Guide | `agent/guide` | `src/guide/` | 13:00 |

Give any new agent a row here before it starts.

## Shared contracts
Keep these stable. Change one only in your own PR, and say so in its description. Until the owner's code is on `main`, build against the contract with a small local fallback and note that in your log.

**Ball (1).** `src/ball/` exports `launchBall({ from:{x,y,z}, vel:{x,y,z}, spin:{x,y,z} })`, `stepBall(dt)`, `getBall()`, and events `onBounce(cb)` / `onNet(cb)`. The surface table lives in `src/ball/surfaces.js`. Agent 2 draws the ball; Agent 1 only moves it.

**Court (2).** `drawCourt(surface)` and `drawNet()`, plus `drawBall(ball)`, with `surface` = `"hard" | "clay" | "grass"` (clay = red clay).

**Pose (7).** `src/body/` exports `JOINTS` (names: head, neck, chest, pelvis, l/r shoulder, elbow, wrist, hip, knee, ankle, toe) and `getPose(i)` → `{ joints: { name: {x,y,z} } }` in court metres, plus `racket: { grip, head, face }`. `playMotion(i, frames)` plays a keyframed motion, such as a serve from Agent 4.

**Player art (3)** draws `getPose(i)` in pixels, plus the racket.

**Serve motion (4).** `SERVE_MOTIONS[playerId] = { first: Motion, second: Motion }`. A Motion is `{ frames: [{ t, joints:{...} }], events: { tossRelease, trophy, contact, finish } }`, with joints normalized to body height (1.0 = standing height) so it scales to each player.

**Serve control (5).** Turns the player's continuous serve input into `{ toss:{ height }, power, spin:{ type:"flat"|"kick"|"slice", rpm }, target:{x,y}, sweetSpot: 0..1 }`. It plays the right motion from Agent 4 (second motion after a first-serve fault) and calls `launchBall`. Skill points persist across matches in `src/profile/` (localStorage `tennis101.profile`).

**Controls (8).** `src/controls/schemes.js` exports `CONTROL_SCHEMES`, a list of `{ id, label, devices, bindings:[{ action, keys, text }] }`. Required actions: `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `splitStep`, `playPoint`, plus the serve actions Agent 5 defines. Also exports `getMoveInput()` → `{x,y}` (y = toward the net), `setScheme(id)` / `getScheme()` (localStorage `tennis101.controls`). Only the chosen scheme's UI and hints are shown.

**Match setup (9).** The start page produces `{ bestOf, tbTo, firstServer, controls, surface, players }` for the match screen.

**Guide (10)** builds its key list from `CONTROL_SCHEMES`, so it never goes out of date.

## Known conflicts
- WASD uses `A`, which is currently the "Point Sinner" test key (`L` is "Point Alcaraz"). Agent 8 moves them, for example to `1` and `2`.
- `CLAUDE.md` lists the home page last. Ryan moved the start page up, so Agent 9 builds it now.
- The HUD no longer shows player speed (Ryan's call). Do not add speed readouts back.
