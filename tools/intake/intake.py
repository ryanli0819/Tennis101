"""INTAKE: drop clips and photos into datasets/inbox/, run this once, and everything is filed and analysed.

    python3 -I tools/intake/intake.py            # file everything in the inbox and run the pose pipeline
    python3 -I tools/intake/intake.py --dry-run  # only say what it would do

What it does with each file in datasets/inbox/ (sub-folders too):
1. Finds the player from the file or folder name: any top-20 surname or id (datasets/footage/top20.json), e.g.
   "Screen Recording ... shelton serve.mov" or a folder "inbox/medvedev/". Files with no player go to inbox/unsorted/.
2. Finds what it shows from keywords: serve (1st/first, 2nd/second/kick), forehand, backhand, slice, running /
   footwork / movement, match, practice; photos are looks and outfits.
3. Moves it: serves → datasets/serves/<id>/, other strokes → datasets/video/<id>/<stroke>/, matches →
   datasets/video/<id>/match/, photos → datasets/players/<id>/images/.
4. Videos: runs pose.swift (every person, every frame) → <name>.keypoints.json next to the clip; for serve clips also
   pick_server.py (keeps the server). Saves 8 stills for the Appearance Scout in datasets/players/<id>/images/stills/.
5. Logs everything in datasets/inbox/intake-log.json (what moved where, what was analysed, what failed).

Video, photos and stills stay on this Mac (git-ignored); keypoints and logs are numbers and names only.
"""
import json, os, re, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INBOX = os.path.join(ROOT, "datasets/inbox")
TOOLS = os.path.join(ROOT, "datasets/serves/tools")
VIDEO = {".mov", ".mp4", ".m4v"}
IMAGE = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif"}
DRY = "--dry-run" in sys.argv

top = json.load(open(os.path.join(ROOT, "datasets/footage/top20.json")))
PEOPLE = top["players"] + top.get("extra", []) + top.get("legends", [])
def names(p):
    full = p["name"].lower().replace("é", "e").replace("ú", "u").replace("ó", "o")
    return {p["id"], p["id"].replace("-", " "), full.split()[-1], full}
KEYS = sorted(((n, p["id"]) for p in PEOPLE for n in names(p)), key=lambda k: -len(k[0]))

def players_in(text):
    t = text.lower().replace("_", " ").replace("-", " ")
    found = []
    for n, pid in KEYS:
        if pid not in found and re.search(r"\b" + re.escape(n.replace("-", " ")) + r"\b", t): found.append(pid)
    return found

def kind_of(text):
    t = text.lower()
    if re.search(r"2nd|second|kick", t) and "serve" in t: return "serve-second"
    if "serve" in t or "serving" in t: return "serve-first"
    for k, words in (("forehand", ["forehand"]), ("backhand", ["backhand"]), ("slice", ["slice"]),
                     ("running", ["running", "footwork", "movement", "sprint", "split"]), ("match", ["match", " vs ", "against"]),
                     ("practice", ["practice"])):
        if any(w in t for w in words): return k
    return None

def run(cmd):
    if DRY: return True
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0

log_path = os.path.join(INBOX, "intake-log.json")
log = json.load(open(log_path)) if os.path.exists(log_path) else []
done = 0
for dirpath, dirs, files in os.walk(INBOX):
    if os.path.relpath(dirpath, INBOX).split(os.sep)[0] == "unsorted": continue
    for f in sorted(files):
        ext = os.path.splitext(f)[1].lower()
        if ext not in VIDEO | IMAGE: continue
        src = os.path.join(dirpath, f)
        context = os.path.relpath(src, INBOX)
        found, kind = players_in(context), kind_of(context)
        pid = found[0] if len(found) == 1 else None
        entry = {"file": f, "at": time.strftime("%Y-%m-%d %H:%M"), "player": pid, "players": found, "kind": kind}
        if len(found) > 1:                                   # a compilation: several players in one clip, split later by the agents
            dest_dir = os.path.join(ROOT, "datasets/video/_compilations")
            entry["note"] = "compilation of " + ", ".join(found) + ": split into one segment per player (Footage Scout / Serve Analyst)"
        elif not pid:
            dest_dir = os.path.join(INBOX, "unsorted")
            entry["note"] = "no player name found: rename it (e.g. 'shelton serve.mov') or put it in inbox/<player>/"
        elif ext in IMAGE:
            dest_dir = os.path.join(ROOT, f"datasets/players/{pid}/images")
        elif kind in ("serve-first", "serve-second"):
            dest_dir = os.path.join(ROOT, f"datasets/serves/{pid}")
        else:
            dest_dir = os.path.join(ROOT, f"datasets/video/{pid}/{kind or 'unsorted'}")
        dest = os.path.join(dest_dir, f)
        entry["to"] = os.path.relpath(dest, ROOT)
        print(("[dry] " if DRY else "") + f"{context} → {entry['to']}")
        if not DRY:
            os.makedirs(dest_dir, exist_ok=True); shutil.move(src, dest)
        if found and ext in VIDEO:
            pid = pid or "_compilations"
            base = os.path.splitext(dest)[0]
            kp = base.replace(" ", "-") + ".keypoints.json"
            frames = os.path.join(ROOT, f"datasets/players/{pid}/images/stills/{os.path.basename(base)}") if len(found) == 1 \
                     else os.path.join(ROOT, f"datasets/video/_compilations/stills/{os.path.basename(base)}")
            entry["pose"] = run(["swift", os.path.join(TOOLS, "pose.swift"), dest, kp, os.path.join(frames, "pose"), "1"])
            entry["keypoints"] = os.path.relpath(kp, ROOT)
            if kind and kind.startswith("serve"):
                entry["server"] = run([sys.executable, "-I", os.path.join(TOOLS, "pick_server.py"), kp, pid, "unknown view"])
            entry["stills"] = run(["swift", os.path.join(TOOLS, "grab.swift"), dest, frames, "8"])
        log.append(entry); done += 1
if not DRY:
    json.dump(log, open(log_path, "w"), indent=1, ensure_ascii=False)
print(f"{done} file(s) {'would be ' if DRY else ''}filed. Log: {os.path.relpath(log_path, ROOT)}")
