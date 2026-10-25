-- Q4. What did the cleaner fix, and how often?
-- Each fix is free text like "dropped leftWrist: bone too long". This groups them by the rule that
-- fired (the text before ':' with joint names removed), so we can see which failure is most common.
SELECT CASE
         WHEN fix LIKE 'hid %'                 THEN 'head hidden behind the raised arm'
         WHEN fix LIKE 'neck rebuilt%'         THEN 'neck rebuilt (arm in front of the head)'
         WHEN fix LIKE '%arm on top%'          THEN 'raised arm on top restored'
         WHEN fix LIKE '%jumped%'              THEN 'hips merged with someone in the crowd'
         WHEN fix LIKE '%too far from the hips' THEN 'shoulder on the raised hand'
         WHEN fix LIKE '%bone too long'        THEN 'bone longer than the real bone'
         WHEN fix LIKE '%overlap%'             THEN 'left and right on top of each other'
         WHEN fix LIKE 'swapped%'              THEN 'left and right swapped'
         ELSE fix END                          AS rule,
       COUNT(*)                                AS times,
       COUNT(DISTINCT frame_index)             AS frames,
       MIN(frame_index) || '–' || MAX(frame_index) AS frame_range
FROM cleaning_fixes
WHERE clip_id = 'sinner-front'
GROUP BY rule
ORDER BY times DESC;
