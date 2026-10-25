# Tennis101 agent team

Cloud agents build the game in parallel, one nightly run each. Every agent:
- reads `CLAUDE.md`, this file, and its own log `docs/agents/<name>.md` first;
- works only on its branch `agent/<name>` and opens or updates one PR to `main` (never pushes to `main`, never merges);
- edits only the folders it owns below, plus the smallest possible hooks in `index.html`;
- keeps the page a static file with no build step (libraries from cdn.jsdelivr.net/npm, exact pinned versions);
- ends each run by updating its log: what is done, open problems, the exact next step.

| # | Agent | Branch | Owns | Runs (UTC) |
|---|---|---|---|---|
| 1 | Ball physics | `agent/ball-physics` | `src/ball/`, `tests/ball.test.mjs` | 05:00 |
| 2 | Body motion | `agent/body-motion` | `src/body/` | 06:00 |
| 3 | Court detail | `agent/court-detail` | `src/court/`, reads `datasets/courts/` | 07:00 |
| 4 | Control systems | `agent/controls` | `src/controls/` | 08:00 |
| 5 | Start page | `agent/start-page` | `src/start/` | 09:00 |
| 6 | Guide | `agent/guide` | `src/guide/` | 10:00 |

More agents will be added. Give each a new row before it starts.

## Shared contracts (keep these stable; change them only in your own PR and say so)

**Controls** (owned by Agent 4, used by 5 and 6). `src/controls/schemes.js` exports `CONTROL_SCHEMES`, a list of:

```js
{ id: "wasd", label: "Keyboard · WASD", devices: ["keyboard"],
  bindings: [{ action: "moveForward", keys: ["W"], text: "Move toward the net" }, ...] }
```

Actions every scheme must cover: `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `splitStep`, `playPoint`. Also `getMoveInput()` returns `{x, y}` in court axes (y = toward the net), and `setScheme(id)` / `getScheme()`, saved in localStorage (`tennis101.controls`). Only the chosen scheme's on-screen UI and hints are shown; the others are hidden.

**Match setup** (owned by Agent 5). The start page produces `{ bestOf: 3|5, tbTo: 7|10, firstServer: 0|1|"r", controls: <scheme id> }` and passes it to the match screen. Later agents may add fields (for example `surface`).

**Guide** (owned by Agent 6) builds its key list from `CONTROL_SCHEMES`, so it never goes out of date.

## Known conflicts to resolve
- WASD uses `A`, which is currently the "Point Sinner" test key, and `L` is "Point Alcaraz". Agent 4 moves the test keys (for example to `1` and `2`) and updates `CLAUDE.md`.
- `CLAUDE.md` lists the home page as lowest priority. Ryan has moved the start page up, so Agent 5 builds it now.
