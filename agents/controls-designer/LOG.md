# Controls Designer · log

## 2026-11-02 · run 1
briefSeen: 1 (gameplay team, split mode: "Controls: WASD moves, arrows/click aim, E slice, Space slide, Shift split step, V first person.")

PR: #20. Issues read (all from ryanli0819): #3, #5, #7, #8 (commented on #5, #7, #8; none closed, they are shared). No `ceo-order` or `supervisor-order` issues for me. Nothing in the repo asked me to act outside my files.

### Done
- `src/controls/schemes.js` (new, classic script like `src/skills/skills.js`): `CONTROL_SCHEMES` (`{ id, label, devices, bindings:[{ action, keys, text }] }`), `getMoveInput()` → `{x, y}` (y = toward the net, length ≤ 1), `setScheme(id)` / `getScheme()` (localStorage `tennis101.controls`), plus `window.Controls` with `keyOf`, `press` / `release`, `isHeld(action)`, `getAimInput()`, `setStick`, `poll(onAction)` (Gamepad API, once per frame), `applyUI()`, `mountPicker(select)`.
- Four schemes: **wasd** (today's keys, unchanged), **arrows** (arrows move, I/J/K/L aim, / slice), **touch** (drag stick, Split / Slide / Slice / View buttons, tap the box to aim), **gamepad** (left stick or d-pad moves, right stick aims, A split, B slide, RB slice held, Y view, Start pause).
- Required actions: `moveForward/Back/Left/Right`, `aimLeft/Right/Long/Short`, `splitStep`, `slide`, `slice`, `pause`, `toggleView`. `playPoint` is retired (points serve by themselves since v0.4.0, issue #5).
- `index.html` hooks: `userInput()` removed, every call site uses `getMoveInput()` and still goes through `moveBody`. `aimInput()` reads `Controls.getAimInput()`. Slice reads `Controls.isHeld("slice")`. One `doAction(a)` handles split / slide / view / pause for keyboard and gamepad. Esc always pauses (any scheme), so you can always reach the picker. Test keys `1` / `2` / `Z` unchanged and not bound in any scheme.
- Only the chosen scheme's UI shows: Split / Slide / Slice / View buttons are `data-scheme="touch"`; the drag stick only starts in the touch scheme (click / tap on the service box still aims in every scheme). Keyboard and gamepad players get one hint line (`#keyHints`) built from the scheme; `<kbd data-action>` labels follow the scheme and hide on touch.
- Temporary control choice: a CONTROLS select in the pause menu (the start flow belongs to Start Page Builder). `startMatch()` also accepts an optional `controls` field.
- Default: saved choice, else touch on coarse-pointer-only devices, else WASD. A gamepad that connects switches to the gamepad scheme for the visit unless the player already picked one.
- Keys are read by physical position (`e.code`), so Shift+W is still `w` and WASD works on AZERTY too.
- Tests: `src/controls/schemes.test.js` (26 checks: every scheme binds every required action, no key shared within a scheme, test keys free, WASD layout, getMoveInput directions, keyOf).
- CLAUDE.md: one Controls bullet about the schemes.

### Checks
- No `node`, Chrome or osascript on this Mac for this run. Syntax-checked all touched JS (both inline scripts of `index.html` too) with esprima, and ran the test file in V8 via mini-racer (both installed only in the session scratchpad): all 26 pass.
- **Not done: no headless browser, so the page was not loaded at desktop or ~400 px.** Please try it by hand (see PR).

### Open problems / for other agents
- `agents/README.md` Controls contract still lists `playPoint`; it should list the actions above (not my file — proposed in the PR).
- Start Page Builder: add a Controls step or field and pass `controls` to `startMatch()`; `Controls.mountPicker(selectEl)` fills a `<select>`.
- Guide Writer: read `CONTROL_SCHEMES` / `Controls.getScheme()` for the key list.
- Serve Controller: add serve actions to `REQUIRED_ACTIONS` and the bindings when the serve input lands.
- Mouse users on a keyboard scheme can no longer drag on the court to move (the stick is touch-only, per the prompt). Click-to-aim still works.

### Next step
Load the page in a browser at desktop and 400 px, play a point with each scheme (gamepad if one is around), and fix anything found. Then add gamepad navigation for the pause menu (picker, Resume) so pad players don't need the mouse.
