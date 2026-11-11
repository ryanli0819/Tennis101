// =====================================================================
// PIXEL LOOKS — the signature on each pro's head, plus a standing portrait
// for the preview page. Owner: Player Artist (src/players/).
//
// The match draws the body in index.html (Animator owns the frames) and
// calls PlayerArt.drawLook for every style except Sinner's cap-curls and
// Alcaraz's long-band, which already live there. This file draws those two
// as well, so the preview can show the reference next to the rest.
// No brand marks. One skin tone for every pro.
// =====================================================================
(function () {
  const SKIN = "#e1b48b";

  function shade(hex, amt) {
    if (window.shade) return window.shade(hex, amt);
    const n = parseInt(String(hex).slice(1), 16);
    if (!Number.isFinite(n)) return hex;
    const f = c => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) : c) * amt)));
    return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  function hairOf(P) {
    const table = (window.PlayerArt && window.PlayerArt.HAIR) || {};
    const row = table[P.id];
    if (row) return row;
    const h = P.hair || "#2a1c14";
    return [h, shade(h, -0.35), shade(h, 0.28)];
  }

  // R(x, y, w, h, colour). box: hx0, hy0, hw, hh, tx, hair, hairD, hairL.
  function drawAccessories(R, P, near, box) {
    const L = P.look;
    if (!L) return;
    const { hx0, hy0, hw, hh, tx } = box;
    const hair = box.hair, hairD = box.hairD, hairL = box.hairL;
    const band = P.band || L.band || "#f6f6f2";
    const cap = P.cap || "#f4f4f0";
    const style = L.style;

    if (style === "cap-curls") {
      for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
        const x = sd < 0 ? hx0 - hw * (0.16 + 0.05 * (k % 2)) : hx0 + hw + hw * (0.04 - 0.05 * (k % 2));
        R(x, hy0 + hh * (0.25 + k * 0.16), hw * 0.16, hh * 0.16, k % 2 ? hairL : hair);
      }
      if (near) for (let k = 0; k < 5; k++) R(hx0 + hw * k / 4 - hw * 0.06, hy0 + hh * 0.9, hw * 0.18, hh * 0.2, k % 2 ? hair : hairL);
      R(hx0 - hw * 0.1, hy0 - hh * 0.22, hw * 1.2, hh * 0.62, cap);
      R(hx0 - hw * 0.1, hy0 - hh * 0.22, hw * 0.22, hh * 0.62, shade(cap, -0.14));
      if (!near) R(hx0 - hw * 0.28, hy0 + hh * 0.28, hw * 1.56, hh * 0.12, shade(cap, -0.22));
      else R(tx - hw * 0.2, hy0 + hh * 0.4, hw * 0.4, hh * 0.08, shade(cap, -0.3));
      return;
    }

    if (style === "long-band") {
      R(hx0 - hw * 0.12, hy0 - hh * 0.28, hw * 1.24, hh * 0.4, hair);
      if (near) {
        R(hx0 - hw * 0.14, hy0 + hh * 0.05, hw * 1.28, hh * 1.15, hair);
        for (let k = 0; k < 6; k++) R(hx0 + hw * k / 5 - hw * 0.04, hy0 + hh * 1.1, hw * 0.16, hh * 0.22, k % 2 ? hairD : hairL);
      } else {
        R(hx0 - hw * 0.18, hy0 + hh * 0.15, hw * 0.28, hh * 0.9, hair);
        R(hx0 + hw * 0.9, hy0 + hh * 0.15, hw * 0.28, hh * 0.9, hair);
        if (L.beard) {
          R(hx0 + hw * 0.08, hy0 + hh * 0.62, hw * 0.84, hh * 0.42, hairD);
          R(tx - hw * 0.16, hy0 + hh * 0.78, hw * 0.32, Math.max(1, hh * 0.06), "#b8695a");
        }
      }
      R(hx0 - hw * 0.14, hy0 + hh * 0.08, hw * 1.28, hh * 0.14, band);
      R(hx0 - hw * 0.14, hy0 + hh * 0.2, hw * 1.28, Math.max(1, hh * 0.04), shade(band, -0.25));
      return;
    }

    if (style === "headband") {
      R(hx0 - hw * 0.06, hy0 - hh * (L.volume ? 0.28 : 0.12), hw * 1.12, hh * (L.volume ? 0.5 : 0.38), hair);
      if (L.wavy) {
        R(hx0 - hw * 0.2, hy0 + hh * 0.15, hw * 0.28, hh * 0.7, hair);
        R(hx0 + hw * 0.92, hy0 + hh * 0.15, hw * 0.28, hh * 0.7, hair);
        R(hx0 - hw * 0.08, hy0 - hh * 0.08, hw * 0.3, hh * 0.2, hairL);
      }
      if (L.flop && !near) R(hx0 + hw * 0.12, hy0 + hh * 0.16, hw * 0.76, hh * 0.16, hairD);
      if (near) R(hx0, hy0 + hh * 0.72, hw, hh * 0.4, hair);
      R(hx0 - hw * 0.14, hy0 + hh * 0.3, hw * 1.28, hh * 0.16, band);
      R(hx0 - hw * 0.14, hy0 + hh * 0.44, hw * 1.28, Math.max(1, hh * 0.045), shade(band, -0.28));
      return;
    }

    if (style === "cap") {
      R(hx0 - hw * 0.02, hy0 - hh * 0.16, hw * 1.04, hh * 0.55, cap);
      R(hx0 - hw * 0.02, hy0 - hh * 0.16, hw * 0.2, hh * 0.5, shade(cap, -0.16));
      if (near) {
        R(hx0 + hw * 0.15, hy0 + hh * 0.55, hw * 0.7, hh * 0.45, hair);
        R(tx - hw * 0.16, hy0 + hh * 0.32, hw * 0.32, hh * 0.08, shade(cap, -0.3));
      } else {
        R(hx0 - hw * 0.22, hy0 + hh * 0.28, hw * 1.44, hh * 0.12, shade(cap, -0.22));
        R(hx0, hy0 + hh * 0.4, hw, Math.max(1, hh * 0.06), shade(SKIN, -0.2));
      }
      return;
    }

    if (style === "cap-back") {
      R(hx0, hy0 - hh * 0.1, hw, hh * 0.5, cap);
      R(hx0, hy0 - hh * 0.1, hw * 0.18, hh * 0.46, shade(cap, -0.16));
      if (near) {
        R(hx0 - hw * 0.22, hy0 + hh * 0.55, hw * 1.44, hh * 0.16, shade(cap, -0.22));
        R(hx0 + hw * 0.1, hy0 + hh * 0.7, hw * 0.8, hh * 0.35, hair);
      } else {
        R(hx0 + hw * 0.18, hy0 - hh * 0.2, hw * 0.64, hh * 0.12, shade(cap, -0.2));
        R(hx0, hy0 + hh * 0.35, hw * 0.16, hh * 0.4, hair);
        R(hx0 + hw * 0.84, hy0 + hh * 0.35, hw * 0.16, hh * 0.4, hair);
      }
      return;
    }

    if (style === "bandana") {
      R(hx0 - hw * 0.08, hy0 - hh * 0.16, hw * 1.16, hh * 0.55, band);
      R(hx0 - hw * 0.08, hy0 - hh * 0.16, hw * 0.16, hh * 0.5, shade(band, -0.2));
      if (near) R(tx - hw * 0.08, hy0 + hh * 0.32, hw * 0.16, hh * 0.14, shade(band, -0.35));
      if (L.longHair) {
        if (near) {
          R(hx0 - hw * 0.1, hy0 + hh * 0.4, hw * 1.2, hh * 1.05, hair);
          for (let k = 0; k < 5; k++) R(hx0 + hw * k / 4, hy0 + hh * 1.35, hw * 0.16, hh * 0.28, k % 2 ? hairD : hair);
        } else {
          R(hx0 - hw * 0.22, hy0 + hh * 0.35, hw * 0.26, hh * 0.85, hair);
          R(hx0 + hw * 0.96, hy0 + hh * 0.35, hw * 0.26, hh * 0.85, hair);
        }
      }
      return;
    }

    if (style === "waves") {
      R(hx0 - hw * 0.22, hy0 - hh * 0.28, hw * 1.44, hh * 0.7, hair);
      R(hx0 - hw * 0.28, hy0 + hh * 0.15, hw * 0.36, hh * 0.55, hairD);
      R(hx0 + hw * 0.92, hy0 + hh * 0.15, hw * 0.36, hh * 0.55, hairL);
      R(hx0 + hw * 0.2, hy0 - hh * 0.36, hw * 0.4, hh * 0.24, hairL);
      if (near) R(hx0 - hw * 0.1, hy0 + hh * 0.55, hw * 1.2, hh * 0.55, hair);
      return;
    }

    if (style === "mop") {
      R(hx0 - hw * 0.04, hy0 - hh * 0.16, hw * 1.08, hh * 0.5, hair);
      if (!near) R(hx0 + hw * 0.08, hy0 + hh * 0.28, hw * 0.84, hh * 0.14, hairD);
      else R(hx0, hy0 + hh * 0.55, hw, hh * 0.4, hair);
      return;
    }

    // crop: a short cap of hair, the default
    R(hx0 + hw * 0.04, hy0 - hh * 0.06, hw * 0.92, hh * 0.34, hair);
    R(hx0 + hw * 0.04, hy0 - hh * 0.06, hw * 0.16, hh * 0.28, hairD);
    if (near) R(hx0 + hw * 0.1, hy0 + hh * 0.4, hw * 0.8, hh * 0.4, hairD);
  }

  function drawLook(P, near, H) {
    if (!H || !H.Rr) return;
    const [hair, hairD, hairL] = hairOf(P);
    drawAccessories(H.Rr, P, near, {
      hx0: H.hx0, hy0: H.hy0, hw: H.hw, hh: H.hh, tx: H.tx,
      hair: H.hair || hair, hairD: H.hairD || hairD, hairL: H.hairL || hairL,
    });
  }

  // Serve-motion head (a circle). Same accessories, in that head's box.
  function sigHead(P, near, hx, hy, r, hr, hrD, hrL) {
    if (!P.look || P.look.style === "cap-curls" || P.look.style === "long-band") return;
    const px = 1 / (window.AS || 3);
    const R = (x, y, w, h, c) => {
      const q = window.q || (v => v);
      const b = window.b;
      if (!b) return;
      b.fillStyle = c;
      b.fillRect(q(x), q(y), Math.max(px, q(w)), Math.max(px, q(h)));
    };
    drawAccessories(R, P, near, {
      hx0: hx - r, hy0: hy - r * 0.9, hw: r * 2, hh: r * 1.7, tx: hx,
      hair: hr, hairD: hrD, hairL: hrL,
    });
  }

  // Standing portrait used by src/players/preview.html. Not the in-match sprite.
  function paint(canvas, P, facing, surface) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const near = facing !== "front";
    const o = (P.outfits && P.outfits[surface]) || {};
    const dressed = Object.assign({}, P, o, { look: P.look, ui: P.shirt });
    const torso = (P.look && P.look.torso) || 1;
    const h = (H * 0.7) * (P.heightM / 1.98);
    const w = h * 0.32 * torso;
    const ground = H * 0.94;
    const x = W / 2;
    const R = (rx, ry, rw, rh, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh)));
    };
    const shirt = dressed.shirt || "#1c2a44";
    const shorts = dressed.shorts || "#f4f4f0";
    const shoes = dressed.shoes || "#f2f2f2";
    const hipY = ground - h * 0.46;
    const capri = !!(P.look && P.look.capri);
    for (const side of [-1, 1]) {
      const lx = x + side * w * 0.22;
      R(lx - w * 0.13, hipY, w * 0.26, h * 0.26, SKIN);
      R(lx - w * 0.11, hipY + h * 0.24, w * 0.22, h * 0.1, dressed.socks || "#f1f1ee");
      R(lx - w * 0.15, ground - h * 0.07, w * 0.34, h * 0.05, shoes);
      R(lx - w * 0.16, ground - h * 0.025, w * 0.36, h * 0.02, shade(shoes, -0.4));
      if (!near) R(lx - w * 0.06, ground - h * 0.065, w * 0.12, h * 0.03, "#ffffff");
    }
    const shortTop = hipY - h * 0.02;
    const shortH = h * (capri ? 0.38 : 0.16);
    R(x - w * 0.5, shortTop, w, shortH, shorts);
    R(x - w * 0.5, shortTop, w, Math.max(2, h * 0.03), shade(shorts, -0.25));
    const shY = hipY - h * 0.4;
    R(x - w * 0.52, shY, w * 1.04, hipY - shY, shirt);
    if (dressed.shirtLow) R(x - w * 0.48, shY + (hipY - shY) * 0.45, w * 0.96, (hipY - shY) * 0.5, dressed.shirtLow);
    R(x - w * 0.46, hipY - h * 0.045, w * 0.92, Math.max(2, h * 0.025), shade(dressed.shirtLow || shirt, -0.12));
    if (!near) {
      R(x - w * 0.1, shY, w * 0.2, h * 0.05, shade(shirt, -0.2));
      R(x - 1, shY + h * 0.05, 2, h * 0.12, shade(shirt, -0.28));
    } else R(x - 1, shY + h * 0.04, 2, h * 0.22, shade(shirt, -0.22));

    const rs = (P.lefty ? -1 : 1) * (near ? 1 : -1);
    const sleeveless = !!(dressed.sleeveless || (P.look && P.look.sleeveless));
    for (const side of [-rs, rs]) {
      const isRacket = side === rs;
      const ax = x + side * w * 0.58;
      if (!sleeveless) {
        const sw = w * 0.22, sx = side > 0 ? x + w * 0.32 : x - w * 0.32 - sw;
        R(sx, shY + h * 0.04, sw, h * 0.1, shirt);
      }
      R(ax - w * 0.09, shY + h * 0.08, w * 0.18, h * 0.2, SKIN);
      const fore = isRacket && dressed.sleeve ? dressed.sleeve : SKIN;
      R(ax - w * 0.08, shY + h * 0.26, w * 0.16, h * 0.16, fore);
      R(ax - w * 0.09, shY + h * 0.4, w * 0.18, Math.max(2, h * 0.03), P.shirt || "#f2f2f2");
      R(ax - w * 0.07, shY + h * 0.43, w * 0.14, w * 0.14, shade(SKIN, 0.08));
      if (isRacket) {
        const rk = (window.PlayerArt && window.PlayerArt.RACKET && window.PlayerArt.RACKET[P.id]) || { frame: "#1d1d22", accent: P.shirt };
        const gx = ax, gy = shY + h * 0.5;
        R(gx - 2, gy, 4, h * 0.16, "#2b2b31");
        ctx.strokeStyle = rk.frame;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(gx - w * 0.34), Math.round(gy - h * 0.02), Math.round(w * 0.68), Math.round(h * 0.28));
        ctx.strokeStyle = rk.accent || P.shirt;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx - w * 0.2, gy + h * 0.02);
        ctx.lineTo(gx + w * 0.2, gy + h * 0.02);
        ctx.stroke();
      }
    }

    const hh = h * 0.16, hw = Math.max(8, w * 0.72);
    const hx0 = x - hw / 2, hy0 = shY - hh - h * 0.02;
    R(x - w * 0.1, shY - h * 0.02, w * 0.2, h * 0.045, shade(SKIN, -0.15));
    R(hx0, hy0, hw, hh, SKIN);
    const [hair, hairD, hairL] = hairOf(P);
    drawAccessories(R, dressed, near, { hx0, hy0, hw, hh, tx: x, hair, hairD, hairL });
    if (!near) {
      R(x - hw * 0.28, hy0 + hh * 0.52, hw * 0.16, 2, "#1b1b1f");
      R(x + hw * 0.12, hy0 + hh * 0.52, hw * 0.16, 2, "#1b1b1f");
      R(x - 1, hy0 + hh * 0.66, 2, Math.max(2, hh * 0.14), shade(SKIN, -0.2));
      R(x - hw * 0.1, hy0 + hh * 0.84, hw * 0.2, 2, "#a4574a");
    }
  }

  window.PlayerArt = Object.assign(window.PlayerArt || {}, { drawLook, sigHead, drawAccessories, paint, shade, SKIN });
})();
