# Tennis101 code tour (annotated)

A guided walk through the codebase. Each part has a **label** (A, B, C …). Every annotated excerpt below carries the same label, so you can point to "B2" in an interview and anyone can find it. Line numbers link to the current file.

```
Tennis101/
├── index.html                  [A–F] the game: one static page, no build step
├── src/serve/motion/           [G]   Sinner's captured serve, as game data
├── datasets/serves/            [H]   motion capture: keypoints, cleaner, exporter, viewer
├── data/                       [I]   SQLite database: schema, build script, queries
├── agents/                     [J]   the 10-agent team: registry, prompts, logs, live dashboard
├── CHANGELOG.md, contemporary/ [K]   version history (publish at 5+ changes)
└── presentation/               [L]   this deck, the SQL explorer, talking points
```

---

## A · Player data: the single source of truth
[`index.html#L250`](../index.html#L250). Every physical number in the game starts here.

```js
const PLAYERS = [
  { last: "SINNER",  first: "Jannik", code: "ITA", heightM: 1.91, weightKg: 77, ... side: "near" },  // [A1] real measurements
  { last: "ALCARAZ", first: "Carlos", code: "ESP", heightM: 1.83, weightKg: 74, ... side: "far" }
];
```

## B · Body → movement physics
[`bodyStats` #L257](../index.html#L257), [`moveBody` #L560](../index.html#L560)

```js
function bodyStats(P) {
  const h = P.heightM / 1.85, w = P.weightKg / 75;          // [B1] compare to a 1.85 m / 75 kg reference athlete
  return {
    top:   5.3 * Math.sqrt(h) / Math.pow(w, 0.25),          // [B2] longer stride → higher top speed; mass lowers it
    accel: 7.0 / w / Math.sqrt(h),                          // [B3] lighter + shorter → quicker first step (the trade-off)
    brake: 9.0 / w,                                         // [B4] stopping fights your own mass
    reach: 0.44 * P.heightM + 0.69,                         // [B5] arm + racket from body centre
  };
}
```
```js
const braking = dx * p.vx + dy * p.vy < 0;                  // [B6] wanted velocity points against current motion = momentum
const rate = (braking ? B.brake : B.accel * (p.boost > 0 ? p.boostMul : 1)) * tire;   // [B7] split-step boost, tiredness
p.stam -= dt * B.drain * (0.9 * (sp / B.top) ** 2 + 1.6 * used / B.accel);           // [B8] running fast and changing speed both cost stamina
```

## C · Split-step timing
[`splitStep` / `gradeSplit` #L591](../index.html#L591)

```js
const d = p.landT - p.contactT;                             // [C1] when you landed vs when the opponent hit
if (a <= 0.07) { p.boost = 0.5; p.boostMul = 1.8; }         // [C2] PERFECT: 1.8× first step for 0.5 s
else if (a <= 0.16) { p.boost = 0.4; p.boostMul = 1.45; }   // [C3] GOOD
// otherwise EARLY/LATE: you only lost time in the air       // [C4] mistiming has a real cost
```

## D · Scoring engine (pure state, no drawing)
[`awardPoint` #L282](../index.html#L282), [`finishGame` #L299](../index.html#L299), [`finishSet` #L312](../index.html#L312), [`umpireCall` #L333](../index.html#L333)

```js
} else if (S.points[p] >= 4 && S.points[p] - S.points[o] >= 2) {    // [D1] game: 4+ points, win by 2 (covers deuce/advantage)
if (S.games[p] >= 6 && S.games[p] - S.games[o] >= 2) finishSet(p);  // [D2] set: 6 games, win by 2 (6–4, 7–5)
else if (S.games[0] === 6 && S.games[1] === 6) S.tb = true;         // [D3] 6–6 → tiebreak to 7 or 10
if (S.tb) S.server = 1 - S.tbStarter;                                // [D4] receiver of the first tiebreak point serves next set
```

## E · Camera and pixel rendering
[`proj` #L401](../index.html#L401)

```js
function proj(x, y, z = 0) {                                // [E1] court metres → screen, perspective from behind Sinner
  const d = y + CAM_BACK;                                   // [E2] distance from the camera
  return { x: BW / 2 + x * F / d, y: HZ + (CAM_H - z) * F / d, s: F / d };   // [E3] s = pixels per metre at that depth
}
```
Everything is drawn into a small buffer and scaled up with smoothing off, which gives the pixel look.

## F · Point flow
[`startRally` #L759](../index.html#L759), [`stepRally` #L773](../index.html#L773), [`hitBall` #L737](../index.html#L737), [`endPoint` #L815](../index.html#L815)

```js
if (S.server === 0 && SERVE_MOTION) {                       // [F1] Sinner serves with his captured motion…
  rally.serve = {}; pos[0].motion = { t: SERVE_MOTION.events.start };
} else hitBall(S.server, true);                             // [F2] …otherwise the placeholder serve
if (d <= BODY[sh.recv].reach && (u >= 0.95 || passing)) return hitBall(sh.recv, false);   // [F3] placeholder hitting: inside your reach ring
const rest = setBreak ? 0.8 : changeover ? 0.65 : 0.35;    // [F4] stamina only partly comes back between points
```

## G · Captured serve in the game
[`motionPose` #L641](../index.html#L641), [`poseToWorld` #L651](../index.html#L651), [`stepMotion` #L658](../index.html#L658), [`drawCapturedFigure` #L454](../index.html#L454), data in [`src/serve/motion/sinner-serve.js`](../src/serve/motion/sinner-serve.js)

```js
out[n] = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];   // [G1] blend the two captured frames around time t
w[n] = { x: p.x + pose[n][0] * h * right, z: pose[n][1] * h };   // [G2] body heights × real height = metres (fits any player)
Object.assign(ball, W.leftWrist);                                // [G3] before release the ball rides in the tossing hand
sv.vz = (sv.hit.z - sv.release.z + 0.5 * 9.81 * T * T) / T;      // [G4] solve one real throw that meets the racket at contact
if (mo.t >= E.contact) { rally.serve = null; hitBall(0, true); } // [G5] contact at the captured moment (≈ 2.95 m high)
```

## H · Motion capture pipeline
| Step | File | What it does |
|---|---|---|
| H1 | (Swift tool, run on the Mac) | Apple Vision body pose on every video frame; 19 joints with confidence |
| H2 | [`clean_keypoints.py`](../datasets/serves/tools/clean_keypoints.py) | Cleans the track in 3 passes (below) and picks 20 key frames |
| H3 | [`export_motion.py`](../datasets/serves/tools/export_motion.py) | Converts to body heights, mirrors to the back view, writes the game file |
| H4 | [`viewer.html`](../datasets/serves/viewer.html) | Plays raw vs cleaned joints as dots and lines |

```python
# ---- pass A: confidence + left/right swaps ----              [H2a] drop <0.3 confidence, undo L/R swaps vs previous frame
# ---- pass B: body scale over time, then smooth hips ----     [H2b] hips may not teleport (catches merging with a spectator)
# ---- pass C: fit everything else to a body of the right size [H2c] neck/shoulders near hips, bones never longer than real
up = "left" if F[k]["i"] <= TOSS_UNTIL else "right"          # [H2d] Ryan's rule: whichever arm is on top is the one shown
rel[j] = (-(x - rx) / (BODY * s), (ry - y) / (BODY * s))     # [H3a] mirrored (seen from behind), scale-free body heights
```

## I · Data organization (SQL)
[`schema.sql`](../data/schema.sql), [`build_db.py`](../data/build_db.py), [`queries/`](../data/queries), results in [`query_results.md`](../data/query_results.md), live in [`sql-explorer.html`](sql-explorer.html)

```sql
CREATE TABLE joints (                                        -- [I1] one row = one body point in one frame
  clip_id TEXT, frame_index INTEGER, joint TEXT,
  kind TEXT CHECK (kind IN ('raw', 'clean')),                -- [I2] keep the detector's view AND the cleaned view
  x REAL, y REAL, confidence REAL,
  estimated INTEGER,                                         -- [I3] 1 = rebuilt (arm on top), not seen
  PRIMARY KEY (clip_id, frame_index, joint, kind));
CREATE VIEW clean_skeleton AS ...                            -- [I4] joins joints + joint meaning + serve phase
CREATE TABLE agent_feeds (from_agent, to_agent);             -- [I5] the agent workflow as a graph
```
Why a rebuild script and not a hand-edited database: **[I6]** the files stay the source of truth, and `build_db.py` recreates the database from scratch every time, so the two can never drift apart.

## J · The agent team
[`agents/agents.json`](../agents/agents.json) is the registry, [`agents/README.md`](../agents/README.md) the rules and contracts, `agents/<name>/PROMPT.md` + `LOG.md` per agent, and [`agents/dashboard.html`](../agents/dashboard.html) the live view.
- **J1 Ownership:** each agent owns folders no one else edits.
- **J2 Contracts:** agents meet at interfaces (`launchBall`, `getPose`, `SERVE_MOTIONS`, `CONTROL_SCHEMES`).
- **J3 Safety:** own branch → pull request → Ryan reviews. Agents never push to `main`.
- **J4 Memory:** every run starts fresh, so the log in its folder is its memory.
- **J5 Messages:** GitHub issues labelled `agent:<name>`. Agents act only on issues from `ryanli0819`.
- **J6 Sync:** the Serve Analyst keeps the Player Artist and Body Animator in step via `src/serve/motion/MOTION_NOTES.md` and `Motion update:` issues.

## K · Versioning and publishing
- **K1:** each game change waits as one file in `contemporary/`.
- **K2:** at 5+ changes the Version Keeper publishes a version: a changelog entry with approximate times, a playable copy, a git tag and a GitHub release.
- **K3:** GitHub Pages rebuilds the website from `main` after every push.
