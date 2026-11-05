# Body Animator · log

## Nov 4, 2026 · run 1 (local, Ryan's Mac)
briefSeen: 1 (Motion & Body, share team)

**Read first:** CLAUDE.md, agents/README.md, RULES.md, PROMPT.md, supervisors.json, and my teammates' logs (Serve Analyst: no runs yet; Animator, Racket Coach, Biomechanics Coach: Claude's setup notes only). Issues: #1 (ryanli0819, "playMotion must play captured serves unchanged and blend into your own animation"). There are no `ceo-order` or `supervisor-order` issues for me. Nothing in the repo told me to act outside my files.

**Engine choice (compared for the browser, no build step):**
| Option | Verdict |
|---|---|
| **three.js 0.170.0 `CCDIKSolver`** | **Chosen.** MIT and maintained. Works on a plain `Bone` chain (no mesh drawn). Per-link `limitation` (hinge axis) and `rotationMin/Max` give real joint limits. Loads as ES modules from jsdelivr (`+esm`) through a dynamic `import()` from a classic script, so no importmap and no extra script tag. ~650 KB, loaded in the background; the game never waits for it. |
| cannon-es 0.20.0 (ragdoll: ConeTwist / Hinge constraints) | Already in the project for the ball (PR #23). But it simulates forces: keeping a foot exactly on its plant, or a hand exactly on the grip, needs tuned motors and is frame-rate dependent. Kept in mind for later secondary motion (falls, follow-through). |
| FullIK (lo-th, a FABRIK port of Caliko) | Good constraints, but unmaintained since ~2018 and its npm releases are hard to pin. |
| three-ik (jsantell, FABRIK) | Archived 2019, no joint constraints. |
| Kalidokit | Turns pose landmarks into rig rotations: useful later for captured clips, but it isn't a gameplay IK. |
A CCD answer is used only if it lands within 1 cm, bends toward the pole and stays in range. Otherwise the exact two-bone solution (law of cosines, same limits) is used. It is also the solver until three.js has loaded (or forever when offline or with `?body=analytic`).

**Done:**
- `src/body/skeleton.js`: the Pose contract joints (camelCase, the same names as the serve files), bones, limits (knee 0–135°, elbow 0–150°; AAOS, the same as the Biomechanics Coach's joints.json in PR #21), and `segments(P)`. Segments use Drillis & Contini 1966 (Winter 2009); the standing column adds up to exactly 1.000 H. An optional `armSpanM` rescales the arms. I did not add `armSpanM` to `PLAYERS`: I have no reliable source for Sinner's or Alcaraz's span.
- `src/body/ik.js`: `BodyIK.solve` (CCD with checks, exact fallback), `twoBone`, `load(mods)`.
- `src/body/body.js`: `Body.update`, `getPose(i)`, `playMotion(i, frames, opts)`, the `?body=skeleton` debug view. How it moves is in `src/body/README.md`. In short:
  - Planted toes never slide. Cadence comes from Alexander's stride law, foot placement from Raibert. The heel lifts before the pelvis drops, and a stretched leg toes off.
  - Lean is atan(a/g). The split-step is a ballistic hop with a landing crouch. On a slide the lead foot skids.
  - The racket hand holds `racketPose`'s grip, and the shoulders turn only as far as the arm needs. The free arm swings against the legs.
  - The serve the game plays (`pos[i].motion.world`) is copied joint for joint, with a 0.2 s blend in and 0.25 s out, and the feet re-plant where it ended.
- `index.html`: 3 script tags and 2 one-line hooks. In `frame()` it calls `Body.update(...)`, and with `?body=skeleton` it pushes the debug bones into the actor draw list. `moveBody`, the movement numbers and the scoring are untouched. Nothing reads `getPose` yet, so the sprites look exactly as before.
- Tests: `src/body/test/body.test.mjs` (Node). `src/body/check/mirror.py` is a line-for-line Python mirror of the gait. **Mirror: 21 passed, 0 failed.**
  - Segments add up to the height.
  - Knee 15–95° and elbow 2–136° through a 9 s rally (sprints, braking, forward / back-pedal, shuffle, split-step, slide), both players.
  - Planted toes slide 0 m and bones keep their length.
  - Cadence: 6 steps in 3 s at 2 m/s, 11 at 6 m/s.
  - Lean: 16 cm forward speeding up, 11 cm back braking.
  - Split-step: 5.7 cm hop, 7.7 cm landing crouch.

**⚠️ Not verified in JS:** this Mac has no node, and jsc / osascript need approval, so I could not run `node --check`, the Node test, or load the page. The JS was checked by careful reading plus a bracket / string / regex scan (all 4 files OK). Risk to `main` is low: if any body script fails to load, `window.Body` is undefined and both hooks are skipped; `Body.update` catches its own errors and switches itself off with one console warning. The three.js `+esm` import and the CCD path are untested in a browser.

**Open problems:**
- Nobody draws from `getPose` yet. The Player Artist (`drawPlayer`) and the Animator (`Anim.frame`) still draw their own figure; my skeleton shows only with `?body=skeleton`.
- When the grip is out of arm's reach (serve contact at ~2.3 m in `racketPose`'s non-captured serve), the arm points straight at it and the hand stops short of the racket.
- There is no handedness field in `ROSTER`: everyone is right-handed.
- The forehand / backhand body shapes come only from the racket path (the grip target, tilt, crouch and minimal shoulder turn). There is no hip-shoulder separation or unit turn yet.

**Next step (run 2):**
1. Run `node src/body/test/body.test.mjs` on a machine with Node, and load the page at desktop and ~400 px with `?body=skeleton`. Fix anything that fails.
2. Add the unit turn and hip-shoulder separation for forehands and backhands, timed to `racketPose`'s time-to-contact, plus a stepping-in front foot at contact.
3. Agree with the Player Artist (in the PR) on drawing `drawPlayer` from `getPose(i)` behind a flag.

**For teammates:** `getPose(i)` is live every frame (court metres, read-only). Player Artist and Animator: draw from it whenever you're ready. Racket Coach: the right hand follows your `g`, so a grip outside the arm's reach (~0.63 m from the shoulder for Sinner) leaves a gap. Serve Analyst: `playMotion` accepts your Motion objects as they are, with no conversion.

## 2026-11-05 · round 2 (Motion & Body review, PR #26)
- Fixed exactly the review note: three.js / CCDIKSolver is now imported only with `?body=skeleton` or `?body=ccd`. Normal play downloads nothing and solves knees/elbows with the exact two-bone IK (`BodyIK.engine` = "analytic two-bone"). `?body=analytic` is no longer needed (it is the default).
- Rebased on origin/main (879fc0b). Updated `src/body/README.md`, the `ik.js` / `body.js` headers.
- Checked: osascript `new Function` syntax check of body.js, ik.js, skeleton.js and index.html's inline scripts — all OK. In the browser (local server): plain page → 0 three.js requests, engine "analytic two-bone"; `?body=skeleton` → 2 three.js requests, engine "three@0.170.0 CCDIKSolver", debug on; no console errors.
- Handed back to Motion & Body.
