# Body Scout · log

## Nov 11, 2026 · run 3 (local, Ryan's Mac) · round 2 landed on PR #42
briefSeen: 1 (Motion & Body, share team)

**Read first:** CLAUDE.md, agents/README.md, RULES.md, PROMPT.md, supervisors.json (brief 1, unchanged; none of the
standing scripts applied to this run), ratings.json (no ratings), issue **#39** and PR **#42** (the only review is still
"round 1: changes (small)"; nothing newer), and my teammates' logs on `main` (the Serve Analyst's captured-serve entry
is new; the others have no runs). Nothing in the repo told me to act outside my files.

**What happened:** run 2 made the two review changes but stopped before committing, so PR #42 still showed round 1.
This run committed that work unchanged, rebased on `origin/main` (now with PR #45, the captured serves for all 22
players; no conflicts), re-ran the check and pushed. No new data and no new numbers: the review asked for exactly two
things and the PR has exactly those.

**Checks run (after the rebase):** `python3 -I datasets/players/tools/build_bodies.py --check` passes: 22 of 22 up to
date, segment and span sums, `bodies.js` parses back, left-handers Shelton, Tien, Nadal, `ROSTER` in `index.html`
(Sinner, Alcaraz) agrees with the ATP.

**Still not checked:** `node --check src/players/bodies.js`, `tests/serve-motion.test.mjs` and the browser load at
desktop and 400 px. No `node` on this Mac, and the system JavaScript engine was refused again. The manager should load
the page once.

**New on `main` that touches my data (for the manager and the Serve Analyst)**
- `src/serve/motion/roster-serves.js` now carries its own `heightM`, `weightKg` and `lefty` for all 22 players and
  pushes the 20 players missing from `ROSTER` into it with those numbers, so the game's physics uses them.
- **Handedness agrees:** the same three left-handers (Shelton, Tien, Nadal). `ROSTER[].lefty` is now set from that
  file, so my run 2 note that nothing sets it is out of date. `BODIES[id].game.lefty` is the same fact with its source.
- **Height and weight differ from the ATP profiles for 10 of 22** (ATP numbers read Nov 11, 2026; links in each
  `body.json` → `official.sources`). Not my file, so I changed nothing:

  | Player | roster-serves.js | ATP profile |
  |---|---|---|
  | Djokovic | 77 kg | 82 kg |
  | Mensik | 1.93 m, 86 kg | 1.96 m, 87 kg |
  | Davidovich Fokina | 1.83 m, 79 kg | 1.80 m, 82 kg |
  | Zverev | 89 kg | 90 kg |
  | Medvedev | 82 kg | 83 kg |
  | Fils | 82 kg | 83 kg |
  | De Minaur | 68 kg | 69 kg |
  | Paul | 81 kg | 82 kg |
  | Tien | 72 kg | 73 kg |
  | Kyrgios | 84 kg | 85 kg |

  The first three change how the player moves and looks (5 kg, 3 cm); the rest are 1 kg. Cleanest fix: that file reads
  height and weight from `(window.BODIES || {})[id].game` when it is loaded, and keeps its own numbers as the fallback.
  `bodies.js` already loads before the main script.
- Carried over from run 2: `agents/README.md` lists the `game` fields without `lefty`, `shoulderJointW`, `hipJointW`,
  `overheadReachM`.

