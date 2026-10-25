-- Q2. Where does the pose detector fail?
-- For each serve phase and body part: how many raw joints the detector found, their average
-- confidence, and how many the cleaner had to throw away. Low confidence + many dropped =
-- the moments the raw data can't be trusted (the toss arm over the face, the blur at contact).
WITH raw AS (
  SELECT fp.phase, n.body_part, j.frame_index, j.joint, j.confidence
  FROM joints j
  JOIN joint_names n   ON n.joint = j.joint
  JOIN frame_phases fp ON fp.clip_id = j.clip_id AND fp.frame_index = j.frame_index
  WHERE j.clip_id = 'sinner-front' AND j.kind = 'raw'
),
kept AS (                       -- raw joints that survived cleaning (and were not rebuilt)
  SELECT frame_index, joint FROM joints
  WHERE clip_id = 'sinner-front' AND kind = 'clean' AND estimated = 0
)
SELECT r.phase, r.body_part,
       COUNT(*)                         AS seen,
       ROUND(AVG(r.confidence), 2)      AS avg_confidence,
       SUM(k.joint IS NULL)             AS dropped,
       ROUND(100.0 * SUM(k.joint IS NULL) / COUNT(*)) || '%' AS dropped_pct
FROM raw r
LEFT JOIN kept k ON k.frame_index = r.frame_index AND k.joint = r.joint
GROUP BY r.phase, r.body_part
ORDER BY MIN(r.frame_index), r.body_part;
