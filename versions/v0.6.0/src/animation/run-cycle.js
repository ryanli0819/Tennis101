// =====================================================================
// RUN CYCLE — picks the animation frame for a player from how they're moving. Owner: Animator (agents/animator/).
//
// Anim.frame(p, B, near) → { kind, frame, bob, lean, crouch, feet: [left, right], arms: [left, right] }
//   kind   : "ready" | "run" | "backpedal" | "shuffle" | "plant" | "split" | "slide"
//   feet[k]: { dx, lift } — sideways offset of the foot from the hip (in body widths) and how high it's lifted (in heights)
//   arms[k]: swing −1..1 (forward/back), opposite to the legs when running
//   bob    : body up/down (heights), lean: body sideways lean (heights, + = screen right), crouch: knee bend (heights)
// Units are fractions of the sprite's height/width, so the same frames fit every player's real size.
// The game's physics never reads this: animation follows the body, it never moves it.
// =====================================================================
(function () {
  // A 4-frame run cycle: contact → passing → contact (other foot) → passing. lift = how high the free foot is.
  const RUN = [
    { L: 0.00, R: 0.10, bob: 0.000, armL: 1, armR: -1 },
    { L: 0.00, R: 0.17, bob: -0.022, armL: 0.5, armR: -0.5 },
    { L: 0.10, R: 0.00, bob: 0.000, armL: -1, armR: 1 },
    { L: 0.17, R: 0.00, bob: -0.022, armL: -0.5, armR: 0.5 },
  ];
  // Side-step shuffle: feet apart, then together (a small hop), body leaning into the move.
  const SHUFFLE = [ { spread: 0.36, bob: 0.000 }, { spread: 0.14, bob: -0.03 } ];

  function frame(p, B, near) {
    const sp = Math.hypot(p.vx, p.vy);
    const fwd = near ? p.vy : -p.vy;                       // + = running toward the net, whichever side you're on
    const side = p.vx;                                     // + = screen right (court x)
    const tilt = Math.max(-1, Math.min(1, side / (B.top || 6)));
    if (p.slide > 0) {                                     // slide: low, the lead leg out long toward the slide
      const dir = Math.sign(p.slideV.x || 1);
      return { kind: "slide", frame: 0, bob: -0.08, lean: dir * 0.05, crouch: 0.08,
               feet: [{ dx: dir < 0 ? -0.6 : 0.05, lift: 0 }, { dx: dir > 0 ? 0.6 : -0.05, lift: 0 }], arms: [0.6, -0.6] };
    }
    if (p.air > 0) return { kind: "split", frame: 0, bob: -0.06, lean: 0, crouch: 0.03,
                            feet: [{ dx: -0.3, lift: 0.04 }, { dx: 0.3, lift: 0.04 }], arms: [0.3, 0.3] };
    if (p.plant > 0) {                                     // changing direction: plant wide and low, lean against the old way
      const back = -Math.sign(side || 1);
      return { kind: "plant", frame: 0, bob: -0.05, lean: back * 0.04, crouch: 0.06,
               feet: [{ dx: -0.42, lift: 0 }, { dx: 0.42, lift: 0 }], arms: [0.4, 0.4] };
    }
    if (sp < 0.5) {                                        // ready position: feet apart, knees soft, a slow breath
      const breathe = Math.sin(p.run * 2.2) * 0.006;
      return { kind: "ready", frame: 0, bob: breathe, lean: 0, crouch: 0.025,
               feet: [{ dx: -0.26, lift: 0 }, { dx: 0.26, lift: 0 }], arms: [0.2, 0.2] };
    }
    if (Math.abs(side) > Math.abs(fwd) * 1.3 && sp < (B.top || 6) * 0.7) {   // moving sideways at moderate speed: shuffle
      const k = Math.floor(p.run * 3.2) % 2, f = SHUFFLE[k];
      return { kind: "shuffle", frame: k, bob: f.bob, lean: tilt * 0.05, crouch: 0.04,
               feet: [{ dx: -f.spread, lift: k ? 0.02 : 0 }, { dx: f.spread, lift: k ? 0.02 : 0 }], arms: [0.25, 0.25] };
    }
    const kind = fwd < -0.6 && Math.abs(fwd) > Math.abs(side) ? "backpedal" : "run";
    const k = Math.floor(p.run * (kind === "run" ? 4.4 : 3.4)) % 4, f = RUN[k];
    const stride = Math.min(1, sp / (B.top || 6));          // faster = longer, higher steps
    return { kind, frame: k, bob: f.bob * stride, lean: tilt * 0.06 + (kind === "backpedal" ? 0 : 0), crouch: 0.02 + 0.02 * stride,
             feet: [{ dx: -0.2 + tilt * 0.1, lift: f.L * stride }, { dx: 0.2 + tilt * 0.1, lift: f.R * stride }],
             arms: [f.armL * stride, f.armR * stride] };
  }

  window.Anim = { frame };
})();
