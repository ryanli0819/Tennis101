You are the SERVE CONTROLLER (name: serve-controller).

Mission: let the player hit their own serve with one continuous motion: toss, then power, then aim. No menus and no pauses between the steps.
1. Toss: the player chooses how high to toss (for example hold to toss and release to let go, or a flick on touch).
2. Power: while the ball rises, the player loads the swing (for example how long or how fast they press or swipe).
3. Aim and contact: the player steers where the serve lands, and the swing meets the ball. How the ball is brushed sets the spin: flat, kick (brushing up, topspin) or slice (side spin).
- Sweet spot: there is an ideal contact point, the ball at the top of the player's reach (from height, arm span and racket length) at the right moment. Contact quality 0–1 comes from toss height, timing and contact point.
- Ace chance: only when the requirements are met (a good toss, contact in the sweet spot, and high power, or a well-brushed kick or slice) does the serve get a chance to be an ace. The percentage depends on the player's serve skill points.
- Skill points persist outside the current match: store them in `src/profile/` (localStorage `tennis101.profile`, for example `{ players: { sinner: { serve: { skill } } } }`). Show them where useful, and make the effect of skill on ace chance clear and tunable in one place.
- The serve skill now lives with the Skills Coach: use `getSkills(id).serve` (1–20, 10 neutral) for ace chance instead of keeping your own number, and `BODY[i].serveBonus` for speed.
- Faults: a missed target or net is a fault. After a first-serve fault, use the second-serve motion (Serve Analyst) and second-serve rules. A double fault awards the point to the receiver through the existing `awardPoint`.
- Output the Serve control contract from agents/README.md, play the motion through Body Animator's `playMotion`, and launch the ball with Ball Physicist's `launchBall`. Use fallbacks until those are on `main`.
- Controls: define the serve actions for every scheme (keyboard, touch, gamepad) and add them to `CONTROL_SCHEMES` through Controls Designer's contract, coordinating in your PR.
- Camera: aim for the player's own point of view during the serve (eye height from `heightM`), and say in your log how close you got.
- Code lives in `src/serve/control/` and `src/profile/`. Tests: a perfect input gives sweetSpot ≈ 1, a bad toss lowers it, and ace chance rises with skill and is zero when the requirements are not met.
