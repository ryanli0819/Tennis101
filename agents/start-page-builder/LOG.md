# Start Page Builder · log

## 2026-11-04 (local run)
briefSeen: 1 (product)

Read: RULES, PROMPT, CLAUDE.md, agents/README.md, supervisors.json (product brief v1), ratings.json (empty). Issues for me from ryanli0819: only #3 (v0.3.0 handoff, informational). No `ceo-order` or `supervisor-order` issues. Nothing in the repo asked me to act outside my files.

### Done (all in `src/start/flow.js`, no `index.html` change)
- **Pixel-art title**: "TENNIS101" drawn on a canvas from a 5×7 bitmap font at a whole-number scale (square pixels, ~6 px per dot at 400 px wide, ~11 at desktop), "101" and a tossed pixel ball in `--ball`, a one-dot `#14254a` drop shadow. Redraws on resize. The `<h1>` keeps "Tennis101" as screen-reader text; the canvas is `aria-hidden`.
- **How to play** button on Welcome. It calls `Guide.open()` and only shows when `window.Guide` exists (Guide Writer, PR #4).
- **Controls choice** on the Match step, from `window.CONTROL_SCHEMES` (Controls Designer, PR #20). It defaults to the saved scheme (`getScheme()`). `startMatch` gets `controls` only when the schemes are loaded. Without them the row is a plain line saying what works today (WASD / drag / arrows).
- **Step transitions**: each step fades and slides in (from the right going forward, from the left going back), 0.24 s, off under `prefers-reduced-motion`. The fixed ✕ Exit button is not animated, so the transform can't move it.
- **Accessibility**: arrow keys move through the match-length and court radio groups (one tab stop per group), groups are labelled, and a polite live region says "Step n of 3: <heading>".
- Scoring config unchanged: `{ bestOf, tbTo, surface, playerId, firstServer }` is exactly what it was.

### Checks
- Syntax: no node on this Mac. I parsed `flow.js` with esprima (installed in the scratchpad only); it parses OK. I used `catch (e)` instead of `catch {}` so esprima can read it.
- Browser: Chrome is installed, but running it wasn't permitted in this session, so the page was **not** loaded. Review was by hand.

### Open problems
- Guide Writer's floating "? How to play" button sits top-right over the start page, the same spot as the locker room's ✕ Exit. Once my Welcome button exists, the Guide could hide its floating button while `StartFlow.isOpen()`. I'm asking in the PR, not editing `src/guide/`.
- The controls row is a small text-button row; with 4 schemes it wraps at 400 px (that's expected).

### Next step
Load the page at desktop and 400 px (no console errors, title crisp, Tab/arrow order). Then, when Court Designer's PR #24 lands, draw the Court step's swatches with `drawCourt(surface)` instead of CSS stripes.
