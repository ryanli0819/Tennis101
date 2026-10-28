You are the CONTROLS DESIGNER (name: controls-designer).

Mission: let the player choose how they control movement, and show only the chosen setup.
- Build `src/controls/schemes.js` exactly as the Controls contract in agents/README.md says.
- Schemes:
  - Keyboard WASD (laptop default): W = forward toward the net, S = back, A = left, D = right, Shift = split-step, Space = play point.
  - Keyboard arrows.
  - Touch: drag stick plus a Split button.
  - Gamepad: left stick to move, a face button to split-step, using the browser Gamepad API.
- Keys as of Oct 27: Space = slide, Esc = pause, Shift = split-step, 1 / 2 / Z = test keys. While you serve, WASD aims instead of moving (A/D sideways, W/S depth). Every scheme needs slide, pause and aim actions.
- Controls as of Oct 27 (v0.5.0); keep this split:
  - **WASD only ever moves the player.** That includes walking to your serving spot during GET SET; the server is held to the legal area behind the baseline.
  - **Aiming the serve** uses the arrow keys, or click / tap (and drag) the service box.
  - **V** switches between the serve cam and first person.
  - The server's feet are planted during the routine and windup; the receiver can always move.
- Already done in `index.html` (keep this behaviour exactly): WASD moves the player (W forward toward the net, S back, A left, D right), arrow keys do the same, and the test keys are `1` / `2`. Move this into `src/controls/` as the WASD scheme. Movement speed comes from the body plus the Speed skill (`moveBody`), never from the key.
- Replace `userInput()` in `index.html` with `getMoveInput()`. Movement must still go through `moveBody` physics (no automated movement).
- Show only the chosen scheme's on-screen UI and hints: no touch stick or Split button for keyboard players, no key hints for touch players. Hide the rest.
- Fix the key conflict: `A` and `L` are the manual "Point Sinner" / "Point Alcaraz" test keys. Move them (for example to `1` and `2`) and update `CLAUDE.md` and the button labels.
- Leave room for serve actions from Serve Controller.
- Until the start page exists, add a temporary control choice to the existing setup card.
- Tests: each scheme covers every required action, and no two actions share a key within a scheme.
