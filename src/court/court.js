/* =====================================================================
   COURT DESIGNER — src/court/court.js
   The world around the players: sky, the stadium bowl and its crowd, officials at court level, the court
   surface (grass / red clay / hard) with its texture and wear, the lines at their ITF widths, the net and
   the ball. Court contract (agents/README.md): drawCourt(surface), drawNet(), drawBall(ball).

   A classic script loaded before the game script. It only defines things at load time and draws with the
   game's globals at call time (proj, b, AS, q, BW, BH, F, HZ, CAM_BACK, CAM_H, CAM_X, COURT, cfg, SURF,
   SURFACES, LIGHT, litLeft, pos, gameT, clock). Pace and bounce in SURFACES belong to the Ball Physicist.

   Speed: the static background (sky, stands, crowd, court, lines, officials) is drawn into its own canvas
   and only redrawn when the camera moves or the crowd waves, so a still camera costs one drawImage a frame.
   Ball marks, slide marks and dust are drawn on top every frame.
   No real venue names, logos, sponsors or trademarked colour schemes.
   ===================================================================== */

/* Each surface has its own setting: grass = a summer afternoon, clay = a warm late afternoon, hard = a night
   session under floodlights. Grass colours follow Ryan's references (datasets/courts/grass/reference.json). */
const SCENES = {
  grass: { sky: ["#c9d1d7", "#d8dee2", "#e6eaec", "#eef0f0"], roof: "#8d969c", stands: "#2b2627", stairs: "#4a4446", wall: "#1f4a2c", trim: "#2e6b3e", lights: false, shade: 0.28,
           crowd: ["#e9e4dc", "#c9b8a6", "#7d6b62", "#3b3a44", "#b04a4a", "#4f6d8f", "#d8c27a", "#f2efe8", "#9aa7b6"], skin: ["#e1b48b", "#c99a72", "#f0c9a2", "#8a5a3c", "#5a3a2a"],
           hats: ["#f2efe8", "#e8dcc0", "#c9b48a", "#ffffff", "#3b3a44"], officials: { coat: "#2f4a3c", legs: "#efe9da" }, post: "#24382c" },
  clay:  { sky: ["#efcfa8", "#f3dcc0", "#f7e7d2", "#fbf2e6"], roof: "#b9a48e", stands: "#4a2f27", stairs: "#7a5848", wall: "#7a3a26", trim: "#a5523a", lights: false, shade: 0.22,
           crowd: ["#f1e6d6", "#d7b98f", "#8f5b46", "#33343d", "#c9504a", "#5b7aa0", "#e7c46a", "#fdf6ea", "#6f8b5a"], skin: ["#e9bd94", "#d4a07a", "#f4d1ad", "#8a5a3c", "#5a3a2a"],
           hats: ["#fdf6ea", "#e7c46a", "#d7b98f", "#ffffff"], officials: { coat: "#2a3348", legs: "#efe6d6" }, post: "#2c2c2e" },
  hard:  { sky: ["#04070d", "#070c17", "#0a1120", "#0d172b"], roof: "#1a2440", stands: "#0b1222", stairs: "#1d2a46", wall: "#14254a", trim: "#24427c", lights: true, shade: 0.4,
           crowd: ["#3a4d74", "#5a3f55", "#2f5b5a", "#6b5a3e", "#4b3a6e", "#7a7f92", "#9a8a6e", "#c7c2b6"], skin: ["#b98d6c", "#a07656", "#cfa585", "#6a4532", "#4a3022"],
           hats: null, officials: { coat: "#1c2638", legs: "#aeb4c2" }, post: "#232b3a" },
};
const SCENE = () => SCENES[cfg.surface] || SCENES.hard;

/* How each surface looks up close. grain: specks over the ground (one per buffer pixel, anchored to the court so
   it pans with the camera). Lines are tapes on clay, paint on grass and hard. */
const COURT_LOOK = {
  grass: { line: "#f4f4ee", grain: { n: 0.34, light: "rgba(198,224,132,0.30)", dark: "rgba(48,80,28,0.30)", blades: true } },
  clay:  { line: "#f1ebe2", grain: { n: 0.32, light: "rgba(240,162,120,0.32)", dark: "rgba(118,42,20,0.26)", grit: "rgba(252,238,222,0.40)" },
           brush: "rgba(236,150,110,0.10)", wear: "rgba(226,146,104,0.30)", mark: "rgba(112,40,20,0.55)", rim: "rgba(236,168,128,0.45)",
           slide: "rgba(226,150,112,0.50)", dust: [214, 128, 90] },
  hard:  { line: "#f4f6f8", grain: { n: 0.24, light: "rgba(255,255,255,0.07)", dark: "rgba(0,0,12,0.12)" }, scuff: "rgba(0,0,0,0.07)" },
};

