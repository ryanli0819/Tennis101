# Anatomy data (Biomechanics Coach)

- `uso/uso-*.keypoints.json`: Apple Vision 2D pose for **every person** in Ryan's US Open clips of Alcaraz vs Ben Shelton
  (`datasets/serves/alcaraz/alcaraz us open against ben shelton*.mov`, local only). Each frame has `people: [{ joints }]`;
  x, y normalized from the top-left, third value = confidence. The players still have to be separated from the crowd.
- `joints.json`: joint ranges of motion (to write). `movements/<name>.json`: timing and angles per tennis movement (to write).
Video and stills stay on Ryan's Mac; only numbers live here.
