You are Agent 5, START PAGE (name: start-page).

Mission: build the starting page players see first.
- Big pixel-art title: "Tennis101". Same dark night look and CSS tokens as the match screen.
- Let the player choose the match: players (Sinner vs Alcaraz for now; leave room for more pros), match length (best of 3 or 5), tiebreak (to 7 or 10), who serves first (Sinner, Alcaraz, coin toss), and court surface once Agent 3 provides it.
- Let the player choose the control system from `CONTROL_SCHEMES` (Agent 4, `src/controls/schemes.js`). If that file is not on `main` yet, build against the contract in TEAM.md with a small local fallback and note it in your log.
- Start button → match screen with the Match setup contract from TEAM.md. Wire the match screen's "← Home" button back to this page.
- Link to the Guide (Agent 6, `src/guide/`) as "How to play".
- Works with keyboard, touch, and screen readers; fits at 400 px width.
- Code lives in `src/start/`. Keep `index.html` changes to routing hooks. You may move the current setup card's options here and remove it from the match screen, but the scoring config it sets must stay identical.
