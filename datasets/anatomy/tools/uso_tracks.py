"""Separate Alcaraz and Shelton from the crowd in the US Open pose data (Biomechanics Coach).

    python3 -I datasets/anatomy/tools/uso_tracks.py            # writes datasets/anatomy/uso/players.json

Input: datasets/anatomy/uso/uso-*.keypoints.json (Apple Vision 2D pose for every person, broadcast clips, ~56 fps).
Only numbers are read; the video stays on Ryan's Mac.

1. Tracks: link each person frame to frame by torso centre and body scale (neck → mid-ankle). A camera cut makes
   the centre or the scale jump, so the track ends there.
2. Kinds: `court` = a whole body, 0.15–0.42 of the frame tall, followed for ≥ 1 s (the broadcast view behind the
   near baseline); `closeup` = taller than that (between-point close-ups and replays); `crowd` = everything else
   (partial bodies, short blips, people who never move: spectators, ball kids, line judges).
3. Serves: in a court track, one wrist goes over the head and stays up (the toss), then the other wrist goes higher
   still (contact). Toss arm = left → right-hander = Alcaraz; toss arm = right → left-hander = Shelton.
   The labels are checked against the picture: seen from behind (no face), a person's left shoulder must be on the
   image left. A track keeps the player of its serve; the whole shot is that player's point on serve.
"""
import glob, json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
USO = os.path.join(HERE, "..", "uso")
CONF = 0.3
TORSO = ("neck", "leftShoulder", "rightShoulder", "leftHip", "rightHip", "root")


def ok(j, k):
    v = j.get(k)
    return v if v and v[2] >= CONF else None


def mid(a, b):
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]


def body(person):
    """Centre, scale and joint count of one detection (None if too little of the body is seen)."""
    j = person["joints"]
    good = {k: v for k, v in j.items() if v[2] >= CONF}
    if len(good) < 8:
        return None
    t = [good[k] for k in TORSO if k in good]
    if len(t) < 3:
        return None
    cx = sum(v[0] for v in t) / len(t)
    cy = sum(v[1] for v in t) / len(t)
    neck = good.get("neck") or (mid(good["leftShoulder"], good["rightShoulder"]) if "leftShoulder" in good and "rightShoulder" in good else None)
    ank = [good[k] for k in ("leftAnkle", "rightAnkle") if k in good]
    if neck and ank:
        s = max(v[1] for v in ank) - neck[1]
    else:
        ys = [v[1] for v in good.values()]
        s = (max(ys) - min(ys)) * 0.8
    if s <= 0.02:
        return None
    return {"c": (cx, cy), "s": s, "n": len(good), "feet": len(ank) == 2, "j": j}


def build_tracks(frames, fps):
    tracks, live = [], []
    for f in frames:
        dets = [b for b in (body(p) for p in f["people"]) if b]
        used = set()
        for tr in sorted(live, key=lambda tr: -tr["obs"][-1][1]["s"]):
            last_i, last = tr["obs"][-1]
            best, bd = None, 1e9
            for k, b in enumerate(dets):
                if k in used:
                    continue
                r = b["s"] / last["s"]
                if not 0.7 < r < 1.45:
                    continue
                dd = math.dist(b["c"], last["c"]) / last["s"]
                if dd < 0.45 * (1 + 0.25 * (f["i"] - last_i - 1)) and dd < bd:
                    best, bd = k, dd
            if best is not None:
                used.add(best)
                tr["obs"].append((f["i"], dets[best]))
        live = [tr for tr in live if f["i"] - tr["obs"][-1][0] <= 6]
        for k, b in enumerate(dets):
            if k not in used:
                tr = {"obs": [(f["i"], b)]}
                tracks.append(tr)
                live.append(tr)
    return tracks


