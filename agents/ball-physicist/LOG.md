# Ball Physicist · log

## 2026-11-02 · run 1 (local, Ryan's Mac)
briefSeen: 1 (Gameplay & Physics, split)

**Issues read** (opened by ryanli0819): #8 (slice: model real backspin) and #2 (skill points: one point = one constant m/s step). No ceo-order or supervisor-order issues were open. Nothing in the repo asked me to act outside my files.

### Engine choice
- **cannon-es 0.20.0** (MIT, pure JS, from jsdelivr, pinned), over Rapier (`@dimforge/rapier3d-compat`). Reasons:
  - It's synchronous and has no WASM. Rapier-compat ships ~1.5 MB of base64 WASM with an async init, and needs physics hooks to change contacts.
  - The same file runs in Node for the tests.
  - It's easy to step one fixed step at a time.
- Neither engine's contact model can produce a tennis bounce. Cannon's friction is capped at μ·m·g per step, almost nothing in a 4 ms impact, and a 5 mm net is crossed in one step at 50 m/s. So:
  - **Cannon integrates the ball:** gravity, our air forces, spin decay via angular damping. The court and net are static trigger bodies.
  - **The contact laws are tennis ones:** a grip-slip bounce (Cross 2002) from `src/ball/surfaces.js`, and a swept test against the net cord and cloth.
- **Aim solver:** it needs ~80 flights per shot, so it uses a predictor that copies cannon's step exactly (forces → angular damping → v += a·dt → x += v·dt, fixed dt 1/480 s). A test checks predictor and engine agree within 2 cm.
- **Offline fallback:** if cannon can't load (offline `file://`), the live ball runs on the predictor. The physics is the same.

### Done
- `src/ball/surfaces.js`: one table (e, eSlope, μ, ex per surface), with sources: ITF Appendix I drop test, ITF Court Pace Rating categories, Cross 2002, Brody/Cross/Lindsey 2002, Haake et al. 2003.
- `src/ball/ball.js`: the contract as `Ball.launchBall`, `stepBall`, `getBall`, `onBounce`, `onNet`, plus `predict`, `solveShot`, `spinFor`, `setSurface` and `init`.
  - Ball: 57.7 g, R 3.35 cm.
  - Air: drag Cd 0.55, ρ 1.2. Magnus Cl = 1/(2 + v/Rω), capped at 0.35. Spin decay τ 6 s (an estimate).
  - Net: 0.914 m at the centre, 1.07 m at the posts (x = ±6.40).
  - Spin: top/back, side (curves in the air) and gyro (kicks at the bounce; the kick serve uses it).
- `src/ball/shots.js`: the game side. It is **opt-in: `?ball=physics`**, remembered in localStorage `tennis101.ball`; `?ball=scripted` switches back.
  - `planShot` still picks the bounce spot. `physShot` solves the launch and predicts the receiver's contact point. The AI runs there, and the racket times its swing from `t1 + 0.85·t2`.
  - `stepPhysShot` judges the point from the real ball: out, NET, fault, let on a cord touch, second bounce.
- `index.html`: 3 script tags + 2 one-line hooks (`planShot`, `stepRally`). The scripted arc is untouched and still the default.
- `tests/ball.test.mjs` (node:test). It covers:
  - the ITF drop test per surface
  - topspin lands shorter than flat; backspin floats longer
  - spin changes the bounce angle (topspin lower and faster, backspin steeper and slower)
  - 1st and 2nd serves clear the net and land in the box on every surface
  - the kick serve is higher and turns >4° at the bounce
  - clay is slower and higher, grass faster and lower
  - the slice is low, checks up on clay and skids on grass
  - net cord: over, back, and cloth
  - skill speed steps are exact
  - aim error is under 10 cm
  - engine and predictor agree
- `src/ball/check/`: a Python mirror of the same physics (`mirror.py`), the same assertions (`mirror_tests.py`), and a bracket/string checker (`jscheck.py`).

### Numbers (from the Python mirror)
- **Drop test from 2.54 m:** hard 1.40 m (ITF 1.35–1.47), clay 1.47, grass 1.20.
- **30 m/s at 16° (ITF pace-style test), speed along the court after the bounce:** clay 17.0, hard 20.0, grass 22.0 m/s.
- **A 28 m/s topspin drive, height when it reaches the baseline (+0.5 m):** clay 0.99 m, hard 0.93 m, grass 0.81 m.
- **Slice:** 15 m/s with 2400 rpm backspin lands 3.5 m past the net. It peaks at 0.9–1.1 m after the bounce. Speed along the court after the bounce: clay 2.7, hard 4.0, grass 5.4 m/s.
- **Serves:**
  - 1st serve at 40 m/s: −3.8°, crosses the net at 1.34 m, 28 m/s at the bounce.
  - 2nd kick at 32 m/s with 3800 rpm: crosses at 1.63 m.
- **Drive speeds:** these are now **25–34 m/s** + `shotBonus`, up from 19–28, because real drag slows them. Flight time stays ~0.7–1.2 s.
  - The slice is now 13.5–17 m/s + 0.3·`shotBonus`, up from 10.5–14.5.
  - Serves are unchanged: 40 / 32 + `serveBonus`.
  - One skill point still adds exactly +0.6 / +0.9 m/s off the racket (tested). Drag takes a little of that by the bounce.

### Open problems / blocked
- **No JS runtime on this machine.** There is no `node`; `jsc` and `osascript` need approval in this non-interactive run, and there's no headless browser. So I could **not** run `node --check`, `tests/ball.test.mjs`, or load the page. I checked the physics with the Python mirror (20/20 assertions pass) and the JS syntax by reading and with a bracket/string scan. That is why physics stays opt-in.
- The cannon-es API details I rely on (World.step(dt), applyForce, angularDamping as pow(1−d, dt), isTrigger) come from reading its source, not from a run.
- Serve outcomes in physics mode come from the real bounce: fault if outside the box, LET if the cord was touched or `planServe` said let. `planServe`'s `ace` flag is still used. A planned net serve is struck 3.5–5° low.
- The old `SURFACES.pace/bounce` in `index.html` still drive the scripted arc. Remove them when physics becomes the default.
- Spin decay τ, cord restitution (0.3) and the grip spring-back `ex` are estimates.

### Next step (tomorrow)
1. On a machine with Node 18+, run `node tests/ball.test.mjs`. Fix anything that fails; the Python mirror says every assertion should pass.
2. Run `python3 -m http.server`, open `/?ball=physics`, and play points on all 3 surfaces at desktop and ~400 px with no console errors. Check that the AI reaches balls, faults and lets are called, and slices bring the receiver forward.
3. If all is good, make physics the default (flip `PHYS_BALL`), and remove the scripted arc and the `pace`/`bounce` fields in the same PR.
