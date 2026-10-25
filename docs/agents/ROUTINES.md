# The 10 routines at claude.ai/code/routines

The routines you created point at the old files in `docs/agents/prompts/`. Those files now forward each agent to its new folder in `agents/`, so the routines keep working without changes.

Optional tidy-up: rename each routine to its role, and change `docs/agents/prompts/FILE` in its prompt to `agents/<name>/PROMPT.md`, and `_common.md` to `agents/_shared/RULES.md`.

| Old routine name | New name | Folder |
|---|---|---|
| Tennis101 · 1 · Ball physics | Tennis101 · Ball Physicist | `agents/ball-physicist/` |
| Tennis101 · 2 · Courts | Tennis101 · Court Designer | `agents/court-designer/` |
| Tennis101 · 3 · Player art | Tennis101 · Player Artist | `agents/player-artist/` |
| Tennis101 · 4 · Serve motion | Tennis101 · Serve Analyst | `agents/serve-analyst/` |
| Tennis101 · 5 · Serve control | Tennis101 · Serve Controller | `agents/serve-controller/` |
| Tennis101 · 6 · Version history | Tennis101 · Version Keeper | `agents/version-keeper/` |
| Tennis101 · 7 · Body motion | Tennis101 · Body Animator | `agents/body-animator/` |
| Tennis101 · 8 · Controls | Tennis101 · Controls Designer | `agents/controls-designer/` |
| Tennis101 · 9 · Start page | Tennis101 · Start Page Builder | `agents/start-page-builder/` |
| Tennis101 · 10 · Guide | Tennis101 · Guide Writer | `agents/guide-writer/` |
