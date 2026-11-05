"""Find every serve in Sinner's clips, measure it, and tell first serves from second serves.

    python3 -I datasets/serves/tools/analyze_serves.py            # prints a report, writes serves.auto.json

First automatic pass (arm and knee measurements). It splits a serve into two stretches and can't compare
camera angles, so the reviewed results, which use the tossed ball's position, are in sinner/serves.json.

How a serve is found: from the toss until contact, one hand stays well above the head. Each such
"arm up" stretch is one serve. For each serve we measure, in body units so camera distance doesn't matter:
  toss_side   where the toss goes sideways, in shoulder widths from the middle of the shoulders
              (+ = the player's right). Seen from the back or front only; a side view can't show it.
  toss_height how far above the neck the hand reaches, in torso lengths
  knee_bend   the deepest knee bend before contact (degrees; smaller = deeper)
  bounces     ball bounces in the routine before the toss: dips of the bouncing hand, 0.3–1.2 s apart
Telling 1st from 2nd: a second serve (kick) is tossed further left and more over the head for a
right-hander, with a deeper knee bend to brush up the back of the ball. The strongest evidence is
context: two serves in one clip seconds apart means the first was a fault and the second is a 2nd serve.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
SINNER = os.path.join(HERE, "..", "sinner")
# clip id -> (file, camera side: +1 when image-right is the player's right, -1 mirrored, 0 side view)
CLIPS = {
    "back-close": ("back-close.keypoints.json", +1),
    "back-side":  ("back-side.keypoints.json", +1),
    "front2":     ("front2.keypoints.json", -1),
    "front":      ("front.keypoints.json", -1),
    "left":       ("left.keypoints.json", 0),
}

def P(f, n, minc=0.3):
    v = f["joints"].get(n)
    return (v[0], v[1]) if v and v[2] >= minc else None

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

def angle(a, b, c):                      # angle at b, degrees
    v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
    d = math.hypot(*v1) * math.hypot(*v2)
    return math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d)))) if d else None

def med(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[len(xs) // 2] if xs else None

def analyze(cid, fname, side):
    d = json.load(open(os.path.join(SINNER, fname)))
    F, fps = d["frames"], d["fps"]
    asp = d["height"] / d["width"]
    for f in F:                                            # work in real pixel proportions
        f["jj"] = {k: (v[0], v[1] * asp, v[2]) for k, v in f["joints"].items()}
        f["joints"] = f["jj"]
    torso = med([dist(P(f, "neck"), P(f, "root")) for f in F if P(f, "neck") and P(f, "root")])
    shw = med([dist(P(f, "leftShoulder"), P(f, "rightShoulder")) for f in F if P(f, "leftShoulder") and P(f, "rightShoulder")])
    # 1) arm-up stretches: a wrist at least 0.45 torso above the neck
    def up(f):
        n = P(f, "neck") or P(f, "nose")
        ws = [w for w in (P(f, "leftWrist"), P(f, "rightWrist")) if w]
        return bool(n and ws and min(w[1] for w in ws) < n[1] - 0.45 * torso)
    flags = [up(f) for f in F]
    runs, i = [], 0
    while i < len(F):
        if flags[i]:
            j = i
            while j + 1 < len(F) and (flags[j + 1] or any(flags[j + 1:j + 5])): j += 1   # bridge short dropouts
            if (j - i + 1) / fps >= 0.35: runs.append((i, j))
            i = j + 1
        else:
            i += 1
    serves = []
    for a, b in runs:
        seg = F[a:b + 1]
        # toss peak: the highest hand in the first 60% of the stretch (the racket hand rises later)
        first = seg[: max(1, int(len(seg) * 0.6))]
        def hi(f):
            ws = [w for w in (P(f, "leftWrist"), P(f, "rightWrist")) if w]
            return min(w[1] for w in ws) if ws else 9
        peak = min(first, key=hi)
        ws = [w for w in (P(peak, "leftWrist"), P(peak, "rightWrist")) if w]
        hand = min(ws, key=lambda w: w[1])
        ls, rs, nk = P(peak, "leftShoulder"), P(peak, "rightShoulder"), P(peak, "neck") or P(peak, "nose")
        mid = ((ls[0] + rs[0]) / 2) if ls and rs else (nk[0] if nk else None)
        toss_side = round(side * (hand[0] - mid) / shw, 2) if side and mid is not None else None
        toss_height = round((nk[1] - hand[1]) / torso, 2) if nk else None
        knees = []
        for f in F[max(0, a - int(0.3 * fps)): b + 1]:
            for s in ("left", "right"):
                h, k, an = P(f, s + "Hip"), P(f, s + "Knee"), P(f, s + "Ankle")
                if h and k and an: knees.append(angle(h, k, an))
        knee = round(min(knees)) if knees else None
        # 2) routine bounces before this toss: the lowest hand dips in a rhythm
        lo, hi_i = max(0, a - int(8 * fps)), max(0, a - int(0.25 * fps))
        if serves: lo = max(lo, serves[-1]["frames"][1] + int(1.0 * fps))
        ys = []
        for f in F[lo:hi_i]:
            w = [x for x in (P(f, "leftWrist"), P(f, "rightWrist")) if x]
            ys.append(max(x[1] for x in w) if w else None)
        dips, last = [], -99
        for k in range(2, len(ys) - 2):
            win = [y for y in ys[k - 2:k + 3] if y is not None]
            if ys[k] is None or len(win) < 4: continue
            around = [y for y in ys[max(0, k - int(0.3 * fps)):k + int(0.3 * fps)] if y is not None]
            if ys[k] == max(win) and ys[k] - min(around) > 0.12 * torso and (k - last) / fps >= 0.3:
                dips.append(k); last = k
        bounces = len(dips)
        serves.append({"clip": cid, "frames": [F[a]["i"], F[b]["i"]], "t": [F[a]["t"], F[b]["t"]],
                       "toss_peak_frame": peak["i"], "toss_side": toss_side, "toss_height": toss_height,
                       "knee_bend_deg": knee, "routine_bounces": bounces, "routine_seconds": round((hi_i - lo) / fps, 1)})
    return serves

def classify(all_serves):
    """Context first (2 serves in one clip = fault then 2nd serve); otherwise compare with those two."""
    by_clip = {}
    for s in all_serves: by_clip.setdefault(s["clip"], []).append(s)
    ref1 = ref2 = None
    for clip, ss in by_clip.items():
        if len(ss) >= 2:
            ss[0]["serve"], ss[0]["why"] = "first", "first of two serves seconds apart in one clip: a fault"
            ss[1]["serve"], ss[1]["why"] = "second", "served again right after a fault"
            ref1, ref2 = ss[0], ss[1]
    for s in all_serves:
        if "serve" in s: s["confidence"] = "high"; continue
        votes, why = 0, []
        if ref1 and ref2 and s["toss_side"] is not None and ref1["toss_side"] is not None and ref2["toss_side"] is not None:
            c = (ref1["toss_side"] + ref2["toss_side"]) / 2
            v = 1 if (s["toss_side"] - c) * (ref1["toss_side"] - ref2["toss_side"]) > 0 else -1
            votes += v; why.append(f"toss {'right/forward' if v > 0 else 'left/over the head'} like a {'1st' if v > 0 else '2nd'} serve")
        if ref1 and ref2 and s["knee_bend_deg"] and ref1["knee_bend_deg"] and ref2["knee_bend_deg"]:
            c = (ref1["knee_bend_deg"] + ref2["knee_bend_deg"]) / 2
            v = 1 if (s["knee_bend_deg"] - c) * (ref1["knee_bend_deg"] - ref2["knee_bend_deg"]) > 0 else -1
            votes += v; why.append(f"knee bend closer to his {'1st' if v > 0 else '2nd'} serve")
        s["serve"] = "first" if votes >= 0 else "second"
        s["confidence"] = "medium" if abs(votes) >= 2 else "low"
        s["why"] = "; ".join(why) or "no comparable measurements (side view); single serve in clip, assumed first"
    return all_serves

if __name__ == "__main__":
    allS = []
    for cid, (fname, side) in CLIPS.items():
        if os.path.exists(os.path.join(SINNER, fname)): allS += analyze(cid, fname, side)
    classify(allS)
    json.dump({"player": "sinner", "method": "datasets/serves/tools/analyze_serves.py", "serves": allS},
              open(os.path.join(SINNER, "serves.auto.json"), "w"), indent=1)
    for s in allS:
        print(f"{s['clip']:11s} frames {s['frames'][0]:>3}-{s['frames'][1]:<3} t {s['t'][0]:5.2f}-{s['t'][1]:5.2f}s  "
              f"toss_side {s['toss_side']!s:>5}  toss_h {s['toss_height']!s:>5}  knee {s['knee_bend_deg']!s:>4}°  "
              f"bounces {s['routine_bounces']} ({s['routine_seconds']}s)  → {s['serve']:6s} [{s['confidence']}] {s['why']}")
