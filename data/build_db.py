"""Build data/tennis101.sqlite from the project's files.

    python3 -I data/build_db.py          # rebuild the database
    python3 -I data/run_queries.py       # run every query in data/queries/ and save the results

The repo files stay the source of truth; this rebuilds the whole database from scratch each time,
so it can never drift out of date. Rebuild it after changing players, agents, serve data or versions.
"""
import json, os, re, sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "tennis101.sqlite")
path = lambda *p: os.path.join(ROOT, *p)

# ---- serve clips we have captured: (clip id, player, view, keypoints file) ----
CLIPS = [
    ("sinner-front", "sinner", "front", "datasets/serves/sinner/front.keypoints.json"),
    ("sinner-overhead", "sinner", "overhead", "datasets/serves/sinner/birdseye.keypoints.json"),
    ("sinner-back-close", "sinner", "back", "datasets/serves/sinner/back-close.keypoints.json"),
    ("sinner-back-side", "sinner", "back-angled", "datasets/serves/sinner/back-side.keypoints.json"),
    ("sinner-front2", "sinner", "front-oblique", "datasets/serves/sinner/front2.keypoints.json"),
    ("sinner-left", "sinner", "left-side", "datasets/serves/sinner/left.keypoints.json"),
]
# ---- serve phases, labelled by watching the 20 key frames of the front clip ----
PHASES = {
    "sinner-front": [("setup", 0, 45), ("toss", 46, 58), ("trophy", 59, 68),
                     ("racket drop", 69, 72), ("contact", 73, 75), ("landing", 76, 88)],
    # his 2nd serve (served right after a fault), slow motion
    "sinner-back-close": [("toss", 250, 299), ("trophy", 300, 316), ("racket drop", 317, 336), ("contact", 337, 346), ("landing", 347, 365)],
}
PHASE_LABELLER = "Claude, by eye from the 20 key frames (Serve Analyst may refine)"


def joint_meaning(name):
    """'leftWrist' -> ('left', 'arm'). Used to fill the joint_names lookup table."""
    side = "left" if name.startswith("left") else "right" if name.startswith("right") else "centre"
    base = name[len(side):] if side != "centre" else name
    base = base.lower()
    part = ("head" if base in ("nose", "eye", "ear") else
            "arm" if base in ("shoulder", "elbow", "wrist") else
            "leg" if base in ("hip", "knee", "ankle") else "torso")
    return side, part


def build():
    if os.path.exists(DB): os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript(open(path("data", "schema.sql")).read())

    # PLAYERS: parsed from the ROSTER array in index.html (the game's single source of player data).
    # The first pro in the roster is the default near-court player; you can pick either in the locker room.
    src = open(path("index.html")).read()
    rows = re.findall(r'\{ id: "(\w+)",\s*last: "(\w+)",\s*first: "(\w+)", code: "(\w+)", heightM: ([\d.]+), weightKg: ([\d.]+)', src)
    for n, (pid, last, first, code, h, w) in enumerate(rows):
        db.execute("INSERT INTO players VALUES (?,?,?,?,?,?,?)", (pid, first, last.title(), code, float(h), float(w), "near" if n == 0 else "far"))

    # SKILLS: the SKILLS list and PLAYER_SKILLS table in src/skills/skills.js
    sk = open(path("src", "skills", "skills.js")).read()
    for sid, name, what, step in re.findall(r'\{ id: "(\w+)",\s*name: "([^"]+)",\s*what: "([^"]+)",\s*step: "([^"]+)" \}', sk):
        db.execute("INSERT INTO skills VALUES (?,?,?,?)", (sid, name, what, step))
    for pid, body in re.findall(r'^\s*(\w+):\s*\{ (speed: [^}]+)\}', sk, re.M):
        for skill, pts in re.findall(r'(\w+): (\d+)', body):
            db.execute("INSERT INTO player_skills VALUES (?,?,?)", (pid, skill, int(pts)))

    # AGENTS: from the registry the dashboard also reads
    reg = json.load(open(path("agents", "agents.json")))
    for a in reg["agents"]:
        db.execute("INSERT INTO agents VALUES (?,?,?,?,?,?)",
                   (a["name"], a["title"], a["order"], a["runsAt"], a["job"], a.get("contract")))
    for a in reg["agents"]:
        for p in a.get("owns", []): db.execute("INSERT INTO agent_paths VALUES (?,?, 'owns')", (a["name"], p))
        for p in a.get("reads", []): db.execute("INSERT OR IGNORE INTO agent_paths VALUES (?,?, 'reads')", (a["name"], p))
        for t in a.get("feeds", []): db.execute("INSERT INTO agent_feeds VALUES (?,?)", (a["name"], t))

    # MOTION CAPTURE: clips -> frames -> joints (raw + clean) -> fixes -> phases
    for clip_id, player, view, f in CLIPS:
        d = json.load(open(path(f)))
        cl = d.get("cleaning", {})
        db.execute("INSERT INTO clips VALUES (?,?,?,?,?,?,?,?)",
                   (clip_id, player, view, d["source"].split(" (")[0], d["width"], d["height"], d["fps"], cl.get("tossUntil")))
        keys = set(d.get("keyframes", []))
        for fr in d["frames"]:
            i = fr["i"]
            db.execute("INSERT INTO frames VALUES (?,?,?,?,?)", (clip_id, i, fr["t"], fr.get("scale"), int(i in keys)))
            est = set(fr.get("estimated", []))
            for kind, joints in (("raw", fr["joints"]), ("clean", fr.get("clean", {}))):
                for name, (x, y, c) in joints.items():
                    db.execute("INSERT OR IGNORE INTO joint_names VALUES (?,?,?)", (name, *joint_meaning(name)))
                    db.execute("INSERT INTO joints VALUES (?,?,?,?,?,?,?,?)",
                               (clip_id, i, name, kind, x, y, c, int(kind == "clean" and name in est)))
        for fx in cl.get("fixes", []):
            for text in fx["fixes"]:
                db.execute("INSERT INTO cleaning_fixes VALUES (?,?,?)", (clip_id, fx["i"], text))
        for phase, a, b in PHASES.get(clip_id, []):
            db.execute("INSERT INTO serve_phases VALUES (?,?,?,?,?)", (clip_id, phase, a, b, PHASE_LABELLER))

    # VERSIONS: '## vX.Y.Z — <time>' headings and their bullets in CHANGELOG.md
    version = None; n = 0
    for line in open(path("CHANGELOG.md")):
        m = re.match(r"## (v[\d.]+) — (.+)", line.strip())
        if m:
            version, n = m.group(1), 0
            db.execute("INSERT INTO versions VALUES (?,?)", m.groups())
        elif version and line.startswith("- "):
            n += 1; db.execute("INSERT INTO version_notes VALUES (?,?,?)", (version, n, line[2:].strip()))
    for f in sorted(os.listdir(path("contemporary"))):
        if f.endswith(".md") and f != "README.md":
            first = open(path("contemporary", f)).readline().lstrip("# ").strip()
            db.execute("INSERT INTO pending_changes VALUES (?,?)", (f, first))

    db.commit()
    counts = {t: db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
              for t in ("players", "player_skills", "agents", "agent_feeds", "clips", "frames", "joints", "cleaning_fixes", "serve_phases", "versions")}
    db.execute("VACUUM"); db.close()
    print(f"built {os.path.relpath(DB, ROOT)} ({os.path.getsize(DB) // 1024} KB):", ", ".join(f"{k} {v}" for k, v in counts.items()))


if __name__ == "__main__":
    build()
