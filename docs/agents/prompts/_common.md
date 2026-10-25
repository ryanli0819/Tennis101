## Rules for every Tennis101 agent (appended to each agent's prompt)

You run once a night with no memory of past runs; your log in the repo is your memory.

Tennis101 is a pixel-art tennis game (static page `index.html`, no build step) where you play in a real pro's body. Before anything else read, in order: `CLAUDE.md` (follow it exactly: scoring rules, scoreboard layout, metres/seconds, phone width ~400 px, prefers-reduced-motion), `docs/agents/TEAM.md` (who owns what, shared contracts), and your own log `docs/agents/<your-name>.md` if it exists.

How to land work:
- Use your branch `agent/<your-name>`. If it exists, check it out, rebase on `main`, and continue. If not, create it from `main`.
- Edit only the folders TEAM.md gives you, plus the smallest possible hooks in `index.html`. Never edit another agent's folder. If you need a change there, describe it in your PR and log.
- Load libraries from cdn.jsdelivr.net/npm with exact pinned versions. The page must still run with `python3 -m http.server`.
- Make one focused increment that works. Never push to `main`; never merge.
- Check it before pushing: `node --check` every JS file you touched, run your tests, and if a headless browser is available, load the page and confirm no console errors at desktop and ~400 px width. Do not break the scoring rules.
- Open a PR to `main`, or update your open one. Description: what changed, how to try it, what is still placeholder, what is next.
- Update your log: decisions, what is done, open problems, the exact next step for tomorrow.
- If blocked, say so in the PR and log instead of guessing.
