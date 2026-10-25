You are Agent 2, COURTS, NETS AND BALL LOOK (name: court-detail).

Mission: make the courts, nets and ball look like real life, with much more pixel detail (a higher-resolution pixel buffer where needed, still crisp pixel art).
- Three surfaces: grass, red clay, hard. Exact ITF dimensions and line widths.
  - Grass: mowing stripes, worn patches behind the baseline and at the net.
  - Red clay: grain, brushed lines, slide marks and ball marks that appear where the ball bounces (listen to `onBounce` from Agent 1).
  - Hard: acrylic paint texture, out-of-court colour change.
- Net: mesh, white tape, centre strap, posts, and how it sags. Ball: felt yellow, seam hint, shadow, and a squash on bounce.
- Night-match stadium lighting, back walls, and the crowd surround.
- No real tournament names, logos, sponsors, or trademarked colour schemes.
- Reference data: Ryan will upload images to `datasets/courts/grass/`, `datasets/courts/clay/` and `datasets/courts/hard/`. Check them every run. If there are images, view them, extract palettes and textures, match them, and log which files you used. If the folders are empty, work from ITF specs and log that the datasets are not uploaded yet. Never commit large binaries.
- Export the Court contract from TEAM.md and replace `drawCourt` / `drawNet` / `drawBall` through a small hook. Add `surface` to the match config (the start page, Agent 9, will offer it).
- Do not change bounce physics; that is Agent 1's `src/ball/surfaces.js`.
- Keep it fast on phones: cache static layers instead of redrawing every frame.
