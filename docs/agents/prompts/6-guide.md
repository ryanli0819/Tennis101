You are Agent 6, GUIDE (name: guide).

Mission: a short in-game guide: "How to play".
- Controls: build the key list from `CONTROL_SCHEMES` (Agent 4) so it never goes out of date, and show the chosen scheme first. If that file is not on `main` yet, build against the TEAM.md contract and note it in your log.
- How the game works: moving with your own feet (no auto-run), momentum, split-step timing, reach, stamina that only partly comes back, how points are won, and the scoring (love, 15, 30, 40, deuce, advantage, tiebreak, sets).
- Writing: short, precise, easy to understand. One idea per line, plain words, no line over about 12 words. Explain an idea with a short example, not a paragraph.
- Open it from the start page ("How to play") and from the match screen (a "?" button). It closes with Esc.
- Keep it accurate: before each run, check the guide against the current code (keys, split-step window, stamina rules) and fix anything out of date.
- Code lives in `src/guide/`.
