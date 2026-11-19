# Animator · log

No runs yet. First version by Claude for Ryan (Oct 28): `src/animation/run-cycle.js` (run, back-pedal, shuffle, plant, ready, split, slide), with legs drawn as hip → knee → foot in `drawPlayer()`. Next: direction-change transitions, then stroke animations.

## Oct 29 — Claude for Ryan
20-frame stride cycles per player and direction (run away / toward, back-pedal, side run with the body turned, shuffle), built from a gait model shaped by `GAIT[id]` and tweened between frames. `drawPlayer` uses `dy` (depth), knee drive, heel-kick soles and `turn` (narrower torso, profile head). Next: real running footage from `datasets/video/<player>/running/` to tune each GAIT.

## Nov 4, 2026 — first agent run (local, Ryan's Mac)
briefSeen: motion-body v1

**Issues read** (opened by ryanli0819): #8 (Animator intro: direction changes first) and #9 ("move the racket poses into `src/animation/`"). #9 is superseded: PROMPT.md and #11 give the racket to the Racket Coach (`src/racket/`), so I left `racketPose` alone. No `ceo-order` or `supervisor-order` issues for me. No repo content asked me to act outside my files.
**Teammates (share team):** serve-analyst, body-animator and racket-coach have no runs yet; biomechanics-coach has data in `datasets/anatomy/uso/` but no `movements/*.json` yet, so nothing to read for direction changes. `getPose(i)` does not exist yet, so the pixel frames stay the source.

**Done — direction changes (Ryan's priority)**, all in `src/animation/run-cycle.js`:
- A small state machine (`track`, state on `p._dc`) reads only the velocity and `p.plant`. It keeps the last cruising heading and plays four beats:
  - `decel` — braking steps: the lead foot reaches out ahead, a stutter step with the other foot, the body sinks (crouch 0.03 → 0.08) and leans back against the old way; side runs start to square up. Progress = share of the old speed already shed.
  - `plant` — lead foot loaded wide and low; the hips begin to open toward the new way (≥ 0.06 s; if the player stops instead, after 0.3 s → `ready`).
  - the cut step (0.24 s ÷ cadence): `crossover` for a sideways cut (the outside leg swings across in front of the body, hips and shoulders turn fully, a strong lean), `dropstep` when the new way is backward (the hip opens, that foot steps back), `pushoff` when it is forward (the back foot drives through, body tipped in with `bend`).
  - then the normal run with an **acceleration lean** (`accel` 0..1 = measured acceleration ÷ `B.accel` × (1 − speed/top)): lean into side runs, `bend` forward on runs, a bit lower; fades out at top speed.
- Abandoned brakes (you brake, then keep going the old way) go straight back to the run. Reversing again mid-cut starts a new `decel`.
- `frame()` uses a short 0.07 s blend (not 0.2 s) between two beats and eases turn/lean twice as fast during them, so the plant is not washed out. It takes an optional `now` (seconds) for tests.
- Reduced motion: the beats snap to 4 poses (no in-between) and every running kind now has no bob.
- Timing with Sinner's body numbers, full sideways reversal at top speed: decel ≈ 0.55 s → plant ≈ 0.12 s → crossover ≈ 0.25 s → side run. A stop: decel → plant 0.3 s → ready.

**Tests:** `tests/animation.test.mjs` (new, `node tests/animation.test.mjs`): standing → ready; slow sideways → shuffle, fast → side run (turned); backward → back-pedal (near and far); sideways reversal → decel → plant → crossover → side run (leans back, sinks, turns, the right leg crosses to the left); forward → back → dropstep → back-pedal; back → forward → pushoff; stop → decel → plant → ready; acceleration lean early, gone at top speed; frames cycle in order; faster run cycles faster; every player (including one with no GAIT) gets the beats with finite numbers; the animation never changes position/velocity/plant; split and slide still win; reduced motion.
**Not run here:** this Mac has no node, and `osascript -l JavaScript` and `pip install` needed approval in this session, so neither `node --check` nor the test file could run. I checked the state machine with a Python mirror of `track()` + the `moveBody` rules (sequences and timings above) and reviewed the JS by reading. First thing next run: run `node --check src/animation/run-cycle.js` and `node tests/animation.test.mjs`, and look at a reversal in the browser.

**Contract change:** `agents/README.md` Animation line: new kinds (`decel`, `crossover`, `dropstep`, `pushoff`; `plant` is now a beat), `bend` and `accel` fields, `Anim.TURN_KINDS`, optional `now`.

**Open problems**
- Not seen in a browser yet: the feet numbers are first guesses; tune by eye (crossover reach 0.3 body widths, drop step 0.2 heights back).
- During a beat the gait phase doesn't advance, so the stride restarts at a random phase after it (hidden by the 0.2 s blend).
- `drawPlayer` gets no torso twist separate from `turn`; hips and shoulders turn together.
- CLAUDE.md's list of animation kinds should mention the new beats (not my file; noted in the PR).

**Next step (tomorrow):** run the tests and `node --check`, watch a reversal at desktop and ~400 px and tune the numbers; then stroke animation: forehand / backhand body (unit turn, load on the outside leg, hip-then-shoulder rotation) keyed to the time-to-contact the Racket Coach's `racketPose` already uses, with the split-step before.
