-- =====================================================================
-- Tennis101 database schema (SQLite)
-- Built by data/build_db.py from the project's files. The files stay the source of
-- truth; this database is a queryable copy so we can ask questions across them
-- (which joints the detector gets wrong, what each agent owns, what changed per version).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- PLAYERS: the real pros. Source: PLAYERS in index.html.
-- Every physical number in the game (speed, reach, stamina) is derived from these.
-- ---------------------------------------------------------------------
CREATE TABLE players (
  id          TEXT PRIMARY KEY,          -- 'sinner', 'alcaraz'
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  country     TEXT NOT NULL,             -- ITA, ESP
  height_m    REAL NOT NULL CHECK (height_m BETWEEN 1.5 AND 2.2),
  weight_kg   REAL NOT NULL CHECK (weight_kg BETWEEN 50 AND 120),
  court_side  TEXT NOT NULL CHECK (court_side IN ('near', 'far'))   -- side in the default line-up (you pick in the locker room)
);

-- ---------------------------------------------------------------------
-- SKILLS. Source: src/skills/skills.js. Each skill runs 1–20, 10 is neutral, and every point
-- above 10 adds the same constant step (step_text) to one feature of the player.
-- ---------------------------------------------------------------------
CREATE TABLE skills (
  id         TEXT PRIMARY KEY,         -- 'speed'
  name       TEXT NOT NULL,            -- 'Speed'
  what       TEXT NOT NULL,            -- what it changes
  step_text  TEXT NOT NULL             -- the constant step per point, e.g. '+2% top speed per point'
);
CREATE TABLE player_skills (
  player_id  TEXT NOT NULL REFERENCES players(id),
  skill_id   TEXT NOT NULL REFERENCES skills(id),
  points     INTEGER NOT NULL CHECK (points BETWEEN 1 AND 20),
  PRIMARY KEY (player_id, skill_id)
);

-- ---------------------------------------------------------------------
-- AGENTS: the nightly cloud agents. Source: agents/agents.json.
-- agent_paths = folders each agent owns or reads (no two agents own the same folder).
-- agent_feeds = whose output each agent consumes: the workflow graph.
-- ---------------------------------------------------------------------
CREATE TABLE agents (
  name          TEXT PRIMARY KEY,        -- role name, e.g. 'serve-analyst'
  title         TEXT NOT NULL,           -- 'Serve Analyst'
  run_order     INTEGER NOT NULL,
  runs_at_hour  INTEGER NOT NULL CHECK (runs_at_hour BETWEEN 0 AND 23),  -- Eastern time
  job           TEXT NOT NULL,
  contract      TEXT                     -- the interface it promises other agents
);

CREATE TABLE agent_paths (
  agent  TEXT NOT NULL REFERENCES agents(name),
  path   TEXT NOT NULL,
  kind   TEXT NOT NULL CHECK (kind IN ('owns', 'reads')),
  PRIMARY KEY (agent, path, kind)
);

CREATE TABLE agent_feeds (
  from_agent  TEXT NOT NULL REFERENCES agents(name),   -- producer
  to_agent    TEXT NOT NULL REFERENCES agents(name),   -- consumer
  PRIMARY KEY (from_agent, to_agent),
  CHECK (from_agent <> to_agent)
);

-- ---------------------------------------------------------------------
-- MOTION CAPTURE: serve clips -> frames -> joints.
-- One clip = one recording. One frame = one video frame. One joint row = one body
-- point in one frame, either as the detector saw it ('raw') or after cleaning ('clean').
-- Coordinates are normalized 0..1 from the top-left of the video frame.
-- ---------------------------------------------------------------------
CREATE TABLE clips (
  id           TEXT PRIMARY KEY,         -- 'sinner-front'
  player_id    TEXT NOT NULL REFERENCES players(id),
  view         TEXT NOT NULL,            -- 'front', 'overhead'
  source_file  TEXT NOT NULL,            -- raw video name (the video itself stays off GitHub)
  width_px     INTEGER, height_px INTEGER,
  fps          REAL,
  toss_until   INTEGER                   -- last frame where the raised arm on top is the toss arm
);