/* THE STADIUM: an oval bowl all around the court — a low back wall, steep tiers of seating rising up and back,
   a roof ring on top. Built in court metres and projected like everything else, so it moves with the camera. */
const STADIUM = { tiers: 18, segs: 72, a0: 12.6, b0: 20.6, wallH: 1.3, rise: 0.95, step: 0.85, aisleEvery: 9 };
function ringPoint(k, j) {                               // tier k (0 = top of the back wall), angle slot j
  const S = STADIUM, ang = j / S.segs * Math.PI * 2;
  const grow = k < 0 ? 0 : 0.6 + k * S.step;             // tiers step back as they rise
  return { x: (S.a0 + grow) * Math.cos(ang), y: (S.b0 + grow) * Math.sin(ang), z: k < 0 ? 0 : S.wallH + k * S.rise };
}

const reducedMotionMQ = matchMedia("(prefers-reduced-motion: reduce)");
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* CROWD: rows of people packed shoulder to shoulder, back row first so each row hides the one behind.
   Three sizes (far, middle, near tiers). People vary: kids, empty seats, hats on a sunny day, a few standing,
   a few waving (two frames, the wavers' arms swap sides). */
const CROWD_SIZES = [
  { cw: 2, ch: 3, hx: 0, hw: 1, hh: 1, bw: 2, bh: 1 },
  { cw: 3, ch: 5, hx: 1, hw: 1, hh: 2, bw: 3, bh: 2 },
  { cw: 4, ch: 6, hx: 1, hw: 2, hh: 2, bw: 4, bh: 3 },
];
const CROWD_HAIR = ["#2a1c14", "#5a4232", "#c9b48a", "#1b1b1f", "#8a8a8a"];   // not HAIR: index.html has its own
let crowdPatterns = {};
function makeCrowd() { crowdPatterns = {}; grainPatterns = {}; bgKey = ""; }
function crowdPattern(surface, size, frame) {
  const key = surface + size + frame;
  if (crowdPatterns[key]) return crowdPatterns[key];
  const sc = SCENES[surface], Z = CROWD_SIZES[size], cols = 24, rows = 4;
  const c = document.createElement("canvas"); c.width = Z.cw * cols; c.height = Z.ch * rows;
  const g = c.getContext("2d"), rnd = seeded(surface.length * 97 + size * 31 + 7), pick = a => a[rnd() * a.length | 0];
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(0, 0, c.width, c.height, sc.stands);
  for (let r = 0; r < rows; r++) {
    const y0 = r * Z.ch;
    R(0, y0 + Z.ch - 1, c.width, 1, "rgba(0,0,0,0.35)");                  // the front edge of the row below their feet
    for (let k = 0; k < cols; k++) {
      const x = k * Z.cw + (r % 2), empty = rnd() < 0.04, kid = rnd() < 0.14, stand = rnd() < 0.05, wave = rnd() < 0.07;
      const shirt = pick(sc.crowd), skin = pick(sc.skin), hair = pick(CROWD_HAIR), hat = sc.hats && rnd() < 0.2 ? pick(sc.hats) : null;
      if (empty) { R(x, y0 + Z.ch - 2, Z.cw - 1, 1, shade(sc.stands, 0.25)); continue; }   // an empty seat
      const lift = stand ? Math.ceil(Z.ch * 0.5) : 0, top = y0 - lift + (kid ? 1 : 0), bw = kid ? Math.max(1, Z.bw - 1) : Z.bw;
      R(x, top + Z.hh, bw, Z.bh + lift - (kid ? 1 : 0), shirt);                                       // shoulders and body
      if (size === 2) R(x + bw - 1, top + Z.hh, 1, Z.bh + lift - (kid ? 1 : 0), shade(shirt, -0.22)); // shaded side
      R(x + Z.hx, top, Z.hw, Z.hh, skin);                                                             // head
      if (hat) R(x + Z.hx - (size === 2 ? 1 : 0), top, Z.hw + (size === 2 ? 2 : 0), 1, hat);          // hat (and brim up close)
      else if (Z.hh > 1 || rnd() < 0.3) R(x + Z.hx, top, Z.hw, 1, hair);                               // hair
      if (wave) {                                                                                    // an arm up, swapping sides
        const ax = (frame + k) % 2 ? x + bw : x - 1;
        R(ax, top - 1, 1, Z.hh + 1, skin);
      }
    }
  }
  return (crowdPatterns[key] = g.createPattern(c, "repeat"));
}

/* Ground grain: one speck per buffer pixel (crisp pixel art), cached per surface. */
let grainPatterns = {};
function grainPattern(surface) {
  if (grainPatterns[surface]) return grainPatterns[surface];
  const G = (COURT_LOOK[surface] || COURT_LOOK.hard).grain, c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"), rnd = seeded(surface.charCodeAt(0) * 131 + 3);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const v = rnd();
    if (G.grit && v < 0.02) { g.fillStyle = G.grit; g.fillRect(x, y, 1, 1); }
    else if (v < G.n) {
      const light = rnd() < 0.5;
      g.fillStyle = light ? G.light : G.dark; g.fillRect(x, y, 1, 1);
      if (G.blades && light && y < 31) { g.fillStyle = G.dark; g.fillRect(x, y + 1, 1, 1); }      // a blade: lit tip, dark root
    }
  }
  return (grainPatterns[surface] = g.createPattern(c, "repeat"));
}

