"""Measure serves, split steps and changes of direction from the players found by uso_tracks.py (Biomechanics Coach).

    python3 -I datasets/anatomy/tools/uso_tracks.py
    python3 -I datasets/anatomy/tools/measure.py          # writes datasets/anatomy/uso/measurements.json

All of it is 2D (one broadcast camera behind Alcaraz's baseline), so:
- angles are the angle seen in the picture. Knee and elbow bends of a side-on server lie close to the picture plane
  (the camera looks along his shoulder line), so they read well; trunk rotation does not show and is not measured.
- lengths are in body scales s = neck → lower ankle in the picture, turned into fractions of standing height with
  NECK_TO_ANKLE (Vision's neck is the mid-shoulder point ≈ 0.818 H, the ankle joint ≈ 0.039 H: 0.78 H; Drillis &
  Contini 1966 / Winter, Biomechanics and Motor Control of Human Movement, segment table).
- times are real time (the US Open clips are not slowed down). The compilation serves are slow motion at a varying
  speed: only their angles and arm order are used.
"""
import glob, json, math, os, statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
USO = os.path.join(HERE, "..", "uso")
NECK_TO_ANKLE = 0.78
CONF = 0.3


def P(j, k):
    v = j.get(k)
    return (v[0], v[1]) if v and v[2] >= CONF else None


def mid(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) if a and b else (a or b)


def angle(a, b, c):
    """Inner angle at b in degrees (180 = straight)."""
    if not (a and b and c):
        return None
    v1 = (a[0] - b[0], a[1] - b[1]); v2 = (c[0] - b[0], c[1] - b[1])
    n = math.hypot(*v1) * math.hypot(*v2)
    if n == 0:
        return None
    return math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))))


def flex(a, b, c):
    """Joint flexion = 180 − inner angle (0 = straight)."""
    x = angle(a, b, c)
    return None if x is None else 180 - x


def tilt_from_vertical(lo, hi):
    """Angle of the segment lo → hi from straight up, degrees (picture plane)."""
    if not (lo and hi):
        return None
    return math.degrees(math.atan2(abs(hi[0] - lo[0]), lo[1] - hi[1]))


def rnd(x, n=1):
    return None if x is None else round(x, n)


def med(xs, n=1):
    xs = [x for x in xs if x is not None]
    return None if not xs else round(st.median(xs), n)


def spread(xs, n=1):
    xs = [x for x in xs if x is not None]
    return None if not xs else [round(min(xs), n), round(max(xs), n)]


