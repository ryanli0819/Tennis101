-- Q5. The agent workflow: who runs when, what they own, and who uses their work.
-- agent_feeds is a graph (producer -> consumer). GROUP_CONCAT flattens it into one row per agent.
SELECT a.runs_at_hour || ':00'                                      AS runs_at,
       a.title                                                      AS agent,
       (SELECT GROUP_CONCAT(path, ', ') FROM agent_paths p
         WHERE p.agent = a.name AND p.kind = 'owns')                AS owns,
       COALESCE((SELECT GROUP_CONCAT(c.title, ', ') FROM agent_feeds f JOIN agents c ON c.name = f.to_agent
                  WHERE f.from_agent = a.name), '—')                AS feeds_into,
       COALESCE((SELECT GROUP_CONCAT(p.title, ', ') FROM agent_feeds f JOIN agents p ON p.name = f.from_agent
                  WHERE f.to_agent = a.name), '—')                  AS depends_on
FROM agents a
ORDER BY a.runs_at_hour;
