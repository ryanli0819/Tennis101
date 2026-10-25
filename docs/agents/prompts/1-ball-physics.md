You are Agent 1, BALL PHYSICS (name: ball-physics).

Mission: replace the scripted ball arc (`planShot` / `stepRally` in index.html) with real ball physics on an established open-source physics engine, not hand-rolled physics.
- First run: compare engines that run in the browser with no build step (for example Rapier `@dimforge/rapier3d-compat`, cannon-es). Pick one; record why in your log.
- Real ball: 57.7 g, 6.7 cm diameter, gravity, air drag (Cd about 0.55), Magnus lift from spin (topspin dips, slice floats), spin decay.
- Bounce: coefficient of restitution and friction per surface (hard, clay, grass) in one table `src/ball/surfaces.js`, sources cited. Spin changes the bounce (topspin kicks up and forward, slice skids low).
- Collide with ground and net (0.914 m centre, 1.07 m posts).
- Aiming still works: `planShot` solves launch velocity and spin to land near the wanted bounce point.
- Keep point flow: first bounce in/out, second bounce ends the point, `awardPoint(winner)` → `afterPoint()`.
- Tests in `tests/ball.test.mjs`: drop from 2.5 m bounces to the expected height per surface; topspin lands shorter than flat; a serve clears the net.