def classify(tr, fps):
    obs = tr["obs"]
    dur = (obs[-1][0] - obs[0][0] + 1) / fps
    s = sorted(o["s"] for _, o in obs)[len(obs) // 2]
    n = sorted(o["n"] for _, o in obs)[len(obs) // 2]
    feet = sum(o["feet"] for _, o in obs) / len(obs)
    xs = [o["c"][0] for _, o in obs]
    ys = [o["c"][1] for _, o in obs]
    travel = (max(xs) - min(xs) + max(ys) - min(ys)) / s
    tr.update(dur=dur, s=s, n=n, travel=travel)
    if dur < 1.0 or n < 13:
        return "crowd"
    if not 0.08 < sorted(xs)[len(xs) // 2] < 0.92:
        return "crowd"  # cut off by the frame edge
    if s >= 0.42 * 0.8:
        return "closeup"
    if s < 0.15 * 0.8 or feet < 0.6:
        return "crowd"
    return "court"


def serves_in(tr, fps):
    """Toss → contact in a court track. Heights are in body scales above the shoulder line (image y grows down);
    the nose is no good here: it is lost at contact (the head turns up) and rises with the jump."""
    out = []
    obs = tr["obs"]
    up = {"left": [], "right": []}
    for i, o in obs:
        j = o["j"]
        l, r = ok(j, "leftShoulder"), ok(j, "rightShoulder")
        sh = mid(l, r) if l and r else ok(j, "neck")
        if not sh:
            continue
        for side in up:
            w = ok(j, side + "Wrist")
            up[side].append((i, (sh[1] - w[1]) / o["s"] if w else None))
    def runs(seq, thr, min_len):
        res, start = [], None
        for k, (i, h) in enumerate(seq + [(None, None)]):
            hi = h is not None and h > thr
            if hi and start is None:
                start = k
            if not hi and start is not None:
                if k - start >= min_len:
                    res.append(seq[start:k])
                start = None
        return res
    for toss_side, hit_side in (("left", "right"), ("right", "left")):
        for run in runs(up[toss_side], 0.3, int(0.2 * fps)):
            t0 = run[0][0]
            # contact: the hitting wrist's highest point in the 1.2 s after the toss arm goes up
            hit = [(i, h) for i, h in up[hit_side] if h is not None and t0 <= i <= t0 + 1.2 * fps]
            if not hit:
                continue
            ci, ch = max(hit, key=lambda x: x[1])
            peak_toss = max(h for _, h in run)
            if ch < 0.2 or ci <= run[0][0] + 0.25 * fps:
                continue
            out.append({"tossUp": t0, "contact": ci, "toss": toss_side, "hand": hit_side,
                        "tossPeak": round(peak_toss, 2), "contactHeight": round(ch, 2)})
    # one serve per contact (the two arm orders can both fire on one serve: keep the higher contact)
    out.sort(key=lambda e: e["contact"])
    merged = []
    for e in out:
        if merged and abs(e["contact"] - merged[-1]["contact"]) < 0.5 * fps:
            if e["contactHeight"] > merged[-1]["contactHeight"]:
                merged[-1] = e
        else:
            merged.append(e)
    return merged


def back_view_labels_ok(tr):
    """Fraction of back-view frames (no face) where the left shoulder is on the image left: ~1 = Vision's left/right
    labels are the person's own; ~0 = mirrored."""
    good = tot = 0
    for _, o in tr["obs"]:
        j = o["j"]
        if ok(j, "nose") or ok(j, "leftEye") or ok(j, "rightEye"):
            continue
        l, r = ok(j, "leftShoulder"), ok(j, "rightShoulder")
        if not (l and r) or abs(l[0] - r[0]) < 0.15 * o["s"]:
            continue
        tot += 1
        good += l[0] < r[0]
    return (good / tot if tot else None), tot


def main():
    files = sorted(glob.glob(os.path.join(USO, "uso-*.keypoints.json")), key=lambda p: int(re.findall(r"(\d+)\.keypoints", p)[0]))
    result = {"about": "Players separated from the crowd in the US Open clips (Alcaraz vs Shelton). Frame numbers index "
                       "uso-N.keypoints.json 'frames'. Built by datasets/anatomy/tools/uso_tracks.py; numbers only.",
              "rule": "Toss arm left = right-hander = alcaraz; toss arm right = left-hander = shelton.",
              "clips": []}
    for path in files:
        d = json.load(open(path))
        fps = d["fps"]
        frames = d["frames"]
        tracks = build_tracks(frames, fps)
        clip = {"file": os.path.basename(path), "fps": round(fps, 2), "frames": len(frames), "tracks": [], "dropped": {}}
        for tr in tracks:
            kind = classify(tr, fps)
            if kind == "crowd":
                clip["dropped"]["crowd"] = clip["dropped"].get("crowd", 0) + 1
                continue
            entry = {"from": tr["obs"][0][0], "to": tr["obs"][-1][0], "kind": kind, "dur": round(tr["dur"], 2),
                     "scale": round(tr["s"], 3)}
            if kind == "court":
                sv = serves_in(tr, fps)
                frac, n = back_view_labels_ok(tr)
                entry["backViewLabelsOk"] = None if frac is None else round(frac, 2)
                entry["serves"] = sv
                if sv:
                    hands = {e["hand"] for e in sv}
                    entry["player"] = ("alcaraz" if hands == {"right"} else "shelton" if hands == {"left"} else "unsure")
                    entry["court"] = "near"
                else:
                    entry["player"] = None
            # the person in each frame, so the measurer can pick the same detection again
            entry["people"] = {str(i): frames[i]["people"].index(next(p for p in frames[i]["people"] if p["joints"] is o["j"]))
                               for i, o in tr["obs"]}
            clip["tracks"].append(entry)
        result["clips"].append(clip)
    out = os.path.join(USO, "players.json")
    with open(out, "w") as fh:
        json.dump(result, fh, indent=1)
    for c in result["clips"]:
        print(c["file"], "dropped", c["dropped"])
        for t in c["tracks"]:
            print("  ", t["kind"], t["from"], t["to"], t["dur"], t["scale"], t.get("player"), t.get("backViewLabelsOk"),
                  [(e["tossUp"], e["contact"], e["hand"], e["contactHeight"]) for e in t.get("serves", [])])
    print("→", out)


if __name__ == "__main__":
    main()