/* World helpers: everything is given in court metres and projected. Nothing may reach behind the camera. */
const nearY = () => -CAM_BACK + 0.5;
function wpoly(pts, color) {
  b.fillStyle = color; b.beginPath();
  pts.forEach((p, i) => { const s = proj(p[0], p[1], p[2] || 0); i ? b.lineTo(s.x, s.y) : b.moveTo(s.x, s.y); });
  b.closePath(); b.fill();
}
function wrect(x0, y0, x1, y1, color) {                  // a flat rectangle on the ground
  y0 = Math.max(y0, nearY()); if (y1 <= y0) return;
  wpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color);
}
function wellipse(cx, cy, rx, ry, color, n = 14) {       // a flat ellipse on the ground
  if (cy - ry < nearY()) return;
  const pts = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  wpoly(pts, color);
}

function drawStadium(sc, surface, frame) {
  const S = STADIUM, quads = [];
  const P = []; for (let k = -1; k <= S.tiers + 1; k++) { P[k] = []; for (let j = 0; j <= S.segs; j++) { const r = ringPoint(Math.min(k, S.tiers), j % S.segs);
    if (k === S.tiers + 1) { r.x *= 1.06; r.y *= 1.04; r.z += 1.8; }      // the roof ring overhangs a little
    P[k][j] = { ...r, d: r.y + CAM_BACK, s: proj(r.x, r.y, r.z) }; } }
  for (let k = -1; k <= S.tiers; k++) for (let j = 0; j < S.segs; j++) {
    const c = [P[k][j], P[k][j + 1], P[k + 1][j + 1], P[k + 1][j]];
    if (c.some(v => v.d < 1.2)) continue;                // behind or right at the camera: not visible
    quads.push({ c, k, j, d: (c[0].d + c[1].d + c[2].d + c[3].d) / 4 });
  }
  quads.sort((a, c) => c.d - a.d);                       // far to near
  const lights = [];
  for (const qd of quads) {
    const pts = qd.c.map(v => v.s), { k, j } = qd, seat = k >= 0 && k < S.tiers;
    const aisle = j % S.aisleEvery === 0, tunnel = (k === 1 || k === 2) && j % (S.aisleEvery * 2) === 4;
    if (k === -1) b.fillStyle = sc.wall;                 // the back wall
    else if (k === S.tiers) b.fillStyle = sc.roof;       // the roof ring
    else if (tunnel) b.fillStyle = "#0a0809";            // a players' / spectators' tunnel in the lower tiers
    else if (aisle) b.fillStyle = sc.stairs;             // aisle steps
    else b.fillStyle = crowdPattern(surface, qd.d < 16 ? 2 : qd.d < 28 ? 1 : 0, frame);
    b.beginPath(); pts.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.closePath(); b.fill();
    if (seat) {
      // upper tiers sit in shade, the top rows under the roof most of all; sections alternate a touch
      const a = sc.shade * k / S.tiers + (Math.floor(j / S.aisleEvery) % 2 ? 0.035 : 0) + (!sc.lights && k >= S.tiers - 3 ? 0.14 : 0);
      b.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; b.fill();
      b.strokeStyle = "rgba(0,0,0,0.28)"; b.lineWidth = 1; b.beginPath(); b.moveTo(pts[0].x, pts[0].y); b.lineTo(pts[1].x, pts[1].y); b.stroke();
      if (aisle) { b.strokeStyle = "rgba(255,255,255,0.10)"; b.beginPath(); b.moveTo(pts[0].x, pts[0].y); b.lineTo(pts[3].x, pts[3].y); b.stroke(); }   // handrail
    }
    if (k === -1) {                                      // wall: a bright trim on top, a dark kick plate at the bottom
      b.strokeStyle = sc.trim; b.lineWidth = 1; b.beginPath(); b.moveTo(pts[3].x, pts[3].y); b.lineTo(pts[2].x, pts[2].y); b.stroke();
      b.strokeStyle = "rgba(0,0,0,0.3)"; b.beginPath(); b.moveTo(pts[0].x, pts[0].y); b.lineTo(pts[1].x, pts[1].y); b.stroke();
    }
    if (k === S.tiers) {                                 // the roof's underside casts a dark line over the top row
      b.strokeStyle = "rgba(0,0,0,0.45)"; b.lineWidth = 1; b.beginPath(); b.moveTo(pts[0].x, pts[0].y); b.lineTo(pts[1].x, pts[1].y); b.stroke();
      if (sc.lights && j % 6 === 0) lights.push(pts[3]);
    }
  }
  for (const m of lights) {                              // floodlights along the roof (night session), with a soft halo
    const x = Math.round(m.x), y = Math.round(m.y);
    b.fillStyle = "rgba(255,246,200,0.06)"; b.fillRect(x - 10, y - 5, 20, 10);
    b.fillStyle = "rgba(255,246,200,0.12)"; b.fillRect(x - 6, y - 3, 12, 6);
    b.fillStyle = "#fff6c8"; b.fillRect(x - 2, y - 1, 4, 2);
  }
}

