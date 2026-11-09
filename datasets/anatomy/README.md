# Anatomy data (Biomechanics Coach)

How real bodies move, in numbers the animators can use. H = standing height (multiply by `heightM`), angles in degrees,
times in seconds. Video and stills stay on Ryan's Mac; only numbers live here.

- `joints.json`: range of motion of every joint (AAOS normal values), which way each bends, what tennis asks of it,
  and body proportions as fractions of H (Drillis & Contini).
- `movements/serve.json`: the serve, measured at real speed on Alcaraz (US Open): events, kinetic chain, joint angles
  and where each arm is at each phase, plus the left-hander's mirror (Shelton).
- `movements/split-step.json`: split steps measured on Alcaraz (timing, air time, height, landing width).
- `movements/return-stance.json`: the receiver's stance (from proportions and coaching values: not measured yet).
- `GAME_CHECK.md`: where the game's poses break anatomy or differ from the real players, and who owns each fix.
- `uso/uso-*.keypoints.json`: Apple Vision 2D pose for **every person** in Ryan's US Open clips of Alcaraz vs Ben
  Shelton (`datasets/serves/alcaraz/alcaraz us open against ben shelton*.mov`, local only). x, y normalized from the
  top-left, third value = confidence.
- `uso/players.json`: the players separated from the crowd, by `tools/uso_tracks.py`. All 8 serves in the clips are
  Alcaraz's (toss arm left = right-handed, near court, seen from behind). Shelton is at the far baseline and too small
  for Vision, so he is measured from his compilation serves (`datasets/serves/shelton/`) instead.
- `uso/measurements.json`: serves, split steps, toe bounces and changes of direction, by `tools/measure.py`.

Rebuild:

    python3 -I datasets/anatomy/tools/uso_tracks.py
    python3 -I datasets/anatomy/tools/measure.py
    node --test tests/anatomy.test.mjs

Limits: one camera, 2D. Bends that point toward or away from the camera read short (knees from behind, the racket
arm in the drop), so the serve's knees and elbows (side-on, in the picture plane) are reliable and the split step's
knee bend is not. Speeds are in the picture; the broadcast camera may pan.
