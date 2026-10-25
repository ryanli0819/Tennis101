-- Q1. How long does each part of Sinner's serve take?
-- Groups the front clip's frames by serve phase. Phases come from serve_phases (labelled by eye),
-- frame times from frames. Shows the rhythm the game has to reproduce.
SELECT phase,
       COUNT(*)                                        AS frames,
       ROUND(MIN(t_sec), 2)                            AS starts_s,
       ROUND(MAX(t_sec) - MIN(t_sec) + 1.0 / 32.46, 2) AS lasts_s   -- + one frame, so a 1-frame phase isn't 0 s
FROM frame_phases
WHERE clip_id = 'sinner-front'
GROUP BY phase
ORDER BY MIN(frame_index);