/* COURT LEVEL: the chair umpire on a high chair by the net post, line judges along the back and side walls,
   ball kids at the net and the back corners, photographers crouched behind the far baseline. Static, so they live
   in the cached background. Positions stay inside the bowl's back wall. */
const OFFICIALS = (() => {
  const L = 11.885, list = [{ x: -7.4, y: 0, kind: "umpire" }];   // built at load time, before COURT exists
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) list.push({ x: sx * 4.1, y: sy * 18.0, kind: "judge" }, { x: sx * 9.2, y: sy * L, kind: "seated" }, { x: sx * 10.4, y: sy * 6.4, kind: "seated" },
                                         { x: sx * 7.3, y: sy * 14.8, kind: "kid" });
    list.push({ x: sx * 6.0, y: 15.6, kind: "photo" }, { x: sx * 6.7, y: 15.3, kind: "photo" }, { x: sx * 6.8, y: -sx * 0.9, kind: "kidNet" });
  }
  return list;
})();
function drawOfficials(sc) {
  const list = OFFICIALS.filter(o => o.y + CAM_BACK > 1.5).sort((a, c) => c.y - a.y);
  const R = (x, y, w, h, col) => { b.fillStyle = col; b.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  const skin = sc.skin[0], cam = "#16161a";
  for (const o of list) {
    const base = o.kind === "umpire" ? 1.9 : 0, g = proj(o.x, o.y, base), s = g.s, gx = g.x, gy = g.y;
    if (o.kind === "umpire") {                           // the high chair: two legs, rungs, a seat box
      const f = proj(o.x, o.y, 0), w = Math.max(2, 0.7 * s);
      R(f.x - w / 2, gy, 1, f.y - gy, "#c9c4b8"); R(f.x + w / 2 - 1, gy, 1, f.y - gy, "#c9c4b8");
      for (let k = 1; k < 4; k++) R(f.x - w / 2, gy + (f.y - gy) * k / 4, w, 1, "#a8a296");
      R(gx - w / 2 - 1, gy - 0.25 * s, w + 2, Math.max(1, 0.25 * s), sc.officials.coat);
    }
    const crouch = o.kind === "kid" || o.kind === "kidNet" || o.kind === "photo", seated = o.kind === "seated" || o.kind === "umpire";
    const H = (crouch ? 1.05 : seated ? 1.3 : 1.8) * s; if (H < 3) continue;
    const w = Math.max(1, 0.42 * s), legs = H * (crouch ? 0.32 : seated ? 0.3 : 0.46), body = H * (crouch ? 0.48 : 0.38), head = Math.max(1, H * 0.14);
    const kidCol = o.kind === "kid" || o.kind === "kidNet", coat = o.kind === "photo" ? "#24242a" : kidCol ? shade(sc.officials.coat, 0.35) : sc.officials.coat;
    if (seated && o.kind !== "umpire") R(gx - w * 0.8, gy - legs - body * 0.5, w * 1.6, body * 0.5 + legs, "#3a3a40");   // the chair
    R(gx - w * 0.75, gy, w * 1.5, 1, "rgba(0,0,0,0.25)");                                              // contact shadow
    R(gx - w / 2, gy - legs, w, legs, o.kind === "photo" ? "#2e2e34" : sc.officials.legs);             // legs
    R(gx - w / 2 - (w > 2 ? 1 : 0), gy - legs - body, w + (w > 2 ? 2 : 0), body, coat);               // jacket / shirt
    R(gx - head / 2, gy - legs - body - head, head, head, skin);                                       // head
    if (o.kind === "judge" || o.kind === "umpire") R(gx - head / 2, gy - legs - body - head, head, Math.max(1, head * 0.35), sc.officials.legs);   // hat
    if (o.kind === "photo") {                            // a long lens pointing at the court, with a glint
      const lw = Math.max(1, 0.35 * s), ly = gy - legs - body * 0.7, dir = o.x < 0 ? 1 : -1;
      R(dir > 0 ? gx + w / 2 : gx - w / 2 - lw, ly, lw, Math.max(1, 0.12 * s), cam);
      R(dir > 0 ? gx + w / 2 + lw - 1 : gx - w / 2 - lw, ly, 1, 1, "#9fb0c8");
    }
  }
}

/* The court surface, its wear and its lines (ITF: lines 2.5–5 cm, the baseline up to 10 cm, centre mark 10 cm long).
   Each line is a real-width quad plus a 1-pixel core so far lines never vanish; up close (net camera) it is wide. */
const LINE_W = 0.05, BASE_W = 0.08, MARK_L = 0.10;
function courtLines() {
  const { L, DBL, SGL, SVC } = COURT, h = LINE_W / 2;
  return [
    [-DBL, L - BASE_W, DBL, L], [-DBL, -L, DBL, -L + BASE_W],                     // baselines
    [-DBL, -L, -DBL + LINE_W, L], [DBL - LINE_W, -L, DBL, L],                    // doubles sidelines
    [-SGL, -L, -SGL + LINE_W, L], [SGL - LINE_W, -L, SGL, L],                    // singles sidelines
    [-SGL, SVC - LINE_W, SGL, SVC], [-SGL, -SVC, SGL, -SVC + LINE_W],            // service lines
    [-h, -SVC, h, SVC],                                                          // centre service line
    [-h, L - BASE_W - MARK_L, h, L - BASE_W], [-h, -L + BASE_W, h, -L + BASE_W + MARK_L],   // centre marks
  ];
}
function drawLines(color) {
  b.strokeStyle = color; b.lineWidth = 1;
  for (const [x0, y0, x1, y1] of courtLines()) {
    const ya = Math.max(y0, nearY()); if (y1 <= ya) continue;
    const along = y1 - y0 > x1 - x0, mx = (x0 + x1) / 2, my = (ya + y1) / 2;
    const a = along ? proj(mx, ya) : proj(x0, my), c = along ? proj(mx, y1) : proj(x1, my);
    b.beginPath(); b.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); b.lineTo(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5); b.stroke();
    wrect(x0, ya, x1, y1, color);
  }
}

