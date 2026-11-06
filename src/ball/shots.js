/* Tennis101 · Ball Physicist — the point flow on the real ball (src/ball/ball.js).
   Plain script, loaded before the game script; it uses the game's globals (pos, BODY, PLAYERS, COURT,
   cfg, ball, rally, sideSign, serviceBox, hitBall, endPoint, retakeServe, rand, clamp) at call time.

   OPT-IN for now: open the page with ?ball=physics (remembered in localStorage "tennis101.ball";
   ?ball=scripted switches back). Without it the old scripted arc plays, unchanged.

   planShot keeps choosing WHERE the ball should bounce; physShot turns that into a real launch
   (speed off the racket + spin, aimed by Ball.solveShot) and predicts the ideal contact point after
   the bounce for the receiver (the AI runs there, the racket times its swing on it).
   stepPhysShot flies the ball and judges the point from what the ball really does:
   first bounce outside the court / box → out or fault, off the net back onto your side → NET,
   a serve that touches the cord and lands in the box → LET, second bounce → point to the hitter. */
const PHYS_BALL = (() => {
  try {
    const q = new URLSearchParams(location.search).get("ball");
    if (q) localStorage.setItem("tennis101.ball", q);
    return (q || localStorage.getItem("tennis101.ball")) === "physics";
  } catch (e) { return false; }
})();
const PHYS_EVENTS = [];
if (PHYS_BALL) {
  Ball.init();
  Ball.onBounce(e => PHYS_EVENTS.push(e));
  Ball.onNet(e => PHYS_EVENTS.push(e));
}

/* o = { hitter, recv, from, bx, by, isServe, sv, q, out, type } from planShot. */
function physShot(o) {
  const { hitter, recv, from, isServe, sv, q, out, type } = o;
  const slice = !isServe && type === "slice", B = BODY[hitter];
  Ball.setSurface(cfg.surface);
  const target = isServe ? { x: sv.land.x, y: sv.land.y } : { x: o.bx, y: o.by };
  const toWide = Math.sign(target.x - from.x) || 1;
  /* Speed off the racket. Strength / Serve skills add their constant m/s per point, exactly
     (BODY[i].shotBonus / serveBonus, src/skills/skills.js). Drives start faster than the scripted arc
     (25–34 m/s, not 19–28) because real drag slows them: the flight time stays about the same. */
  const speed = isServe ? (sv.no === 2 ? 32 : 40) + B.serveBonus
              : slice ? 13.5 + 2 * q + rand(0, 1.5) + B.shotBonus * 0.3
              : 25 + 6 * q + rand(0, 3) + B.shotBonus;
  /* Spin (rpm). 1st serve: flat-slice, bends toward the sideline it's aimed at, skids.
     2nd serve: kick, heavy topspin + rifle spin: high over the net, bends and jumps the other way at the bounce.
     Drive: topspin. Slice: backspin, floats low and checks up (clay) or skids (grass). */
  const spin = isServe ? (sv.no === 2 ? { top: 3800, side: 800, curveTo: -toWide, gyro: 1500, kickTo: -toWide } : { top: 600, side: 1200, curveTo: toWide })
             : slice ? { top: -rand(2000, 2800), side: rand(200, 500), curveTo: toWide }
             : { top: rand(1500, 2300), side: rand(-300, 300), curveTo: 0 };
  const sol = Ball.solveShot({ from, target, speed, topRpm: spin.top, sideRpm: spin.side, curveTo: spin.curveTo,
                               gyroRpm: spin.gyro || 0, kickTo: spin.kickTo || 0, maxDeg: slice ? 25 : 40 });
  let vel = sol.vel;
  if (isServe && sv.net) {                               // planServe said "into the net": the same serve, struck a few degrees low
    const th = sol.theta - (sv.no === 2 ? 5 : 3.5) * Math.PI / 180, h = Math.hypot(vel.x, vel.y) || 1;
    vel = { x: vel.x / h * speed * Math.cos(th), y: vel.y / h * speed * Math.cos(th), z: speed * Math.sin(th) };
  }
  const launch = { from, vel, spin: sol.spin };
  // where the receiver should meet it: after the bounce, once it drops back to hitting height, or at the back of the court
  const path = Ball.predict(launch, { samples: true });
  const b1 = path.bounces[0], tB = b1 ? b1.t : path.t, zc = slice ? 0.45 : 1.0, sgn = sideSign(recv);
  let end = null, peaked = false;
  if (b1) for (const s of path.samples) {
    if (s.t <= tB) continue;
    if (s.vz < 0) peaked = true;
    if ((peaked && s.z <= zc) || s.y * sgn >= 12.4) { end = s; break; }
  }
  if (!end) end = path.samples[path.samples.length - 1] || { t: tB, x: target.x, y: target.y, z: zc };
  Ball.launchBall(launch);
  PHYS_EVENTS.length = 0;
  return { hitter, recv, from, isServe, serve: sv, type, out, phys: true, box: isServe ? serviceBox(hitter) : null,
           bounce: b1 ? { x: b1.x, y: b1.y } : target, end: { x: clamp(end.x, -6.5, 6.5), y: end.y, z: Math.max(0.3, end.z) },
           t1: tB, t2: Math.max(0.05, (end.t - tB) / 0.85), tEnd: Math.max(end.t, tB + 0.05),   // racketPose: t1 + 0.85·t2 = contact time
           t: 0, bounced: false, netTouched: false, prevD: Infinity, prevV: Infinity, arc: 0, curve: 0, kick: { up: 1, side: 0 } };
}

