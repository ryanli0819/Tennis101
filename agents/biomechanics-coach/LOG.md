# Biomechanics Coach · log

## Nov 2, 2026 · run 1 (local, Ryan's Mac)
briefSeen: 1 (motion-body)

CEO order #13 (separate Alcaraz and Shelton, then joints and movement data, check the game). Done in this run:

- **Players separated** (`datasets/anatomy/tools/uso_tracks.py` → `uso/players.json`): people tracked frame to frame
  by torso centre and body scale, so a camera cut ends a track; crowd, ball kids, line judges, partial bodies and
  frame-edge people dropped (451 tracks); kept 11 court tracks and 11 close-ups. **All 8 serves are Alcaraz's**: toss
  arm left → right-handed, near court, seen from behind (Vision's labels checked: in back-view frames the left shoulder
  is on the picture's left, 100%). **Shelton never shows up during play**: he's at the far baseline, too small for
  Vision. His left-handed pattern comes from `datasets/serves/shelton/compilation-25/26` instead: toss arm right on 4
  of 4 serves (every right-hander in that compilation tosses left; one Zverev clip has mirrored labels, detected and
  swapped by `measure.py`).
- **Measured** (`tools/measure.py` → `uso/measurements.json`): serve timing at real speed (toss hand past the shoulder
  −1.07 s, toss arm highest −0.75 s, deepest knees −0.37 s, landing +0.32 s), loading knees front 49° / back 72°,
  contact elbow 13°, landing on the front foot with the back leg kicked up (~100°); 4 split steps (all ~0.9 s after his
  own serve contact, as Shelton returns: 0.18 s air, 0.035 H high, landing 0.35 H wide); 14 toe bounces; 9 direction
  changes (pose only: the camera may pan).
- **Data**: `joints.json` (AAOS ranges, which way each joint bends, tennis use, Drillis & Contini proportions),
  `movements/serve.json`, `split-step.json`, `return-stance.json` (return stance from proportions + coaching values:
  no receiver in the clips).
- **Game check** (`datasets/anatomy/GAME_CHECK.md`, 12 items). Fixed one in `index.html` (smallest hook): the
  split-step hop is now a free-flight arc from `SPLIT_AIR` (`hopLift`, peak ≈ 6 cm) instead of a fixed 13 cm lift
  (the shadow used +15 cm). Reported for others: return/split/ready stances too narrow and the split tucks the knees
  to ~90° (Animator); Alcaraz's 1st serve plays ~1.45× too fast, elbow bent 41–57° at contact, shoulders swapped after
  contact from a 2D mirror (Serve Analyst); racket and toss elbows drawn past 150° in the drop and at contact (Body
  Animator / Player Artist); backpedal knee drives backward (Animator); no `hand` field for left-handers.
- **Tests**: `tests/anatomy.test.mjs` (node:test, no dependencies). Hard checks: ranges, proportions, movement angles
  inside joints.json, player separation, run-cycle legs never cross, knees forward and ≤ 135°, serve motions' knees
  and contact. Advice (stance widths, elbow folds, contact elbow) printed. Hard checks verified against today's data
  with a Python port; **node is not installed in this sandbox, so `node --check` and `node --test` were not run**.

For teammates (share team):
- Serve Analyst: use `movements/serve.json` events to re-time Alcaraz's 1st serve (timeScale ≈ 0.33); see GAME_CHECK #6–8.
- Animator: stance widths in H: ready 0.26–0.32, return 0.32–0.45, split landing 0.30–0.45 (#2–5).
- Body Animator / Player Artist: draw a foreshortened arm instead of folding past ~145° (#9–10).
- Racket Coach: contact arm 14° from vertical, elbow 13°, hand 0.07 H in front of the shoulders; finish across to the
  non-racket hip.

Not followed: nothing in the repo asked me to act outside my files.

Open problems: no receiver data (asked Ryan for a clip showing the returner: issue #22; PR #21); knee bend can't be measured from behind
(split steps, return); `uso-4`'s serve is quicker than the others (maybe a second serve).

**Next step:** once node runs, `node --test tests/anatomy.test.mjs`; then `movements/forehand.json` and
`backhand.json` from the Footage Scout's clips in `datasets/video/`, and the return stance from a receiver clip.
