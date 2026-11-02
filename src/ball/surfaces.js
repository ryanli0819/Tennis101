/* Tennis101 · Ball Physicist — how each court surface bounces the ball.
   One table, read by src/ball/ball.js. Plain script (no build step); also loads in Node for tests.

   Bounce model (Cross 2002, "Grip-slip behavior of a bouncing ball", Am. J. Phys. 70, 1093):
   - Vertical: the ball leaves at e × its impact speed. e falls a little with harder impacts
     (`eSlope` per m/s above 7 m/s, about the ITF drop-test impact speed).
   - Horizontal: friction pushes on the bottom of the ball. It either SLIDES all through the bounce
     (impulse μ(1+e)·vz, Coulomb) or GRIPS: the bottom of the ball stops sliding and springs back by
     `ex` (Cross measured ex ≈ 0–0.3: the ball leaves slightly "overspinning"). Friction trades
     forward speed for topspin; topspin coming in means less sliding, so the ball keeps its pace.
   - The ball is a thin pressurised shell: I = 0.55 m R² (Cross 2002), set in ball.js.

   Numbers, with what they are checked against (tests/ball.test.mjs):
   - ITF Rules of Tennis, Appendix I: dropped from 254 cm onto a rigid slab a ball must rebound
     135–147 cm. Our hard court rebounds ≈ 1.40 m (e = 0.775, air drag included).
   - ITF Court Pace Rating (CPR = 100(1 − μ) + 150(0.81 − e), ball fired at 30 m/s, 16°):
     clay courts are "slow" (CPR ≤ 29, high friction μ ≈ 0.75–0.85), acrylic hard courts "medium" to
     "medium-fast" (μ ≈ 0.55–0.65), grass "fast" (μ ≈ 0.45–0.55, a soft lawn so a lower bounce).
     (ITF Court Pace Classification Programme; Brody, Cross & Lindsey, "The Physics and Technology
     of Tennis", 2002, ch. 3; Haake, Carré & Goodwill, "Modelling of oblique tennis ball impacts on
     tennis courts", Sports Eng. 2003.)
   - Clay: slower and higher (most friction, the most grip spring-back, the liveliest bounce).
     Grass: faster and lower (least friction, softest turf). Hard: in between.
   e and ex are tuned estimates inside the published ranges; μ is the surface's sliding friction. */
(function (root) {
  const BALL_SURFACES = {
    hard:  { label: "Hard (acrylic)", e: 0.775, eSlope: 0.004, mu: 0.60, ex: 0.10, itf: "medium–fast" },
    clay:  { label: "Red clay",       e: 0.795, eSlope: 0.006, mu: 0.80, ex: 0.25, itf: "slow" },
    grass: { label: "Grass",          e: 0.715, eSlope: 0.004, mu: 0.48, ex: 0.00, itf: "fast" },
  };
  root.BALL_SURFACES = BALL_SURFACES;
  if (typeof module !== "undefined" && module.exports) module.exports = BALL_SURFACES;
})(typeof globalThis !== "undefined" ? globalThis : this);
