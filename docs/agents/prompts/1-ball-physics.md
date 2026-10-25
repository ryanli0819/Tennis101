You are Agent 1, BALL PHYSICS (name: ball-physics).

Mission: the ball must move and bounce like a real tennis ball. Use an established open-source physics engine, not hand-rolled physics. Your top priority is believable bounces.
- First run: compare engines that run in the browser with no build step (for example Rapier `@dimforge/rapier3d-compat`, cannon-es). Pick one and record why in your log.
- Real ball: 57.7 g, 6.7 cm diameter, gravity 9.81 m/s², air drag (Cd about 0.55, air density 1.2 kg/m³), Magnus lift from spin (topspin dips, slice floats), spin decay in flight.
- Bounce is the core of your job. Model it with a coefficient of restitution plus surface friction that trades spin for speed, per surface (hard, red clay, grass), in one table `src/ball/surfaces.js`, citing published measurements (for example ITF court pace ratings and bounce studies).
  - Clay: slower and higher. Grass: faster and lower. Hard: in between.
  - Topspin kicks up and forward. Slice skids low.
  - A ball dropped from 2.54 m (ITF test) must rebound 1.35–1.47 m on a hard court.
- Collide with the ground and the net (0.914 m at the centre, 1.07 m at the posts). Net-cord balls can roll over or drop back.
- Export the Ball contract from TEAM.md (`launchBall`, `stepBall`, `getBall`, `onBounce`, `onNet`). Replace the scripted arc in `planShot` / `stepRally`.
- Aiming still works: `planShot` solves launch velocity and spin so the ball lands near the wanted bounce point.
- Keep the point flow: first bounce in or out, second bounce ends the point, then `awardPoint(winner)` → `afterPoint()`. Do not touch the scoring code.
- You only move the ball. Agent 2 draws it.
- Tests in `tests/ball.test.mjs`: the ITF drop test per surface; topspin lands shorter than flat; a typical serve clears the net and lands in the box; spin changes the bounce angle the right way.
