// Loads the in-repo serve motions exactly as index.html does (sinner-serve.js, then roster-serves.js, then alcaraz-poetry.js),
// plus the not-loaded 2D clips (alcaraz-serve.js, sinner-serve.js) in their own contexts. Read-only.
import { readFileSync } from "node:fs";
import vm from "node:vm";
const ROOT = new URL("../../../", import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), "utf8");
function ctx(files) {
  const c = { window: { ROSTER: [] } }; c.window.window = c.window; vm.createContext(c);
  for (const f of files) vm.runInContext(read(f), c);
  return c.window.SERVE_MOTIONS;
}
export function liveMotions() {
  const S = ctx(["src/serve/motion/sinner-serve.js", "src/serve/motion/roster-serves.js", "src/serve/motion/alcaraz-poetry.js"]);
  return {
    alcaraz: [{ clip: "alcaraz-poetry.js first (live)", m: S.alcaraz.first }, { clip: "roster-serves.js alcaraz second (live)", m: S.alcaraz.second }],
    sinner: [{ clip: "roster-serves.js sinner first (live)", m: S.sinner.first }, { clip: "roster-serves.js sinner second (live)", m: S.sinner.second }],
  };
}
export function extraMotions() {   // 2D (x, up only) clips kept on disk; not played by the game
  const A = ctx(["src/serve/motion/alcaraz-serve.js"]).alcaraz, Sn = ctx(["src/serve/motion/sinner-serve.js"]).sinner;
  return {
    alcaraz: [{ clip: "alcaraz-serve.js first (2D, not loaded)", m: A.first }, { clip: "alcaraz-serve.js second (2D hand-keyed, not loaded)", m: A.second }],
    sinner: [{ clip: "sinner-serve.js first (2D, replaced by roster)", m: Sn.first }, { clip: "sinner-serve.js firstFront (2D, unused)", m: Sn.firstFront }, { clip: "sinner-serve.js second (2D, replaced by roster)", m: Sn.second }],
  };
}

/* Clips used to MEASURE bone lengths: the MediaPipe world-landmark serves (roster-serves.js), metric 3D, not hand-edited.
   alcaraz-poetry.js is solved and tested but NOT used to measure lengths: its own note says joints were rebuilt
   (one racket-arm path, depth interpolated across the jump) and its left/right medians disagree (thigh 0.248 vs 0.202 H,
   foot 0.046 vs 0.087 H; src/body/tools/measure-bones.mjs, MEASURED). */
export function measurementClips(id) { return liveMotions()[id].filter(c => !/poetry/.test(c.clip)); }