**Exact next step**
1. If the manager sends PR #42 back, fix exactly what the review says.
2. Add the comparison above to `build_bodies.py` (it only compares `index.html`'s `ROSTER` today), so the check
   reports every place the game holds a height or weight that differs from the sourced one.
3. Then the run 1 list (below): ANSUR II widths, then movement evidence for the ten neutral players.

## Nov 11, 2026 · run 2 (local, Ryan's Mac) · review round 2 on PR #42
briefSeen: 1 (Motion & Body, share team)

**Read first:** CLAUDE.md, agents/README.md, RULES.md, PROMPT.md, supervisors.json (brief 1, unchanged), ratings.json
(still no ratings), issue **#39** with Ryan's addition on handedness, and the Motion & Body review on PR #42 ("round 1:
changes (small)"). Teammates' logs on `main` have no runs yet. Rebased on `origin/main` (clean). Nothing in the repo told
me to act outside my files.

**Done (exactly the two review points):**
1. `game.lefty` (true / false) for all 22 players, derived by `build_bodies.py` from the sourced `official.hand`, with a
   `why`, and regenerated into `src/players/bodies.js` as `BODIES[id].game.lefty`.
   - `true`: **Shelton, Tien, Nadal**. `false`: the other 19.
   - The tool now also fails if `official.hand` is not `"right"` or `"left"`, if `game.lefty` is missing or disagrees
     with it, or if `bodies.js` carries a flag that does not match the hand. It prints the left-handers at the end.
2. **Learner Tien is left-handed** per his ATP Tour profile (https://www.atptour.com/en/players/learner-tien/t0ha/overview,
   `PlayHand` read in run 1). He was not on the manager's list of known lefties (Shelton, Nadal), so the roster has
   **three** left-handers, not two. `tien/appearance.json` agrees ("slim young left-hander").

`BODY_SOURCES.md` says what `game.lefty` is. No change to `index.html` in this round.

**Checks run:** `python3 -I datasets/players/tools/build_bodies.py --check` passes (22 of 22 up to date, segment and
span sums, `bodies.js` parses back with 3 `lefty: true` and 19 `lefty: false`, `ROSTER` agrees).

**Still not checked:** `node --check src/players/bodies.js` and the browser load (desktop and 400 px). There is no
`node` on this Mac and the system JavaScript engine is not allowed for this agent, same as run 1. The manager should
load the page once.

**For the manager and teammates**
- `index.html` on `main` reads `PLAYERS[i].lefty` to mirror serves, and nothing sets it from `BODIES` yet. The hook
  would be `lefty: !!((window.BODIES || {})[id] || {}).game?.lefty` where `PLAYERS` is filled (`choosePlayers`). That
  is game code, not mine: I left it for the manager to assign.
- `agents/README.md` lists the `game` fields without `lefty`, `shoulderJointW`, `hipJointW`, `overheadReachM`. Not my
  file: please add them when this merges.
- Not sourced, so not written: Ryan's note that Nadal "plays left, writes right". The ATP profile only gives the
  playing hand. If the game needs the natural hand (it does not today), it needs its own link.

**Exact next step:** unchanged from run 1 (below): ANSUR II widths first, then movement evidence for the ten neutral
players.

## Nov 11, 2026 · run 1 (local, Ryan's Mac)
briefSeen: 1 (Motion & Body, share team)

**Read first:** CLAUDE.md, agents/README.md, RULES.md, PROMPT.md, supervisors.json, ratings.json (no ratings yet), my
teammates' logs (Body Animator run 1 on its branch: its skeleton already uses Drillis & Contini segments and AAOS limits;
Biomechanics Coach: `joints.json` is on its branch, PR #21, not on `main` yet). Order: issue **#39** (`ceo-order`,
ryanli0819). Nothing in the repo told me to act outside my files.

