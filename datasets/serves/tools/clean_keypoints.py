"""Clean raw 2D pose keypoints for a serve clip and pick evenly spaced key frames.

usage: python3 -I clean_keypoints.py <clip.keypoints.json> [keyframes=20] [refFrames=40] [tossUntil=-1]

tossUntil: last frame where the raised arm on top is the tossing (left) arm; after it, a raised arm on top is
the racket (right) arm. Read it off the video once per clip (front clip: 69). -1 = always the tossing arm.

Adds to every frame a "clean" dict (same joint names, [x, y, confidence]) and an "estimated" list,
plus "keyframes" and a "cleaning" report. Raw "joints" are kept untouched.

Why: the raw detector fails in three ways during a serve.
- When the toss or racket arm goes up in front of the face (the fold), it puts the neck/nose on the
  raised hand, so the torso stretches up to the hand.
- Around contact, it merges Sinner's legs with a spectator's upper body in the crowd behind him.
- Left and right joints swap for a few frames, and overlapping arms produce two copies of a joint.

How, in three passes, with body lengths measured in the calm first frames (refFrames):
A. Drop joints under 0.3 confidence; undo left/right swaps by matching the previous frame.
B. Body scale and hips: the body grows as he jumps toward the camera, so a per-frame scale is taken from
   the bones that look normal and smoothed over time. The hips (root, leftHip, rightHip) must move
   smoothly: points that jump away from their neighbours in time are dropped, and gaps of up to
   4 frames are interpolated (listed in "estimated").
C. Everything else must fit a body of that size around those hips: neck and shoulders within one
   torso of the hips (else the neck is rebuilt from the shoulders or the last good frame), head points
   near the neck (else hidden: the arm is in front, and the arm on top is what is shown), every bone no
   longer than 1.35x its real length, no joint without its parent, and when the left and right copy of
   a joint overlap, only the more confident one (the one on top) is kept.
"""
import json, math, sys

path = sys.argv[1]
NKEY = int(sys.argv[2]) if len(sys.argv) > 2 else 20
NREF = int(sys.argv[3]) if len(sys.argv) > 3 else 40
TOSS_UNTIL = int(sys.argv[4]) if len(sys.argv) > 4 else -1
MINC = 0.3
d = json.load(open(path))
F = d["frames"]
AS = d["height"] / d["width"]                          # measure in real pixels, not normalized units

