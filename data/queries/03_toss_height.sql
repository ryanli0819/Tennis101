-- Q3. How high does Sinner toss, in body heights above his hips?
-- Uses the cleaned left (tossing) wrist during the toss and trophy phases. The image y axis points
-- down, so "higher" = smaller y. Dividing by body_scale and by his body height in the image
-- (measured in the calm setup frames) turns pixels into "body heights", which the game can scale
-- to any player's real height.
WITH body AS (                      -- his height in normalized image units, from the setup frames
  SELECT AVG(ankle.y - nose.y) AS h
  FROM joints nose
  JOIN joints ankle ON ankle.clip_id = nose.clip_id AND ankle.frame_index = nose.frame_index
                   AND ankle.kind = 'clean' AND ankle.joint = 'leftAnkle'
  WHERE nose.clip_id = 'sinner-front' AND nose.kind = 'clean' AND nose.joint = 'nose'
    AND nose.frame_index <= 45
),
toss AS (
  SELECT s.frame_index, s.t_sec, s.phase, w.y AS wrist_y, r.y AS root_y, f.body_scale, s.estimated
  FROM clean_skeleton s
  JOIN joints w ON w.clip_id = s.clip_id AND w.frame_index = s.frame_index AND w.kind = 'clean' AND w.joint = 'leftWrist'
  JOIN joints r ON r.clip_id = s.clip_id AND r.frame_index = s.frame_index AND r.kind = 'clean' AND r.joint = 'root'
  JOIN frames f ON f.clip_id = s.clip_id AND f.frame_index = s.frame_index
  WHERE s.clip_id = 'sinner-front' AND s.joint = 'leftWrist' AND s.phase IN ('toss', 'trophy')
)
SELECT frame_index, ROUND(t_sec, 2) AS t_s, phase,
       ROUND((root_y - wrist_y) / body_scale / (SELECT h FROM body), 2) AS hand_above_hips_bodyheights,
       CASE estimated WHEN 1 THEN 'rebuilt (arm on top)' ELSE 'seen' END AS source
FROM toss
ORDER BY hand_above_hips_bodyheights DESC
LIMIT 5;
