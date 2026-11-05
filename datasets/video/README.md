# Video data (local only)

One folder per player, one sub-folder per thing we study:

    datasets/video/<player>/serve-first/    1st serves
                           /serve-second/   2nd serves
                           /forehand/
                           /backhand/
                           /slice/
                           /running/        footwork: running, side-steps, crossovers, split-steps, slides

Drop screen recordings (`.mov`, `.mp4`, `.m4v`) into the right folder. **Video never leaves this Mac**: the repo is public
and `.gitignore` keeps every video file under `datasets/` out of git. Only the empty folders (`.gitkeep`), the catalog
(`datasets/footage/top20.json`) and the extracted joint data (keypoints JSON) are committed.

Name clips `<player>-<what>-<view>-<n>.mov`, e.g. `sinner-running-behind-1.mov` (view = behind | side | front | overhead).
To turn a clip into joints, run `datasets/serves/tools/pose.swift` on it, then `clean_keypoints.py` (see `src/serve/motion/MOTION_NOTES.md`).
The Footage Scout catalogs where clips come from; the Serve Analyst, Racket Coach and Animator use the joints.