class Track:
    """One player's joints, frame by frame, lightly smoothed (3-frame mean per joint)."""

    def __init__(self, frames, entry):
        self.idx = sorted(int(i) for i in entry["people"])
        raw = {i: frames[i]["people"][entry["people"][str(i)]]["joints"] for i in self.idx}
        self.j = {}
        for i in self.idx:
            out = {}
            for k in raw[i]:
                pts = [raw[n][k] for n in (i - 1, i, i + 1) if n in raw and k in raw[n] and raw[n][k][2] >= CONF]
                if raw[i].get(k, [0, 0, 0])[2] >= CONF and pts:
                    out[k] = [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), 1.0]
            self.j[i] = out
        self.s = {}
        for i in self.idx:
            j = self.j[i]
            neck = P(j, "neck") or mid(P(j, "leftShoulder"), P(j, "rightShoulder"))
            ank = [P(j, "leftAnkle"), P(j, "rightAnkle")]
            if neck and all(ank):
                self.s[i] = max(a[1] for a in ank) - neck[1]
        good = sorted(self.s.values())
        self.scale = good[len(good) // 2] if good else None

    def at(self, i):
        return self.j.get(i, {})

    def ground(self, a, b):
        """Standing ground line (image y) = the median lower ankle over frames a..b."""
        ys = [max(P(self.j[i], "leftAnkle")[1], P(self.j[i], "rightAnkle")[1]) for i in range(a, b + 1)
              if i in self.j and P(self.j[i], "leftAnkle") and P(self.j[i], "rightAnkle")]
        return st.median(ys) if ys else None


def H(track, dy):
    """Picture distance → fraction of standing height."""
    return dy / track.scale * NECK_TO_ANKLE


def serve_measure(track, sv, fps):
    """Key moments of one serve and the body at each."""
    tossS = sv["toss"]; hitS = sv["hand"]
    front = "left" if hitS == "right" else "right"  # a right-hander's front (left) leg points at the net
    back = hitS
    ci = sv["contact"]
    # refine contact: highest hitting wrist within ±4 frames
    cands = [(i, P(track.at(i), hitS + "Wrist")) for i in range(ci - 4, ci + 5)]
    cands = [(i, w) for i, w in cands if w]
    if cands:
        ci = min(cands, key=lambda x: x[1][1])[0]
    pre = [i for i in track.idx if ci - 2.0 * fps <= i < ci]
    # trophy: toss wrist highest before contact
    toss_y = [(i, P(track.at(i), tossS + "Wrist")) for i in pre]
    toss_y = [(i, w[1]) for i, w in toss_y if w]
    if not toss_y:
        return None
    trophy = min(toss_y, key=lambda x: x[1])[0]  # toss arm highest ≈ ball just released
    # toss arm starts up: its wrist crosses the shoulder line
    start = None
    for i in sorted(pre, reverse=True):
        j = track.at(i); w = P(j, tossS + "Wrist"); sh = mid(P(j, "leftShoulder"), P(j, "rightShoulder"))
        if i < trophy and w and sh and w[1] > sh[1]:
            start = i; break
    # deepest knee bend between toss start and contact
    kb = []
    for i in pre:
        if start is not None and i < start:
            continue
        j = track.at(i)
        kf = flex(P(j, front + "Hip"), P(j, front + "Knee"), P(j, front + "Ankle"))
        kbk = flex(P(j, back + "Hip"), P(j, back + "Knee"), P(j, back + "Ankle"))
        if kf is not None and kbk is not None:
            kb.append((i, kf, kbk))
    if not kb:
        return None
    deep = max(kb, key=lambda x: x[1] + x[2])[0]
    # stance before the motion: 0.6 s before the toss arm starts
    a0 = (start or trophy) - int(0.6 * fps)
    ground = track.ground(max(track.idx[0], a0 - int(0.4 * fps)), (start or trophy))
    # landing: after contact the feet come down (picture y grows) and then stop: the first frame where the lower
    # ankle stops falling after falling at least 1% of body scale. (Not a fixed ground line: he lands inside the court.)
    land = None
    ys = []
    for i in range(ci, ci + int(0.8 * fps)):
        j = track.at(i); la, ra = P(j, "leftAnkle"), P(j, "rightAnkle")
        if la and ra:
            ys.append((i, max(la[1], ra[1])))
    fell = False
    for k in range(3, len(ys)):
        dy = ys[k][1] - ys[k - 3][1]
        if dy > 0.01 * track.scale:
            fell = True
        elif fell and dy < 0.003 * track.scale:
            land = ys[k - 2][0]; break
    # facing: the nose is on the chest side; +1 = the player faces picture-right
    noses = [P(track.at(i), "nose")[0] - P(track.at(i), "neck")[0] for i in range(a0, start or trophy)
             if P(track.at(i), "nose") and P(track.at(i), "neck")]
    facing = 1 if noses and st.median(noses) > 0 else -1

    def pose(i):
        j = track.at(i)
        sh = mid(P(j, "leftShoulder"), P(j, "rightShoulder")); hip = mid(P(j, "leftHip"), P(j, "rightHip"))
        out = {
            "frontKneeFlex": rnd(flex(P(j, front + "Hip"), P(j, front + "Knee"), P(j, front + "Ankle"))),
            "backKneeFlex": rnd(flex(P(j, back + "Hip"), P(j, back + "Knee"), P(j, back + "Ankle"))),
            "hitElbowFlex": rnd(flex(P(j, hitS + "Shoulder"), P(j, hitS + "Elbow"), P(j, hitS + "Wrist"))),
            "tossElbowFlex": rnd(flex(P(j, tossS + "Shoulder"), P(j, tossS + "Elbow"), P(j, tossS + "Wrist"))),
            "hitUpperArmFromUp": rnd(tilt_from_vertical(P(j, hitS + "Shoulder"), P(j, hitS + "Elbow"))),
            "tossArmFromUp": rnd(tilt_from_vertical(P(j, tossS + "Shoulder"), P(j, tossS + "Wrist"))),
            "trunkLeanFromUp": rnd(tilt_from_vertical(hip, sh)),
            # shoulder-over-shoulder: hitting shoulder below the toss shoulder, degrees
            "shoulderTilt": None,
        }
        hs, ts = P(j, hitS + "Shoulder"), P(j, tossS + "Shoulder")
        if hs and ts:
            out["shoulderTilt"] = rnd(math.degrees(math.atan2(hs[1] - ts[1], abs(hs[0] - ts[0]) + 1e-9)))
        if ground:
            if hip:
                out["hipHeightH"] = rnd(H(track, ground - hip[1]), 3)
            for side, key in ((hitS, "hitWristHeightH"), (tossS, "tossWristHeightH")):
                w = P(j, side + "Wrist")
                if w:
                    out[key] = rnd(H(track, ground - w[1]), 3)
        # where the hands are, relative to the shoulder midpoint: forward = the way the chest faces (+), up (+)
        for side, key in ((hitS, "hitHand"), (tossS, "tossHand")):
            w = P(j, side + "Wrist")
            if w and sh:
                out[key] = {"forwardH": rnd(H(track, (w[0] - sh[0]) * facing), 3), "upH": rnd(H(track, sh[1] - w[1]), 3)}
        return out

    t = lambda i: None if i is None else round((i - ci) / fps, 3)
    return {
        "hand": hitS, "frames": {"tossStart": start, "tossArmHighest": trophy, "deepestKnees": deep, "contact": ci, "landing": land},
        "timesToContact": {"tossStart": t(start), "tossArmHighest": t(trophy), "deepestKnees": t(deep), "landing": t(land)},
        "stance": pose(a0), "tossStart": pose(start) if start else None, "tossArmHighest": pose(trophy), "deepestKnees": pose(deep),
        "contact": pose(ci), "landing": pose(land) if land else None,
    }


def hip_drop(track, ref, a, b):
    """Hip-to-lower-ankle height at frame ref minus its lowest value in frames a..b, in fractions of standing height."""
    def hh(i):
        j = track.at(i); hip = mid(P(j, "leftHip"), P(j, "rightHip")); la, ra = P(j, "leftAnkle"), P(j, "rightAnkle")
        return max(la[1], ra[1]) - hip[1] if hip and la and ra else None
    r = next((hh(i) for i in range(ref, ref - 10, -1) if hh(i) is not None), None)
    lows = [x for x in (hh(i) for i in range(a, b + 1)) if x is not None]
    return round(H(track, r - min(lows)), 3) if r is not None and lows else None


def hops(track, fps, after, before):
    """Split steps: both ankles leave the ground together for 0.1–0.35 s and land again (picture y grows down).
    The ground line follows the feet, so a step with one foot is not a hop."""
    out = []
    seq = []
    for i in track.idx:
        if not after <= i <= before:
            continue
        j = track.at(i); la, ra = P(j, "leftAnkle"), P(j, "rightAnkle"); hip = mid(P(j, "leftHip"), P(j, "rightHip"))
        if la and ra and hip:
            seq.append((i, max(la[1], ra[1]), min(la[1], ra[1]), hip[1]))
    if len(seq) < 10:
        return out
    k = 0
    while k < len(seq):
        i0, low0, high0, hip0 = seq[k]
        # both feet: the lower ankle rises at least 2.5% of body scale above where it was 3 frames ago
        if k >= 3:
            base = seq[k - 3][1]
            if base - low0 > 0.025 * track.scale:
                peak = k
                m = k
                while m + 1 < len(seq) and seq[m + 1][0] - seq[m][0] <= 2 and (seq[m + 1][0] - i0) < 0.45 * fps:
                    m += 1
                    if seq[m][1] < seq[peak][1]:
                        peak = m
                    if seq[m][1] >= base - 0.008 * track.scale:
                        break
                air = (seq[m][0] - seq[k - 3][0]) / fps
                j = track.at(seq[m][0])
                la, ra = P(j, "leftAnkle"), P(j, "rightAnkle")
                both = la and ra and abs(la[1] - ra[1]) < 0.035 * track.scale  # lands on both feet, not a stride
                if 0.1 <= air <= 0.4 and seq[m][1] >= base - 0.012 * track.scale and both:
                    out.append({
                        "takeoff": seq[k - 3][0], "land": seq[m][0], "airTime": round(air, 3),
                        "heightH": round(H(track, base - seq[peak][1]), 3),
                        "landingStanceWidthH": round(H(track, abs(la[0] - ra[0])), 3) if la and ra else None,
                        # how far the hips sink on landing vs 0.15 s before take-off (knee bend itself points away
                        # from a camera behind the player, so the hip drop is what can be measured)
                        "landingHipDropH": hip_drop(track, seq[k - 3][0] - int(0.15 * fps), seq[m][0], seq[m][0] + int(0.08 * fps)),
                    })
                    k = m + 1
                    continue
        k += 1
    return out


def direction_changes(track, fps, after, before):
    """Sideways reversals of the hips: speed (body heights per second, in the picture) above 0.35 H/s one way, then
    the other, within 0.8 s. The camera may pan with the player, so speeds are lower bounds; the pose at the turn
    is what counts here."""
    xs = []
    for i in track.idx:
        if after <= i <= before:
            hip = mid(P(track.at(i), "leftHip"), P(track.at(i), "rightHip"))
            if hip:
                xs.append((i, hip[0]))
    v = []
    w = 4
    for k in range(w, len(xs) - w):
        (i0, x0), (i1, x1) = xs[k - w], xs[k + w]
        if i1 - i0 <= 2 * w + 2:
            v.append((xs[k][0], H(track, (x1 - x0)) / ((i1 - i0) / fps)))
    out = []
    last = None
    for k in range(1, len(v)):
        if v[k - 1][1] * v[k][1] < 0:
            before_v = [s for i, s in v if v[k][0] - 0.4 * fps <= i < v[k][0]]
            after_v = [s for i, s in v if v[k][0] <= i <= v[k][0] + 0.4 * fps]
            if not before_v or not after_v:
                continue
            vin = max(before_v, key=abs); vout = max(after_v, key=abs)
            if abs(vin) > 0.35 and abs(vout) > 0.35 and vin * vout < 0 and (last is None or v[k][0] - last > 0.3 * fps):
                i = v[k][0]; j = track.at(i)
                la, ra = P(j, "leftAnkle"), P(j, "rightAnkle")
                sh = mid(P(j, "leftShoulder"), P(j, "rightShoulder")); hip = mid(P(j, "leftHip"), P(j, "rightHip"))
                lean = None
                if sh and hip:
                    # positive = the trunk leans toward the new direction
                    lean = math.degrees(math.atan2((sh[0] - hip[0]) * (1 if vout > 0 else -1), hip[1] - sh[1]))
                out.append({"frame": i, "speedInH": round(abs(vin), 2), "speedOutH": round(abs(vout), 2),
                            "stanceWidthH": round(H(track, abs(la[0] - ra[0])), 3) if la and ra else None,
                            "hipDropH": hip_drop(track, i - int(0.5 * fps), i - int(0.1 * fps), i + int(0.1 * fps)),
                            "trunkLeanToNewDir": rnd(lean)})
                last = i
    return out


def compilation_serves():
    """Angles of every compilation serve (slow motion: no times) for the right- vs left-hander comparison."""
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "datasets", "serves", "*", "compilation-*.keypoints.json"))):
        d = json.load(open(path))
        if d.get("confidence") == "low":
            continue
        frames = d["frames"]
        pid = d["player"]
        for sv in d.get("serves", []):
            c = sv["contactFrame"]
            if c >= len(frames):
                continue
            # Vision mirrors left/right on some clips: seen from behind (no face), the left shoulder must be on the
            # picture's left. If it mostly is not, swap every left/right label of this serve.
            good = tot = 0
            for f in frames[max(0, c - 120): c + 30]:
                jj = f["joints"]
                if P(jj, "nose") or P(jj, "leftEye") or P(jj, "rightEye"):
                    continue
                l, r = P(jj, "leftShoulder"), P(jj, "rightShoulder")
                if l and r and abs(l[0] - r[0]) >= 0.01:
                    tot += 1; good += l[0] < r[0]
            mirrored = tot >= 10 and good / tot < 0.5
            def J(i):
                jj = frames[i]["joints"]
                if not mirrored:
                    return jj
                return {(k.replace("left", "@").replace("right", "left").replace("@", "right")): v for k, v in jj.items()}
            # the toss arm is the first wrist above the head; the hitting hand is the other one
            other = None
            for i in range(max(0, c - 150), c):
                jj = J(i); n = P(jj, "nose") or P(jj, "neck")
                for s in ("left", "right"):
                    w = P(jj, s + "Wrist")
                    if n and w and w[1] < n[1] - 0.02:
                        other = s; break
                if other:
                    break
            if not other:
                continue
            hand = "right" if other == "left" else "left"
            front = other
            j = J(c)
            # deepest front-knee bend in the 3 s of slow motion before contact
            best = None
            for i in range(max(0, c - 180), c):
                jj = J(i)
                kf = flex(P(jj, front + "Hip"), P(jj, front + "Knee"), P(jj, front + "Ankle"))
                kb = flex(P(jj, hand + "Hip"), P(jj, hand + "Knee"), P(jj, hand + "Ankle"))
                if kf is not None and kb is not None and (best is None or kf + kb > best[1] + best[2]):
                    best = (i, kf, kb)
            # toss arm: highest toss wrist before contact
            tw = [(i, P(J(i), other + "Wrist")) for i in range(max(0, c - 180), c)]
            tw = [(i, w) for i, w in tw if w]
            trophy = min(tw, key=lambda x: x[1][1])[0] if tw else None
            jt = J(trophy) if trophy is not None else {}
            rec = {
                "file": os.path.relpath(path, ROOT), "contactFrame": c, "hand": hand, "tossArm": other,
                "labelsMirrored": mirrored,
                "contactElbowFlex": rnd(flex(P(j, hand + "Shoulder"), P(j, hand + "Elbow"), P(j, hand + "Wrist"))),
                "contactArmFromUp": rnd(tilt_from_vertical(P(j, hand + "Shoulder"), P(j, hand + "Wrist"))),
                "deepestFrontKneeFlex": rnd(best[1]) if best else None,
                "deepestBackKneeFlex": rnd(best[2]) if best else None,
                "trophyHitElbowFlex": rnd(flex(P(jt, hand + "Shoulder"), P(jt, hand + "Elbow"), P(jt, hand + "Wrist"))),
                "trophyTossArmFromUp": rnd(tilt_from_vertical(P(jt, other + "Shoulder"), P(jt, other + "Wrist"))),
            }
            out.setdefault(pid, []).append(rec)
    return out


