# Animator · log

No runs yet. First version by Claude for Ryan (Oct 28): `src/animation/run-cycle.js` (run, back-pedal, shuffle, plant, ready, split, slide), with legs drawn as hip → knee → foot in `drawPlayer()`. Next: direction-change transitions, then stroke animations.

## Oct 29 — Claude for Ryan
20-frame stride cycles per player and direction (run away / toward, back-pedal, side run with the body turned, shuffle), built from a gait model shaped by `GAIT[id]` and tweened between frames. `drawPlayer` uses `dy` (depth), knee drive, heel-kick soles and `turn` (narrower torso, profile head). Next: real running footage from `datasets/video/<player>/running/` to tune each GAIT.