function drawSurface(surface, sc) {
  const su = SURFACES[surface] || SURFACES.hard, lk = COURT_LOOK[surface] || COURT_LOOK.hard, { L, DBL, SGL, SVC } = COURT;
  wrect(-DBL, -L, DBL, L, su.court);                      // the playing surface
  if (surface === "grass") {                              // mowing stripes across the court, inside the bowl's back wall
    for (let y0 = -19.5, k = 0; y0 < 19.5; y0 += 1.5, k++) if (k % 2) wrect(-11, y0, 11, y0 + 1.5, su.stripe);
    for (const sy of [-1, 1]) {                           // worn to sand behind each baseline, thinning at the edges
      wellipse(0, sy * (L + 0.7), 3.4, 1.9, "rgba(185,163,106,0.45)");
      wellipse(0, sy * (L + 0.5), 2.3, 1.2, su.worn);
      wrect(-3.6, sy > 0 ? L - 0.5 : -L - 0.2, 3.6, sy > 0 ? L + 0.2 : -L + 0.5, "rgba(185,163,106,0.5)");
      wellipse(0, sy * SVC, 1.0, 0.55, "rgba(185,163,106,0.28)");              // the T, where serves land and players split
      for (const sx of [-1, 1]) wellipse(sx * 1.6, sy * 2.6, 1.1, 0.8, "rgba(185,163,106,0.18)");   // volley spots by the net
    }
  } else if (surface === "clay") {
    for (let x = -12.1, k = 0; x < 12; x += 1.1, k++) if (k % 2) wrect(x, -19.5, x + 1.1, 19.5, lk.brush);   // drag-mat strips
    for (const sy of [-1, 1]) wellipse(0, sy * (L + 0.8), 3.2, 1.5, lk.wear);  // scuffed behind the baselines
  } else {
    for (const sy of [-1, 1]) for (const [x, rx] of [[0, 2.6], [-1.6, 1.2], [1.7, 1.0]]) wellipse(x, sy * (L + 0.6), rx, 0.7, lk.scuff);   // shoe rubber
  }
  const gp = grainPattern(surface);                       // specks over the court; they pan with the court
  if (gp.setTransform) { const o = proj(0, 0); gp.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(o.x), Math.round(o.y)])); }
  b.fillStyle = gp; b.fillRect(0, Math.max(0, Math.round(HZ)), BW, BH);
  drawLines(lk.line);
  if (surface === "clay") wrect(-SGL, -0.04, SGL, 0.04, "rgba(120,44,22,0.18)");   // the groove under the net
}

