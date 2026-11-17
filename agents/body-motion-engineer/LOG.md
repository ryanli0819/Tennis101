# body-motion-engineer LOG

Task: HQ-20261117-002.PM.1
briefSeen: PM v1 (plus steering Event 8 at 4:42 PM ET and Event 17 at 4:54 PM ET, 2026-11-17)

- 2026-11-17: fixed-length 3D skeleton for Alcaraz and Sinner (`src/body/skeleton.js`). Joint limits are READ from `datasets/anatomy/joints.json` (commit e93398b, not edited) by `src/body/joints.js`. Every serve frame is solved onto the skeleton with constant bone lengths and SOURCED limits; clamps are logged. Per-segment depth order via `segmentsInDrawOrder(J, camera)`. Guarded index.html hook (`BodySkeleton.fitWorld`).
- Tests: `node --test src/body/test/skeleton.test.mjs` (13/13). Evidence tools: `src/body/tools/evidence.mjs`, `measure-bones.mjs`.
- Bundle: /workspace/tennis101-hq/work/HQ-20261117-002.PM.1/body-motion-engineer/ (BONE_TABLE.md, JOINT_LIMITS.md, PLAN.md, SELF-REVIEW.md, evidence/, changes.patch).
- Not pushed, no PR (manager pushes).
