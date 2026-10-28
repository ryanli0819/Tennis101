"""Turn cleaned serve clips into the game motion file the character plays.

    python3 -I datasets/serves/tools/export_motion.py

Reads the 'clean' joints of each clip in MOTIONS and writes src/serve/motion/sinner-serve.js:
  window.SERVE_MOTIONS.sinner.first   from the front clip   (front view, mirrored)
  window.SERVE_MOTIONS.sinner.second  from the back close-up (back view, no mirror) — his 2nd serve,
                                      found by analyze_serves.py (served again seconds after a fault;
                                      toss over the head instead of out to the right)

Coordinates in the output are in BODY HEIGHTS, so the same motion fits any player's real height:
  x = sideways from the hips, + = the player's right (the game sees the near player from behind)
  y = height above the ground
The camera zoom and the player moving toward the camera are removed with the per-frame body scale.
Slow-motion clips are re-timed so toss release → contact takes the real-speed time (REAL_RELEASE_TO_CONTACT).
Missing joints hold their last known position relative to the hips, so the figure never loses a limb.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = os.path.join(ROOT, "src/serve/motion/sinner-serve.js")
JOINTS = ["nose", "neck", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist",
          "root", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle"]
REAL_RELEASE_TO_CONTACT = 0.65          # seconds, measured in the real-speed front clip

# Events are frame numbers read off the key frames. The Serve Analyst can refine them.
MOTIONS = {
    "first":  {"src": "datasets/serves/sinner/front.keypoints.json", "mirror": True, "calm": (0, 46),
               "events": {"start": 46, "tossRelease": 55, "trophy": 66, "contact": 74, "finish": 88},
               "note": "1st serve, front view (real speed)"},
    "second": {"src": "datasets/serves/sinner/back-close.keypoints.json", "mirror": False, "calm": (100, 200),
               "events": {"start": 250, "tossRelease": 266, "trophy": 300, "contact": 343, "finish": 365},
               "note": "2nd serve, back view, served after a fault (slow motion, re-timed)"},
}

def export(spec):
    d = json.load(open(os.path.join(ROOT, spec["src"])))
    W, H, F = d["width"], d["height"], d["frames"]
    px = lambda v: (v[0] * W, v[1] * H)                   # normalized -> pixels (keeps the aspect right)
    E, (c0, c1) = spec["events"], spec["calm"]
    calm = [f for f in F if c0 <= f["i"] < c1]
    # Body height in pixels from the calm frames: nose-to-ankle ≈ 90% of height, neck-to-ankle ≈ 82% (no nose from behind)
    spans = []
    for f in calm:
        c = f["clean"]
        top, frac = (c["nose"], 0.90) if "nose" in c else (c.get("neck"), 0.82)
        if top and "leftAnkle" in c and "rightAnkle" in c:
            spans.append(((px(c["leftAnkle"])[1] + px(c["rightAnkle"])[1]) / 2 - px(top)[1]) / frac)
    spans.sort(); BODY = spans[len(spans) // 2]
    roots = sorted(px(f["clean"]["root"])[1] for f in calm if "root" in f["clean"])
    root_y0 = roots[len(roots) // 2]
    ankles = sorted(max(px(f["clean"][a])[1] for a in ("leftAnkle", "rightAnkle")) for f in calm
                    if "leftAnkle" in f["clean"] and "rightAnkle" in f["clean"])
    ROOT_UP0 = (ankles[len(ankles) // 2] - root_y0) / BODY
    sx = -1 if spec["mirror"] else 1

    t_of = {f["i"]: f["t"] for f in F}
    k = REAL_RELEASE_TO_CONTACT / (t_of[E["contact"]] - t_of[E["tossRelease"]])   # 1.0 for a real-speed clip
    t0 = t_of[E["start"]] - 0.3                            # keep a little lead-in before the toss starts
    frames, last_rel = [], {}
    for f in F:
        if not (t0 <= f["t"] <= t_of[E["finish"]] + 0.15): continue
        c, s = f["clean"], f.get("scale", 1.0) or 1.0
        if "root" not in c: continue
        rx, ry = px(c["root"])
        root_up = max(0.35, ROOT_UP0 + (root_y0 - ry) / (BODY * s) * 0.6)   # hips rise in the jump (approximate)
        rel = {}
        for j in JOINTS:
            if j in c:
                x, y = px(c[j]); rel[j] = (sx * (x - rx) / (BODY * s), (ry - y) / (BODY * s))
            elif j in last_rel:
                rel[j] = last_rel[j]                        # hold the last known pose
        last_rel.update(rel)
        frames.append({"i": f["i"], "t": round((f["t"] - t0) * k, 3),
                       "j": {n: [round(v[0], 3), round(v[1] + root_up, 3)] for n, v in rel.items()}})
    for j in JOINTS:                                       # back-fill joints first seen later in the clip
        first = next((fr["j"][j] for fr in frames if j in fr["j"]), None)
        for fr in frames:
            if j in fr["j"]: break
            if first: fr["j"][j] = first
    return {"player": "sinner", "source": spec["src"] + " (clean)", "note": spec["note"], "timeScale": round(k, 3),
            "units": "body heights; x + = player's right, y = above the ground; seen from behind",
            "events": {n: round((t_of[v] - t0) * k, 3) for n, v in E.items()}, "frames": frames}

out = {name: export(spec) for name, spec in MOTIONS.items()}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write("// Generated by datasets/serves/tools/export_motion.py from Sinner's real serves (video, cleaned).\n"
            "// first = his 1st serve (front clip), second = his 2nd serve after a fault (back close-up).\n"
            "// Do not edit by hand: change the data or the script and re-run it. Owner: Serve Analyst.\n"
            "window.SERVE_MOTIONS = window.SERVE_MOTIONS || {};\n"
            f"window.SERVE_MOTIONS.sinner = {json.dumps(out, separators=(',', ':'))};\n")
for n, m in out.items():
    print(f"{n:6s}: {len(m['frames'])} frames, x{m['timeScale']} time, events {m['events']}")
print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)")
