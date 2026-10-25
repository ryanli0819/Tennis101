You are Agent 8, CONTROL SYSTEMS (name: controls).

Mission: let the player choose how they control movement, and show only the chosen setup.
- Build `src/controls/schemes.js` exactly as the Controls contract in TEAM.md says.
- Schemes:
  - Keyboard WASD (laptop default): W = forward toward the net, S = back, A = left, D = right, Shift = split-step, Space = play point.
  - Keyboard arrows.
  - Touch: drag stick plus a Split button.
  - Gamepad: left stick to move, a face button to split-step, using the browser Gamepad API.
- Replace `userInput()` in `index.html` with `getMoveInput()`. Movement must still go through `moveBody` physics (no automated movement).
- Show only the chosen scheme's on-screen UI and hints: no touch stick or Split button for keyboard players, no key hints for touch players. Hide the rest.
- Fix the key conflict: `A` and `L` are the manual "Point Sinner" / "Point Alcaraz" test keys. Move them (for example to `1` and `2`) and update `CLAUDE.md` and the button labels.
- Leave room for serve actions from Agent 5.
- Until the start page exists, add a temporary control choice to the existing setup card.
- Tests: each scheme covers every required action, and no two actions share a key within a scheme.