def P(j, n): v = j.get(n); return None if v is None else (v[0], v[1] * AS)
def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])
def med(xs): xs = sorted(x for x in xs if x is not None); return xs[len(xs) // 2] if xs else None

PARENT = {"leftShoulder": "neck", "rightShoulder": "neck", "leftElbow": "leftShoulder", "leftWrist": "leftElbow",
          "rightElbow": "rightShoulder", "rightWrist": "rightElbow", "leftKnee": "leftHip", "leftAnkle": "leftKnee",
          "rightKnee": "rightHip", "rightAnkle": "rightKnee"}
LIMB = {k: v for k, v in PARENT.items() if "Shoulder" not in k}
PAIRS = ["Shoulder", "Elbow", "Wrist", "Hip", "Knee", "Ankle", "Eye", "Ear"]
HIPS = ["root", "leftHip", "rightHip"]
HEAD = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"]

def ref_len(a, b):
    return med([dist(P(f["joints"], a), P(f["joints"], b)) for f in F[:NREF]
                if a in f["joints"] and b in f["joints"] and min(f["joints"][a][2], f["joints"][b][2]) >= 0.5])
REF = {j: ref_len(j, p) for j, p in LIMB.items()}
TORSO = ref_len("neck", "root"); HEADL = ref_len("nose", "neck")
SHW = ref_len("leftShoulder", "rightShoulder"); HIPW = ref_len("leftHip", "rightHip")
log = {f["i"]: [] for f in F}

# ---- pass A: confidence + left/right swaps ----
J = []
prev = None
for f in F:
    j = {n: list(v) for n, v in f["joints"].items() if v[2] >= MINC}
    if prev:
        for part in PAIRS:
            L, R = "left" + part, "right" + part
            if L in j and R in j and L in prev and R in prev:
                keep = dist(P(j, L), P(prev, L)) + dist(P(j, R), P(prev, R))
                swap = dist(P(j, L), P(prev, R)) + dist(P(j, R), P(prev, L))
                if swap < 0.6 * keep:
                    j[L], j[R] = j[R], j[L]; log[f["i"]].append(f"swapped left/right {part.lower()}s")
    J.append(j); prev = j if j else prev

# ---- pass B: body scale over time, then smooth hips ----
raw_scale = []
for j in J:
    r = [dist(P(j, a), P(j, b)) / REF[a] for a, b in LIMB.items() if a in j and b in j and REF[a]]
    raw_scale.append(med(r))
S = []
for k in range(len(J)):
    w = [raw_scale[i] for i in range(max(0, k - 4), min(len(J), k + 5))]
    S.append(min(2.2, max(0.7, med(w) or 1.0)))
for h in HIPS:
    for k in range(len(J)):
        if h not in J[k]: continue
        before = [P(J[i], h) for i in range(max(0, k - 4), k) if h in J[i]]
        after = [P(J[i], h) for i in range(k + 1, min(len(J), k + 5)) if h in J[i]]
        nb = before + after
        if len(before) >= 2 and len(after) >= 2:          # only judge a frame with neighbours on both sides
            c = (med([p[0] for p in nb]), med([p[1] for p in nb]))
            if dist(P(J[k], h), c) > 0.35 * TORSO * S[k]:
                del J[k][h]; log[F[k]["i"]].append(f"dropped {h}: jumped (merged with someone in the crowd)")
    k = 0
    while k < len(J):
        if h in J[k]: k += 1; continue
        e = k
        while e < len(J) and h not in J[e]: e += 1
        if k > 0 and e < len(J) and e - k <= 4:
            a, b = J[k - 1][h], J[e][h]
            for i in range(k, e):
                u = (i - k + 1) / (e - k + 1)
                J[i][h] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0.3]
                F[i].setdefault("estimated", []).append(h)
        k = e

