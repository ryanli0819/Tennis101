# Game vs anatomy: what the Biomechanics Coach found

Checked on Nov 2, 2026 against `joints.json`, `movements/*.json` and the US Open measurements. `tests/anatomy.test.mjs`
fails on anything impossible (a joint past its range, legs crossing, a knee driving backward, a serve whose contact isn't
the racket hand's high point) and prints the rest as advice. Units: H = the player's standing height.

| # | Where | Finding | Real | Owner | Status |
|---|---|---|---|---|---|
| 1 | `index.html` split-step hop (`drawPlayer`, shadows) | A fixed 0.07 H (13 cm) lift for the whole 0.22 s, and +0.15 m on the shadow. A 0.22 s free flight can only rise g·T²/8 ≈ 6 cm. | Measured split steps: 0.024–0.062 H high, 0.11–0.34 s in the air. | Biomechanics Coach | **Fixed here**: `hopLift(p)` = a free-flight arc from `SPLIT_AIR` (peak ≈ 6 cm), used by the sprite and its shadow. |
| 2 | `run-cycle.js` `receive` | Low enough (hips 0.085 H down ≈ knees ~70°, trunk ~30° forward), but feet ±0.4 sprite widths = **0.24 H** apart, narrower than the sprite's own shoulders (0.30 H). | 0.32–0.45 H, clearly wider than the shoulders. | Animator | Suggested: feet `dx` ±0.6 to ±0.7. |
| 3 | `run-cycle.js` `split` | Feet ±0.3 = **0.18 H** apart; hips dropped 0.09 H while the feet lift 0.04 H, so the legs tuck to ~90° in the air. | Lands 0.30–0.45 H wide (median 0.35 H); knees soft (~15–25°) in flight, absorbing to ~35–50° on landing. | Animator | Suggested: feet ±0.58, `bob` −0.06 → −0.01, `lift` 0.04 → 0.02 (the hop itself now comes from `hopLift`). |
| 4 | `run-cycle.js` `ready` | Feet ±0.26 = 0.16 H apart. | About shoulder width or a bit more: 0.26–0.32 H. | Animator | Suggested: ±0.45. |
| 5 | `run-cycle.js` `backpedal` | Knee drive (`knees.dy`) follows the direction of travel, i.e. backward relative to where he faces. Small (K = 0.03). | Backing up, the thigh still lifts in front of the body (toward the net). | Animator | Suggested: flip the sign of `knees.dy` for `backpedal`. |
| 6 | `alcaraz-serve.js` `first` timing | Every phase runs **~1.45× too fast**: toss hand passes the shoulder −0.74 s (real −1.07), toss arm highest −0.53 (real −0.75), deepest knees −0.25 (real −0.37). The three ratios agree (1.42–1.48). | US Open, 8 serves at real speed (`movements/serve.json`). | Serve Analyst | Suggested: re-time with `timeScale` ≈ 0.33 instead of 0.226 (the Indian Wells clip looks ~3.0× slowed, not 4.4×). |
| 7 | `alcaraz-serve.js` `first` contact | Racket elbow 41–57° bent at contact. | Nearly straight: 13° (US Open), 3–15° (10 pros in the compilation). | Serve Analyst | Check the rebuilt arm around contact (MOTION_NOTES "Known limits"). |
| 8 | `alcaraz-serve.js` `first`, after contact | The left shoulder ends up 0.22 H to the **right** of the right shoulder (and the left hand far right). From behind, that only happens if he turns to face the camera. The front-side clip was mirrored in 2D; the depth turn became a sideways swap. | After contact a right-hander's chest turns to face the net: left shoulder stays on his left. | Serve Analyst | Re-project by the camera's angle instead of a plain mirror, or hold the shoulder order after contact. |
| 9 | Serve motions, racket drop | Racket elbow drawn past 150° (up to 179°) in Alcaraz 1st (25 frames), Sinner 1st (77), Sinner 2nd (23), around −0.35…−0.05 s. In 3D the elbow is ~90–130°; the forearm points toward/away from the camera, so the 2D arm folds flat. | Elbow flexion max ~150°. | Body Animator / Player Artist (`drawCapturedFigure`) | Draw a foreshortened arm when the 2D fold passes ~145° (shorter upper arm + visible forearm) rather than a forearm lying on the upper arm. |
| 10 | Serve motions, toss arm at contact | Toss elbow 157–178° folded at contact (Sinner 1st, Sinner front, Alcaraz 2nd). | The tucked toss arm stops at ~145–150°. | Body Animator / Serve Analyst | Clamp the drawn fold to 145°. |
| 11 | Serve motions, knees | Loading knees 70–98° (Sinner 2nd back knee 98°). | Alcaraz at the US Open: front 49°, back 72°; 10 pros: front 31–58°. | Serve Analyst | Inside the range: fine, just deep. No change needed. |
| 12 | Left-handers | No `hand` field in `ROSTER`; every serve is drawn right-handed. | Shelton tosses with his right arm (4 of 4 serves). | Player Artist / Serve Analyst | When a lefty joins: `hand: "left"` and mirror the motion (swap left/right, flip x). |

Fine as it is: legs never cross in any stride frame; knees stay within 135° (sprint swing max ≈ 119°); the plant
(feet 0.25 H, leaning into the new direction) matches the measured changes of direction (median 0.23 H, trunk ~5°
toward the new way); the return stance is low enough; arms are drawn in depth order; the bounce routine moves the arm.
