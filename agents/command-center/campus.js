// =====================================================================
// HQ CAMPUS — one pixel-art building per agent.
// Loaded by agents/command-center/hq.html (plain script, no build step).
// Status on the page comes from the live HQ record when it is connected,
// and from each agent's LOG.md when the page is opened from the repo.
// =====================================================================
(function (root) {
  // 3×5 glyphs, each row a 3-bit number (bit 2 = left pixel).
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
    E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
    I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [5, 7, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
    Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 2], V: [5, 5, 5, 2, 2], W: [5, 5, 5, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], " ": [0, 0, 0, 0, 0],
  };

  // Building name is the place (locker room, lab, …). The agent's role is the caption.
  const PLACES = {
    "ball-physicist": { kind: "lab", place: "Ball lab", sign: "LAB" },
    "court-designer": { kind: "shed", place: "Grounds shed", sign: "SHED" },
    "player-artist": { kind: "studio", place: "Art studio", sign: "ART" },
    "serve-analyst": { kind: "video", place: "Video studio", sign: "VIDEO" },
    "serve-controller": { kind: "booth", place: "Serve booth", sign: "SERVE" },
    "version-keeper": { kind: "archive", place: "Archive", sign: "FILES" },
    "body-animator": { kind: "motion", place: "Motion studio", sign: "MOTION" },
    "controls-designer": { kind: "controls", place: "Control booth", sign: "KEYS" },
    "start-page-builder": { kind: "gate", place: "Gatehouse", sign: "GATE" },
    "guide-writer": { kind: "guide", place: "Guide kiosk", sign: "GUIDE" },
    "skills-coach": { kind: "gym", place: "Training gym", sign: "GYM" },
    "locker-room-designer": { kind: "locker", place: "Locker room", sign: "LOCKERS" },
    "pov-camera": { kind: "camera", place: "Camera tower", sign: "CAMERA" },
    "animator": { kind: "frames", place: "Frame shop", sign: "FRAMES" },
    "footage-scout": { kind: "reels", place: "Film archive", sign: "REELS" },
    "racket-coach": { kind: "racket", place: "Stringing room", sign: "RACKET" },
    "appearance-scout": { kind: "wardrobe", place: "Wardrobe", sign: "KITS" },
    "biomechanics-coach": { kind: "anatomy", place: "Anatomy lab", sign: "JOINTS" },
    "body-scout": { kind: "measure", place: "Measuring hut", sign: "BODY" },
  };

  const TEAM_ORDER = ["gameplay", "look-world", "motion-body", "product"];

  function kindFor(id, title) {
    if (PLACES[id]) return { id, ...PLACES[id] };
    const t = String(title || id || "").toLowerCase();
    const guess = [
      [/locker/, "locker-room-designer"],
      [/court|ground/, "court-designer"],
      [/ball|physic/, "ball-physicist"],
      [/video|analyst/, "serve-analyst"],
      [/camera|first-person|\bpov\b/, "pov-camera"],
      [/racket/, "racket-coach"],
      [/guide|how to play/, "guide-writer"],
      [/skill|gym/, "skills-coach"],
    ].find(([re]) => re.test(t));
    const base = guess ? PLACES[guess[1]] : { kind: "hut", place: "Clubhouse", sign: "CLUB" };
    return { id, ...base };
  }

  // Latest log section only. "blocked" in that section marks the agent blocked;
  // everything else is idle until the live HQ record says otherwise.
  function parseLog(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!raw) return { status: "idle", task: "", briefSeen: null };
    const brief = raw.match(/briefSeen:\s*(\d+)/i);
    const briefSeen = brief ? Number(brief[1]) : null;
    const parts = raw.split(/\n(?=##\s)/);
    const latest = parts[parts.length - 1];
    const lines = latest.split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#") && !/^briefSeen:/i.test(s));
    const body = lines.join(" ");
    const status = /\bblocked\b/i.test(body) ? "blocked" : "idle";
    const next = body.match(/Next:\s*.+/i);
    const task = (next ? next[0] : (lines[0] || "")).replace(/\s+/g, " ").slice(0, 220);
    return { status, task, briefSeen };
  }

  function neighborhoods(agents, sups) {
    const list = (agents || []).map(a => ({ ...a }));
    const byId = new Map(list.map(a => [a.id, a]));
    const used = new Set();
    const supEntries = Object.entries(sups || {});
    const ordered = [
      ...TEAM_ORDER.filter(id => sups && sups[id]).map(id => [id, sups[id]]),
      ...supEntries.filter(([id]) => !TEAM_ORDER.includes(id)).sort((a, b) => String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]))),
    ];
    const groups = [];
    for (const [id, s] of ordered) {
      const members = [];
      for (const name of s.members || []) if (byId.has(name)) members.push(byId.get(name));
      for (const a of list) if ((a.supervisor || null) === id && !members.some(m => m.id === a.id)) members.push(a);
      members.forEach(m => used.add(m.id));
      members.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
      if (members.length) groups.push({ id, name: s.name || id, mode: s.mode || "share", agents: members });
    }
    const loose = list.filter(a => !used.has(a.id)).sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    if (loose.length) groups.push({ id: null, name: "Reports to the CEO", mode: "", agents: loose });
    return groups;
  }

  function isDark() {
    if (typeof document === "undefined") return false;
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function colors(dark) {
    const lamps = dark
      ? { running: "#7fcfa5", queued: "#8fc7ae", review: "#e6b56a", blocked: "#f08a92", idle: "#c4b4be", done: "#9dccb0", new: "#f0a0b8" }
      : { running: "#1f7a4e", queued: "#2f6b52", review: "#8a5a10", blocked: "#a32030", idle: "#6e5e68", done: "#3d7a58", new: "#a84868" };
    if (dark) return {
      grassA: "#1a3329", grassB: "#143028", path: "#3d342c", court: "#234a3c", line: "#e7f2ea",
      wall: "#3c3344", wallDark: "#2a2432", roof: "#6eae93", roofDark: "#3e7a62",
      ink: "#140f16", trim: "#f4eaef", glass: "#d7ecff", door: "#1a141c",
      sign: "#f7f1e8", signInk: "#1c1620", shadow: "rgba(0,0,0,.5)",
      tree: "#2f6b4c", treeDark: "#1d4632", trunk: "#4a3428", ball: "#d6ee6a",
      accent: "#f0a0b8", outfit: ["#f4f4f2", "#24345c", "#c45a3a"], cone: "#e6b56a",
      lamps,
    };
    return {
      grassA: "#d7edcc", grassB: "#c5e2b8", path: "#e6d3b0", court: "#4f8a72", line: "#f7fbf8",
      wall: "#fffaf4", wallDark: "#efe4d6", roof: "#3e7a5c", roofDark: "#2a5a44",
      ink: "#241c22", trim: "#fffdf8", glass: "#c5ddf2", door: "#6a4328",
      sign: "#fffdf8", signInk: "#241c22", shadow: "rgba(40,30,20,.22)",
      tree: "#3c8a48", treeDark: "#2c6a38", trunk: "#6b4a2c", ball: "#d6ee4c",
      accent: "#c0587a", outfit: ["#f4f4f2", "#1a2744", "#c45a3a"], cone: "#e0a040",
      lamps,
    };
  }

  function rect(g, x, y, w, h, c) {
    if (!c || w <= 0 || h <= 0) return;
    g.fillStyle = c;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function glyphText(R, word, x, y, color) {
    let cx = x;
    for (const ch of String(word || "").toUpperCase()) {
      const rows = GLYPH[ch] || GLYPH[" "];
      rows.forEach((bits, ry) => {
        for (let rx = 0; rx < 3; rx++) if (bits & (4 >> rx)) R(cx + rx, y + ry, 1, 1, color);
      });
      cx += 4;
    }
    return cx - x - 1;
  }

  function signWidth(word) { return Math.max(0, String(word || "").length * 4 - 1); }

  function paintSign(R, C, word, cx, y) {
    const tw = signWidth(word);
    const w = tw + 6;
    const x = Math.round(cx - w / 2);
    R(x, y, w, 9, C.ink);
    R(x + 1, y + 1, w - 2, 7, C.sign);
    glyphText(R, word, x + 3, y + 2, C.signInk);
  }

  function lampDot(R, C, x, y, lamp) {
    R(x, y, 5, 5, C.ink);
    R(x + 1, y + 1, 3, 3, lamp);
  }

  function disc(R, cx, cy, r, c, hole) {
    const h2 = hole ? hole * hole : -1;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 <= r * r && d2 >= h2) R(cx + x, cy + y, 1, 1, c);
    }
  }

  function lawn(R, C, W, H) {
    R(0, 0, W, H, C.grassA);
    for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) R(x, y, 2, 2, C.grassB);
  }

  function wall(R, C, x, y, w, h) {
    R(x - 1, y - 1, w + 2, h + 2, C.ink);
    R(x, y, w, h, C.wall);
  }

  function roof(R, C, x, y, w, rows) {
    for (let i = 0; i < rows; i++) R(x + i, y - i, w - i * 2, 1, i === rows - 1 ? C.roofDark : C.roof);
    R(x - 1, y + 1, w + 2, 1, C.ink);
  }

  function door(R, C, x, y, w, h) {
    R(x, y, w, h, C.door);
    R(x + w - 3, y + Math.floor(h / 2), 1, 1, C.ball);
  }

  function win(R, C, x, y, w, h) {
    R(x, y, w, h, C.ink);
    R(x + 1, y + 1, w - 2, h - 2, C.glass);
    R(x + Math.floor(w / 2), y + 1, 1, h - 2, C.ink);
  }

  const DRAW = {
    lab(R, C, sign, lamp) {
      wall(R, C, 16, 16, 30, 28);
      roof(R, C, 14, 15, 34, 6);
      R(36, 4, 6, 12, C.ink); R(37, 5, 4, 10, C.wallDark);
      R(37, 4, 4, 2, C.roofDark);
      win(R, C, 20, 22, 8, 7); win(R, C, 32, 22, 8, 7);
      door(R, C, 27, 32, 8, 12);
      paintSign(R, C, sign, 31, 18);
      lampDot(R, C, 40, 6, lamp);
    },
    shed(R, C, sign, lamp) {
      wall(R, C, 8, 24, 46, 20);
      roof(R, C, 6, 23, 50, 5);
      door(R, C, 14, 32, 14, 12);
      win(R, C, 36, 30, 10, 8);
      disc(R, 12, 42, 3, C.ink); disc(R, 12, 42, 1, C.wall);
      paintSign(R, C, sign, 32, 26);
      lampDot(R, C, 48, 20, lamp);
    },
    studio(R, C, sign, lamp) {
      wall(R, C, 10, 22, 42, 22);
      R(10, 16, 42, 6, C.roof);
      R(18, 12, 16, 6, C.ink); R(19, 13, 14, 4, C.glass); // skylight
      R(14, 34, 2, 10, C.trunk); R(12, 30, 10, 2, C.trim); R(16, 26, 2, 8, C.trunk); // easel
      paintSign(R, C, sign, 40, 26);
      lampDot(R, C, 46, 18, lamp);
    },
    video(R, C, sign, lamp) {
      wall(R, C, 6, 20, 52, 24);
      R(6, 16, 52, 4, C.roofDark);
      R(30, 8, 2, 8, C.ink); R(24, 8, 14, 2, C.ink); // antenna
      R(12, 24, 16, 12, C.ink); R(13, 25, 14, 10, C.glass);
      R(34, 24, 16, 12, C.ink); R(35, 25, 14, 10, "#1a2438");
      R(15, 28, 8, 2, C.ball); R(37, 30, 6, 2, C.accent);
      paintSign(R, C, sign, 32, 38);
      lampDot(R, C, 52, 16, lamp);
    },
    booth(R, C, sign, lamp) {
      wall(R, C, 16, 22, 30, 22);
      roof(R, C, 14, 21, 34, 5);
      door(R, C, 26, 32, 10, 12);
      disc(R, 40, 12, 4, C.ball); disc(R, 40, 12, 1, C.ink);
      R(39, 16, 2, 6, C.ink);
      paintSign(R, C, sign, 28, 24);
      lampDot(R, C, 18, 18, lamp);
    },
    archive(R, C, sign, lamp) {
      wall(R, C, 20, 8, 24, 36);
      R(18, 6, 28, 3, C.roofDark);
      disc(R, 32, 18, 5, C.ink); disc(R, 32, 18, 4, C.sign); disc(R, 32, 18, 1, C.ink);
      R(32, 14, 1, 8, C.signInk); R(28, 18, 8, 1, C.signInk);
      door(R, C, 28, 32, 8, 12);
      paintSign(R, C, sign, 32, 26);
      lampDot(R, C, 38, 10, lamp);
    },
    motion(R, C, sign, lamp) {
      wall(R, C, 10, 20, 44, 24);
      roof(R, C, 8, 19, 48, 5);
      win(R, C, 18, 24, 16, 14);
      // a tiny figure in the window
      R(25, 26, 2, 2, C.ink); R(24, 28, 4, 4, C.accent); R(23, 32, 2, 4, C.ink); R(27, 32, 2, 4, C.ink);
      door(R, C, 40, 32, 8, 12);
      paintSign(R, C, sign, 32, 40);
      lampDot(R, C, 48, 16, lamp);
    },
    controls(R, C, sign, lamp) {
      wall(R, C, 8, 18, 48, 26);
      R(8, 14, 48, 4, C.roofDark);
      // d-pad
      R(18, 26, 6, 14, C.ink); R(12, 30, 18, 6, C.ink);
      R(19, 27, 4, 12, C.wallDark); R(13, 31, 16, 4, C.wallDark);
      door(R, C, 40, 30, 10, 14);
      paintSign(R, C, sign, 32, 20);
      lampDot(R, C, 50, 14, lamp);
    },
    gate(R, C, sign, lamp) {
      R(8, 16, 10, 28, C.ink); R(9, 17, 8, 26, C.wall);
      R(46, 16, 10, 28, C.ink); R(47, 17, 8, 26, C.wall);
      R(8, 14, 48, 8, C.ink); R(9, 15, 46, 6, C.roof);
      door(R, C, 14, 34, 6, 10); door(R, C, 44, 34, 6, 10);
      paintSign(R, C, sign, 32, 16);
      lampDot(R, C, 50, 16, lamp);
    },
    guide(R, C, sign, lamp) {
      wall(R, C, 14, 24, 36, 20);
      roof(R, C, 12, 23, 40, 5);
      // open book
      R(22, 30, 20, 10, C.ink); R(23, 31, 8, 8, C.sign); R(33, 31, 8, 8, C.trim);
      R(31, 31, 2, 8, C.ink);
      paintSign(R, C, sign, 32, 26);
      lampDot(R, C, 44, 20, lamp);
    },
    gym(R, C, sign, lamp) {
      wall(R, C, 6, 22, 52, 22);
      R(6, 18, 52, 4, C.roofDark);
      R(16, 20, 2, 8, C.ink); R(46, 20, 2, 8, C.ink); R(16, 20, 32, 2, C.ink); // bar
      R(18, 36, 8, 6, C.cone); R(20, 34, 4, 2, C.cone);
      R(38, 36, 8, 6, C.cone); R(40, 34, 4, 2, C.cone);
      paintSign(R, C, sign, 32, 26);
      lampDot(R, C, 52, 18, lamp);
    },
    locker(R, C, sign, lamp) {
      wall(R, C, 6, 16, 52, 28);
      R(6, 14, 52, 3, C.roof);
      for (let i = 0; i < 4; i++) {
        const x = 10 + i * 12;
        R(x, 22, 9, 18, C.ink);
        R(x + 1, 23, 7, 16, i % 2 ? C.wallDark : C.door);
        R(x + 2, 25, 5, 1, C.trim); R(x + 2, 28, 5, 1, C.trim);
      }
      paintSign(R, C, sign, 32, 18);
      lampDot(R, C, 52, 14, lamp);
    },
    camera(R, C, sign, lamp) {
      wall(R, C, 26, 10, 16, 34);
      R(24, 8, 20, 3, C.roofDark);
      R(18, 18, 14, 10, C.ink); R(19, 19, 12, 8, C.wallDark); // body
      disc(R, 16, 23, 5, C.ink); disc(R, 16, 23, 3, C.glass); disc(R, 16, 23, 1, C.ink);
      door(R, C, 30, 32, 8, 12);
      paintSign(R, C, sign, 34, 28);
      lampDot(R, C, 36, 12, lamp);
    },
    frames(R, C, sign, lamp) {
      wall(R, C, 8, 18, 48, 26);
      roof(R, C, 6, 17, 52, 4);
      R(10, 28, 44, 8, C.ink); R(11, 29, 42, 6, C.wallDark);
      for (let i = 0; i < 6; i++) R(14 + i * 7, 30, 3, 4, C.glass);
      paintSign(R, C, sign, 32, 20);
      lampDot(R, C, 50, 14, lamp);
    },
    reels(R, C, sign, lamp) {
      wall(R, C, 8, 18, 48, 26);
      roof(R, C, 6, 17, 52, 4);
      disc(R, 22, 30, 7, C.ink); disc(R, 22, 30, 5, C.wallDark); disc(R, 22, 30, 2, C.ink);
      disc(R, 42, 30, 7, C.ink); disc(R, 42, 30, 5, C.wallDark); disc(R, 42, 30, 2, C.ink);
      paintSign(R, C, sign, 32, 20);
      lampDot(R, C, 50, 14, lamp);
    },
    racket(R, C, sign, lamp) {
      wall(R, C, 10, 16, 44, 28);
      roof(R, C, 8, 15, 48, 5);
      disc(R, 28, 28, 8, C.ink); disc(R, 28, 28, 6, C.glass);
      R(27, 22, 2, 12, C.trim); R(22, 28, 12, 1, C.trim); // strings
      R(26, 36, 4, 8, C.door); // handle
      paintSign(R, C, sign, 44, 20);
      lampDot(R, C, 48, 16, lamp);
    },
    wardrobe(R, C, sign, lamp) {
      wall(R, C, 8, 18, 48, 26);
      R(8, 16, 48, 3, C.roofDark);
      C.outfit.forEach((c, i) => { R(14 + i * 12, 24, 10, 16, C.ink); R(15 + i * 12, 25, 8, 14, c); });
      paintSign(R, C, sign, 32, 20);
      lampDot(R, C, 50, 16, lamp);
    },
    anatomy(R, C, sign, lamp) {
      wall(R, C, 10, 16, 44, 28);
      roof(R, C, 8, 15, 48, 5);
      R(30, 24, 4, 4, C.ink); R(22, 32, 4, 4, C.ink); R(38, 32, 4, 4, C.ink); R(30, 38, 4, 4, C.ink);
      R(31, 28, 2, 4, C.accent); R(26, 33, 6, 2, C.accent); R(34, 33, 6, 2, C.accent); R(31, 36, 2, 4, C.accent);
      paintSign(R, C, sign, 32, 18);
      lampDot(R, C, 48, 16, lamp);
    },
    measure(R, C, sign, lamp) {
      wall(R, C, 14, 18, 32, 26);
      roof(R, C, 12, 17, 36, 5);
      door(R, C, 24, 30, 10, 14);
      R(48, 14, 3, 30, C.ink); R(49, 15, 1, 28, C.trim);
      for (let i = 0; i < 7; i++) R(46, 16 + i * 4, 2, 1, C.signInk);
      paintSign(R, C, sign, 30, 22);
      lampDot(R, C, 40, 14, lamp);
    },
    hut(R, C, sign, lamp) {
      wall(R, C, 14, 22, 36, 22);
      roof(R, C, 12, 21, 40, 6);
      door(R, C, 28, 32, 8, 12);
      win(R, C, 18, 28, 8, 7);
      paintSign(R, C, sign, 32, 24);
      lampDot(R, C, 44, 16, lamp);
    },
  };

  function paintBuilding(canvas, spec, status, palette) {
    const W = 64, H = 52;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d");
    if (!g) return canvas;
    const C = palette || colors(false);
    const R = (x, y, w, h, c) => rect(g, x, y, w, h, c);
    lawn(R, C, W, H);
    const lamp = (C.lamps && C.lamps[status]) || C.lamps.idle;
    (DRAW[spec.kind] || DRAW.hut)(R, C, spec.sign || "CLUB", lamp);
    return canvas;
  }

  function paintGrass(g, w, h, C) {
    if (typeof g.createPattern === "function" && typeof document !== "undefined") {
      const tile = document.createElement("canvas");
      tile.width = 8; tile.height = 8;
      const tg = tile.getContext("2d");
      tg.fillStyle = C.grassA; tg.fillRect(0, 0, 8, 8);
      tg.fillStyle = C.grassB; tg.fillRect(0, 0, 4, 4); tg.fillRect(4, 4, 4, 4);
      g.fillStyle = g.createPattern(tile, "repeat");
      g.fillRect(0, 0, w, h);
    } else {
      g.fillStyle = C.grassA; g.fillRect(0, 0, w, h);
      g.fillStyle = C.grassB;
      for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) g.fillRect(x, y, 2, 2);
    }
    // a gravel path across the middle and a few shrubs, seeded so they don't flicker
    g.fillStyle = C.path;
    g.fillRect(0, Math.floor(h * 0.46), w, Math.max(2, Math.floor(h * 0.04)));
    g.fillRect(Math.floor(w * 0.48), 0, Math.max(2, Math.floor(w * 0.035)), h);
    let seed = 19;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 18; i++) {
      g.fillStyle = i % 2 ? C.tree : C.treeDark;
      g.fillRect(Math.floor(rnd() * (w - 4)), Math.floor(rnd() * (h - 4)), 3, 3);
    }
  }

  function sized(canvas, fallbackW, fallbackH) {
    const w = Math.max(8, canvas.clientWidth || canvas.width || fallbackW);
    const h = Math.max(8, canvas.clientHeight || canvas.height || fallbackH);
    canvas.width = Math.max(8, Math.round(w / 3));
    canvas.height = Math.max(8, Math.round(h / 3));
    return canvas.getContext("2d");
  }

  function paintGround(canvas, palette) {
    const C = palette || colors(false);
    const g = sized(canvas, 640, 480);
    if (!g) return;
    paintGrass(g, canvas.width, canvas.height, C);
  }

  function paintCourt(canvas, palette) {
    const C = palette || colors(false);
    const g = sized(canvas, 360, 110);
    if (!g) return;
    const w = canvas.width, h = canvas.height;
    paintGrass(g, w, h, C);
    const x0 = Math.round(w * 0.18), x1 = Math.round(w * 0.82);
    const y0 = Math.round(h * 0.12), y1 = Math.round(h * 0.88);
    g.fillStyle = C.court; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = C.line;
    g.fillRect(x0, y0, x1 - x0, 1); g.fillRect(x0, y1 - 1, x1 - x0, 1);
    g.fillRect(x0, y0, 1, y1 - y0); g.fillRect(x1 - 1, y0, 1, y1 - y0);
    const mid = Math.round((y0 + y1) / 2);
    g.fillRect(x0, mid, x1 - x0, 1);
    g.fillStyle = C.trim; g.fillRect(x0, mid - 2, 1, 5); g.fillRect(x1 - 1, mid - 2, 1, 5);
    // trees flanking the court
    g.fillStyle = C.trunk; g.fillRect(Math.round(w * 0.08), y0 + 4, 2, 10);
    g.fillStyle = C.tree; g.fillRect(Math.round(w * 0.06), y0, 6, 6);
    g.fillStyle = C.trunk; g.fillRect(Math.round(w * 0.9), y0 + 4, 2, 10);
    g.fillStyle = C.treeDark; g.fillRect(Math.round(w * 0.88), y0, 6, 6);
  }

  const api = {
    PLACES, GLYPH, kindFor, parseLog, neighborhoods, colors, isDark,
    paintBuilding, paintGround, paintCourt,
  };
  root.HQCampus = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
