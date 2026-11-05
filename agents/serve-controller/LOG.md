# Serve Controller · log

The Serve Controller writes here at the end of every run: what is done, open problems, and the exact next step.

## 2026-11-04 · run 1 (local, Ryan's Mac)

briefSeen: gameplay v1 (split team: I stay in `src/serve/control/` + `src/profile/` + small hooks in `index.html`)

Issues read: #5 and #3 (from ryanli0819, informational; both already reflected on `main`: no key starts a point, arrows aim, WASD moves). No `ceo-order` or `supervisor-order` for me. No instructions found in the repo that pointed outside CLAUDE.md / agents/README.md / RULES.md.

### Done
- Found an unfinished, never-committed attempt in the worktree (`src/serve/control/serve-control.js`, its test, `src/profile/profile.js`). Kept it, finished it, and wired it into the game.
- **You hit your own serve** in one motion: hold **F** = the arm lifts with the ball, let go = toss (longer hold = higher toss); hold **F** again while it rises = load the swing (pro waits in his trophy pose), let go = swing, contact one real swing-time later. **Q** held = kick, **E** held = slice, nothing = flat. Arrows / click still aim until contact. Touch: hold the new **Serve** button the same way; the flick as you let go of the swing picks the spin (up = kick, sideways = slice). Gamepad: A / RB / LB / right stick.
- If you press nothing for 0.7 s after the bounces, the serve goes by itself as a safe medium **auto serve** that can never ace (points still serve themselves).
- `ServeControl.create()` owns the captured motion's clock while serving (`stepMotion` asks it for `t`), so the pose holds while you hold. The computer presses the same "key" through a plan with small human errors, so both sides use one code path.
- **Sweet spot** = ball at the top of the reach: `reachTop = 0.81·h + 0.38·armSpan + 0.82·racket + 0.08` (Sinner 2.93 m, Alcaraz 2.84 m). Contact quality = toss × timing × contact-point bells. Timing is frame-rate independent (sub-frame contact; held frames counted exactly). There's a test for it at 1 ms, 60 fps and 30 fps.
- **Ace chance** (`aceChance`): zero unless toss ≥ 0.7, sweet spot ≥ 0.75 and power ≥ 0.8 (flat) / ≥ 0.6 (kick/slice), AND the ball lands within 45 cm of a line. Then a base for receiver on the wrong / right side + a constant step per Serve point (`getSkills(id).serve`). All in `SERVE_TUNING.ace`.
- `planServe` now uses `ServeControl.resolveServe`; `ACE_CHANCE` is kept (adds `requirements`, `sweetSpot`). Serve speed = `speedOf(result) + BODY.serveBonus`; the flight's arc/curve/kick follow the chosen spin (flat low & straight, slice bends wide, kick high and jumps).
- **Tuned to real stats** (simulation in the test, 20k points): Sinner (Control 17, Serve 16) ≈ 35% 1st-serve faults, ~2% double faults, ~7% aces, ~1.4% lets; Alcaraz (15/14) ≈ 40%, ~3%, ~6%. `letRate` per player unchanged (0.02 / 0.03).
- **Profile** (`src/profile/profile.js`, `tennis101.profile`): `players.<id>.serve.stats` (serves, aces, faults, double faults, avg/best sweet spot) for your own non-auto serves. Writes merge, so the Skills Coach's `players.<id>.skills` survive. `Profile.serveSkill(id)` reads `getSkills(id).serve`.
- HUD: a small serve meter under the stamina strip (toss bar with the ideal tick, power bar, `SERVE <skill> · <what to do next>`), and after contact `SWEET SPOT 92% · FLAT · ACE CHANCE 31%`.
- `SERVE_BINDINGS` (serveToss / serveAim / serveKick / serveSlice for keyboard, touch, gamepad) is exported for the Controls Designer's `CONTROL_SCHEMES`; `src/controls/` isn't on main yet, so the keys are wired directly in `index.html` for now.
- Updated my two contract entries in `agents/README.md` (Serve control, Serving).

