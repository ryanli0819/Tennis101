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
