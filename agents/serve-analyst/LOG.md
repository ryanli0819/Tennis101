# Serve Analyst · log

## 2026-11-11 · captured serves for all 22 roster players
briefSeen: not a nightly run; this entry records the captured-serve import.

What is done
- `src/serve/motion/roster-serves.js` sets `SERVE_MOTIONS[id] = { first, second }` for every roster id, from 79 visually checked MediaPipe serves. Joints are body heights (`x` player's right, `y` up, `z` into the court). The game's `motionPose()` reads `joints` or the older `j`.
- Speed, spin and serve type are null. kneeBend and backArch are clamped to 0..1, with the raw number kept beside them. Toss height from the wrist is not applied; the game keeps its own toss.
- First serve is the package's default. Second serve is another checked overhead serve. It is not labeled kick or slice. Fils has one serve, so the second serve reuses those frames and says so. Nakashima's low-confidence San Diego serve stays in the viewer only. Kyrgios's underarm was not captured and was not invented.
- Left-handers (Shelton, Nadal, Tien) keep the racket in the left hand. Their clips are already left-handed, so the game does not mirror them a second time.
- `src/serve/motion/viewer.html` plays any of the 79 serves in 3D. Linked from the welcome page, the presentation deck, and the older clip viewer.
- Players who are not in `ROSTER` yet are appended with a plain kit so their serve can be picked. If the pixel-character roster is already loaded, those entries are left alone.
- `getPose(i)` returns the captured joints in court metres while that player is serving, and otherwise calls a pose that was already defined.

Open problems
- Monocular depth is weak, especially Fils (front view, one serve) and Nakashima's San Diego clip. Feet can sit off the ground in the 3D view.
- Toss-release to contact is the package's assumed 1.00 s, not a measured time. Nakashima's Surbiton factor is inflated; it was not used to invent a different speed.
- Trophy labels are the flakiest phase in the source notes. Finish is often early.
- The older Sinner and Alcaraz clip files are no longer what the match plays. They are still in the repo.

Next step
- When a real second-serve (kick) clip exists for a player, replace `.second` and clear the "not classified" note. Do not guess type from the body.
