-- Q6. Version history: each published version with its number of changes,
-- plus how many changes are waiting in contemporary/ for the next one (published at 5+).
SELECT v.version, v.published, COUNT(n.line_no) AS notes
FROM versions v LEFT JOIN version_notes n ON n.version = v.version
GROUP BY v.version
UNION ALL
SELECT 'next (waiting)', COUNT(*) || ' of 5 changes', NULL FROM pending_changes;