### Checks
- No `node` on this Mac, and launching headless Chrome needed an approval I couldn't get in an unattended run. Instead I ran QuickJS (pip `quickjs`, scratchpad only): every touched JS file and both inline scripts in `index.html` parse; `serve-control.test.mjs` passes in full; and a stub-DOM smoke test ran the real game script for 40 s of play: you serving with F (sweet spot 98–99% for perfect input), idle (auto serves), and the computer serving. No runtime errors, stats saved to the profile.
- **Not checked:** the visual layout at desktop / 400 px in a real browser. Someone with a browser should look at the serve meter and the extra Serve button.

### Camera (first person)
The first-person serve camera already exists (V, `CAMS.pov`, eye height 94% of `heightM`, owned by the First-Person Camera). It looks straight down the court, so the toss at ~3.4 m is above the view: in first person you serve by feel and the meter. Next step for the camera: tilt up during the toss and back down at contact (a request for the First-Person Camera, not my folder).

### Open problems
- `CLAUDE.md` (Controls) still describes serves as fully automatic; it needs a line for F / Q / E / Serve button. Not my file: asked in the PR.
- No arm span in `ROSTER` yet, so `reachTop` uses height × 1.03. If the Skills Coach / Player Artist adds `armSpanM`, it's picked up automatically.
- Pros without a captured motion use the old routine serve with `autoResult` (clean, can't ace). Only matters once the roster grows.
- `launchBall` / `playMotion` (Ball Physicist / Body Animator) aren't on main: the serve still flies on the scripted arc in `planShot`, and the motion is played by `stepMotion`.
- Second serve defaults to flat if you don't hold Q. Maybe default the 2nd serve to kick: Ryan's call.

### Next step (tomorrow)
1. If Ryan approves, default the 2nd serve's brush to kick and show the brush in the meter while loading.
2. Hand `SERVE_BINDINGS` to the Controls Designer once `src/controls/schemes.js` is on main (replace the direct key wiring with the scheme lookup).
3. When `launchBall` lands, launch the serve from the contact point with `{ vel, spin: rpm }` from `result` instead of `planShot`'s arc.

## 2026-11-05 — round 2 (manager review: conflict with main's side-on serve)
- Merged origin/main (8a979e2, side-on start + the server looks at the box) into `agent/serve-controller`, no force-push.
- `stepMotion`: kept main's `sideOn(i, W, m, mo.t)` right after the pose (it reads `mo.t`, which the serve control now drives), and main's toss line (the ball travels from the hand, which is ahead of him side-on, toward the court) in **both** paths: the controlled toss (`ctl.flightU()`) and the auto toss.
- Checks: both inline scripts in index.html parse (`osascript -l JavaScript` + `new Function`). `src/serve/control/` is unchanged by the merge, so `serve-control.test.mjs` results stand; no `node` on this Mac to re-run it.

## 2026-11-05 — round 3 (PR #25): serve input through src/controls/
- Merged `origin/agent/controls-designer` (#20) into `agent/serve-controller` (no force-push) and resolved the five index.html conflicts.
- Added the serve actions to Controls Designer's contract in `src/controls/schemes.js`: `serve` and `kick` in `REQUIRED_ACTIONS` and `HELD`, bound in every scheme — WASD/Arrows: F serve, Q kick; touch: the Serve button (flick up = kick, sideways = slice); gamepad: X serve, LB kick. The slice brush reuses the existing `slice` action (E, / or RB). Hint lines mention serve/kick.
- `serveInput()` now reads `Controls.isHeld("serve" | "kick" | "slice")` plus the touch Serve button; the duplicate `input.keys` / `userInput()` / `gamepad()` / own keydown handler are gone. The Serve button is touch-only (`data-scheme="touch"`), like Split / Slide / Slice.
- Deviation from the review: gamepad A and RB were already taken (A = split step, RB = slice in #20), so serve is X and kick LB; SERVE_BINDINGS help text updated to match.
- Checks: index.html inline scripts, schemes.js, serve-control.js, profile.js parse (`osascript -l JavaScript` + `new Function`); `schemes.test.js` run in JXA with a small CommonJS shim: all passed. `serve-control.test.mjs` not re-run (no node / QuickJS here); serve-control.js changed only in help text, so its logic results stand.
- Next: manager's browser check of main + #19 + #20 + #23 + #25 + #30.
