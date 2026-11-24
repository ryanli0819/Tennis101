---
name: triangulate-serve
description: Make a pro's in-game serve follow a real clip by triangulating three sources — an existing 3D capture, the clip's 2D body track, and any measurements printed on the clip — into one body with fixed bones. Use when Ryan gives a serve clip (with or without a joint-angle overlay) and wants a player's serve, legs, arms or whole body to follow it.
---

# Triangulate a serve from a clip

A monocular clip shows **where** each joint is across the picture but not how far it points toward or away from the
lens. A 3D capture knows the depth but drifts from the real motion. Labels drawn on the clip (joint angles, times) are
the only true numbers. **Triangulation** combines the three so each fills the others' blind spot: picture → direction
across the frame, bone length → the hidden depth (**folding**), 3D capture → which way it folds, labels → the target
angles. The result is one body with rigid bones that matches the clip frame by frame.

Generalise from the method below; take every number (clock, contact time, thresholds) from the new clip itself.
The worked example is `datasets/serves/tools/alcaraz_legs_arms.py` — read it for code shape, never reuse its constants.

## Prerequisites

- **The clip in the project** (`datasets/video/<player>/serve/`, git-ignored). macOS privacy blocks reading
  `~/Downloads` and `~/Desktop` even unsandboxed: ask Ryan to move the file in. Never commit video or stills.
- **One serve, one fixed camera**, whole body in frame. Slow motion helps. A compilation with cuts breaks the camera fit.
- **A 3D starting motion** for that player (a `SERVE_MOTIONS[id]` file or roster serve) — it supplies depth signs.
- **A shared clock** between the clip and the motion. Burned-in time labels are best; otherwise two events you can see
  in both (trophy, contact) give a linear map `t_game = (t_clip − T0)·K`.
- macOS with Swift (Apple Vision) — `datasets/serves/tools/track_labels.swift` reads text and 2D pose; numpy for the fit.
- The game running in the built-in browser (`.claude/launch.json` → `tennis101`) for the in-game check; keep the pane hidden.

## Steps

Each step ends on its **done** line. Measure before and after every step; a change that improves its own number but
worsens an earlier one is reverted.

1. **Extract numbers, not pictures.** Run `track_labels.swift` over the clip (label region, and `full` if labels sit
   elsewhere). Parse into a tracks JSON: per frame the label values (angles, clip time) and every detected person's 2D
   joints with confidence. Keep only the server (largest / most central person).
   *Done:* labels read on nearly every frame, a list of frames with no pose, tracks JSON written (numbers only).

2. **Look before fitting.** Grab stills at the key phases (start, toss, trophy, racket drop, contact, landing) with
   `grab.swift` into the scratchpad and Read them. Write down, from the pictures, which hand is which, when contact
   really happens (arm straight, racket over the ball), and when the camera or overlay misleads.
   *Done:* each phase has a clip time you saw yourself; contact time confirmed by eye, not inherited from the old motion.

3. **Fit one camera.** Scaled orthographic, one rotation for the whole clip, the player's position re-matched per
   frame. Solve the rotation by least squares between 3D joints and 2D points, then take the nearest true rotation by
   SVD. Its third row is the depth axis.
   *Done:* rms reprojection error reported in px; refit after every later step that moves joints.

4. **Torso first.** Fit the hip line, the shoulder line (with its tilt) and the spine to the picture, keeping their
   lengths; rotate the upper body rigidly, then place each shoulder and carry its arm with it. Legs and arms hang
   from the torso, so fixing it later undoes their fit.
   *Done:* hip line, shoulder line and spine angles each within a few degrees of the picture on most frames.

5. **Legs.** Drive each knee's inside angle from the labels (or the picture where no label exists). Feet on the ground
   stay put and the hips rise or sink to fit (least squares over planted feet); a foot in the air turns about its
   knee. Choose the knee direction on the IK circle that matches the picture's knee offset from the hip.
   *Done:* knee angle within a few degrees of the label on most frames, planted feet still, knee picture error reported.

6. **Arms.** Each bone keeps its length; its direction across the picture comes from the clip; the hidden depth is
   `dz = ±√(L² − l²)` with the sign from the 3D capture (folding). Clean the 2D track first — see
   [LESSONS.md](LESSONS.md) for hand identity, jumps, blur and lost frames.
   *Done:* arm picture error in px per phase (toss, trophy, drop, contact, finish) all small; hands never swap or overlap.

7. **Steady.** Smooth every joint in time (local-linear, lighter on the racket arm near contact), then let the game's
   skeleton restore bone lengths. Per-frame fits always leave jumps.
   *Done:* worst frame-to-frame joint jump in cm reported before/after; no joint jumps more than the real swing.

8. **Events and derived data.** Set contact (and any moved event) from step 2, recompute derived joints, contact
   wrist height, and any per-frame extras (e.g. estimated muscle effort, labelled ESTIMATED).
   *Done:* in-game toss meets the racket at contact and the serve is struck.

9. **Generate, never hand-edit.** The script writes `src/serve/motion/<player>-tracked.js`; load it last for that
   player in `index.html` and bump the `?v=` cache key on every rebuild.
   *Done:* file regenerates from the tracks JSON with one command.

10. **Check in the game, from the user's end.** Drive `frame()` by hand in the hidden browser; measure joint jitter and
    bone lengths over the whole serve, near and far; screenshot trophy, contact and landing and compare side by side
    with stills from step 2. The near server shows his back, the racket in his real hand, toss arm out in front.
    *Done:* every phase matches the clip by eye, jitter and bone numbers reported, no console errors.

11. **Ship.** Note it in `src/serve/motion/MOTION_NOTES.md` and a `contemporary/` entry; commit, push `main`, rebuild
    and republish the demo (`python3 -I tools/build_demo_artifact.py`).

## What made it work

- **Each source answers only what it knows**: picture for in-plane direction, bone length for depth magnitude, 3D
  capture for depth sign, labels for angles. Never let the 3D capture decide what the picture shows.
- **Fixed bone lengths everywhere** — they turn a 2D track into 3D and stop limbs stretching.
- **Order: camera → torso → legs → arms → steady**, refitting the camera between stages.
- **Numbers at every step** (degrees, px, cm) so regressions show up immediately.
- **Eyes on the clip for events**: the inherited contact time was wrong until checked frame by frame.
