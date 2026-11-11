// =====================================================================
// BUILDINGS — pixel scenery around the court. Drawn from index.html
// after the stadium and before the playing surface.
//
// This file only paints. It does not move the ball, the players, the
// camera or the score, and it adds no collision. Footprints stay outside
// the doubles court (x ±5.485 m, y ±11.885 m) and inside the stadium bowl
// (ellipse 12.6 m × 20.6 m) so the lines, the net and the crowd stay put.
// The same buildings stand on every surface; colours follow the surface
// (grass afternoon, clay late day, hard night).
//
// Buildings.pieces(surface) → scenery records
// Buildings.palette(surface) → colours
// Buildings.draw(ctx, project, surface, camBack)
//   project(x, y, z) → { x, y } in the same buffer as drawCourt.
// =====================================================================
(function (root) {
  // Metres. y grows toward the far baseline; the broadcast camera sits at −y.
  const PIECES = [
    { id: "clubhouse", name: "Clubhouse", kind: "house", x: -9.0, y: -6.2, w: 2.8, d: 2.4, h: 3.5 },
    { id: "tree-near", name: "Tree", kind: "tree", x: 8.05, y: -8.15, w: 1.05, d: 1.05, h: 2.4 },
    { id: "locker", name: "Locker room", kind: "locker", x: 6.4, y: -6.0, w: 2.8, d: 2.4, h: 2.9 },
    { id: "walkway", name: "Walkway", kind: "path", x: 6.15, y: -3.5, w: 0.42, d: 0.85, h: 0.04 },
    { id: "tree-left", name: "Tree", kind: "tree", x: -7.3, y: -1.7, w: 1.05, d: 1.05, h: 2.6 },
    { id: "umpire", name: "Umpire chair", kind: "chair", x: 6.55, y: -2.45, w: 1.5, d: 1.2, h: 3.8 },
    { id: "tree-right", name: "Tree", kind: "tree", x: 8.15, y: 1.35, w: 1.05, d: 1.05, h: 2.5 },
    { id: "shed", name: "Grounds shed", kind: "shed", x: -9.4, y: 2.8, w: 2.6, d: 2.0, h: 2.35 },
    { id: "stand", name: "Grandstand", kind: "stand", x: 6.5, y: 4.6, w: 2.5, d: 4.6, h: 2.1 },
    { id: "tree-far", name: "Tree", kind: "tree", x: -7.7, y: 9.4, w: 1.05, d: 1.05, h: 2.3 },
    { id: "tower", name: "Scoreboard", kind: "tower", x: -8.0, y: 12.55, w: 1.8, d: 1.25, h: 6.6 },
  ];

  const PALETTES = {
    grass: {
      wall: "#f4f1e4", wallSide: "#ddd4c0", roof: "#245c38", roofSide: "#1a4329",
      trim: "#f7f7f2", door: "#6a4324", glass: "#b7d4ea", canopy: "#f4f7f2",
      seat: "#1f5a36", seatAlt: "#17462b", board: "#102818", boardInk: "#d8ee4c",
      trunk: "#6b4a2c", leaf: "#3d8a46", leafDark: "#2a6834",
      path: "#d9c49a", shadow: "rgba(16,32,16,0.30)",
      crowd: ["#f2efe8", "#c9b8a6", "#b04a4a", "#4f6d8f", "#2a1c14", "#d8c27a"],
    },
    clay: {
      wall: "#f6e6d2", wallSide: "#e4cbb0", roof: "#9a4630", roofSide: "#7a3422",
      trim: "#fbf3ea", door: "#5c3318", glass: "#f0d2a4", canopy: "#f8efe4",
      seat: "#7a3a26", seatAlt: "#5c2c1c", board: "#3a2018", boardInk: "#f2d07a",
      trunk: "#6a4030", leaf: "#4e8740", leafDark: "#3a6830",
      path: "#e6c8a4", shadow: "rgba(60,28,14,0.28)",
      crowd: ["#f1e6d6", "#d7b98f", "#c9504a", "#5b7aa0", "#3a241c", "#e7c46a"],
    },
    hard: {
      wall: "#1a2c52", wallSide: "#121e38", roof: "#0c162c", roofSide: "#0a1222",
      trim: "#c5d4f2", door: "#0c1424", glass: "#fff3c4", canopy: "#d5e2ff",
      seat: "#162848", seatAlt: "#101c34", board: "#070d18", boardInk: "#d8ee4c",
      trunk: "#3a3228", leaf: "#1c4a36", leafDark: "#143628",
      path: "#8ea0b8", shadow: "rgba(0,0,0,0.45)",
      crowd: ["#3a4d74", "#5a3f55", "#c7c2b6", "#6b5a3e", "#2a1c14", "#9a8a6e"],
    },
  };

  function palette(surface) {
    return PALETTES[surface] || PALETTES.hard;
  }

  function pieces(surface) {
    return PIECES.map(p => ({ ...p, surface: PALETTES[surface] ? surface : "hard" }));
  }

  function pt(project, x, y, z) {
    const p = project(x, y, z || 0);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return p;
  }

  function fillPoly(ctx, pts) {
    if (!pts || pts.some(p => !p)) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }

  function quad(ctx, project, color, corners) {
    ctx.fillStyle = color;
    fillPoly(ctx, corners.map(c => pt(project, c[0], c[1], c[2])));
  }

  // A box. The camera looks from −y, so the south face (smaller y) is the front,
  // and the side face is the one turned toward centre court.
  function prism(ctx, project, x, y, w, d, z0, z1, front, side, top) {
    const cx = x + w / 2;
    const sx = cx >= 0 ? x : x + w;
    ctx.fillStyle = side;
    fillPoly(ctx, [pt(project, sx, y, z0), pt(project, sx, y + d, z0), pt(project, sx, y + d, z1), pt(project, sx, y, z1)]);
    if (top) quad(ctx, project, top, [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]]);
    quad(ctx, project, front, [[x, y, z0], [x + w, y, z0], [x + w, y, z1], [x, y, z1]]);
  }

  function shadow(ctx, project, p, pal) {
    const { x, y, w, d } = p;
    quad(ctx, project, pal.shadow, [
      [x + 0.12, y + 0.12, 0.01], [x + w + 0.28, y + 0.18, 0.01],
      [x + w + 0.36, y + d + 0.32, 0.01], [x + 0.08, y + d + 0.22, 0.01],
    ]);
  }

  function pitched(ctx, project, x, y, w, d, h, rise, pal) {
    const mid = y + d * 0.5;
    quad(ctx, project, pal.roofSide, [[x, y + d, h], [x + w, y + d, h], [x + w, mid, h + rise], [x, mid, h + rise]]);
    quad(ctx, project, pal.roof, [[x - 0.06, y - 0.02, h], [x + w + 0.06, y - 0.02, h], [x + w, mid, h + rise], [x, mid, h + rise]]);
  }

  function drawHouse(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    const rise = 0.85;
    shadow(ctx, project, p, pal);
    prism(ctx, project, x, y, w, d, 0, h, pal.wall, pal.wallSide, pal.roofSide);
    pitched(ctx, project, x, y, w, d, h, rise, pal);
    // chimney, toward the back so the ridge still reads
    prism(ctx, project, x + w * 0.72, y + d * 0.55, 0.42, 0.42, h * 0.55, h + rise + 0.55, pal.wallSide, pal.door, pal.door);
    const wz = h * 0.48, wh = h * 0.22, ww = 0.55;
    quad(ctx, project, pal.glass, [[x + 0.35, y - 0.04, wz], [x + 0.35 + ww, y - 0.04, wz], [x + 0.35 + ww, y - 0.04, wz + wh], [x + 0.35, y - 0.04, wz + wh]]);
    quad(ctx, project, pal.glass, [[x + w - 0.9, y - 0.04, wz], [x + w - 0.35, y - 0.04, wz], [x + w - 0.35, y - 0.04, wz + wh], [x + w - 0.9, y - 0.04, wz + wh]]);
    quad(ctx, project, pal.door, [[x + w * 0.38, y - 0.04, 0], [x + w * 0.62, y - 0.04, 0], [x + w * 0.62, y - 0.04, h * 0.42], [x + w * 0.38, y - 0.04, h * 0.42]]);
    // static flag (no animation — stays still under reduced motion too)
    prism(ctx, project, x + 0.35, y + d * 0.2, 0.08, 0.08, h + rise * 0.4, h + rise + 0.9, pal.trim, pal.trim, pal.trim);
    quad(ctx, project, pal.roof, [[x + 0.43, y + d * 0.2, h + rise + 0.55], [x + 1.05, y + d * 0.2, h + rise + 0.7], [x + 1.05, y + d * 0.2, h + rise + 0.95], [x + 0.43, y + d * 0.2, h + rise + 0.8]]);
  }

  function drawShed(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    shadow(ctx, project, p, pal);
    prism(ctx, project, x, y, w, d, 0, h, pal.wall, pal.wallSide, pal.roofSide);
    pitched(ctx, project, x, y, w, d, h, 0.6, pal);
    quad(ctx, project, pal.door, [[x + 0.3, y - 0.04, 0], [x + w * 0.55, y - 0.04, 0], [x + w * 0.55, y - 0.04, h * 0.62], [x + 0.3, y - 0.04, h * 0.62]]);
    quad(ctx, project, pal.glass, [[x + w * 0.68, y - 0.04, h * 0.4], [x + w * 0.9, y - 0.04, h * 0.4], [x + w * 0.9, y - 0.04, h * 0.68], [x + w * 0.68, y - 0.04, h * 0.68]]);
    // water butt beside the door
    prism(ctx, project, x + w * 0.62, y - 0.35, 0.45, 0.45, 0, 0.7, pal.door, pal.wallSide, pal.roofSide);
  }

  function drawLocker(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    shadow(ctx, project, p, pal);
    prism(ctx, project, x, y, w, d, 0, h, pal.wall, pal.wallSide, pal.roof);
    // striped awning over the entrance
    quad(ctx, project, pal.roof, [[x + 0.15, y + 0.15, h * 0.62], [x + w - 0.15, y + 0.15, h * 0.62], [x + w - 0.3, y - 0.7, h * 0.5], [x + 0.3, y - 0.7, h * 0.5]]);
    quad(ctx, project, pal.trim, [[x + 0.15, y + 0.12, h * 0.56], [x + w - 0.15, y + 0.12, h * 0.56], [x + w - 0.28, y - 0.55, h * 0.46], [x + 0.28, y - 0.55, h * 0.46]]);
    const doors = 3;
    for (let i = 0; i < doors; i++) {
      const dx = x + 0.28 + i * ((w - 0.5) / doors);
      const dw = (w - 0.7) / doors;
      quad(ctx, project, i === 1 ? pal.door : pal.wallSide, [[dx, y - 0.04, 0], [dx + dw, y - 0.04, 0], [dx + dw, y - 0.04, h * 0.48], [dx, y - 0.04, h * 0.48]]);
    }
    // bench just in front of the doors, still on the building's side of the walkway
    prism(ctx, project, x + 0.45, y - 0.55, w - 0.9, 0.32, 0, 0.42, pal.door, pal.wallSide, pal.trim);
  }

  function drawChair(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    const seat = h * 0.48;
    shadow(ctx, project, p, pal);
    // step ladder up to the seat
    prism(ctx, project, x + w * 0.28, y - 0.55, w * 0.44, 0.5, 0, seat * 0.55, pal.wallSide, pal.door, pal.trim);
    prism(ctx, project, x, y, w, d, seat * 0.85, seat, pal.trim, pal.wallSide, pal.trim);
    // legs
    prism(ctx, project, x + 0.08, y + 0.08, 0.12, 0.12, 0, seat * 0.85, pal.door, pal.door, pal.door);
    prism(ctx, project, x + w - 0.2, y + 0.08, 0.12, 0.12, 0, seat * 0.85, pal.door, pal.door, pal.door);
    // back of the chair, on the far side
    prism(ctx, project, x + 0.12, y + d - 0.16, w - 0.24, 0.12, seat, seat + h * 0.28, pal.wall, pal.wallSide, pal.trim);
    // umbrella
    prism(ctx, project, x + w * 0.48, y + d * 0.4, 0.08, 0.08, seat, h, pal.trim, pal.trim, pal.trim);
    prism(ctx, project, x - 0.35, y - 0.28, w + 0.7, d + 0.5, h - 0.1, h + 0.08, pal.canopy, pal.trim, pal.canopy);
    // a bright rim so the chair reads against the stands
    quad(ctx, project, pal.boardInk, [[x - 0.35, y - 0.3, h + 0.02], [x + w + 0.35, y - 0.3, h + 0.02], [x + w + 0.35, y - 0.3, h + 0.1], [x - 0.35, y - 0.3, h + 0.1]]);
  }

  function drawStand(ctx, project, p, pal) {
    const { x, y, w, d } = p;
    const rows = 4;
    shadow(ctx, project, p, pal);
    for (let i = rows - 1; i >= 0; i--) {
      const yy = y + (d / rows) * i;
      const dd = d / rows + 0.04;
      const z1 = 0.48 * (i + 1);
      const col = i % 2 ? pal.seat : pal.seatAlt;
      prism(ctx, project, x + i * 0.08, yy, w - i * 0.08, dd, 0, z1, col, pal.wallSide, pal.roofSide);
      const seats = 5;
      for (let s = 0; s < seats; s++) {
        const hx = x + 0.22 + i * 0.08 + s * ((w - 0.5) / seats);
        prism(ctx, project, hx, yy - 0.02, 0.22, 0.22, z1, z1 + 0.28, pal.crowd[(i + s) % pal.crowd.length], pal.door, pal.crowd[(i * 2 + s) % pal.crowd.length]);
      }
    }
    // a short roof over the back row, so it reads as a grandstand rather than steps
    const zTop = 0.48 * rows + 0.7;
    prism(ctx, project, x - 0.1, y + d * 0.72, w + 0.2, d * 0.28, zTop, zTop + 0.12, pal.roof, pal.roofSide, pal.roof);
  }

  function drawTower(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    shadow(ctx, project, p, pal);
    prism(ctx, project, x + w * 0.22, y + d * 0.15, w * 0.56, d * 0.7, 0, h * 0.62, pal.wall, pal.wallSide, pal.roofSide);
    // board facing the camera
    const bz0 = h * 0.58, bz1 = h * 0.9;
    prism(ctx, project, x - 0.12, y - 0.05, w + 0.24, d * 0.55, bz0, bz1, pal.board, pal.wallSide, pal.roof);
    // two rows of blocks, a scoreboard rather than the live score
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const bx = x + 0.08 + col * (w / 3.3);
        const bz = bz0 + 0.18 + row * ((bz1 - bz0) * 0.38);
        quad(ctx, project, pal.boardInk, [[bx, y - 0.1, bz], [bx + 0.28, y - 0.1, bz], [bx + 0.28, y - 0.1, bz + 0.16], [bx, y - 0.1, bz + 0.16]]);
      }
    }
    prism(ctx, project, x + w * 0.3, y + d * 0.2, w * 0.4, d * 0.45, bz1, h, pal.wallSide, pal.door, pal.roof);
    // lamp: warm at night (glass), cool trim by day — same quad either way
    quad(ctx, project, pal.glass, [[x + w * 0.42, y + d * 0.15, h - 0.08], [x + w * 0.58, y + d * 0.15, h - 0.08], [x + w * 0.58, y + d * 0.15, h + 0.18], [x + w * 0.42, y + d * 0.15, h + 0.18]]);
  }

  function drawTree(ctx, project, p, pal) {
    const { x, y, w, d, h } = p;
    const cx = x + w / 2, cy = y + d / 2;
    shadow(ctx, project, p, pal);
    prism(ctx, project, cx - 0.1, cy - 0.1, 0.2, 0.2, 0, h * 0.42, pal.trunk, pal.door, pal.trunk);
    prism(ctx, project, x, y, w, d, h * 0.32, h * 0.62, pal.leaf, pal.leafDark, pal.leaf);
    prism(ctx, project, x + w * 0.15, y + d * 0.12, w * 0.7, d * 0.7, h * 0.55, h * 0.82, pal.leafDark, pal.leaf, pal.leaf);
    prism(ctx, project, x + w * 0.3, y + d * 0.28, w * 0.4, d * 0.42, h * 0.75, h, pal.leaf, pal.leafDark, pal.leaf);
  }

  function drawPath(ctx, project, p, pal) {
    const { x, y, w, d } = p;
    quad(ctx, project, pal.path, [[x, y, 0.03], [x + w, y, 0.03], [x + w, y + d, 0.03], [x, y + d, 0.03]]);
  }

  const DRAW = {
    house: drawHouse, shed: drawShed, locker: drawLocker, chair: drawChair,
    stand: drawStand, tower: drawTower, tree: drawTree, path: drawPath,
  };

  function draw(ctx, project, surface, camBack) {
    if (!ctx || typeof project !== "function") return;
    const pal = palette(surface);
    const back = Number.isFinite(camBack) ? camBack : 19;
    const list = pieces(surface).filter(p => p.y + back > 1.2).sort((a, b) => b.y - a.y);
    ctx.save();
    try {
      for (const p of list) (DRAW[p.kind] || drawHouse)(ctx, project, p, pal);
    } finally {
      ctx.restore();
    }
  }

  const api = { pieces, palette, draw, PIECES: PIECES.map(p => ({ ...p })) };
  root.Buildings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
