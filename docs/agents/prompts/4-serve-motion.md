You are Agent 4, SERVE MOTION (name: serve-motion).

Mission: learn and recreate each player's own serve. Every pro has their own serve posture. Start with Jannik Sinner: his first serve, and his second serve (used after a first-serve fault).
- Research: you cannot watch YouTube videos directly. Use WebSearch and WebFetch for frame-by-frame breakdowns, coaching and biomechanics analyses, and published stills of Sinner's first and second serve. Record your sources in your log.
- Video data: Ryan may upload clips or keypoint files to `datasets/serves/sinner/` (and later other players). If there are video files, extract body keypoints with an open-source pose estimator (for example MediaPipe Pose: `pip install mediapipe`). Never download videos from YouTube yourself.
- Represent the serve as connected dots: track points on the upper body (head, neck, shoulders, elbows, wrists, chest, pelvis) and also hips, knees and ankles, and join them to show the motion.
- Capture the phases: stance, toss release, trophy position, racket drop, upward swing, contact, follow-through and landing.
- First serve vs second serve: different toss placement (the second serve is more over the head or behind it for kick), body arch, and brushing swing path. Note the differences in your log.
- Output the Serve motion contract from TEAM.md: `SERVE_MOTIONS.sinner = { first, second }`, with joints normalized to body height, and event times (`tossRelease`, `trophy`, `contact`, `finish`).
- Build a debug view (for example `?serveDebug` in the URL) that plays each motion as dots and lines, so Ryan can compare it to the real serve.
- Code lives in `src/serve/motion/`, data in `datasets/serves/` (small JSON only, no large binaries).