/* The whole static background, drawn into the cache. */
function drawBackground(surface, frame) {
  const sc = SCENES[surface] || SCENES.hard, su = SURFACES[surface] || SURFACES.hard;
  const skyEnd = Math.max(1, Math.round(HZ));             // sky in flat pixel bands down to the horizon, ground below
  sc.sky.forEach((c, k) => { b.fillStyle = c; b.fillRect(0, Math.floor(skyEnd * k / sc.sky.length), BW, Math.ceil(skyEnd / sc.sky.length) + 1); });
  b.fillStyle = su.runoff; b.fillRect(0, skyEnd, BW, BH - skyEnd);
  // The camera is always inside the bowl, so the ground goes first and the stands simply cover whatever ground
  // lies beyond the back wall (no stripes or shade painted over the seats).
  drawSurface(surface, sc);
  const st = LIGHT().stand;
  if (st) {                                               // the stands' shadow over part of the court, with a soft edge
    const y0 = Math.max(st.y0, nearY()), y1 = Math.max(y0 + 0.1, st.y1);
    for (let k = 0; k < 3; k++) {
      const g = k * 0.6, e = { x0: st.x0 === -14 ? st.x0 : st.x0 + g, x1: st.x1 === 14 ? st.x1 : st.x1 - g, y0: st.y0 === -20 ? y0 : y0 + g, y1 };
      wrect(e.x0, e.y0, e.x1, e.y1, `rgba(10,14,30,${(st.a / 3).toFixed(3)})`);
    }
  }
  drawStadium(sc, surface, frame);
  drawOfficials(sc);
}

/* MARKS: on clay the ball leaves an oval mark where it bounces and kicks up a little dust; sliding scrapes a light
   streak. They stay for the match (real clay is only brushed at set breaks) and clear on a new match or court.
   Every bounce also squashes the ball for a moment (all surfaces). */
