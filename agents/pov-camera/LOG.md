# First-Person Camera · log

## 2026-11-04 · run 1 (local, Ryan's Mac)
briefSeen: gameplay v1

**Orders read:** no `ceo-order` or `supervisor-order` issues for pov-camera, team:gameplay or agent:all. Open issues for me (all opened by ryanli0819): #6 (play the routine in first person: the ball bouncing in front of you, then look up with the toss): done in this PR. #7 (v0.5.0: V switches serve cam ↔ first person): kept. Nothing in the repo asked me to act outside my files.

**Done (PR `agent/pov-camera`):**
- First person moved into `src/camera/pov.js` (`window.Pov`). `CAMS.pov` = `Pov.cam(PLAYERS[0], pos[0], Pov.head())`; `povWanted()` = `Pov.wanted({...})`.
- **On from GET SET (READY)**, not only from the routine (the old `povWanted` needed a `rally`, so READY was never first person). Off 0.35 s after contact. Never while you receive. V still switches serve cam ↔ first person.
- **Pitch (looking up and down).** `proj()` in `index.html` now takes a camera pitch (`CAM_P`, `setPitch`). It is 0 for every other camera, which gives exactly the old projection. `HZ` is the middle of the view; `horizonY()` is the real horizon (used for the sky and click-to-aim). `screenToCourt` inverts the pitched projection. The serve-cam inset forces pitch 0.
- **Where you look** (`Pov.look`): GET SET 0 (the box); bouncing −0.45 rad (hand, ball and the top of the box all in view); after the bounces 0; toss: follows the ball (ball 0.3 rad above the middle of the view, at most 0.8 rad up); after contact back to 0, faster.
- **Head movement:** 55% of the motion's neck height and neck + pelvis sideways movement, clamped to ±0.16 m. Off with reduced motion.
- **prefers-reduced-motion:** the head stays still; the view cuts between fixed angles (down for the bounce, level, one fixed 0.55 rad look-up for the toss, level after contact) and never tracks the ball.
- **Your own hands, ball and racket** (`Pov.drawSelf`, drawn last on the actor layer): forearms, wristbands, hands, and the racket (`drawRacket`, `RACKET_LOOK`) on the captured joints (`pos[0].motion.world`) in the Player Artist's colours (skin, `P.sleeve`, `P.ui`). The captured joints are flat (seen from behind), so `Pov.armDepth` gives them depth: the tossing arm is 0.32 m in front, and the racket arm is 0.2 m in front, goes 0.15 m behind at the trophy and comes 0.45 m in front at contact. Anything nearer than 0.42 m to the lens along the view isn't drawn.
- While you bounce, hold and toss the ball, first person draws the ball itself, never closer than just in front of your palm (`Pov.ownsBall`). The real joints are in the body plane, inside the camera's near limit.
- Aim stays readable: the box and cross show at GET SET, during the bounce and before the toss. While you look up at the toss, a yellow chevron at the bottom edge shows where your aim is.
- Tests: `node src/camera/pov.test.mjs`: eye height = 94% of `heightM` (taller sees higher); on during READY and toss, off within 0.5 s after contact, never while receiving; where it looks in each phase; reduced motion cuts; every serve motion's events fit `armDepth`.

**Not verified this run (blocked):** this Mac session had no JavaScript runtime I was allowed to use (`node`, `jsc`, `osascript -l JavaScript` and `pip install` all needed approval), and no headless browser. So `node --check`, the tests and a page load at desktop / 400 px **were not run**. I checked bracket and string balance with a Python script, and checked the maths by hand (pitch 0 gives exactly the old `proj`, and the `screenToCourt` inverse with pitch 0 gives the old formula). The manager or Ryan needs to run `node src/camera/pov.test.mjs` and look at a first-person serve before merging.

**Open problems / to tune by eye:**
- Arm depths and sizes are first guesses. Forearms are ~8 cm thick, so they look big up close. The 2D capture puts the tossing hand out to the side (~0.58 m for Sinner), near the edge of the view.
- With a strong pitch, court and stadium polygons with corners behind the camera are clamped at 0.4 m (as before, just more often). They should fall off-screen, but this needs a visual check for slivers.
- CLAUDE.md / agents/README.md still say "your own body isn't drawn in first person". Suggested wording is in the PR; I don't edit those files.
- Player Artist: a proper first-person hand sprite (fingers, palm open after release) would replace my round hand.

**Next step (run 2):** load the page and serve in first person on grass, clay and hard, at desktop and 400 px. Tune `LOOK_DOWN`, `BALL_HIGH`, the arm depths and the forearm width by eye, and fix any polygon slivers when looking up (cull or clip court polygons by view depth if needed). Then ask the Serve Analyst (issue `agent:serve-analyst`) for a forward (depth) estimate of the arms from the side clips, to replace `armDepth`'s guesses.

## Before
No runs yet. First version by Claude for Ryan (Oct 27): `CAMS.pov` + `povWanted()` in index.html, eye height 94% of height, own body hidden.
