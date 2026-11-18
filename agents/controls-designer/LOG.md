# Controls Designer · log

The Controls Designer writes here at the end of every run: what is done, open problems, and the exact next step.

## 2026-11-18 · HQ-20261118-002.GP.1 · touch gestures for Slide, Split step and Slice
briefSeen: 1 (Gameplay & Physics)

Why: Ryan ordered no on-screen buttons during play and no selectable text on phones. Front-end Menus Builder (HQ-20261118-002) removes the HUD buttons; Slide, Split step and Slice buttons were the only phone route to those moves.

Done (branch `agent/controls-designer-hq-20261118-002`, off origin/main 2e7ac5b; not pushed):
- `src/controls/gestures.js` (new, pure, no DOM): `TouchGestures.create()` classifies touch pointers.
  double-tap → split step · short flick DOWN → slide · short flick SIDEWAYS → slice (toggle armed).
  Flick UP (toward the opponent, reserved for shot aiming), two-finger tap (pause, WF), long press, diagonals, slow drags: nothing.
  A finger that landed within 300 ms of another finger while both were down, or any 3rd finger, never counts.
- `index.html`: loads it; pointer handlers feed it (touch only, never the serve-aim finger, never while aiming);
  a 2nd finger no longer steals or ends the move stick; gestures call `splitStep(0)`, `slide(0)`, `toggleSlice()` after the stick lets go.
- New shared hook `setSliceArmed(on)` (+ `toggleSlice()`): the Slice button and hitBall's one-shot disarm use it; it updates
  `#sliceBtn` only if that button exists. E held is unchanged (separate from "armed").
- Armed cue: the reach ring turns a steady brighter white, 2 px (no text, no animation, so reduced-motion is fine).
- Tests: `src/controls/gestures.test.mjs` (8/8). Headless touch test (CDP Input.dispatchTouchEvent) in
  HQ work dir `work/HQ-20261118-002.GP.1/controls-designer/evidence/touch-gestures.headless.mjs`: 20/20 at 400×800 and 20/20 at 667×375, pageErrors [].
- Full node suite: before 37 tests / 35 pass / 2 fail; after 45 / 43 / 2 (the same 2 serve-motion failures, pre-existing on main).

Open problems:
- The near player (and so the slice cue) is under the HUD buttons/scoreboard at the baseline on phones until WF's button removal lands.
- In first person (`pov`) the reach ring is not drawn, so the armed cue is not visible there (serve cam only, where slice is irrelevant).
- A quick (<250 ms, ≥40 px) downward or sideways jab of the stick finger is read as a flick; holds and normal drags are not.
- No real-device check (iOS Safari / Android Chrome); only headless Chrome touch emulation.
- `CONTROL_SCHEMES` (agents/README.md line 51) still does not exist on main; gestures should be listed there when it is built.

Next step: after Gameplay & Physics Manager REVIEW-PASS, push and open a sibling PR to main (merges before WF's button removal);
then add the gesture bindings to `src/controls/schemes.js` / CONTROL_SCHEMES and the Guide.
