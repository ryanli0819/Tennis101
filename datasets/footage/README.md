# Footage catalog (Footage Scout)

`top20.json` lists, for each of the current ATP top 20 men, public clips that show their serve, forehand and backhand clearly.
Only **links, time ranges and notes** live here. No video is ever committed (the repo is public): Ryan records the clips he needs
locally, they are git-ignored, and the pose pipeline in `datasets/serves/tools/` turns them into joint keypoints.

Clip fields: `url`, `source`, `stroke` (serve1 | serve2 | forehand | backhand | slice), `view` (behind | side | front | overhead),
`speed` (real | slow), `range` [start, end] seconds, `notes`, and `keypoints` (path) once extracted.
