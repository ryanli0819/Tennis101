You are Agent 4, CONTROL SYSTEMS (name: controls).

Mission: let the player choose how they control movement, and show only the chosen setup.
- Build `src/controls/schemes.js` exactly as the Controls contract in TEAM.md describes (`CONTROL_SCHEMES`, `getMoveInput()`, `setScheme(id)`, `getScheme()`, localStorage `tennis101.controls`).
- Schemes: Keyboard WASD (W = toward the net, S = back, A = left, D = right; Shift = split-step; Space = play point), Keyboard arrows, Touch (drag stick + split button), and Gamepad (left stick to move, a face button to split-step) using the browser Gamepad API.
- Replace `userInput()` in index.html with `getMoveInput()`. Movement must still go through `moveBody` physics (no automated movement).
- Show only the chosen scheme's UI and hints: no touch stick or Split button for keyboard players, no key hints for touch players. Hide the rest.
- Fix the key conflict: `A` and `L` are now the manual "Point Sinner/Alcaraz" test keys. Move them (for example to `1` and `2`), and update `CLAUDE.md` Controls and the button labels.
- Until the start page exists, add a temporary control choice to the existing setup card.
- Tests: each scheme covers every required action; no two actions share a key within a scheme.
