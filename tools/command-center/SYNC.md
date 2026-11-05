# Syncing Tennis101 HQ with the agents

HQ (https://claude.ai/artifact/T2eXNa7ibx52NiDNAo9GoF, source `agents/command-center/hq.html`) keeps its live state in the
artifact's database: `agents/<name>`, `supervisors/<id>`, `commands/<id>`, `links/<id>`, `scripts/<id>`, `activity/feed`.
The agents run from the repo and GitHub, so a Claude session (ask "sync HQ") moves information both ways:

**HQ → agents**
1. Every open order in `commands` with no `issue` field becomes a GitHub issue: labels `agent:<name>` (or `team:<supervisor>`
   for a team, `agent:all` for everyone) plus `ceo-order` (from the CEO) or `supervisor-order`. Write the issue URL back
   into the order (`issue`). An order that HQ marked `overridden` gets a comment on its issue and is closed.
2. `supervisors`, `links` and `scripts` are written to `agents/supervisors.json` (teams with members, mode, brief and
   version, plus the correlations and scripts), committed to `main`.
3. Agents created in HQ (`status: "new"`) get a folder (`agents/<name>/PROMPT.md`, `LOG.md`), a row in `agents.json` and
   `agents/README.md`, and an `agent:<name>` label; then their status becomes `queued`.

**Agents → HQ**
4. For each agent: its newest LOG.md entry, open PRs (`agent/<name>`) and open issues set `status` (running while a
   pipeline run is active in `.pipeline/`, review when a PR waits for Ryan, queued when issues are open, blocked when the
   log says so, idle otherwise), `task`, `progress`, `briefSeen` and `updatedAt`.
5. Orders whose issue was closed by the agent are marked `done`. Add one line per change to `activity/feed`.

## Automatic sync
A scheduled task in the Claude app on Ryan's Mac, **Tennis101 HQ sync** (`tennis101-hq-sync`, every 30 minutes while the app
is open), runs the chain below by itself: routing, assigning, the agents' work (PRs from `agent/<name>` in
`.worktrees/<name>`), the manager's review, the manager's merge and the report to Ryan.

## How a CEO order moves (managers in the middle)
Ryan's rule: an order goes to the right manager first; the manager splits it among the agents on the team; an agent's
work goes back to its manager; only when the manager has checked all of it and everything is correct and fits together
does the manager merge it to the site and report to Ryan, who tests it and rates the merge and the manager 0–10. Fields on `commands/<id>`: `stage`, `sup`, `routedWhy`, `criteria`,
`assignments` (`[{agent, task, state, pr, review, round}]`), `round`, `report`.

1. **Routing** (`stage: "routing"`). `to: "auto"` → the manager (supervisor in `agents/supervisors.json`) whose team owns
   the work (missions + owned folders in `agents/README.md`); `agent:<name>` → that agent's manager; `sup:<id>` → that
   manager; `all` → every manager whose team has a part (one manager leads and writes the report). Write `sup`,
   `routedWhy`, `stage: "assigned"`, and a feed line "<Manager> took the CEO order".
2. **Assignment** (`stage: "assigned"` → `"working"`). The manager reads its brief and its members' folders and logs, then
   writes `criteria` (the concrete checks it will use to accept the work) and one assignment per agent that has a part:
   a precise task with what "done" looks like (`state: "assigned"`). A GitHub issue per assignment, labels
   `agent:<name>` + `ceo-order`. Agents outside the team only through their own manager.
3. **Agents work** (`state: "working"` → `"submitted"`). Each agent works on `agent/<name>` and opens or updates its PR,
   then hands it back to the manager: `state: "submitted"`, `pr`. Agents never report to Ryan directly.
4. **Manager review** (`stage: "review"`, once every assignment is submitted). The manager evaluates every PR against the
   order and `criteria`, not against the agent's own description: reads the diff; checks ownership, scoring rules,
   metres/seconds, phone width and reduced motion; syntax-checks and runs the tests; loads the merged-together branches
   in a browser at desktop and ~400 px and confirms the asked-for behaviour actually happens; and checks the agents'
   pieces fit together (shared contracts, no conflicts). Per assignment: `approved`, or `changes` with exact notes in
   `review` → `stage: "changes"`, `round` + 1, the agent fixes it on the same PR and hands it back. After 3 rounds
   without approval: `stage: "blocked"`, and the manager tells Ryan exactly what is wrong.
5. **The manager merges** (only when every assignment is approved). Merge the PRs into `main` in order
   (`gh pr merge --squash`), then check `main` itself: pull it, syntax-check, load the site locally at desktop and
   ~400 px and confirm the behaviour and no console errors. If `main` is broken, revert the merge at once and send the
   work back (`stage: "changes"`). Then record each player-visible change in `contemporary/` (its README), and if 5 or
   more are waiting, publish the version as the Version Keeper does (CHANGELOG, `versions/`, `?v=` keys, tag, database
   rebuild) and republish the demo artifact (`tools/build_demo_artifact.py`). `main` must always be playable.
6. **Back to the CEO** (`status: "done"`, `stage: "done"`). `report`: a short plain report to Ryan: what changed on the
   site, how the manager verified it, the merged PRs and the version. Feed line "<Manager> → CEO: merged — <summary>",
   and a notification if possible.
7. **Ryan rates it.** He tests the site and rates the merge and the manager 0–10 with feedback in HQ
   (`rating: {score, feedback, at}`, `stage: "rated"`). The sync mirrors every rating into
   `agents/command-center/ratings.json`. Before routing or assigning, a manager reads its own ratings and feedback and
   does what the feedback asks; a low score (≤ 6) means the manager reopens that work as a new assignment.