CREATE TABLE frames (
  clip_id      TEXT NOT NULL REFERENCES clips(id),
  frame_index  INTEGER NOT NULL,
  t_sec        REAL NOT NULL,
  body_scale   REAL,                     -- body size vs the first frames (grows as he jumps toward the camera)
  is_keyframe  INTEGER NOT NULL DEFAULT 0 CHECK (is_keyframe IN (0, 1)),   -- one of the 20 evenly spaced frames
  PRIMARY KEY (clip_id, frame_index)
);

-- Lookup: what each joint name means. Lets queries group by side or body part.
CREATE TABLE joint_names (
  joint      TEXT PRIMARY KEY,           -- 'leftWrist'
  side       TEXT NOT NULL CHECK (side IN ('left', 'right', 'centre')),
  body_part  TEXT NOT NULL CHECK (body_part IN ('head', 'arm', 'torso', 'leg'))
);

CREATE TABLE joints (
  clip_id      TEXT NOT NULL,
  frame_index  INTEGER NOT NULL,
  joint        TEXT NOT NULL REFERENCES joint_names(joint),
  kind         TEXT NOT NULL CHECK (kind IN ('raw', 'clean')),
  x            REAL NOT NULL,
  y            REAL NOT NULL,
  confidence   REAL NOT NULL,
  estimated    INTEGER NOT NULL DEFAULT 0, -- 1 = rebuilt by the cleaner (e.g. the arm on top), not seen
  PRIMARY KEY (clip_id, frame_index, joint, kind),
  FOREIGN KEY (clip_id, frame_index) REFERENCES frames(clip_id, frame_index)
);
CREATE INDEX joints_by_joint ON joints (clip_id, joint, kind);

-- Serve phases, labelled by watching the stills (who labelled it is recorded).
CREATE TABLE serve_phases (
  clip_id      TEXT NOT NULL REFERENCES clips(id),
  phase        TEXT NOT NULL,            -- 'setup', 'toss', 'trophy', 'racket drop', 'contact', 'landing'
  start_frame  INTEGER NOT NULL,
  end_frame    INTEGER NOT NULL,
  labelled_by  TEXT NOT NULL,
  PRIMARY KEY (clip_id, phase),
  CHECK (end_frame >= start_frame)
);

-- Every correction the cleaner made, one row per fix (from clean_keypoints.py's report).
CREATE TABLE cleaning_fixes (
  clip_id      TEXT NOT NULL,
  frame_index  INTEGER NOT NULL,
  fix          TEXT NOT NULL,
  FOREIGN KEY (clip_id, frame_index) REFERENCES frames(clip_id, frame_index)
);

-- ---------------------------------------------------------------------
-- VERSION HISTORY. Source: CHANGELOG.md and contemporary/.
-- ---------------------------------------------------------------------
CREATE TABLE versions (
  version    TEXT PRIMARY KEY,           -- 'v0.2.1'
  published  TEXT NOT NULL               -- approximate, e.g. 'Oct 24, 2026, 11 PM'
);
CREATE TABLE version_notes (
  version  TEXT NOT NULL REFERENCES versions(version),
  line_no  INTEGER NOT NULL,
  note     TEXT NOT NULL,
  PRIMARY KEY (version, line_no)
);
CREATE TABLE pending_changes (           -- files waiting in contemporary/ for the next version
  file     TEXT PRIMARY KEY,
  title    TEXT
);

-- ---------------------------------------------------------------------
-- VIEWS: the questions we ask most, saved as named queries.
-- ---------------------------------------------------------------------

-- Each frame with the serve phase it belongs to.
CREATE VIEW frame_phases AS
SELECT f.clip_id, f.frame_index, f.t_sec, f.is_keyframe, f.body_scale, p.phase
FROM frames f
LEFT JOIN serve_phases p
  ON p.clip_id = f.clip_id AND f.frame_index BETWEEN p.start_frame AND p.end_frame;

-- The cleaned skeleton, with joint meaning and phase attached: what the game animates from.
CREATE VIEW clean_skeleton AS
SELECT j.clip_id, j.frame_index, fp.t_sec, fp.phase, j.joint, n.side, n.body_part,
       j.x, j.y, j.confidence, j.estimated
FROM joints j
JOIN joint_names n ON n.joint = j.joint
JOIN frame_phases fp ON fp.clip_id = j.clip_id AND fp.frame_index = j.frame_index
WHERE j.kind = 'clean';