function physSecondBounce(sh) {
  const who = PLAYERS[sh.hitter].last;
  endPoint(sh.hitter, sh.serve && sh.serve.ace ? `ACE — ${who}` : sh.recv === 0 ? `${who} — OUT OF REACH` : `WINNER — ${who}`);
}

/* The first bounce decides in / out. Returns true when the point (or the serve) is over. */
function physFirstBounce(sh, e) {
  sh.bounced = true;
  const r = Ball.CONST.R;                                // a ball touching the line is in
  if (sh.isServe) {
    const bx = sh.box;
    const inBox = Math.sign(e.y) === bx.sy && e.x >= bx.xlo - r && e.x <= bx.xhi + r && Math.abs(e.y) <= COURT.SVC + r;
    const no = rally.serveNo;
    if (!inBox) { if (no === 1) retakeServe(2, sh.netTouched ? "NET · FAULT" : "FAULT"); else endPoint(sh.recv, "DOUBLE FAULT"); return true; }
    if (sh.netTouched || sh.serve.let) { retakeServe(no, "LET · " + (no === 1 ? "FIRST" : "SECOND") + " SERVE"); return true; }
    return false;
  }
  const mySide = Math.sign(e.y) === sideSign(sh.recv);
  if (!mySide || Math.abs(e.x) > COURT.SGL + r || Math.abs(e.y) > COURT.L + r) { endPoint(sh.recv, mySide ? "OUT" : "NET"); return true; }
  return false;
}

/* Called by stepRally while a physics ball is in play (after the players moved). */
function stepPhysShot(sh, dt) {
  Ball.stepBall(dt);
  const g = Ball.getBall();
  ball.x = g.x; ball.y = g.y; ball.z = g.z;
  while (PHYS_EVENTS.length) {
    const e = PHYS_EVENTS.shift();
    if (e.kind) { sh.netTouched = true; continue; }      // cord or cloth
    if (e.n === 1) { if (physFirstBounce(sh, e)) return; }
    else return physSecondBounce(sh);
  }
  const rv = pos[sh.recv], B = BODY[sh.recv];
  if (!sh.bounced) {
    // VOLLEY: once the ball has crossed the net, the receiver may take it out of the air (never a serve)
    if (!sh.isServe && Math.sign(ball.y) === sideSign(sh.recv) && ball.z > 0.2 && ball.z < PLAYERS[sh.recv].heightM * 1.25) {
      const d = Math.hypot(ball.x - rv.x, ball.y - rv.y), passing = d > sh.prevV;
      sh.prevV = d;
      if (d <= B.reach * B.volleyReach && (passing || d < 0.5 * B.reach)) return hitBall(sh.recv, false, true);
    }
    return;
  }
  if (Math.abs(ball.y) > 19 || Math.abs(ball.x) > 10 || sh.t > 9) return physSecondBounce(sh);   // into the stands
  const u = (sh.t - sh.t1) / (sh.tEnd - sh.t1);
  if (u >= 0.3 && !(sh.serve && sh.serve.ace)) {          // an ace is out of reach by definition
    // contact: in reach, and either at the ideal point or the ball is starting to pass you
    const d = Math.hypot(ball.x - rv.x, ball.y - rv.y), passing = d > sh.prevD;
    sh.prevD = d;
    const reach = B.reach * (sh.isServe ? 1.15 : 1);      // returners stretch further for a serve
    if (d <= reach && (u >= 0.95 || passing)) return hitBall(sh.recv, false);
  }
}