# ---- pass C: fit everything else to a body of the right size ----
last_neck_off = None
last_sh = {}                                          # shoulder offsets from the neck, last good frame, per unit scale
for k, j in enumerate(J):
    s, i = S[k], F[k]["i"]
    root = P(j, "root")
    if root is None and "leftHip" in j and "rightHip" in j:
        a, b = P(j, "leftHip"), P(j, "rightHip"); root = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    if root is None and k > 0 and "root" in J[k - 1]:          # one hip left: keep last frame's hip-to-root offset
        for h in ("leftHip", "rightHip"):
            if h in j and h in J[k - 1]:
                pr, ph, hh = P(J[k - 1], "root"), P(J[k - 1], h), P(j, h)
                root = (hh[0] + pr[0] - ph[0], hh[1] + pr[1] - ph[1]); break
    if root is not None and "root" not in j:
        j["root"] = [root[0], root[1] / AS, 0.3]; F[k].setdefault("estimated", []).append("root")
    if root is None:                                   # no hips: keep only what we can't check
        for n in list(j):
            if n not in ("leftKnee", "rightKnee", "leftAnkle", "rightAnkle"): del j[n]
        log[i].append("no hips found: upper body hidden")
    else:
        for sh in ("leftShoulder", "rightShoulder"):
            if sh in j and dist(P(j, sh), root) > 1.45 * TORSO * s:
                del j[sh]; log[i].append(f"dropped {sh}: too far from the hips")
        ok = "neck" in j and 0.45 * TORSO * s <= dist(P(j, "neck"), root) <= 1.3 * TORSO * s
        if not ok:
            if "leftShoulder" in j and "rightShoulder" in j:
                a, b = P(j, "leftShoulder"), P(j, "rightShoulder"); n = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            elif last_neck_off and k - last_neck_off[2] <= 4:
                n = (root[0] + last_neck_off[0] * s, root[1] + last_neck_off[1] * s)
            else:
                n = None
            hijack = P(j, "neck") if "neck" in j else None
            if n: j["neck"] = [n[0], n[1] / AS, 0.3]; F[k].setdefault("estimated", []).append("neck")
            elif "neck" in j: del j["neck"]
            log[i].append("neck rebuilt: arm in front of the head" if n else "neck hidden")
            # The point the detector called "neck" sat on the raised hand. That arm is on top, so show it:
            # the tossing (left) arm up to tossUntil, the racket (right) arm after it (Sinner is right-handed).
            up = "left" if TOSS_UNTIL < 0 or F[k]["i"] <= TOSS_UNTIL else "right"
            arm = (REF[up + "Elbow"] or 0) + (REF[up + "Wrist"] or 0)
            if n and hijack and hijack[1] < n[1] and dist(hijack, n) <= 1.8 * arm * s:
                for side in ("leftShoulder", "rightShoulder"):     # shoulders follow the neck from the last good frame
                    if side not in j and side in last_sh:
                        j[side] = [n[0] + last_sh[side][0] * s, (n[1] + last_sh[side][1] * s) / AS, 0.3]
                        F[k].setdefault("estimated", []).append(side)
                if up + "Shoulder" in j:
                    j.pop(up + "Wrist", None); j.pop(up + "Elbow", None)   # those were placed on the face
                    sh = P(j, up + "Shoulder")
                    j[up + "Wrist"] = [hijack[0], hijack[1] / AS, 0.3]
                    j[up + "Elbow"] = [(sh[0] + hijack[0]) / 2, (sh[1] + hijack[1]) / 2 / AS, 0.3]
                    F[k].setdefault("estimated", []).extend([up + "Elbow", up + "Wrist"])
                    log[i].append(("toss" if up == "left" else "racket") + " arm on top: raised hand taken from the misplaced neck point")
        if "neck" in j:
            nk = P(j, "neck"); last_neck_off = ((nk[0] - root[0]) / s, (nk[1] - root[1]) / s, k)
            if ok:
                for side in ("leftShoulder", "rightShoulder"):
                    if side in j: last_sh[side] = ((P(j, side)[0] - nk[0]) / s, (P(j, side)[1] - nk[1]) / s)
            for h in HEAD:
                if h in j and dist(P(j, h), nk) > 2.2 * HEADL * s:
                    del j[h]; log[i].append(f"hid {h}: covered by the arm")
        else:
            for h in HEAD: j.pop(h, None)
    for c, p in PARENT.items():                       # parents first, so orphans cascade
        if c in j and (p not in j):
            del j[c]
        elif c in j and c in LIMB and REF[c] and c not in F[k].get("estimated", []) and dist(P(j, c), P(j, p)) > 1.35 * REF[c] * s:
            del j[c]; log[i].append(f"dropped {c}: bone too long")
    for part in PAIRS:
        L, R = "left" + part, "right" + part
        if L in j and R in j and dist(P(j, L), P(j, R)) < 0.12 * SHW * s:
            lose = L if j[L][2] < j[R][2] else R
            del j[lose]; log[i].append(f"{part.lower()}s overlap: kept the one on top ({'right' if lose == L else 'left'})")
    F[k]["clean"] = {n: [round(v[0], 4), round(v[1], 4), round(v[2], 2)] for n, v in j.items()}
    F[k]["estimated"] = sorted(set(e for e in F[k].get("estimated", []) if e in j))
    F[k]["scale"] = round(s, 3)

n = len(F)
d["keyframes"] = [round(k * (n - 1) / (NKEY - 1)) for k in range(NKEY)]
d["cleaning"] = {"script": "datasets/serves/tools/clean_keypoints.py", "minConfidence": MINC, "referenceFrames": NREF,
                 "tossUntil": TOSS_UNTIL,
                 "fixes": [{"i": f["i"], "t": f["t"], "fixes": log[f["i"]]} for f in F if log[f["i"]]]}
d["notes"] = ("'joints' = raw detections. 'clean' = after clean_keypoints.py (swaps, arm in front of the head, "
              "merges with the crowd, bone lengths, overlaps); joints in 'estimated' were rebuilt or interpolated. "
              "'scale' = body size relative to the first frames. 'keyframes' = evenly spaced frames.")
json.dump(d, open(path, "w"), separators=(",", ":"))
print(f"{n} frames, keyframes {d['keyframes']}, frames with fixes: {len(d['cleaning']['fixes'])}")
print("scale:", " ".join(f"{F[k]['scale']:.2f}" for k in d["keyframes"]))
