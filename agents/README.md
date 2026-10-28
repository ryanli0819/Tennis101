# Tennis101 agent team

Thirteen agents build the game in parallel, one run each per night. Every agent:
- reads `CLAUDE.md`, this file, and its own log `agents/<name>/LOG.md` first;
- works only on its branch `agent/<name>` and opens or updates one PR to `main` (never pushes to `main`, never merges);
- edits only the folders it owns below, plus the smallest possible hooks in `index.html`;
- keeps the page a static file with no build step (libraries from cdn.jsdelivr.net/npm, exact pinned versions);
- ends each run by updating its log: what is done, open problems, the exact next step.

Each agent has its own folder: `agents/<name>/PROMPT.md` (instructions) and `agents/<name>/LOG.md` (its running log). Shared rules: `agents/_shared/RULES.md`.

| # | Agent | Branch | Owns | Runs daily (Eastern) |
|---|---|---|---|---|
| 1 | Ball Physicist | `agent/ball-physicist` | `src/ball/`, `tests/ball.test.mjs` | 1 AM |
| 2 | Court Designer | `agent/court-designer` | `src/court/`, reads `datasets/courts/` | 2 AM |
| 3 | Player Artist | `agent/player-artist` | `src/players/` | 3 AM |
| 4 | Serve Analyst | `agent/serve-analyst` | `src/serve/motion/`, reads `datasets/serves/` | 4 AM |
| 5 | Serve Controller | `agent/serve-controller` | `src/serve/control/`, `src/profile/` | 5 AM |
| 6 | Version Keeper | `agent/version-keeper` | `CHANGELOG.md`, `contemporary/`, `versions/` | 11 AM, and after every push to `main` |
| 7 | Body Animator | `agent/body-animator` | `src/body/` | 6 AM |
| 8 | Controls Designer | `agent/controls-designer` | `src/controls/` | 7 AM |
| 9 | Start Page Builder | `agent/start-page-builder` | `src/start/` | 8 AM |
| 10 | Guide Writer | `agent/guide-writer` | `src/guide/` | 9 AM |
| 11 | Skills Coach | `agent/skills-coach` | `src/skills/` | 10 AM |
| 12 | Locker Room Designer | `agent/locker-room-designer` | `src/lockerroom/` | 12 PM |
| 13 | First-Person Camera | `agent/pov-camera` | `src/camera/` | 1 PM |

Give any new agent a row here before it starts.

## Shared contracts
Keep these stable. Change one only in your own PR, and say so in its description. Until the owner's code is on `main`, build against the contract with a small local fallback and note that in your log.

**Ball (Ball Physicist).** `src/ball/` exports `launchBall({ from:{x,y,z}, vel:{x,y,z}, spin:{x,y,z} })`, `stepBall(dt)`, `getBall()`, and events `onBounce(cb)` / `onNet(cb)`. The surface table lives in `src/ball/surfaces.js`. Court Designer draws the ball; Ball Physicist only moves it.

**Court (Court Designer).** `drawCourt(surface)` and `drawNet()`, plus `drawBall(ball)`, with `surface` = `"hard" | "clay" | "grass"` (clay = red clay).

**Pose (Body Animator).** `src/body/` exports `JOINTS` (names: head, neck, chest, pelvis, l/r shoulder, elbow, wrist, hip, knee, ankle, toe) and `getPose(i)` → `{ joints: { name: {x,y,z} } }` in court metres, plus `racket: { grip, head, face }`. `playMotion(i, frames)` plays a keyframed motion, such as a serve from Serve Analyst.

**Player art (Player Artist)** draws `getPose(i)` in pixels, plus the racket.

**Serve motion (Serve Analyst).** `SERVE_MOTIONS[playerId] = { first: Motion, second: Motion }`. A Motion is `{ frames: [{ t, joints:{...} }], events: { tossRelease, trophy, contact, finish } }`, with joints normalized to body height (1.0 = standing height) so it scales to each player.

