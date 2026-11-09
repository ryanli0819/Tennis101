// Smoke test for src/players/player-art.js (Player Artist). Run: node src/players/player-art.test.mjs
// Draws every frame of every captured serve (Sinner, Alcaraz; 1st and 2nd; near and far; light from either side)
// and both locker-room portraits into a recording mock canvas: nothing may throw and no coordinate may be NaN.
import fs from "fs"; import vm from "vm"; import path from "path"; import { fileURLToPath } from "url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let bad = 0, calls = 0;
const chk = (...a) => { calls++; for (const v of a) if (typeof v === "number" && !Number.isFinite(v)) bad++; };
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => chk(...a)), set: (t, k, v) => { t[k] = v; return true; } });
const g = { document: { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) }, Math, console };
g.window = g;
vm.createContext(g);
vm.runInContext(`
var AS = 3, b = null; const q = v => Math.round(v * AS) / AS;
var CAM = { back: 16.5, h: 2.4 };
function proj(x, y, z = 0) { const d = Math.max(0.4, y + CAM.back); return { x: 160 + x * 150 / d, y: 60 + (CAM.h - z) * 150 / d, s: 150 / d }; }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) : c) * amt)));
  return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }
const HAIR = { sinner: ["#e0702a", "#a8461a", "#f7a35c"], alcaraz: ["#2a1c14", "#120b07", "#4d3626"] };
const RACKET_LOOK = { sinner: { frame: "#1d1d22", accent: "#f2f2ef" } };
const V3 = { norm: v => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; } };
var LIT = true; const litLeft = () => LIT;
var racketCalls = 0; function drawRacket() { racketCalls++; }
var PLAYERS = [];
`, g);
for (const f of ["src/serve/motion/sinner-serve.js", "src/serve/motion/alcaraz-serve.js", "src/players/player-art.js"])
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), g, { filename: f });
vm.runInContext(`b = document.createElement("canvas").getContext("2d");`, g);

const looks = { sinner: { style: "cap-curls" }, alcaraz: { style: "long-band", band: "#f6f6f2", beard: true } };
const kits = { sinner: { shirt: "#1f2f4a", shorts: "#f5f5f2", cap: "#f2f2ef", shoes: "#f0ece6" },
               alcaraz: { shirt: "#3c3f45", shirtLow: "#a3a7ad", shorts: "#1f2024", shoes: "#1d1d20", socks: "#141416", sleeve: "#121214" } };
let frames = 0, portraits = 0;
for (const id of ["sinner", "alcaraz"]) for (const side of ["near", "far"]) for (const lit of [true, false]) {
  const P = { id, side, heightM: id === "sinner" ? 1.91 : 1.83, weightKg: id === "sinner" ? 77 : 74, shirt: "#23b59c", shorts: "#11233a",
              hair: "#c4672f", ui: "#23b59c", look: looks[id], ...kits[id] };
  g.PLAYERS[0] = P; g.LIT = lit; g.CAM.back = side === "near" ? 16.5 : 18.1;
  const p = { x: 1, y: side === "near" ? -11.9 : 11.9 }, R = side === "near" ? 1 : -1;
  for (const which of ["first", "second"]) {
    const m = g.SERVE_MOTIONS[id] && g.SERVE_MOTIONS[id][which]; if (!m) continue;
    for (const fr of m.frames) {
      const W = {}; for (const n in fr.j) W[n] = { x: p.x + R * fr.j[n][0] * P.heightM, y: p.y, z: Math.max(0, fr.j[n][1] * P.heightM) };
      g.PlayerArt.drawCapturedFigure(0, p, W); frames++;
    }
  }
  const c = g.PlayerArt.portrait(P, { surface: "hard" }); if (c && c.width === 44 && c.height === 64) portraits++;
}
console.log(JSON.stringify({ frames, portraits, calls, bad, racketCalls: g.racketCalls }));
if (bad || frames < 100 || portraits !== 8 || g.racketCalls !== frames) { console.error("FAIL"); process.exit(1); }
console.log("ok");