const marks = { surface: null, bounces: [], slides: [[], []], puffs: [], lastBounce: -9 };
function resetMarks() { marks.surface = cfg.surface; marks.bounces = []; marks.slides = [[], []]; marks.puffs = []; marks.lastBounce = -9; }
function markBounce(x, y) {
  if (marks.surface !== cfg.surface) resetMarks();
  marks.lastBounce = gameT;
  if (cfg.surface !== "clay") return;
  marks.bounces.push({ x, y }); if (marks.bounces.length > 120) marks.bounces.shift();
  marks.puffs.push({ x, y, t: gameT, n: 7 }); if (marks.puffs.length > 12) marks.puffs.shift();
}
function trackSlides() {
  for (const i of [0, 1]) {
    const p = pos[i], trails = marks.slides[i];
    if (!(p.slide > 0)) { if (trails.length && trails[trails.length - 1].length) trails.push([]); continue; }
    if (!trails.length) trails.push([]);
    const tr = trails[trails.length - 1], last = tr[tr.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.12) {
      tr.push({ x: p.x, y: p.y });
      if (tr.length % 3 === 1) marks.puffs.push({ x: p.x, y: p.y, t: gameT, n: 4 });
    }
    while (trails.length > 24) trails.shift();
  }
}
function drawMarks() {
  if (marks.surface !== cfg.surface) resetMarks();
  if (cfg.surface !== "clay") return;
  const lk = COURT_LOOK.clay;
  trackSlides();
  for (const tr of marks.slides) for (const t of tr) for (let k = 1; k < t.length; k++) {   // slide streaks, 24 cm wide
    const a = t[k - 1], c = t[k], d = Math.hypot(c.x - a.x, c.y - a.y) || 1, nx = -(c.y - a.y) / d * 0.12, ny = (c.x - a.x) / d * 0.12;
    if (Math.min(a.y, c.y) - 0.2 < nearY()) continue;
    wpoly([[a.x + nx, a.y + ny], [c.x + nx, c.y + ny], [c.x - nx, c.y - ny], [a.x - nx, a.y - ny]], lk.slide);
  }
  for (const m of marks.bounces) {                       // ball marks: a dark oval with a lighter rim, never under a pixel
    if (m.y - 0.2 < nearY()) continue;
    const g = proj(m.x, m.y), ry = Math.max(0.5, Math.abs(proj(m.x, m.y + 0.09).y - proj(m.x, m.y - 0.09).y) / 2), rx = Math.max(0.7, 0.05 * g.s);
    b.fillStyle = lk.rim; b.beginPath(); b.ellipse(g.x, g.y, rx + 0.6, ry + 0.4, 0, 0, Math.PI * 2); b.fill();
    b.fillStyle = lk.mark; b.beginPath(); b.ellipse(g.x, g.y, rx, ry, 0, 0, Math.PI * 2); b.fill();
  }
  const [r, gC, bC] = lk.dust;
  marks.puffs = reducedMotionMQ.matches ? [] : marks.puffs.filter(f => gameT - f.t < 0.5);
  for (const f of marks.puffs) {                         // dust: a ring of grains thrown out and up, settling
    const u = (gameT - f.t) / 0.5;
    for (let k = 0; k < f.n; k++) {
      const a = k / f.n * Math.PI * 2 + f.x * 3, rr = 0.06 + 0.3 * u, p = proj(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.6, 0.18 * Math.sin(Math.PI * u) * (0.6 + 0.4 * (k % 2)));
      b.fillStyle = `rgba(${r},${gC},${bC},${(0.7 * (1 - u)).toFixed(3)})`; b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
}

/* drawCourt(surface): the cached background, then this frame's marks. */
const bgCanvas = document.createElement("canvas"), bgCtx = bgCanvas.getContext("2d");
let bgKey = "";
function drawCourt(surface = cfg.surface) {
  const frame = reducedMotionMQ.matches ? 0 : Math.floor(gameT / 0.55) % 2;     // the wavers' arms swap twice a second
  const key = [surface, BW, BH, F.toFixed(2), HZ.toFixed(2), CAM_BACK.toFixed(2), CAM_H.toFixed(2), CAM_X.toFixed(2), frame].join();
  if (key !== bgKey) {
    if (bgCanvas.width !== BW || bgCanvas.height !== BH) { bgCanvas.width = BW; bgCanvas.height = BH; }
    const keep = b; b = bgCtx;
    try { drawBackground(surface, frame); } finally { b = keep; }
    bgKey = key;
  }
  b.drawImage(bgCanvas, 0, 0);
  drawMarks();
}

/* THE NET (ITF): 0.914 m at the centre strap, 1.07 m at the posts, posts 0.914 m outside the doubles sidelines and
   singles sticks 0.914 m outside the singles sidelines (the net is 1.07 m at the sticks, then sags to the strap).
   Mesh about 4.5 cm (never denser than one pixel), white tape 6 cm, a 5 cm centre strap, round posts with caps. */
const NET = { post: 6.4, stick: 5.029, hp: 1.07, hc: 0.914, tape: 0.06, strap: 0.05 };
const netTop = x => { const a = Math.abs(x); return a >= NET.stick ? NET.hp : NET.hc + (NET.hp - NET.hc) * Math.pow(a / NET.stick, 1.4); };
function drawNet() {
  const N = NET, xs = []; for (let k = 0; k <= 32; k++) xs.push(-N.post + 2 * N.post * k / 32);
  const s0 = proj(0, 0).s, fine = 1 / AS, sc = SCENE();
  const path = (top, bot) => { b.beginPath(); top.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); for (let i = bot.length - 1; i >= 0; i--) b.lineTo(bot[i].x, bot[i].y); b.closePath(); };
  const top = xs.map(x => proj(x, 0, netTop(x))), under = xs.map(x => proj(x, 0, netTop(x) - N.tape)), bot = xs.map(x => proj(x, 0, 0));
  b.fillStyle = "rgba(16,20,28,0.5)"; path(under, bot); b.fill();                         // the net, see-through
  const cell = Math.max(0.045, 1.1 / s0);                                                 // mesh spacing in metres (≥ ~1 buffer pixel)
  b.strokeStyle = "rgba(214,222,234,0.16)"; b.lineWidth = fine; b.beginPath();
  for (let x = -N.post + cell; x < N.post; x += cell) { const a = proj(x, 0, 0), c = proj(x, 0, netTop(x) - N.tape); b.moveTo(q(a.x), a.y); b.lineTo(q(c.x), c.y); }
  for (let z = cell; z < N.hp - N.tape; z += cell) xs.forEach((x, i) => { const p = proj(x, 0, Math.min(z, netTop(x) - N.tape)); i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y); });
  b.stroke();
  b.strokeStyle = "rgba(10,12,18,0.55)"; b.lineWidth = Math.max(fine, 0.02 * s0);         // bottom cord
  b.beginPath(); b.moveTo(bot[0].x, bot[0].y); b.lineTo(bot[bot.length - 1].x, bot[bot.length - 1].y); b.stroke();
  b.fillStyle = "#f4f6f8"; path(top, under); b.fill();                                   // white tape over the cable
  b.strokeStyle = "#f4f6f8"; b.lineWidth = fine; b.beginPath(); top.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.stroke();
  b.strokeStyle = "rgba(160,168,180,0.7)"; b.beginPath(); under.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.stroke();   // tape's lower stitch
  { const h = Math.max(N.strap / 2, fine / s0), a = proj(-h, 0, 0), c = proj(h, 0, N.hc);   // centre strap down to the ground anchor
    b.fillStyle = "#f4f6f8"; b.fillRect(q(a.x), c.y, Math.max(fine, q(c.x - a.x)), a.y - c.y);
    b.fillStyle = "#9aa2ae"; b.fillRect(q(a.x) - fine, a.y - fine, Math.max(fine, q(c.x - a.x)) + 2 * fine, fine); }
  const lx = litLeft() ? -1 : 1;
  const pole = (x, w, h, col, cap) => {                  // a round pole: dark body, lit edge, a cap
    const hw = Math.max(fine, w / 2 * s0), a = proj(x, 0, 0), c = proj(x, 0, h);
    b.fillStyle = col; b.fillRect(q(a.x - hw), c.y, q(2 * hw) || fine, a.y - c.y);
    b.fillStyle = shade(col, 0.35); b.fillRect(q(a.x + lx * hw * 0.5) - (lx > 0 ? fine : 0), c.y, fine, a.y - c.y);
    if (cap) { b.fillStyle = shade(col, 0.2); b.fillRect(q(a.x - hw) - fine, c.y - fine * 2, q(2 * hw) + 2 * fine, fine * 2); }
  };
  for (const sx of [-1, 1]) { pole(sx * N.stick, 0.06, N.hp, "#e6e6df", false); pole(sx * N.post, 0.1, N.hp + 0.03, sc.post, true); }
  { const a = proj(N.post + 0.05, 0, 0.8); b.fillStyle = "#9aa2ae"; b.fillRect(q(a.x), a.y, Math.max(fine, 0.04 * s0), Math.max(fine, 0.03 * s0)); }   // winding handle
}

