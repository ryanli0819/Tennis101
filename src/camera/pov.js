/* FIRST-PERSON CAMERA (owner: First-Person Camera agent, agents/pov-camera/).
   Press V while you serve: from GET SET until just after contact you see the serve through your own eyes,
   at your pro's real eye height. You look down at the ball while you bounce it, back up at the box, up with
   the toss, then back down the court as you hit. Your tossing hand, the ball and the racket come into view,
   drawn on the captured serve joints (SERVE_MOTIONS, Serve Analyst) in the Player Artist's colours.
   The head follows the motion a little (neck and pelvis), never enough to feel sick. With
   prefers-reduced-motion the head stays still and the view cuts between a few fixed angles instead of moving.
   The pure parts (eye height, when it is on, where to look, head offset, arm depth) take plain values, so they
   are tested without a page (src/camera/pov.test.mjs). Units: metres, seconds, radians (pitch + = looking up). */
(function (root) {
  const EYE = 0.94;              // eye height as a share of standing height
  const BEHIND = 0.35;           // the camera sits this far behind the eyes, so the near court stays in view
  const AFTER = 0.35;            // first person stays on this long after contact, then hands back
  const HEAD = 0.55;             // share of the neck / pelvis movement the view follows
  const HEAD_MAX = 0.16;         // and never more than this (m) from the standing eye
  const LOOK_DOWN = -0.45;       // while bouncing the ball (~26° down: the hand, the ball and still the top of the box)
  const LOOK_UP_MAX = 0.8;       // the toss: never more than ~46° up
  const BALL_HIGH = 0.3;         // keep the tossed ball this far (rad) above the middle of the view
  const STILL_UP = 0.55;         // reduced motion: one fixed look-up for the whole toss
  const RATE = 6, RATE_BACK = 9; // how fast the view turns (1/s); faster back down the court after contact
  const NEAR = 0.42;             // anything closer to the lens than this (along the view) is not drawn

  const eyeHeight = P => P.heightM * EYE;
  const clampAbs = (v, m) => Math.max(-m, Math.min(m, v));
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Is first person on? st = { firstPerson, server, over, rally, nextServe, clock }.
     Your own serve only: GET SET (READY), the routine, the toss, and AFTER s past contact. Never while you receive. */
  function wanted(st) {
    if (!st.firstPerson || st.server !== 0 || st.over) return false;
    const r = st.rally;
    if (!r) return !!(st.nextServe && st.nextServe.ready);
    return !!r.serve || !!(r.shot && r.shot.isServe && st.clock - (r.serveClock || 0) < AFTER);
  }

  /* How far the motion has moved the head from where it stood: neck height, and neck + pelvis sideways.
     W = the motion's world joints now, W0 = at its first frame. Returns { x, z } in metres. */
  function headOffset(W, W0) {
    if (!W || !W0 || !W.neck || !W0.neck) return { x: 0, z: 0 };
    const sx = W.root && W0.root ? (W.neck.x - W0.neck.x + W.root.x - W0.root.x) / 2 : W.neck.x - W0.neck.x;
    return { x: clampAbs(sx * HEAD, HEAD_MAX), z: clampAbs((W.neck.z - W0.neck.z) * HEAD, HEAD_MAX) };
  }

  /* The camera for CAMS.pov (same shape as the other cameras; anchor null = eye-level horizon). */
  function cam(P, p, head) {
    const h = head || { x: 0, z: 0 };
    return { back: BEHIND - p.y, h: eyeHeight(P) + h.z, x: p.x + h.x, anchor: null };
  }

  /* Where to look. s = { on, reduce, t, events, ball, eye: { y, z }, fwd }: t / events = the serve's clock and
     events (null during GET SET), fwd = +1 if the court is toward +y. Returns { pitch, rate } (rate 0 = cut). */
  function look(s) {
    const cut = s.reduce ? 0 : null;
    if (!s.on) return { pitch: 0, rate: cut ?? RATE };
    const E = s.events;
    if (!E || s.t == null) return { pitch: 0, rate: cut ?? RATE };                          // GET SET: eyes on the box
    if (s.t < (E.set ?? E.start)) return { pitch: LOOK_DOWN, rate: cut ?? RATE };            // bouncing the ball
    if (s.t < E.tossRelease) return { pitch: 0, rate: cut ?? RATE };                         // a last look at the box
    if (s.t < E.contact) {                                                                   // the toss: follow the ball up
      if (s.reduce) return { pitch: STILL_UP, rate: 0 };
      const b = s.ball, ahead = b ? Math.max(0.2, (b.y - s.eye.y) * s.fwd) : 1;
      const up = b ? Math.atan2(b.z - s.eye.z, ahead) - BALL_HIGH : 0;
      return { pitch: Math.max(0, Math.min(LOOK_UP_MAX, up)), rate: RATE };
    }
    return { pitch: 0, rate: cut ?? RATE_BACK };                                             // hit: back down the court
  }

  /* How far in front of the body plane (m) each arm joint is. The captured joints are flat (seen from behind),
     so first person gives the arms depth: the tossing arm reaches out in front, the racket arm goes back
     behind the head at the trophy and comes through high and in front at contact. */
  function armDepth(t, E) {
    const lerp = (a, c, u) => a + (c - a) * Math.max(0, Math.min(1, u));
    const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    const racket = t < E.tossRelease ? 0.2
      : t < E.trophy ? lerp(0.2, -0.15, (t - E.tossRelease) / (E.trophy - E.tossRelease))
      : t < E.contact ? lerp(-0.15, 0.45, smooth((t - E.trophy) / (E.contact - E.trophy)))
      : 0.45;
    const toss = t < E.contact ? 0.32 : lerp(0.32, 0.15, (t - E.contact) / 0.3);         // the tossing arm folds in after contact
    return { leftElbow: toss * 0.55, leftWrist: toss, leftHand: toss + 0.06, rightElbow: racket * 0.55, rightWrist: racket };
  }

  /* ---- In the page (these read the game's globals: pos, PLAYERS, rally, ball, CAM_*, proj, drawRacket, ...) ---- */

  /* Your serve's clock and events: the captured motion's, or the plain routine's for a pro without one. */
  function serveClock() {
    const mo = pos[0].motion;
    if (mo && mo.m && mo.m.events) return { t: mo.t, events: mo.m.events };
    const sv = rally && rally.serve;
    if (sv && !sv.captured && S.server === 0) {
      const R = ROUTINE.seconds;
      return { t: sv.t, events: { start: R, tossRelease: R, trophy: R + ROUTINE.toss * 0.55, contact: R + ROUTINE.toss } };
    }
    return { t: null, events: null };
  }
  /* The head offset right now (zero with reduced motion: the view stays still). */
  function head() {
    const mo = pos[0].motion;
    if (reduced() || !mo || !mo.world || !mo.m) return { x: 0, z: 0 };
    return headOffset(mo.world, poseToWorld(0, pos[0], motionPose(mo.m, mo.m.frames[0].t)));
  }
  /* Where to look this frame (on = first person is the camera now). */
  function lookNow(on) {
    const c = serveClock(), fwd = sideSign(0) < 0 ? 1 : -1;
    return look({ on, reduce: reduced(), t: c.t, events: c.events, ball, eye: { y: -CAM_BACK, z: CAM_H }, fwd });
  }
  /* Does first person draw the ball itself? While you bounce, hold and toss it, the ball is closer than the
     camera can draw (the joints sit in the body plane), so drawSelf puts it just in front of your palm. */
  const ownsBall = () => !!(rally && rally.serve && S.server === 0);

  /* DRAW YOURSELF in first person: forearms, hands, racket and the ball in your hand, on the actor layer.
     Called last, so your hands are in front of everything. */
  function drawSelf() {
    const p = pos[0], P = PLAYERS[0], fwd = sideSign(0) < 0 ? 1 : -1, skin = "#e1b48b", c = serveClock();
    const D = c.events ? armDepth(c.t, c.events) : armDepth(0, { tossRelease: 1, trophy: 2, contact: 3 });
    const depth = w => (w.y + CAM_BACK) * CAM_PC + (w.z - CAM_H) * CAM_PS;                // distance along the view
    const seen = (...ws) => ws.every(w => w && depth(w) > NEAR);
    const W = p.motion && p.motion.world;
    if (W) {
      const J = n => W[n] && { x: W[n].x, y: W[n].y + fwd * (D[n] || 0), z: W[n].z };
      const along = (A, C, u) => A && C && { x: A.x + (C.x - A.x) * u, y: A.y + (C.y - A.y) * u, z: A.z + (C.z - A.z) * u };
      const limb = (A, C, col, wm) => {
        if (!seen(A, C)) return;
        const a = proj(A.x, A.y, A.z), e = proj(C.x, C.y, C.z);
        b.strokeStyle = col; b.lineCap = "round"; b.lineWidth = Math.max(1 / AS, q(wm * (a.s + e.s) / 2));
        b.beginPath(); b.moveTo(q(a.x), q(a.y)); b.lineTo(q(e.x), q(e.y)); b.stroke();
      };
      const hand = Wr => {                                      // a hand: a rounded block with a darker knuckle line
        if (!seen(Wr)) return;
        const h = proj(Wr.x, Wr.y, Wr.z), r = Math.max(1.5 / AS, 0.05 * h.s);
        b.fillStyle = skin; b.beginPath(); b.arc(q(h.x), q(h.y), r, 0, Math.PI * 2); b.fill();
        b.fillStyle = shade(skin, -0.2); b.fillRect(q(h.x - r * 0.7), q(h.y - r * 0.2), q(r * 1.4), Math.max(1 / AS, q(r * 0.18)));
      };
      const band = P.ui || "#f2f2f2";
      // racket arm first: the tossing arm is nearer the eye through most of the serve
      const re = J("rightElbow"), rw = J("rightWrist");
      if (seen(re, rw)) {
        const u = V3.norm({ x: rw.x - re.x, y: rw.y - re.y, z: rw.z - re.z });
        const tip = { x: rw.x + u.x * RACKET.len, y: rw.y + u.y * RACKET.len, z: rw.z + u.z * RACKET.len };
        if (seen(tip)) drawRacket(rw, u, V3.norm({ x: 0, y: u.z, z: -u.y }), RACKET_LOOK[P.id] || RACKET_LOOK.sinner);
        limb(re, rw, P.sleeve || skin, 0.085);
        limb(along(re, rw, 0.82), along(re, rw, 0.95), band, 0.095);                        // wristband
        hand(rw);
      }
      // tossing arm and hand (W.leftHand: the hand flexing at the wrist while it bounces the ball)
      const le = J("leftElbow"), lw = J("leftWrist"), lh = W.leftHand ? J("leftHand") : along(le, lw, 1.18);
      limb(le, lw, skin, 0.08);
      limb(along(le, lw, 0.82), along(le, lw, 0.95), band, 0.09);
      if (lw && lh) { limb(lw, lh, skin, 0.07); hand(lh); }
    }
    if (ball && ownsBall()) {                                   // the ball, never closer than just in front of your palm
      const ahead = Math.max((ball.y - p.y) * fwd, D.leftHand + 0.05);
      const shown = { x: ball.x, y: p.y + fwd * ahead, z: ball.z };
      if (seen(shown)) drawBall(shown, true);
    }
    if (rally && rally.serve && S.server === 0) {               // looking up at the toss: a chevron at the bottom edge points to your aim
      const a = proj(aim.x, aim.y);
      if (a.y > BH - 3) {
        const x = Math.max(6, Math.min(BW - 6, a.x)), y = BH - 3;
        b.fillStyle = "#d8ee4c"; b.beginPath(); b.moveTo(q(x - 4), q(y - 3)); b.lineTo(q(x + 4), q(y - 3)); b.lineTo(q(x), q(y + 1)); b.closePath(); b.fill();
      }
    }
  }

  root.Pov = { EYE, BEHIND, AFTER, LOOK_DOWN, LOOK_UP_MAX, STILL_UP,
               eyeHeight, wanted, headOffset, cam, look, armDepth, head, lookNow, ownsBall, drawSelf };
})(typeof window !== "undefined" ? window : globalThis);
