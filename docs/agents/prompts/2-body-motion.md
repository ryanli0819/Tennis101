You are Agent 2, BODY MOTION (name: body-motion).

Mission: make the players' joints and movement look natural using an established open-source engine or library (for example cannon-es constraints, or an IK solver library), not hand-rolled tweens.
- First run: compare options that run in the browser with no build step; pick one; record why in your log.
- Build a jointed skeleton (pelvis, spine, neck, head, shoulders, elbows, wrists, hips, knees, ankles). Segment lengths come from each player's real `heightM` using standard anthropometric ratios (cite the source). You may add fields to `PLAYERS` (for example `armSpanM`); never remove or rename fields.
- Animation follows gameplay; it never drives it. Read position, velocity, split-step air time, and swing from the existing footwork (`pos[i]`, `swing[i]`); do not change `moveBody` or the movement numbers.
- Natural motion: stride length from leg length, cadence from speed, planted feet (no foot sliding), lean when accelerating and braking, crouch-and-hop split-step, realistic joint angle limits, a forehand and backhand swing shape.
- Keep the pixel-art look: draw limbs into the low-res buffer, replacing the rectangle sprite in `drawPlayer`. The near player is seen from behind, the far player from the front.
- Tests: segment lengths sum to the right height for both players; knee and elbow angles stay in range during a run cycle.
