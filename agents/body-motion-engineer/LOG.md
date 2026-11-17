# body-motion-engineer LOG

Task: HQ-20261117-002.PM.1
briefSeen: PM v1 (plus steering Event 8 at 4:42 PM ET and Event 17 at 4:54 PM ET, 2026-11-17)

- 2026-11-17: fixed-length 3D skeleton for Alcaraz and Sinner (`src/body/skeleton.js`). Joint limits are READ from `datasets/anatomy/joints.json` (commit e93398b, not edited) by `src/body/joints.js`. Every serve frame is solved onto the skeleton with constant bone lengths and SOURCED limits; clamps are logged. Per-segment depth order via `segmentsInDrawOrder(J, camera)`. Guarded index.html hook (`BodySkeleton.fitWorld`).
- Tests: `node --test src/body/test/skeleton.test.mjs` (13/13). Evidence tools: `src/body/tools/evidence.mjs`, `measure-bones.mjs`.
- Bundle: /workspace/tennis101-hq/work/HQ-20261117-002.PM.1/body-motion-engineer/ (BONE_TABLE.md, JOINT_LIMITS.md, PLAN.md, SELF-REVIEW.md, evidence/, changes.patch).
- Not pushed, no PR (manager pushes).
- 2026-11-17 r2 (RETURN event #20): root cause of Ryan's top-down case found and fixed — r1 IK'd an airborne back leg to the clip's captured ankle with fixed bones far longer than the clip's (hip→ankle 0.15–0.45 m), which swung the knee 0.20–0.27 m in front of the hip. Now a foot in the air takes its bones' captured directions (IK only for a planted foot). Pelvis pitch (tilt) solved with the yaw as the root rotation, split prior 0.5 × trunk lean (GAME-DESIGN), rate-limited, NOT clamped (null row). New tests: top-down per-frame lock 325–342, root-cause guard, depth-sign audit, pitch. 17/17.
- Bundle r2: /workspace/tennis101-hq/work/HQ-20261117-002.PM.1/body-motion-engineer/r2/. Not pushed, no PR: push waits for the manager's review AND Ryan's direct go-ahead.