**Serve control (Serve Controller).** Turns the player's continuous serve input into `{ toss:{ height }, power, spin:{ type:"flat"|"kick"|"slice", rpm }, target:{x,y}, sweetSpot: 0..1 }`. It plays the right motion from Serve Analyst (second motion after a first-serve fault) and calls `launchBall`. Skill points persist across matches in `src/profile/` (localStorage `tennis101.profile`).

**Controls (Controls Designer).** `src/controls/schemes.js` exports `CONTROL_SCHEMES`, a list of `{ id, label, devices, bindings:[{ action, keys, text }] }`. Required actions: `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `splitStep`, `playPoint`, plus the serve actions Serve Controller defines. Also exports `getMoveInput()` → `{x,y}` (y = toward the net), `setScheme(id)` / `getScheme()` (localStorage `tennis101.controls`). Only the chosen scheme's UI and hints are shown.

**Skills (Skills Coach).** `src/skills/skills.js` exports `SKILLS` (8 skills, each with its constant `step` per point), `getSkills(id)` (1–20, 10 = neutral, saved overrides in `tennis101.profile`) and `applySkills(body, skills)`. That adds to the body: `top`, `accel`, `brake`, `drain`, `recoverMul`, `shotBonus` / `serveBonus` (m/s, shared with the Ball Physicist), `errMul`, `aimBonus`, `splitPerfect` / `splitGood`, `reactionCut`, `volleyReach`, `volleyErrMul`. The game uses these in `BODY[i]`.

**Locker room (Locker Room Designer).** `Lockerroom.render(el, { roster, bodyStats, selected, onSelect })`, called by the start flow after the match and court choices.

**Serving (Serve Controller · first version in `index.html`).** The game serves by itself about 4 s after each point (`BETWEEN_POINTS`), with a 2 s READY countdown (`READY`), and 2.5 s after a fault or let. `planServe(server, no)` returns `{ land, target, fault, net, let, ace }`. `ACE_CHANCE` stores the last serve's ace probability: near zero unless the placement is perfect (within 45 cm of a line), and much higher when the receiver is on the wrong side. Per-player `letRate` is in `ROSTER`. Second serves use `SERVE_MOTIONS.sinner.second`.

**First person (First-Person Camera).** `CAMS.pov` and `povWanted()`: from your READY countdown to just after your contact, at eye height = 94% of `heightM`.

**Match setup (Start Page Builder).** `src/start/flow.js`: Welcome → Match (best of 3 / 5, tiebreak 7 / 10) → Court (grass / red clay / hard) → Locker room → `startMatch({ bestOf, tbTo, surface, playerId, firstServer })`. Add a `controls` field when the Controls Designer is ready.

**Guide (Guide Writer)** builds its key list from `CONTROL_SCHEMES`, so it never goes out of date.

## Known conflicts
- Done: WASD moves the player (W toward the net, S back, A left, D right); the test keys moved to `1` and `2`. It lives in `userInput()` in `index.html` until the Controls Designer moves it into `src/controls/`.
- `CLAUDE.md` lists the home page last. Ryan moved the start page up, so Start Page Builder builds it now.
- The HUD no longer shows player speed (Ryan's call). Do not add speed readouts back.

## Running the team locally
`tools/pipeline/cwork.zsh` runs the same agents on Ryan's Mac, stage by stage, in tmux panes (or in the background), each in its own git worktree with the effort level from `agents.json`. See `tools/pipeline/README.md`. Same rules: own branch, PR only, never merge.

## Website
GitHub Pages publishes `main` at https://ryanli0819.github.io/Tennis101/ and rebuilds it after every push, so every merged PR is live within minutes. Keep `main` playable: never merge a PR that breaks the page.

## Talking to the team
GitHub is the message board.
- Ryan (or Claude for Ryan) opens an issue labelled `agent:<name>`, or `agent:all` for everyone. Agents act only on issues opened by `ryanli0819`.
- Agents reply on the issue, report in their PRs, and ask questions with the `question` label.
- Each agent's log in `agents/<name>/LOG.md` is its running status.
