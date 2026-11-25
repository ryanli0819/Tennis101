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
4. Videos: if macOS can't decode the codec (AV1 from YouTube on M1/M2), converts a 1080p H.264 copy first
   (tools/intake/convert.py, PyAV in tools/.venv). Then runs pose.swift (every person, every frame) → <name>.keypoints.json next to the clip; for serve clips also
   pick_server.py (keeps the server). Saves 8 stills for the Appearance Scout in datasets/players/<id>/images/stills/.
5. Logs everything in datasets/inbox/intake-log.json (what moved where, what was analysed, what failed).
0. Rejects what is already in the system (Ryan, Nov 25): a file whose content (SHA-256) matches a video or photo already
   anywhere under datasets/ — or one filed earlier in the same run — is moved to the macOS Trash (recoverable; no
   second copy is kept on the Mac) and logged with the copy it matches. A different file with an existing file's name is filed under a new name, never
   over it. Fingerprints are cached in datasets/inbox/media-index.json (path, size, modified time → hash).

Video, photos and stills stay on this Mac (git-ignored); keypoints and logs are numbers and names only.
"""
import hashlib, json, os, re, shutil, subprocess, sys, time

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

def stroke_dir(kind):                                       # the Inbox app's three categories
    return "serves" if kind and kind.startswith("serve") else "forehands" if kind == "forehand" else "backhands" if kind == "backhand" else ""

def run(cmd):
    if DRY: return True
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0

if "--detect" in sys.argv:                                  # used by the Tennis101 Inbox app: which players does a name mention?
    print(",".join(players_in(sys.argv[sys.argv.index("--detect") + 1]))); sys.exit(0)
if "--players" in sys.argv:                                 # the list the app offers when a name mentions nobody
    print("\n".join(f"{p['id']} — {p['name']}" for p in top["players"])); sys.exit(0)   # the roster only

# ---- already in the system? content fingerprints of every video and photo under datasets/ (the inbox excluded)
INDEX_PATH = os.path.join(INBOX, "media-index.json")
index = json.load(open(INDEX_PATH)) if os.path.exists(INDEX_PATH) else {}

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()

def fingerprint(path):
    st = os.stat(path); rel = os.path.relpath(path, ROOT); c = index.get(rel)
    if c and c["size"] == st.st_size and c["mtime"] == int(st.st_mtime): return c["sha256"]
    d = sha256(path); index[rel] = {"size": st.st_size, "mtime": int(st.st_mtime), "sha256": d}; return d

known = {}                                                  # sha256 → a path already in the system
for dirpath, dirs, files in os.walk(os.path.join(ROOT, "datasets")):
    if os.path.commonpath([dirpath, INBOX]) == INBOX: continue
    for f in files:
        if os.path.splitext(f)[1].lower() in VIDEO | IMAGE:
            fp = os.path.join(dirpath, f); known.setdefault(fingerprint(fp), os.path.relpath(fp, ROOT))
index = {k: v for k, v in index.items() if os.path.exists(os.path.join(ROOT, k))}

def free_name(dest):
    """A different file already has this name: file it next to it as 'name (2).ext', never over it."""
    if not os.path.exists(dest): return dest
    b, e = os.path.splitext(dest); n = 2
    while os.path.exists(f"{b} ({n}){e}"): n += 1
    return f"{b} ({n}){e}"

log_path = os.path.join(INBOX, "intake-log.json")
log = json.load(open(log_path)) if os.path.exists(log_path) else []
done = 0
for dirpath, dirs, files in os.walk(INBOX):
    if os.path.relpath(dirpath, INBOX).split(os.sep)[0] in ("unsorted", "rejected"): continue
    for f in sorted(files):
        ext = os.path.splitext(f)[1].lower()
        if ext not in VIDEO | IMAGE: continue
        src = os.path.join(dirpath, f)
        context = os.path.relpath(src, INBOX)
        found, kind = players_in(context), kind_of(context)
        pid = found[0] if len(found) == 1 else None
        entry = {"file": f, "at": time.strftime("%Y-%m-%d %H:%M"), "player": pid, "players": found, "kind": kind}
        digest = sha256(src)
        if digest in known:                                  # already in the system: reject, keep the file aside
            rej = free_name(os.path.join(os.path.expanduser("~/.Trash"), f))
            entry.update(rejected=True, duplicateOf=known[digest], to="Trash")
            print(("[dry] " if DRY else "") + f"{context} ✗ already in the system as {known[digest]}: moved to the Trash")
            if not DRY:
                os.makedirs(os.path.dirname(rej), exist_ok=True); shutil.move(src, rej)
            log.append(entry); done += 1; continue
        if len(found) > 1:                                   # a compilation: several players in one clip, split later by the agents
            dest_dir = os.path.join(ROOT, "datasets/video/_compilations", stroke_dir(kind))
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
        dest = free_name(os.path.join(dest_dir, f))
        entry["to"] = os.path.relpath(dest, ROOT)
        known[digest] = entry["to"]                          # a second copy later in this run is rejected too
        print(("[dry] " if DRY else "") + f"{context} → {entry['to']}")
        if not DRY:
            os.makedirs(dest_dir, exist_ok=True); shutil.move(src, dest)
        if found and ext in VIDEO:
            pid = pid or "_compilations"
            base = os.path.splitext(dest)[0]
            kp = base.replace(" ", "-") + ".keypoints.json"
            frames = os.path.join(ROOT, f"datasets/players/{pid}/images/stills/{os.path.basename(base)}") if len(found) == 1 \
                     else os.path.join(ROOT, f"datasets/video/_compilations/stills/{os.path.basename(base)}")
            probe = "" if DRY else subprocess.run(["swift", os.path.join(TOOLS, "codec.swift"), dest], capture_output=True, text=True).stdout
            if "decodable false" in probe:                   # e.g. AV1 from a YouTube download: Apple's decoder can't read it on M1/M2
                entry["codec"] = probe.split()[1] if probe.split() else "?"
                venv = os.path.join(ROOT, "tools/.venv/bin/python")
                conv = base + "-h264.mp4"
                if os.path.exists(venv) and run([venv, "-I", os.path.join(ROOT, "tools/intake/convert.py"), dest, conv, "1080"]):
                    entry["converted"] = os.path.relpath(conv, ROOT); print(f"  converted {entry['codec']} → H.264: {entry['converted']}")
                    dest = conv                               # analyse the converted copy (the original stays next to it)
                else:
                    entry["note"] = f"can't decode {entry['codec']} on this Mac and the converter (tools/.venv, PyAV) failed or is missing"
                    print("  ! " + entry["note"]); log.append(entry); done += 1; continue
            entry["pose"] = run(["swift", os.path.join(TOOLS, "pose.swift"), dest, kp, os.path.join(frames, "pose"), "1"])
            entry["keypoints"] = os.path.relpath(kp, ROOT)
            if kind and kind.startswith("serve") and len(found) == 1:   # one server to pick (not in a compilation)
                entry["server"] = run([sys.executable, "-I", os.path.join(TOOLS, "pick_server.py"), kp, pid, "unknown view"])
            entry["stills"] = run(["swift", os.path.join(TOOLS, "grab.swift"), dest, frames, "8"])
        log.append(entry); done += 1
if not DRY:
    json.dump(log, open(log_path, "w"), indent=1, ensure_ascii=False)
    json.dump(index, open(INDEX_PATH, "w"), indent=0)
print(f"{done} file(s) {'would be ' if DRY else ''}filed. Log: {os.path.relpath(log_path, ROOT)}")