/* THE BALL: round, optic yellow felt, lit from the light side and shaded on the other, a white seam that turns
   with its spin, a fuzzy edge, and a faint trail when it flies fast. For ~70 ms after a bounce it squashes flat
   against the ground. (Its shadow is drawn by drawShadows.) */
const BALL_R = 0.1;                                      // drawn radius in metres: ~3× real, so it reads at any distance
function drawBall(ball, inset = false) {
  const p = proj(ball.x, ball.y, ball.z), r = Math.min(9, Math.max(2.2, BALL_R * p.s)), cx = q(p.x), cy = q(p.y);
  const tr = ball._trail || (ball._trail = []);
  const sp = tr.length ? Math.hypot(ball.x - tr[0].x, ball.y - tr[0].y, ball.z - tr[0].z) : 0;
  if (sp > 0.12 && !reducedMotionMQ.matches)            // moving fast: a short fading trail
    tr.slice(0, 3).forEach((o, k) => { const t = proj(o.x, o.y, o.z);
      b.fillStyle = `rgba(216,238,76,${0.22 - k * 0.06})`; b.beginPath(); b.arc(q(t.x), q(t.y), r * (0.9 - k * 0.15), 0, Math.PI * 2); b.fill(); });
  if (!inset) { tr.unshift({ x: ball.x, y: ball.y, z: ball.z }); tr.length = Math.min(tr.length, 4); }
  const since = gameT - marks.lastBounce, squash = since >= 0 && since < 0.07 && ball.z < 0.15 ? 1 - since / 0.07 : 0;
  const sx = 1 + 0.3 * squash, sy = 1 - 0.32 * squash;
  const lx = litLeft() ? -1 : 1, night = !LIGHT().sun;
  b.save();
  if (squash) { b.translate(cx, cy + r * (1 - sy)); b.scale(sx, sy); b.translate(-cx, -cy); }   // flattened, still sitting on the ground
  b.beginPath(); b.arc(cx, cy, r, 0, Math.PI * 2); b.clip();
  b.fillStyle = "#a9c02c"; b.fillRect(cx - r, cy - r, r * 2, r * 2);                         // shaded side
  b.fillStyle = "#d6ec3e"; b.beginPath(); b.arc(cx + lx * r * 0.28, cy - r * 0.24, r * 0.95, 0, Math.PI * 2); b.fill();   // lit felt
  b.fillStyle = "#f2fb9a"; b.beginPath(); b.arc(cx + lx * r * 0.42, cy - r * 0.42, r * (night ? 0.24 : 0.32), 0, Math.PI * 2); b.fill();   // highlight
  const th = (clock || gameT) * 11 + ball.x;                                               // the seam turns with the spin
  b.strokeStyle = "rgba(250,250,238,0.95)"; b.lineWidth = Math.max(1 / AS, r * 0.16);
  b.beginPath(); b.ellipse(cx - Math.cos(th) * r * 0.55, cy - Math.sin(th) * r * 0.55, r * 0.75, r * 0.5, th, -1.1, 1.1); b.stroke();
  b.beginPath(); b.ellipse(cx + Math.cos(th) * r * 0.55, cy + Math.sin(th) * r * 0.55, r * 0.75, r * 0.5, th + Math.PI, -1.1, 1.1); b.stroke();
  b.restore();
  b.fillStyle = "rgba(226,244,120,0.55)";                                                  // felt fuzz around the edge
  for (let k = 0; k < 10; k++) { const a = k * 0.628 + th * 0.2; b.fillRect(q(cx + Math.cos(a) * r * sx) - 0.5 / AS, q(cy + r * (1 - sy) + Math.sin(a) * r * sy) - 0.5 / AS, 1 / AS, 1 / AS); }
}

window.Court = { drawCourt, drawNet, drawBall, markBounce, reset: resetMarks, SCENES, STADIUM, COURT_LOOK };
