-- Q7. How do the two pros compare, skill by skill, and what does the gap mean on court?
-- Each point above 10 adds the same step (step_text), so the gap in points is directly the gap in effect.
-- CASE turns the point gap into a plain-language edge.
SELECT s.name                                   AS skill,
       sin.points                               AS sinner,
       alc.points                               AS alcaraz,
       alc.points - sin.points                  AS alcaraz_minus_sinner,
       CASE WHEN alc.points > sin.points THEN 'Alcaraz'
            WHEN alc.points < sin.points THEN 'Sinner' ELSE 'even' END AS edge,
       s.step_text                              AS one_point_means
FROM skills s
JOIN player_skills sin ON sin.skill_id = s.id AND sin.player_id = 'sinner'
JOIN player_skills alc ON alc.skill_id = s.id AND alc.player_id = 'alcaraz'
ORDER BY ABS(alc.points - sin.points) DESC, s.name;
