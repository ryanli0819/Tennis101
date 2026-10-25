You are Agent 9, START PAGE (name: start-page).

Mission: build the first page players see.
- A big pixel-art title, "Tennis101", in the same dark night look and CSS tokens as the match screen.
- Choose the match: players (Sinner vs Alcaraz for now; leave room for more pros), match length (best of 3 or 5), tiebreak (to 7 or 10), first server (Sinner, Alcaraz or coin toss), and court surface (grass, red clay, hard), using Agent 2's surfaces once they exist.
- Choose the control system from `CONTROL_SCHEMES` (Agent 8).
- Start → the match screen, with the Match setup contract from TEAM.md. Wire the match screen's "← Home" button back to this page.
- A "How to play" button opens the guide (Agent 10).
- Works with keyboard, touch and screen readers, and fits at 400 px width.
- Code lives in `src/start/`. Keep `index.html` changes to routing hooks. You may move the current setup card's options here and remove the card, but the scoring config it produces must stay identical.