def summarise(serves):
    keys = {}
    for s in serves:
        for phase in ("stance", "tossStart", "tossArmHighest", "deepestKnees", "contact", "landing"):
            for k, v in (s.get(phase) or {}).items():
                if isinstance(v, dict):
                    for kk, vv in v.items():
                        keys.setdefault(f"{phase}.{k}.{kk}", []).append(vv)
                else:
                    keys.setdefault(f"{phase}.{k}", []).append(v)
        for k, v in s["timesToContact"].items():
            keys.setdefault(f"time.{k}", []).append(v)
    return {k: {"median": med(v, 3), "range": spread(v, 3), "n": len([x for x in v if x is not None])} for k, v in sorted(keys.items())}


def main():
    players = json.load(open(os.path.join(USO, "players.json")))
    serves, splits, turns = [], [], []
    for clip in players["clips"]:
        d = json.load(open(os.path.join(USO, clip["file"])))
        fps = d["fps"]
        for entry in clip["tracks"]:
            if entry["kind"] != "court" or not entry.get("player"):
                continue
            tr = Track(d["frames"], entry)
            for sv in entry["serves"]:
                m = serve_measure(tr, sv, fps)
                if not m:
                    continue
                m.update(player=entry["player"], clip=clip["file"])
                serves.append(m)
                land = m["frames"]["landing"] or m["frames"]["contact"] + int(0.4 * fps)
                for h in hops(tr, fps, land + 2, entry["to"]):
                    h.update(player=entry["player"], clip=clip["file"],
                             afterServeContact=round((h["land"] - m["frames"]["contact"]) / fps, 3))
                    splits.append(h)
                for c in direction_changes(tr, fps, land + 2, entry["to"]):
                    c.update(player=entry["player"], clip=clip["file"],
                             afterServeContact=round((c["frame"] - m["frames"]["contact"]) / fps, 3))
                    turns.append(c)
    # a split step lands wide (feet at least 0.25 H apart); narrow hops are the little bounces on the toes between shots
    bounces = [h for h in splits if (h["landingStanceWidthH"] or 0) < 0.25]
    splits = [h for h in splits if (h["landingStanceWidthH"] or 0) >= 0.25]
    comp = compilation_serves()
    result = {
        "about": "Measured from Apple Vision 2D pose (numbers only; video stays local). Heights and widths are "
                 "fractions of standing height (H); angles in degrees seen in the picture; times in seconds. "
                 "Built by datasets/anatomy/tools/measure.py.",
        "uso": {
            "alcarazServes": {"n": len(serves), "summary": summarise(serves), "each": serves},
            "splitSteps": {"n": len(splits), "summary": {k: {"median": med([s[k] for s in splits], 3), "range": spread([s[k] for s in splits], 3)}
                                                         for k in ("airTime", "heightH", "landingStanceWidthH", "landingHipDropH", "afterServeContact")},
                           "each": splits},
            "bouncesOnToes": {"n": len(bounces), "summary": {k: {"median": med([s[k] for s in bounces], 3), "range": spread([s[k] for s in bounces], 3)}
                                                            for k in ("airTime", "heightH", "landingStanceWidthH")}, "each": bounces},
            "directionChanges": {"n": len(turns), "summary": {k: {"median": med([s[k] for s in turns], 2), "range": spread([s[k] for s in turns], 2)}
                                                              for k in ("speedInH", "speedOutH", "stanceWidthH", "hipDropH", "trunkLeanToNewDir")},
                                 "each": turns},
        },
        "compilationServes": {pid: {"hands": sorted({r["hand"] for r in recs}), "n": len(recs),
                                    "median": {k: med([r[k] for r in recs]) for k in recs[0]
                                               if k not in ("file", "contactFrame", "hand", "tossArm", "labelsMirrored")},
                                    "each": recs}
                              for pid, recs in comp.items()},
    }
    out = os.path.join(USO, "measurements.json")
    json.dump(result, open(out, "w"), indent=1)
    print(json.dumps({"serves": result["uso"]["alcarazServes"]["summary"], "split": result["uso"]["splitSteps"]["summary"],
                      "turns": result["uso"]["directionChanges"]["summary"],
                      "comp": {p: (v["hands"], v["n"], v["median"]) for p, v in result["compilationServes"].items()}}, indent=0))
    print("→", out)


if __name__ == "__main__":
    main()
