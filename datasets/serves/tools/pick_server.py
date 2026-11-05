"""Pick the server out of every person Apple Vision found, frame by frame.

    python3 -I datasets/serves/tools/pick_server.py <clip.keypoints.json> <player> <view> [mirror-note]

pose.swift writes every detected person per frame ("people"). A clip can also show ball kids, a line judge or
the crowd, so before cleaning we keep one person: the server. The first frame takes the biggest, most confident
person; after that, the person whose hips are closest to where the server's hips were (and who is not much
smaller), so the track never jumps to someone in the background. The result has the same layout as Sinner's
files: one "joints" dict per frame, plus player / view / segments / notes, ready for clean_keypoints.py.
"""
import json, math, sys

path, player, view = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(path))
AS = d["height"] / d["width"]

def size(j):
    ys = [v[1] * AS for v in j.values()]; xs = [v[0] for v in j.values()]
    return max(ys) - min(ys) + (max(xs) - min(xs)) * 0.3 if j else 0
def hips(j):
    for n in ("root", "leftHip", "rightHip", "neck"):
        if n in j: return (j[n][0], j[n][1] * AS)
    return None
def score(person):
    j = person["joints"]; return size(j) * (0.5 + sum(v[2] for v in j.values()) / max(1, len(j)))

prev, picked, gaps = None, 0, 0
for f in d["frames"]:
    people = [p for p in f.get("people", []) if p.get("joints")]
    if not people:
        f["joints"] = {}; gaps += 1
    else:
        if prev is None:
            best = max(people, key=score)
        else:
            ref_h, ref_s = prev
            def cost(p):
                h = hips(p["joints"]); s = size(p["joints"])
                dd = math.hypot(h[0] - ref_h[0], h[1] - ref_h[1]) if h and ref_h else 9
                return dd + (0.5 if s < ref_s * 0.6 else 0)
            best = min(people, key=cost)
        f["joints"] = best["joints"]; picked += 1
        prev = (hips(best["joints"]) or (prev and prev[0]), max(size(best["joints"]), (prev[1] * 0.9) if prev else 0))
    f.pop("people", None)
d.update(player=player, view=view, segments=[{"from": 0, "to": len(d["frames"]) - 1, "view": view}],
         notes="'joints' = the server, picked from every detected person by pick_server.py (size + continuity of the hips). "
               "Then clean_keypoints.py adds 'clean'. Alcaraz is right-handed: left = tossing arm.")
json.dump(d, open(path, "w"))
print(f"{path}: {picked} frames with the server, {gaps} empty")
