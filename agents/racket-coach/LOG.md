# Racket Coach · log

No runs yet. First version by Claude for Ryan (Oct 28), in `index.html`: swings timed by time-to-contact and joined by a spline (`poseTrack`), contact aimed at the ball's height, drives with a loop, the slice from 2 o'clock to `SLICE_END` (Sinner 4, Alcaraz 5) with shoulder tilt and a racket-head trail, a serve windup with a racket drop for sprite players. Next: move it into `src/racket/`, then measure real racket paths from the Footage Scout's clips.

## 2026-11-02 · CEO order (issue #11), run by the HQ sync
briefSeen: 1 (motion-body)
- Moved `RACKET`, `drawRacket`, `SLICE_END`, `poseTrack`, `racketPose` out of `index.html` into `src/racket/racket.js`, unchanged, as one classic `<script>` loaded before the main inline script (same global names, so nothing else changed). `RACKET_LOOK`, `V3`, `ease` stay in `index.html` (shared with the Player Artist's sprite code).
- Added `tests/racket.test.mjs` (`node tests/racket.test.mjs` from the repo root): slice starts ~2 o'clock (10 on the backhand) and ends at `SLICE_END` ± 0.5 h, both players; contact grip height = ball height (clamped 0.45–1.75 m) for drives and slices; backswing behind the body from ttc 0.45 to 0.2 s; still in ready 1.5 s out. 102 checks pass (run through `osascript -l JavaScript`, no node on this Mac).
- Checked in the browser: match loads, both rackets draw, serve and rally run, no console errors, desktop and 400 px.
- Decision: the backswing test allows −0.08 m (the two-handed backhand's back pose sits 0.10 m behind the body).
- Next: measure racket paths (wrist path, forearm angle, clock angle at takeback/contact/finish, contact point, phase timing) from the Footage Scout's Sinner/Alcaraz stroke clips once they are recorded (issue #14, PR #15) → `datasets/racket/<player>.json`.
