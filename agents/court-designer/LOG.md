# Court Designer · log

## 2026-11-04 · run 1
briefSeen: 1 (Look & World, share)

**Inputs checked**
- Issues for me from `ryanli0819`: #8 (move the stadium into `src/court/`, make it richer, ≤ ~3 ms/frame) and #3 (replace the `SURFACES` placeholder look; courts and nets must hold up under the net camera). No `ceo-order` or `supervisor-order` for me. No issues from anyone else were acted on.
- `datasets/courts/`: only `grass/reference.json` (Ryan's notes; the photos stay on his Mac). `clay/` and `hard/` are not uploaded yet, so clay and hard follow ITF specs and the existing `SCENES` palettes.
- Teammates (player-artist, appearance-scout, footage-scout): nothing that touches the court layer. Their outfit colours are drawn over my backgrounds; nothing they need from me this run.
- No `agents/supervisors.json` script fired for this run.

**What changed** (branch `agent/court-designer`)
- New `src/court/court.js`, a classic script loaded before the game script. It owns `SCENES`, `STADIUM`, the crowd, officials, surfaces, lines, net and ball, and exports `window.Court = { drawCourt, drawNet, drawBall, markBounce, reset, ... }` (Court contract in `agents/README.md`, unchanged).
- `index.html` hooks (kept small): one `<script>` tag, the old stadium/court/net/ball code removed, `Court.markBounce(x, y)` at the first bounce in `stepRally`, `Court.reset()` in `startMatch`. Light, shadows and `SURFACES` (pace and bounce belong to the Ball Physicist) stay in `index.html`.
- Stadium: 18 steeper tiers, three crowd texture sizes (far/mid/near), kids, empty seats, sun hats by day, a few people standing, wavers (two frames, frozen under reduced motion), section shading, darker top rows under the roof, handrails on aisles, tunnels in the lower tiers, a wall trim and kick plate, and floodlights with halos at night.
- Court level: chair umpire on a high chair, line judges, seated judges, ball kids at the net and corners, photographers with long lenses behind the far baseline.
- Surfaces: per-pixel grain that pans with the court (grass blades, clay grit, acrylic speckle). Grass: mowing stripes, worn baseline patches, a worn T and volley spots. Clay: drag-mat strips, scuffs, a groove under the net, **ball marks at every bounce**, slide streaks and dust puffs. Hard: shoe-rubber scuffs.
- Lines at ITF widths: 5 cm lines, 8 cm baselines, 10 cm centre marks, drawn as real quads with a 1 px core so they never vanish at a distance.
- Net (ITF): 1.07 m posts 0.914 m outside the doubles lines, singles sticks, a sag to 0.914 m at the centre strap, mesh no finer than 1 px, 6 cm tape, posts with caps and a winding handle.
- Ball: squashes for about 70 ms after each bounce.
- Speed: the static background is cached in its own canvas and redrawn only when the camera moves, the court changes, or the wavers' frame flips (twice a second).

**Fixes this run**
- The work above was left uncommitted by an interrupted earlier session. Reviewing it, I found `const HAIR` in court.js clashing with `const HAIR` in `index.html`, which would have thrown "already declared" and broken the whole game script. Renamed it `CROWD_HAIR`. Checked every other top-level name in court.js against `index.html` and `src/**`: no other clashes.
- Dust puffs are skipped under `prefers-reduced-motion`.

**Not verified (blocked)**
- No `node` on this Mac's PATH, and headless Chrome and `osascript` needed approval this non-interactive run couldn't give. So there was **no `node --check`, no browser load at desktop or 400 px, and no ms/frame timing**. Ryan or the next run must load the page (all three surfaces, plus the net camera) and watch the console before merging. A harness that starts a clay match and logs draw timing was written but couldn't be run.

**Open problems**
- The 3 ms budget isn't measured. When the camera pans (serve cam, net cam), the background redraws every frame: 18×72 stadium quads plus the grain fill.
- Clay and hard references aren't uploaded yet.
- The serve-cam inset (`drawServeInset` in `index.html`) still draws its own plain court; it could reuse `drawSurface`.

**Next step (tomorrow)**
1. Load the page headless (or ask Ryan to) on clay, grass and hard; fix any console errors; time `drawCourt` cached and uncached at 1280×800 and 400×800.
2. If uncached is over ~3 ms, cache the stadium projection per camera key and drop tiers that are off screen.
3. Then: a richer net up close (mesh knots, cord shadow on the court) and the serve inset using the shared surface drawing.
