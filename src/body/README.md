# src/body/ · Body Animator

A jointed skeleton for each player, built every frame from the footwork. It never drives the game: it reads `pos[i]`, the Racket Coach's `racketPose`, and the serve the game is playing, and writes nothing back.

| File | What |
|---|---|
| `skeleton.js` | `BodySkeleton`: `JOINTS`, `BONES`, `LIMITS` (knee 0–135°, elbow 0–150°), `segments(P)` (Drillis & Contini 1966 via Winter 2009, scaled to `heightM`; optional `armSpanM`), `flexion(a, b, c)` |
| `ik.js` | `BodyIK`: one limb to a target. The exact two-bone solution on normal play (no download). With `?body=skeleton` or `?body=ccd` it loads three.js `CCDIKSolver` (three@0.170.0, jsdelivr) in the background, with a hinge and the joint's range, and the exact answer stays the fallback and the check |
| `body.js` | `Body.update(dt, { pos, PLAYERS, racket })`, `getPose(i)`, `playMotion(i, frames, { loop, flip })`, `Body.drawDebug` |
| `test/body.test.mjs` | `node src/body/test/body.test.mjs` |
| `check/mirror.py` | `python3 -I src/body/check/mirror.py`: the same gait checks in Python, for machines with no JS runtime |

## Pose contract
`getPose(i)` returns `{ joints, racket, source, solver, feet }`, all in court metres (x across, y along the court, z up):
- `joints`: `head, neck, chest, pelvis, left/right Shoulder, Elbow, Wrist, Hip, Knee, Ankle, Toe` (camelCase, the same names as the serve motions; `pelvis` = the serve's `root`, `head` = its `nose`).
- `racket`: `{ grip, head, face }` from `racketPose` (grip point, racket tip 0.686 m along it, string normal).
- `source`: `"gait"`, `"blend"` or `"motion"` (a serve or `playMotion` is playing). `feet`: `[{ planted, slid, toe }]`.
Treat it as read-only. It is ready after the frame's `Body.update`, so draw from it in the same frame.

## How it moves
- **Feet:** a planted toe never slides. A foot lifts when its phase in the stride comes round (stride from leg length, Alexander 1984: λ/L = 2.3·Fr^0.3; cadence = speed ÷ stride) or when the leg is fully stretched behind the hip (toe-off). It lands where the hip will be half a stance later (Raibert 1986). The heel rises up to 50° before the pelvis has to drop. Below 0.35 m/s the body stands and steps only to re-balance. Side moves under 3 m/s are a shuffle (0.6× stride); faster ones turn the hips 50° into a side run.
- **Lean:** the trunk tilts by atan(a / g) when speeding up or braking (at most ~35° in total). It bends forward in the return stance and after a split-step landing.
- **Split-step:** a ballistic hop of g·T²/8 for the air time T (5.9 cm for 0.22 s), with the feet spreading to land wide, then a crouch that fades in ~0.15 s.
- **Slide:** the lead foot skids out in front and the back foot drags. This is the only time feet slide.
- **Arms:** the right hand holds the racket grip, and the left hand holds the throat in the ready position or goes on the handle for a two-hander. Otherwise the arm swings against the legs. The shoulders turn only as far as the arm needs to reach. Racket `tilt` rolls the shoulders and `crouch` lowers the pelvis.
- **Motions:** `playMotion` plays frames (`j: {name: [side, up]}` or `[side, fwd, up]`, or `joints: {name: {x, y, z}}`, in body heights) joint for joint. The body blends in over 0.2 s and out over 0.25 s. A serve the game is playing (`pos[i].motion.world`) is picked up the same way, and the feet re-plant where the motion left them.

## See it
`?body=skeleton` draws the bones over the sprites (left blue, right orange, racket yellow, planted toes as dots) and loads three.js for the CCD solver. `?body=ccd` loads the CCD solver without drawing. With no flag nothing is downloaded and the exact two-bone IK is used.
