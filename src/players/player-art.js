// =====================================================================
// PLAYER ART — the detailed pixel figure drawn on captured joints (the real serve motions), and the
// locker-room portrait. Owner: Player Artist (agents/player-artist/). It only draws: it never moves a joint.
//
// PlayerArt.drawCapturedFigure(i, p, W)  W = joints in court metres (poseToWorld + stepMotion), on the actor layer
// PlayerArt.portrait(P, { surface })      → a 44×64 canvas: the pro from the front, in his kit for that court
// PlayerArt.skinOf(P)                     → [base, shade, light] skin tones per pro
//
// Uses the game's globals at draw time: b, proj, q, AS, shade, HAIR, drawRacket, RACKET_LOOK, V3, litLeft, PLAYERS.
// Joints and units are exactly the ones in src/serve/motion/MOTION_NOTES.md (body heights × heightM = metres).
// =====================================================================
(function () {
  const SKIN = { sinner: "#ecc29f", alcaraz: "#d8a277" };   // Sinner fair (ginger), Alcaraz tanned
  const skinOf = P => { const c = SKIN[P.id] || "#e1b48b"; return [c, shade(c, -0.18), shade(c, 0.14)]; };

  /* Body widths in metres, for a 1.85 m / 75 kg build (scaled by each pro's build). [start, end] = tapered. */
  const WID = { thigh: [0.16, 0.115], shin: [0.1, 0.066], calf: 0.118, upper: [0.092, 0.072], fore: [0.078, 0.054],
                sleeve: [0.14, 0.12], neck: 0.088, headRx: 0.084, headRy: 0.106, hand: 0.046, shoe: [0.125, 0.07] };

  /* Stable pixel noise (0..1) for hair and cloth texture: same pixel → same value, so nothing flickers. */
  const noise = (ix, iy) => { const v = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453; return v - Math.floor(v); };

  function drawCapturedFigure(i, p, W) {
    const P = PLAYERS[i], near = P.side !== "far", px = 1 / AS;
    const at = n => W[n] ? proj(W[n].x, W[n].y, W[n].z) : null;
    const g = proj(p.x, p.y), s = g.s;
    const build = Math.sqrt((P.weightKg / P.heightM) / (75 / 1.85));      // heavier for his height = thicker limbs
    const M = (m, min = px) => Math.max(min, m * s * build);              // metres → pixels, never thinner than a pixel
    const [skin, skinD, skinL] = skinOf(P);
    const lit = litLeft() ? -1 : 1;                                       // which screen side the main light is on
    const away = { x: -lit * 0.8, y: 0.6 };                               // shadow side of any shape: away from the light, and down
    const shirt = P.shirt, shorts = P.shorts, socks = P.socks || "#f1f1ee", shoes = P.shoes || "#f2f2f2", band = P.wristband || P.ui || "#f2f2f2";
    const lerp = (A, C, u) => ({ x: A.x + (C.x - A.x) * u, y: A.y + (C.y - A.y) * u });
    const add = (A, v, k) => ({ x: A.x + v.x * k, y: A.y + v.y * k });
    const unit = (A, C) => { const dx = C.x - A.x, dy = C.y - A.y, l = Math.hypot(dx, dy) || 1e-6; return { x: dx / l, y: dy / l }; };
    const poly = (pts, c) => { if (!pts.every(Boolean)) return; b.fillStyle = c; b.beginPath();
      pts.forEach((v, k) => (k ? b.lineTo(q(v.x), q(v.y)) : b.moveTo(q(v.x), q(v.y)))); b.closePath(); b.fill(); };
    const dot = (v, r, c) => { b.fillStyle = c; b.beginPath(); b.arc(q(v.x), q(v.y), Math.max(px * 0.6, r), 0, Math.PI * 2); b.fill(); };
    const line = (A, C, c, w = px) => { if (!A || !C) return; b.strokeStyle = c; b.lineWidth = w; b.lineCap = "round";
      b.beginPath(); b.moveTo(q(A.x), q(A.y)); b.lineTo(q(C.x), q(C.y)); b.stroke(); };
    const Rr = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(q(x), q(y), Math.max(px, q(w)), Math.max(px, q(h))); };

    /* A limb from A to C: a tapered body wa → wc wide (metres), round ends, a shaded side away from the light
       and a lit edge on the other. Returns the side normal so details (creases, hems) can sit on it. */
    const limb = (A, C, wa, wc, col, opt = {}) => {
      if (!A || !C) return null;
      const d = unit(A, C); let n = { x: -d.y, y: d.x };
      if (n.x * away.x + n.y * away.y < 0) n = { x: -n.x, y: -n.y };     // n points to the shadow side
      const ra = M(wa) / 2, rc = M(wc) / 2;
      poly([add(A, n, ra), add(C, n, rc), add(C, n, -rc), add(A, n, -ra)], col);
      if (!opt.flat) { dot(A, ra, col); dot(C, rc, col); }
      if (ra > px) {
        poly([add(A, n, ra), add(C, n, rc), add(C, n, rc * 0.25), add(A, n, ra * 0.25)], shade(col, opt.dark ?? -0.2));
        if (ra > 1.6 * px) line(add(lerp(A, C, 0.12), n, -ra * 0.62), add(lerp(A, C, 0.82), n, -rc * 0.62), shade(col, opt.light ?? 0.16));
      }
      return n;
    };

    /* A shoe under the ankle: upper, sole, an accent stripe; from behind the heel counter and pull tab,
       from the front the toe box and laces. */
    const shoe = (A, K) => {
      if (!A) return;
      const w = M(WID.shoe[0], 2 * px), h = M(WID.shoe[1], 1.5 * px), toe = K && !near ? Math.sign(A.x - K.x) * w * 0.08 : 0;
      const x0 = A.x - w / 2 + toe, y0 = A.y - h * 0.25;
      Rr(x0, y0, w, h, shoes);
      Rr(x0 + (lit < 0 ? w * 0.62 : 0), y0, w * 0.38, h * 0.8, shade(shoes, -0.12));        // shaded side
      Rr(x0 - px * 0.5, y0 + h * 0.78, w + px, Math.max(px, h * 0.26), shade(shoes, -0.45)); // sole
      Rr(x0 + w * 0.15, y0 + h * 0.45, w * 0.7, px, P.ui || "#d23a3a");                      // accent stripe
      if (near) { Rr(A.x - w * 0.2, y0, w * 0.4, h * 0.55, shade(shoes, -0.3));              // heel counter
                  Rr(A.x - px * 0.5, y0 - px, px, px, P.ui || "#d23a3a"); }                   // pull tab
      else { Rr(A.x - w * 0.22, y0, w * 0.44, h * 0.42, "#ffffff");                          // tongue and laces
             if (h > 2 * px) Rr(A.x - w * 0.22, y0 + h * 0.2, w * 0.44, px, shade(shoes, -0.4)); }
    };

    // the soft contact shadow under him
    b.fillStyle = "rgba(0,0,0,0.30)"; b.beginPath(); b.ellipse(q(g.x), q(g.y), M(0.32), Math.max(px, M(0.09)), 0, 0, Math.PI * 2); b.fill();

    const lH = at("leftHip"), rH = at("rightHip"), lK = at("leftKnee"), rK = at("rightKnee");
    const lS = at("leftShoulder"), rS = at("rightShoulder"), Nk = at("neck"), No = at("nose");
    const legs = [["left", lH, lK, at("leftAnkle"), rH], ["right", rH, rK, at("rightAnkle"), lH]];

    /* ARMS: upper arm, forearm (or his compression sleeve), wristband with a stripe, a hand; the short sleeve over the top. */
    const arm = sd => {
      const S0 = at(sd + "Shoulder"), E = at(sd + "Elbow"), Wr = at(sd + "Wrist");
      if (!S0 || !E || !Wr) return;
      limb(S0, E, WID.upper[0], WID.upper[1], skin);
      const fore = sd === "right" && P.sleeve ? P.sleeve : skin;
      limb(E, Wr, WID.fore[0], WID.fore[1], fore);
      const n = limb(lerp(Wr, E, 0.22), lerp(Wr, E, 0.06), 0.072, 0.068, band, { flat: true, dark: -0.15 });
      if (n && M(0.07) > 2.5 * px) line(add(lerp(Wr, E, 0.14), n, M(0.036)), add(lerp(Wr, E, 0.14), n, -M(0.036)), shade(band, -0.3));   // stripe
      const Hd = sd === "left" && W.leftHand ? at("leftHand") : add(Wr, unit(E, Wr), M(0.045));
      if (sd === "left" && W.leftHand) limb(Wr, Hd, 0.06, 0.05, skin, { dark: -0.15 });
      dot(Hd, M(WID.hand / 1.6), skinL); dot(add(Hd, away, M(0.012)), M(WID.hand / 3), skin);
      // short sleeve: a little wider than the arm, its hem darker; it rides up when the arm is raised
      const raise = Math.max(0, Math.min(1, (S0.y - E.y) / Math.max(px, M(0.18))));
      const SE = lerp(S0, E, 0.4 - 0.12 * raise);
      limb(S0, SE, WID.sleeve[0], WID.sleeve[1], shirt, { flat: true, dark: -0.18 });
      const d = unit(S0, E), o = { x: -d.y, y: d.x };
      line(add(SE, o, M(WID.sleeve[1] / 2)), add(SE, o, -M(WID.sleeve[1] / 2)), shade(shirt, -0.3));
    };
    /* Depth: seen from behind, an arm whose hand has crossed the body's middle below the shoulders is in front
       of him, so his legs, shorts and shirt hide it (drawn first, with its racket); seen from the front every arm
       is drawn over the chest. */
    const cx = lS && rS ? (lS.x + rS.x) / 2 : g.x;
    const hidden = sd => {
      const S0 = at(sd + "Shoulder"), Wr = at(sd + "Wrist");
      return near && !!S0 && !!Wr && Math.sign(Wr.x - cx) !== Math.sign(S0.x - cx) && Math.abs(Wr.x - cx) > M(0.06) && Wr.y > S0.y;
    };
    const racket = () => {
      if (!W.rightElbow || !W.rightWrist) return;                                // a real 3D racket continuing the right forearm
      const e = W.rightElbow, r = W.rightWrist, u = V3.norm({ x: r.x - e.x, y: r.y - e.y, z: r.z - e.z });
      const n = V3.norm({ x: 0, y: u.z, z: -u.y });                                // face square to the forearm, toward the net
      drawRacket(r, u, n, RACKET_LOOK[P.id] || RACKET_LOOK.sinner);
    };
    const racketHidden = hidden("right");
    if (racketHidden) racket();
    for (const sd of ["left", "right"]) if (hidden(sd)) arm(sd);

    // LEGS: thigh, knee, a calf that bulges, socks with a ribbed top, shoes
    for (const [, Hp, Kp, Ap] of legs) {
      if (!Hp || !Kp || !Ap) continue;
      limb(Hp, Kp, WID.thigh[0], WID.thigh[1], skin);
      const Cf = lerp(Kp, Ap, 0.3);
      limb(Kp, Cf, WID.shin[0], WID.calf, skin, { flat: true }); limb(Cf, Ap, WID.calf, WID.shin[1], skin);
      const kd = unit(Hp, Kp);
      if (near) line(add(Kp, { x: -kd.y, y: kd.x }, M(0.035)), add(Kp, { x: kd.y, y: -kd.x }, M(0.035)), skinD);   // crease behind the knee
      else dot(add(Kp, kd, -M(0.01)), M(0.028), skinL);                                                              // kneecap
      const So = lerp(Ap, Kp, 0.17);
      const sd = unit(So, Ap), across = { x: -sd.y, y: sd.x };
      limb(So, Ap, 0.082, 0.074, socks, { dark: -0.12 }); line(add(So, across, -M(0.04)), add(So, across, M(0.04)), shade(socks, -0.2));   // ribbed top
      shoe(Ap, Kp);
    }

    // SHORTS: one piece from the waistband to above the knees, split between the legs, hems, pull creases
    if (lH && rH && lK && rK) {
      const hipU = unit(lH, rH), up = { x: hipU.y, y: -hipU.x };                     // "up" for the pelvis on screen
      const upV = up.y > 0 ? { x: -up.x, y: -up.y } : up;
      const end = (Hp, Kp, other) => {                                              // a leg's hem: outer and inner corner
        const e = lerp(Hp, Kp, 0.56), d = unit(Hp, Kp); let o = { x: -d.y, y: d.x };
        if (o.x * (Hp.x - other.x) < 0) o = { x: -o.x, y: -o.y };
        return [add(e, o, M(0.108)), add(e, o, -M(0.09))];
      };
      const [lo, li] = end(lH, lK, rH), [ro, ri] = end(rH, rK, lH);
      const wl = add(add(lH, upV, M(0.075)), hipU, -M(0.08)), wr = add(add(rH, upV, M(0.075)), hipU, M(0.08));
      const hl = add(lH, hipU, -M(0.11)), hr = add(rH, hipU, M(0.11)), mid = lerp(lH, rH, 0.5), crotch = add(mid, upV, -M(0.11));
      poly([wl, wr, hr, ro, ri, crotch, li, lo, hl], shorts);
      const shadowRight = lit < 0;                                                  // the leg away from the light is darker
      poly(shadowRight ? [lerp(wl, wr, 0.55), wr, hr, ro, ri, crotch] : [wl, lerp(wl, wr, 0.45), crotch, li, lo, hl], shade(shorts, -0.13));
      line(wl, wr, shade(shorts, -0.24), M(0.034));                                 // waistband
      line(add(mid, upV, M(0.06)), crotch, shade(shorts, -0.28));                   // centre seam
      line(lo, li, shade(shorts, -0.3)); line(ro, ri, shade(shorts, -0.3));         // hems
      line(lerp(crotch, li, 0.3), lerp(lo, hl, 0.45), shade(shorts, -0.2));          // pull creases from the crotch
      line(lerp(crotch, ri, 0.3), lerp(ro, hr, 0.45), shade(shorts, -0.2));
      line(lerp(lo, hl, 0.2), lerp(wl, hl, 0.6), shade(shorts, 0.14));              // lit edge of the cloth
    }

    // SHIRT: shoulders to below the hips; it hangs in a curve, lifts and creases on the side of a raised arm
    if (lS && rS && lH && rH) {
      const su = unit(lS, rS), lE = at("leftElbow"), rE = at("rightElbow");
      const raise = (S0, E) => (S0 && E ? Math.max(0, Math.min(1, (S0.y - E.y) / Math.max(px, M(0.15)))) : 0);
      const rl = raise(lS, lE), rr = raise(rS, rE);
      const down = { x: 0, y: 1 };
      const tl = add(add(lS, su, -M(0.045)), down, -M(0.012)), tr = add(add(rS, su, M(0.045)), down, -M(0.012));
      const al = add(lerp(lS, lH, 0.26), su, -M(0.06 - 0.02 * rl)), ar = add(lerp(rS, rH, 0.26), su, M(0.06 - 0.02 * rr));
      const hu = unit(lH, rH);
      const el = add(add(lH, hu, -M(0.085 - 0.03 * rl)), down, M(0.1 - 0.07 * rl)), er = add(add(rH, hu, M(0.085 - 0.03 * rr)), down, M(0.1 - 0.07 * rr));
      const em = add(lerp(el, er, 0.5), down, M(0.025));
      const ne = Nk || lerp(lS, rS, 0.5), cl = add(ne, su, -M(0.06)), cr = add(ne, su, M(0.06));
      const body = [cl, tl, al, el, lerp(el, em, 0.5), em, lerp(em, er, 0.5), er, ar, tr, cr];
      poly(body, shirt);
      if (P.shirtLow) for (let k = 1; k <= 3; k++)                                 // a fade: dark at the shoulders, light at the hem
        poly([lerp(al, el, k / 4), lerp(ar, er, k / 4), er, em, el], mixHex(shirt, P.shirtLow, k / 3));
      const shR = lit < 0;                                                         // the side away from the light
      poly(shR ? [lerp(cl, cr, 0.7), cr, tr, ar, er, lerp(em, er, 0.3), lerp(lerp(el, er, 0.5), ne, 0.4)]
               : [cl, lerp(cl, cr, 0.3), lerp(lerp(el, er, 0.5), ne, 0.4), lerp(el, em, 0.7), el, al, tl], shade(shirt, -0.15));
      line(shR ? lerp(tl, al, 0.4) : lerp(tr, ar, 0.4), shR ? lerp(al, el, 0.7) : lerp(ar, er, 0.7), shade(shirt, 0.15));   // lit flank
      const fold = shade(shirt, -0.26), foldL = shade(shirt, 0.1);
      // creases pulled from the raised arm's armpit down to the other hip (the windup and the toss)
      for (const [r0, A0, H0] of [[rl, al, er], [rr, ar, el]]) if (r0 > 0.25) {
        line(lerp(A0, H0, 0.08), lerp(A0, H0, 0.5), fold); line(add(lerp(A0, H0, 0.25), down, M(0.04)), lerp(A0, H0, 0.68), fold);
        if (r0 > 0.6) line(add(lerp(A0, H0, 0.1), down, M(0.02)), add(lerp(A0, H0, 0.45), down, M(0.02)), foldL);
      }
      // the hem gathers into soft vertical folds, and the hem itself is a darker band
      for (const u of [0.24, 0.5, 0.76]) { const hm = lerp(el, er, u); line(add(hm, down, -M(0.13)), add(hm, down, -M(0.01)), fold); }
      line(add(lerp(el, er, 0.36), down, -M(0.09)), add(lerp(el, er, 0.38), down, -M(0.01)), foldL);
      line(el, em, shade(shirt, -0.2), M(0.02)); line(em, er, shade(shirt, -0.2), M(0.02));
      if (near) {                                                                  // the BACK: collar, shoulder seams, shoulder blades
        line(cl, cr, shade(shirt, -0.3), M(0.03));
        line(cl, tl, shade(shirt, -0.12)); line(cr, tr, shade(shirt, -0.12));
        for (const [S0, r0, sg] of [[lS, rl, -1], [rS, rr, 1]]) {
          const bl = add(lerp(S0, lerp(lH, rH, 0.5), 0.3), su, -sg * M(0.03));
          line(bl, add(bl, su, sg * M(0.07 + 0.03 * r0)), shade(shirt, -0.14 - 0.1 * r0));
        }
      } else {                                                                     // the FRONT: crew neck showing the throat, a placket
        poly([cl, cr, add(ne, down, M(0.05))], skin);
        line(cl, add(ne, down, M(0.05)), shade(shirt, -0.3)); line(cr, add(ne, down, M(0.05)), shade(shirt, -0.3));
        line(add(ne, down, M(0.05)), add(ne, down, M(0.13)), shade(shirt, -0.25));
      }
    }
    for (const sd of ["left", "right"]) if (!hidden(sd)) arm(sd);
    if (!near && !racketHidden) racket();

    // HEAD: neck, then the head as a pixel blob (hair texture, cap panels, face), the signature look on top
    if (Nk && No) {
      const rx = M(WID.headRx, 1.5 * px), ry = M(WID.headRy, 2 * px), hx = No.x, hy = No.y - M(0.035);
      limb(Nk, { x: hx, y: hy + ry * 0.55 }, WID.neck, WID.neck * 0.92, skinD, { dark: -0.12 });
      drawHead(P, near, hx, hy, rx, ry, { skin, skinD, skinL, lit, px, look: W._look });
    }
    if (near && !racketHidden) racket();
  }

  /* Fill an ellipse pixel by pixel on the actor grid; col(u, v, ix, iy) gives the colour (or null) for each pixel,
     u/v run −1..1 across the ellipse, ix/iy are stable pixel indices for texture. */
  function blob(cx, cy, rx, ry, col, test = true) {
    const px = 1 / AS, x0 = q(cx - rx), y0 = q(cy - ry);
    for (let y = y0; y < cy + ry; y += px) for (let x = x0; x < cx + rx; x += px) {
      const u = (x + px / 2 - cx) / rx, v = (y + px / 2 - cy) / ry;
      if (test && u * u + v * v > 1) continue;
      const c = col(u, v, Math.round((x - x0) * AS), Math.round((y - y0) * AS));
      if (c) { b.fillStyle = c; b.fillRect(x, y, px, px); }
    }
  }

  /* The head, seen from behind (near) or from the front (far), with each pro's signature look exaggerated:
     Sinner "cap-curls" (oversized cap, bright ginger curls flaring out), Alcaraz "long-band" (long hair, white band, beard). */
  function drawHead(P, near, hx, hy, rx, ry, T) {
    const { skin, skinD, skinL, lit, px, look } = T;
    const [hair, hairD, hairL] = HAIR[P.id] || [P.hair, shade(P.hair, -0.35), shade(P.hair, 0.25)];
    const L = P.look || {}, cap = P.cap || (L.style === "cap-curls" ? "#f2f2ef" : null);
    const curl = (ix, iy, u) => {                                       // ginger curls: loops of light and shadow, darker on the shaded side
      const k = noise(ix, iy), ring = ((ix + 2 * (iy >> 1)) % 3 + 3) % 3;
      if (u * lit < -0.45 && k < 0.5) return hairD;
      return ring === 0 ? (k > 0.55 ? hairL : hair) : ring === 1 ? hair : (k > 0.7 ? hairD : hair);
    };
    const strand = (ix, iy, u) => {                                     // straight, long hair: vertical strands
      const k = noise(ix, iy >> 2);
      if (u * lit < -0.5) return k > 0.6 ? hair : hairD;
      return k > 0.82 ? hairL : k < 0.25 ? hairD : hair;
    };
    const ears = () => { for (const sg of [-1, 1]) { Rr2(hx + sg * rx - (sg > 0 ? 0 : px), hy + ry * 0.02, px, Math.max(px, ry * 0.34), skin);
                                                     Rr2(hx + sg * rx - (sg > 0 ? 0 : px), hy + ry * 0.2, px, px, skinD); } };
    if (near) {                                                         // ---- FROM BEHIND: no face
      if (L.style === "cap-curls" || cap) {
        blob(hx, hy, rx * 1.04, ry, (u, v, ix, iy) => (v > -0.1 ? curl(ix, iy, u) : hairD));   // hair covers the back of the head
        for (const sg of [-1, 1]) for (let k = 0; k < 4; k++) {          // curls flaring out under the cap at the sides
          const cxk = hx + sg * rx * (1.08 + 0.12 * (k % 2)), cyk = hy + ry * (0.0 + k * 0.2);
          blob(cxk, cyk, Math.max(px, rx * 0.2), Math.max(px, ry * 0.13), (u, v, ix, iy) => curl(ix + k * 3, iy, sg * lit < 0 ? -1 : 0.2));
        }
        ears();                                                         // the ears show between the curls
        for (let k = 0; k < 6; k++)                                     // a thick curly nape
          blob(hx - rx * 0.8 + rx * 1.6 * k / 5, hy + ry * (0.86 + 0.06 * (k % 2)), Math.max(px, rx * 0.2), Math.max(px, ry * 0.12),
               (u, v, ix, iy) => curl(ix + k * 5, iy + 1, (k / 5 - 0.5) * 2));
        blob(hx, hy - ry * 0.02, rx * 1.17, ry * 1.04, (u, v) => {        // the oversized crown: six panels, shaded, a button on top
          if (v > 0.08) return null;
          const panel = Math.abs(u) < 0.05 || Math.abs(Math.abs(u) - 0.6 * Math.sqrt(Math.max(0, 1 + v))) < 0.05;
          let c = u * lit < -0.35 ? shade(cap, -0.14) : u * lit > 0.4 && v < -0.4 ? shade(cap, 0.1) : cap;
          if (panel && v > -0.92) c = shade(c, -0.18);
          if (v < -0.9 && Math.abs(u) < 0.14) c = shade(cap, -0.3);
          if (v > 0.0) c = shade(c, -0.08);                               // the band at the bottom of the crown
          return c;
        });
        blob(hx, hy + ry * 0.02, Math.max(px, rx * 0.26), Math.max(px, ry * 0.14), (u, v, ix, iy) => (v < 0.2 ? curl(ix, iy, 0) : null));   // hair through the strap opening
        Rr2(hx - rx * 0.32, hy + ry * 0.1, rx * 0.64, Math.max(px, ry * 0.08), shade(cap, -0.32));      // strap
      } else {                                                          // long hair down to the neck, a hairband round the head
        blob(hx, hy, rx * 1.08, ry * 1.02, (u, v, ix, iy) => strand(ix, iy, u));
        ears();
        for (let k = 0; k < 7; k++) {                                   // long, wavy ends past the nape
          const x = hx - rx * 1.02 + rx * 2.04 * k / 6, len = ry * (0.45 + 0.25 * ((k * 3) % 4) / 3);
          Rr2(x - px, hy + ry * 0.4, px * 2.5, len, k % 2 ? hairD : hair);
          if (k % 3 === 1) Rr2(x, hy + ry * 0.4 + len * 0.3, px, len * 0.5, hairL);
        }
        if (L.style === "long-band") { blob(hx, hy - ry * 0.62, rx * 0.9, ry * 0.38, (u, v, ix, iy) => (v < 0.3 ? strand(ix, iy, u) : null));   // volume over the band
          Rr2(hx - rx * 1.1, hy - ry * 0.36, rx * 2.2, Math.max(px, ry * 0.2), L.band || "#f6f6f2");
          Rr2(hx - rx * 1.1, hy - ry * 0.16, rx * 2.2, px, shade(L.band || "#f6f6f2", -0.25)); }
      }
      if (look && Math.abs(look.x) > 0.15) {                            // head turned to the box: cheek, nose and the cap's brim show on that side
        const sd = Math.sign(look.x), a = Math.min(1, Math.abs(look.x));
        blob(hx + sd * rx * 0.72, hy + ry * 0.28, rx * 0.34 * a + px, ry * 0.5, () => skin);   // cheek
        Rr2(hx + sd * rx * (1.02 + 0.12 * a) - (sd < 0 ? px : 0), hy + ry * 0.25, px * 2, px * 2, skin);   // nose tip past the outline
        Rr2(hx + sd * rx * 0.62, hy + ry * 0.62, rx * 0.3, px, skinD);                                       // jaw shadow
        if (cap) Rr2(sd > 0 ? hx + rx * 0.5 : hx - rx * (0.5 + a), hy - ry * 0.12, rx * (0.4 + a), Math.max(px, ry * 0.22), shade(cap, -0.2));   // brim
      }
      return;
    }
    // ---- FROM THE FRONT: a face, then hair and the signature look
    if (L.style !== "cap-curls" && !cap) blob(hx, hy + ry * 0.1, rx * 1.12, ry * 1.08, (u, v, ix, iy) => (v < 0.9 ? strand(ix, iy, u) : null));   // hair behind the face, to the jaw
    blob(hx, hy, rx, ry, (u, v) => {                                    // the face: shaded on the side away from the light, lit cheek
      if (u * lit < -0.5) return skinD;
      if (u * lit > 0.35 && v > -0.1 && v < 0.5) return skinL;
      return skin;
    });
    const lk = look ? look.x * rx * 0.38 : 0, lu = look ? look.up * ry * 0.3 : 0;   // the face turns to where he looks (box, then the toss)
    hx += lk; hy -= lu;                                                 // features only: moved back below
    const eyeY = hy + ry * 0.02, ex = Math.max(px, rx * 0.4);
    if (rx > 2.5 * px) {                                                // big enough for features
      Rr2(hx - ex - px, eyeY - Math.max(px, ry * 0.18), px * 2.5, px, hairD); Rr2(hx + ex - px * 1.5, eyeY - Math.max(px, ry * 0.18), px * 2.5, px, hairD);   // brows
      Rr2(hx - ex - px * 0.5, eyeY, px * 2, px, "#f4f1ea"); Rr2(hx + ex - px * 1.5, eyeY, px * 2, px, "#f4f1ea");   // whites
      Rr2(hx - ex, eyeY, px, px, "#2a3a46"); Rr2(hx + ex - px, eyeY, px, px, "#2a3a46");                             // irises
      Rr2(hx - px * 0.5, eyeY + px, px, Math.max(px, ry * 0.26), skinD); Rr2(hx - px * 0.5 + lit * px, eyeY + ry * 0.3, px, px, skinD);   // nose
      Rr2(hx - rx * 0.28, hy + ry * 0.58, rx * 0.56, px, "#a4574a");                                                 // mouth
    } else { Rr2(hx - ex, eyeY, px, px, "#1b1b1f"); Rr2(hx + ex - px, eyeY, px, px, "#1b1b1f"); }
    hx -= lk; hy += lu;
    for (const sg of [-1, 1]) Rr2(hx + sg * rx - (sg > 0 ? 0 : px), hy + ry * 0.0, px, Math.max(px, ry * 0.3), sg * lit < 0 ? skinD : skin);   // ears
    if (L.style === "cap-curls" || cap) {
      for (const sg of [-1, 1]) for (let k = 0; k < 3; k++)              // curls flaring out under the cap
        blob(hx + sg * rx * (1.05 + 0.12 * (k % 2)), hy - ry * 0.1 + k * ry * 0.24, Math.max(px, rx * 0.2), Math.max(px, ry * 0.13),
             (u, v, ix, iy) => curl(ix + k * 3, iy, sg * lit < 0 ? -1 : 0.3));
      blob(hx, hy - ry * 0.25, rx * 1.15, ry * 0.95, (u, v) => (v > 0.0 ? null : u * lit < -0.4 ? shade(cap, -0.14) : Math.abs(u) < 0.06 && v > -0.9 ? shade(cap, -0.15) : cap));   // crown
      Rr2(hx - rx * 1.3 + lit * px, hy - ry * 0.3, rx * 2.6, Math.max(px, ry * 0.2), shade(cap, -0.2));   // the long brim, pointing at you
      Rr2(hx - rx * 0.9, hy - ry * 0.1, rx * 1.8, px, shade(skin, -0.25));                                // its shadow on the forehead
    } else {
      blob(hx, hy - ry * 0.55, rx * 1.12, ry * 0.6, (u, v, ix, iy) => (v < 0.35 ? strand(ix, iy, u) : null));   // hair over the forehead
      if (L.style === "long-band") { Rr2(hx - rx * 1.12, hy - ry * 0.5, rx * 2.24, Math.max(px, ry * 0.18), L.band || "#f6f6f2");
                                     Rr2(hx - rx * 1.12, hy - ry * 0.32, rx * 2.24, px, shade(L.band || "#f6f6f2", -0.25)); }
      if (L.beard) blob(hx, hy + ry * 0.5, rx * 0.98, ry * 0.52, (u, v, ix, iy) => {   // beard on the cheeks, jaw and chin, mouth showing
        if (v < -0.25 && Math.abs(u) < 0.62) return null;
        if (Math.abs(v - 0.1) < 0.18 && Math.abs(u) < 0.3) return v > 0.08 ? "#b8695a" : hairD;
        return noise(ix, iy) > 0.8 ? hair : hairD;
      });
    }
  }
  function Rr2(x, y, w, h, c) { const px = 1 / AS; b.fillStyle = c; b.fillRect(q(x), q(y), Math.max(px, q(w)), Math.max(px, q(h))); }
  function mixHex(a, c, t) {
    const A = parseInt(a.slice(1), 16), C = parseInt(c.slice(1), 16), m = sh => Math.round(((A >> sh) & 255) * (1 - t) + ((C >> sh) & 255) * t);
    return "#" + [16, 8, 0].map(sh => m(sh).toString(16).padStart(2, "0")).join("");
  }

  /* LOCKER-ROOM PORTRAIT: the pro standing, seen from the front, in his kit for the court, racket in his right hand.
     A 44×64 pixel canvas (shown at any size with image-rendering: pixelated); height scales with heightM. */
  function portrait(P, opts = {}) {
    const surface = opts.surface || "hard", K = { ...P, ui: P.ui || P.shirt, ...((P.outfits && P.outfits[surface]) || {}) };
    const c = document.createElement("canvas"); c.width = 44; c.height = 64; c.className = opts.className || "lr-sprite";
    const g = c.getContext("2d");
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    const [skin, skinD, skinL] = skinOf(K), [hair, hairD, hairL] = HAIR[K.id] || [K.hair, shade(K.hair, -0.35), shade(K.hair, 0.25)];
    const L = K.look || {}, capC = K.cap || (L.style === "cap-curls" ? "#f2f2ef" : null);
    const k = Math.min(1, K.heightM / 1.95), top = 62 - Math.round(58 * k), Y = f => top + Math.round(f * 58 * k), cx = 22;
    const shirt = K.shirt, shorts = K.shorts, shoes = K.shoes || "#f2f2f2", socks = K.socks || "#f1f1ee", band = K.wristband || K.ui;
    const look = (typeof RACKET_LOOK !== "undefined" && (RACKET_LOOK[K.id] || RACKET_LOOK.sinner)) || { frame: "#1d1d22", accent: "#f2f2ef" };
    g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(cx - 11, 62, 22, 2);                         // ground shadow
    // legs, knees, socks, shoes (light from the left: the right side of each shape is darker)
    for (const sg of [-1, 1]) {
      const lx = cx + sg * 4 - 2;
      R(lx, Y(0.62), 4, Y(0.9) - Y(0.62), skin); R(lx + 3, Y(0.62), 1, Y(0.9) - Y(0.62), skinD);
      R(lx + 1, Y(0.75), 2, 1, skinL);                                                         // kneecap
      R(lx, Y(0.9), 4, Y(0.95) - Y(0.9), socks); R(lx, Y(0.9), 4, 1, shade(socks, -0.18));
      R(lx - (sg < 0 ? 1 : 0), Y(0.95), 5, 62 - Y(0.95) - 1, shoes); R(lx - (sg < 0 ? 1 : 0), 61, 5, 1, shade(shoes, -0.45));
      R(lx, Y(0.95), 3, 1, "#ffffff"); R(lx + 1, Y(0.95) + 1, 2, 1, K.ui || "#d23a3a");          // laces, accent
    }
    // shorts: waistband, split, hems, shaded side
    R(cx - 7, Y(0.5), 14, Y(0.64) - Y(0.5), shorts); R(cx + 3, Y(0.5), 4, Y(0.64) - Y(0.5), shade(shorts, -0.13));
    R(cx - 7, Y(0.5), 14, 1, shade(shorts, -0.24)); R(cx, Y(0.58), 1, Y(0.64) - Y(0.58), shade(shorts, -0.3));
    R(cx - 7, Y(0.64) - 1, 6, 1, shade(shorts, -0.3)); R(cx + 1, Y(0.64) - 1, 6, 1, shade(shorts, -0.3));
    // shirt: broad shoulders, tapering to a hem that hangs over the shorts; shaded side, folds, crew neck
    for (let y = Y(0.2); y < Y(0.53); y++) {
      const t = (y - Y(0.2)) / (Y(0.53) - Y(0.2)), hw = Math.round(9 - 2 * Math.min(1, t * 1.6));
      R(cx - hw, y, hw * 2, 1, K.shirtLow ? mixHex(shirt, K.shirtLow, t) : shirt);
      R(cx + hw - 3, y, 3, 1, shade(K.shirtLow ? mixHex(shirt, K.shirtLow, t) : shirt, -0.15));
    }
    R(cx - 8, Y(0.22), 1, Y(0.4) - Y(0.22), shade(shirt, 0.14));                               // lit flank
    R(cx - 3, Y(0.42), 1, Y(0.53) - Y(0.42), shade(shirt, -0.26)); R(cx + 2, Y(0.44), 1, Y(0.53) - Y(0.44), shade(shirt, -0.26));   // hem folds
    R(cx - 7, Y(0.53) - 1, 14, 1, shade(shirt, -0.2));                                         // hem
    R(cx - 2, Y(0.2), 4, 2, skin); R(cx - 3, Y(0.2), 1, 2, shade(shirt, -0.3)); R(cx + 2, Y(0.2), 1, 2, shade(shirt, -0.3));   // crew neck
    // arms: sleeves, arms, wristbands, hands; the right hand (his right = your left) holds the racket
    for (const sg of [-1, 1]) {
      const ax = sg < 0 ? cx - 12 : cx + 9;
      R(ax, Y(0.21), 3, Y(0.3) - Y(0.21), shirt); R(ax, Y(0.3) - 1, 3, 1, shade(shirt, -0.3));
      R(ax, Y(0.3), 3, Y(0.46) - Y(0.3), sg < 0 && K.sleeve ? K.sleeve : skin); R(ax + 2, Y(0.3), 1, Y(0.46) - Y(0.3), skinD);
      R(ax, Y(0.43), 3, 2, band); R(ax, Y(0.46), 3, 2, skinL);
    }
    // racket: grip from the right hand, throat, oval frame with strings, accent
    const rx0 = cx - 11, gy = Y(0.47);
    R(rx0, gy, 2, 5, "#2b2b31"); R(rx0, gy + 5, 1, 2, look.frame); R(rx0 + 1, gy + 5, 1, 2, look.frame);
    const fy = gy + 7, fw = 7, fh = 10;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const u = (x + 0.5 - fw / 2) / (fw / 2), v = (y + 0.5 - fh / 2) / (fh / 2), d = u * u + v * v;
      if (d > 1) continue;
      const edge = d > 0.55;
      R(rx0 - 2.5 + x, fy + y, 1, 1, edge ? (v < -0.5 ? look.accent : look.frame) : ((x + y) % 2 ? "#e9e9de" : "#b9bcb4"));
    }
    // neck and head: face, then the signature look
    R(cx - 2, Y(0.17), 4, Y(0.2) - Y(0.17), skinD);
    const hx = cx - 4, hy = Y(0.02), hw = 8, hh = Y(0.17) - Y(0.02);
    if (!capC) R(hx - 1, hy + 1, hw + 2, hh + 1, hair);                                        // long hair behind the face
    R(hx, hy, hw, hh, skin); R(hx + hw - 2, hy + 2, 2, hh - 3, skinD); R(hx + 1, hy + hh - 4, 1, 1, skinL);
    R(hx - 1, hy + 4, 1, 2, skin); R(hx + hw, hy + 4, 1, 2, skinD);                            // ears
    const ey = hy + Math.round(hh * 0.48);
    R(hx + 1, ey - 1, 2, 1, hairD); R(hx + 5, ey - 1, 2, 1, hairD);                            // brows
    R(hx + 1, ey, 2, 1, "#f4f1ea"); R(hx + 5, ey, 2, 1, "#f4f1ea"); R(hx + 2, ey, 1, 1, "#2a3a46"); R(hx + 5, ey, 1, 1, "#2a3a46");   // eyes
    R(hx + 4, ey + 1, 1, 2, skinD); R(hx + 3, hy + hh - 2, 2, 1, "#a4574a");                  // nose, mouth
    if (L.style === "cap-curls" || capC) {
      for (const [x, y, col] of [[-2, 3, hair], [-3, 4, hairL], [-2, 5, hairD], [-3, 6, hair], [-2, 7, hairL],
                                 [hw + 1, 3, hair], [hw + 2, 4, hairD], [hw + 1, 5, hairL], [hw + 2, 6, hair], [hw + 1, 7, hairD]])
        R(hx + x, hy + y - 1, 2, 2, col);                                                       // curls flaring out
      R(hx - 1, hy - 3, hw + 2, 4, capC); R(hx + hw - 2, hy - 3, 3, 4, shade(capC, -0.14)); R(hx + 3, hy - 3, 1, 4, shade(capC, -0.15));
      R(hx + 3, hy - 4, 2, 1, shade(capC, -0.3));                                              // button
      R(hx - 2, hy + 1, hw + 4, 1, shade(capC, -0.2)); R(hx, hy + 2, hw, 1, shade(skin, -0.25));   // brim + its shadow
    } else {
      R(hx - 1, hy - 3, hw + 2, 4, hair); R(hx + 1, hy - 4, hw - 2, 1, hair);
      for (let x = 0; x < hw + 2; x++) if ((x * 7) % 3 === 0) R(hx - 1 + x, hy - 3 + (x % 2), 1, 1, x % 2 ? hairL : hairD);   // texture
      if (L.style === "long-band") { R(hx - 1, hy - 1, hw + 2, 1, L.band || "#f6f6f2"); R(hx - 1, hy, hw + 2, 1, shade(L.band || "#f6f6f2", -0.25)); }
      if (L.beard) { R(hx, hy + hh - 4, hw, 4, hairD); R(hx + 3, hy + hh - 2, 2, 1, "#b8695a"); R(hx + 2, hy + hh - 3, 4, 1, hairD);
                     R(hx + 1, hy + hh - 1, 1, 1, hair); R(hx + 6, hy + hh - 2, 1, 1, hair); }
    }
    return c;
  }

  window.PlayerArt = { drawCapturedFigure, portrait, skinOf };
})();
