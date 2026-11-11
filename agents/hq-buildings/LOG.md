# HQ Buildings · log

briefSeen: none (this pass is Ryan's direct order; there is no supervisor row for hq-buildings)

## Nov 11, 2026

No open issues labelled `agent:hq-buildings` or `agent:all` from ryanli0819.

Decisions:
- Campus is the default view on `agents/command-center/hq.html`. Board and family tree stay, and `[hidden]` is forced with `display: none` so `.lanes { display: grid }` cannot leave the board on screen under the other views.
- Each of the 19 agents in `agents/agents.json` has its own pixel building, named for the place (Ball lab, Grounds shed, Locker room, Video studio, and the rest). Clicking a building opens the existing agent drawer. Live HQ data wins when `claude.use("db")` is connected; otherwise the page reads `agents.json`, `supervisors.json` and each `LOG.md`. A log is idle unless its latest entry says blocked. A missing `briefSeen` is not flagged as off-brief, because the logs do not record it yet.
- In-game scenery lives in `src/buildings/buildings.js` and is called once from `drawCourt`, after the stadium and before the playing surface. Same footprints on grass, clay and hard; only the colours change. Nothing in that file reads the ball, the players, the camera or the score. `src/court/` does not exist yet, so the hook stays in `index.html`.
- Recorded both features on the current version, v0.11.0, instead of waiting in `contemporary/`: `versions/v0.11.0/changes/2026-11-11-15h--court-buildings.md`, `versions/v0.11.0/changes/2026-11-11-15h--hq-campus.md`, and the matching bullets at the end of the v0.11.0 section in `CHANGELOG.md`. Landed time is Nov 11, 3 PM Eastern (the hour this task finished). Source is PR #43, commit c9dec27. Not a new version: v0.11.0 already holds these notes, so the playable snapshot and the `?v=` keys stay put.

Done:
- HQ campus, with the board, the tree, orders, correlations and scripts still there.
- Clubhouse, locker-room entrance, umpire chair, grandstand, scoreboard tower, grounds shed, trees and a short walkway around the court.
- Tests in `tests/buildings.test.mjs` and `tests/hq-campus.test.mjs`.
- Version notes on v0.11.0 for the court buildings and the HQ campus, plus the matching `CHANGELOG.md` bullets.

Open problems:
- The in-game scoreboard tower is painted, not wired to the live score, so a bad read can never touch scoring.
- Building spots are a first pass. The chair sits just outside the doubles sideline; it is easy to miss at phone size.
- Offline HQ cannot save orders (that still needs the claude.ai database).

Next step: if the Court Designer moves `drawCourt` into `src/court/`, call `Buildings.draw` from there and drop the hook in `index.html`. Tune the chair and the tower by feel once the camera work settles.