**Done (issue #39):**
- `datasets/players/<id>/body.json` for all **22** roster players.
  - `official` is **sourced**: height, weight, birth date, hand and backhand read from each player's ATP Tour profile
    data on Nov 11, 2026 (one link per number).
  - `research` holds my judgement calls (arm-span ratio, leg shift, build multipliers, movement ratings, flexibility),
    each with its why and its evidence.
  - `reach`, `segments`, `build`, `movement`, `flexibility` and `game` are **derived** by the tool, each marked
    `"estimate": true` with its method.
- `datasets/players/tools/build_bodies.py`: derives those blocks, runs the checks, writes `src/players/bodies.js`.
  `--check` changes nothing and fails on a stale file or a failed check.
- `src/players/bodies.js` (generated): `window.BODIES[id]` = `game` + `proportions` + `segments` + `flexDeg` +
  `widestStance` + `hand`, `backhand`, `build`; `window.BODIES_MODEL`.
- `datasets/players/BODY_SOURCES.md`: the method, every ratio with its reference and how I checked it, the table of
  official numbers.
- `index.html`: one `<script src="src/players/bodies.js">` before the main script. Nothing reads `BODIES` yet, so the
  game plays exactly as before, with or without the file.
- `ROSTER` height and weight: **no change needed**. Sinner 1.91 m / 77 kg and Alcaraz 1.83 m / 74 kg match the ATP.

**Checks run:** `python3 -I datasets/players/tools/build_bodies.py --check` passes: 22 of 22 files parse; head + neck +
trunk + thigh + shin + foot height equals the official height within 1 mm for every player (limit 1 cm); shoulder-joint
spacing + two arms equals the arm span; `bodies.js` parses as the two JSON assignments it is and has the 22 players;
`ROSTER` agrees with the sourced numbers.

**Not checked (say so in the PR):** there is no `node` and no headless browser on this Mac for me (JavaScriptCore and
`curl` are not allowed in this run), so `node --check src/players/bodies.js` and the "no console errors at desktop and
400 px" load test were **not run**. The file is a comment plus `window.BODIES = <JSON>;` and
`window.BODIES_MODEL = <JSON>;`, and the Python check parses both objects back. The manager should load the page once.

**What is real and what is still estimated**
- Real (ATP Tour): height, weight, birth date, hand, backhand, for all 22.
- Real but not used as a body number: Tennis Australia's match speeds for Djokovic (36.02 km/h), Nadal (26.84) and
  Federer (26.03), stored under `movement.published`; the ATP's 23.58 km/h "maximum speed" for men's tennis, which
  matches the game's 6.6 m/s reference.
- Estimated for **every** player:
  - arm span (no published wingspan exists for anyone on the roster; 1.02–1.05 × height, by look);
  - every segment length and width (standard ratios × height);
  - shoulder-joint and hip-joint spacing, chest depth, limb thickness;
  - top speed, acceleration, change of direction (the game's body formula × a rating × age);
  - every joint range (normal ranges; only Djokovic, Alcaraz and Medvedev differ, with evidence).
- Players with **no** movement evidence at all (ratings exactly 1.00, speed from build alone): Zverev, Tiafoe, Jódar,
  Fritz, Auger-Aliassime, Lehecka, Mensik, Nakashima, Tien, Kyrgios.
- Weakest references (BODY_SOURCES.md says so line by line): the NHANES shoulder width and the pelvis width came from
  search-result summaries because the pages would not open; Drillis & Contini is cited from the literature, not opened;
  chest depth, the thickness baselines and the age slowdown are my own estimates.

**Decisions**
- Drillis & Contini's arm pieces over-shoot a real arm span, so the arm is scaled to close the span and their numbers
  only split it into upper arm, forearm and hand.
- `game.shoulderW` is the bone width (acromion to acromion) and `game.hipW` the outer hip width. I added
  `shoulderJointW` and `hipJointW` (joint centres) for the skeleton, and `overheadReachM`. Additions to the contract,
  nothing removed.
- `game.reachM` is the standing reach to the sweet spot (1.24–1.33 m). The game's reach ring today is about 0.25 m
  longer because it includes a lean: the Body Animator should add the lean, not swap one for the other.
- `splitDepth` = share of the leg length the hips drop in the widest stance (0.43 typical, 0.87 Djokovic).
- Nadal and Federer are modelled at their prime (no age slowdown); Djokovic (39) is slowed for age.
- Build type follows BMI except Djokovic (lean, per appearance.json) and Federer (athletic); both say why.
- `data/build_db.py` does not read these files, so the database was not rebuilt.

**For teammates and other agents**
- Body Animator (#40): `BODIES[id].segments` are joint-to-joint lengths in metres on the same Drillis & Contini base
  as your `segments(P)`; hang the legs from `hipJointW` and the arms from `shoulderJointW`. `flexDeg` and
  `widestStance` are per player.
- Player Artist: `BODIES[id].proportions` are fractions of height seen from the front (`shoulderW`, `chestW`,
  `waistW`, `hipW`, `thighW`, `calfW`, `upperArmW`, `racketArmUpperW`...). I created `src/players/bodies.js` only;
  the rest of `src/players/` is yours (PR #28).
- Appearance Scout: `mensik/appearance.json` says 1.93 m, the ATP says 1.96 m. `nakashima/appearance.json` says lean
  and slim, but the ATP's 83 kg gives BMI 23.5. Jódar: ATP 191 cm, other pages 188 cm.
- Biomechanics Coach: the tool carries a copy of your normal ranges until `joints.json` is on `main`.
- Oddity, not used: the ATP data's status field for Nadal came back with an implausible value through the fetch
  helper; I took "retired" from `top20.json` instead.

**Open problems**
- No measured wingspans. They can be measured: arm span / height from a front-on frame with the arms out (pose
  keypoints, wrist to wrist plus hands), per player, once such frames exist.
- The shoulder and pelvis width ratios need a reference I can actually open (ANSUR II summary report,
  NATICK/TR-15/007: biacromial, bicristal, hip breadth, chest depth, span).
- `node` is missing on this Mac for this agent, so no JS test could run.

**Exact next step**
1. Open the ANSUR II summary statistics (https://tools.openlab.psu.edu/publicData/ANSURII-TR15-007.pdf) and replace the
   three weak width ratios and the chest depth in `build_bodies.py` (+ BODY_SOURCES.md) with its numbers.
2. Movement evidence for the ten neutral players (ATP "Tennis Insights" / TennisViz articles, player quotes), one
   player at a time, in `research.movement`.
3. Sinner: sliding and flexibility evidence (he is at the typical 110° now for lack of a source).
4. When the Biomechanics Coach's pose data separates the players, measure leg-to-height and shoulder-to-hip ratios for
   Alcaraz and Shelton from the US Open keypoints and compare with `segments`.
