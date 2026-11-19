#!/usr/bin/env python3
"""Alcaraz's first and second serve follow Ryan's leg-tracked clip (legs and arms).

Source: datasets/video/alcaraz/serve/alcaraz_serve01_legs_0.25x.mp4 (local, git-ignored). It is the
poetry-in-motion serve at 0.25x with Ryan's leg overlay: cyan = left (front) leg, orange = right (back) leg,
and a label on every frame: "frame N  t=S.SSSs  L knee A°  R knee B°" (S = the source clip's clock, the same
clock alcaraz-poetry.js was captured on). After landing the overlay also prints "R 3D flex F° EST" for the
kicked-back right leg, where the 2D angle collapses (the shin points at the camera).

Step 1 (extract, needs macOS):
  swift datasets/serves/tools/track_labels.swift <clip> /tmp/track.json
  swift datasets/serves/tools/track_labels.swift <clip> /tmp/ocr3d.json full
  python3 -I datasets/serves/tools/alcaraz_legs_arms.py extract /tmp/track.json /tmp/ocr3d.json
  → datasets/serves/alcaraz/legs-clip.tracks.json (numbers only: knee angles, 2D arm points; no pictures)
Step 2 (build):
  python3 -I datasets/serves/tools/alcaraz_legs_arms.py build
  → src/serve/motion/alcaraz-tracked.js (loaded after alcaraz-poetry.js; writes SERVE_MOTIONS.alcaraz.first
    and .second). Input: alcaraz-poetry.js, which this never changes.

What it does to the poetry motion:
  LEGS  each knee's inside angle follows the clip's label (3D estimate where the overlay gives one).
        A planted foot stays put and the hips rise or sink to fit (the upper body moves with them).
        A foot in the air keeps its thigh; the shin (and the foot with it) turns about the knee.
  ARMS  one fixed camera (scaled orthographic) is fitted between the 3D body and the tracked 2D body.
        Each arm bone keeps its length; its direction across the picture comes from the clip, and how far it
        points toward or away from the camera (the folding the picture hides) comes from that length and the
        3D capture's side. Which hand is which is decided against where the 3D capture puts each hand, so the
        arms never swap when they cross in the picture, and two hands or two knees never sit inside each other.
  SECOND SERVE  the clip has one serve, so the second serve uses the same body motion. The game still
        flies the ball as a second serve (kick); nothing here changes the ball.
"""
import json, math, os, re, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
TRACKS = os.path.join(ROOT, "datasets/serves/alcaraz/legs-clip.tracks.json")
POETRY = os.path.join(ROOT, "src/serve/motion/alcaraz-poetry.js")
OUT_JS = os.path.join(ROOT, "src/serve/motion/alcaraz-tracked.js")
CLIP = "datasets/video/alcaraz/serve/alcaraz_serve01_legs_0.25x.mp4"

# alcaraz-poetry.js clock: game t = (source t - T0) * K. From its events: trophy src 4.30 → 1.3476,
# contact src 5.08 → 1.5921 (capture_alcaraz_poetry.py TROPHY_SRC / CONTACT_SRC).
K = (1.5921 - 1.3476) / (5.08 - 4.30)
T0 = 5.08 - 1.5921 / K
CONTACT_SRC_CLIP = 5.42

ARM = {"left": ("leftShoulder", "leftElbow", "leftWrist", "leftIndex"),
       "right": ("rightShoulder", "rightElbow", "rightWrist", "rightIndex")}
LEG = {"left": ("leftHip", "leftKnee", "leftAnkle", "leftHeel", "leftToe"),
       "right": ("rightHip", "rightKnee", "rightAnkle", "rightHeel", "rightToe")}
LEG_JOINTS = set(LEG["left"][1:] + LEG["right"][1:])


# ---------------------------------------------------------------- extract
def extract(track_path, ocr_path):
    T = json.load(open(track_path)); O = json.load(open(ocr_path))["frames"]
    rows = []
    for i, f in enumerate(T["frames"]):
        s = " ".join(f["text"])
        m = re.search(r"frame\s*(\d+).*?t\s*=\s*([\d.]+)", s)
        k = re.search(r"L\s*knee\s*(\d+).*?R\s*knee\s*(\d+)", s)
        r = {"file_t": round(f["t"], 4)}
        if m: r["src_frame"], r["src_t"] = int(m.group(1)), float(m.group(2))
        if k: r["L"], r["R"] = int(k.group(1)), int(k.group(2))
        e = re.search(r"3D\s*flex\s*(\d+)", " ".join(O[i]["text"])) if i < len(O) else None
        if e: r["R3Dflex"] = int(e.group(1))
        if f["people"]:
            j = max(f["people"], key=len)
            r["pose"] = {n: [round(v[0], 1), round(v[1], 1), round(v[2], 2)] for n, v in j.items()}
        rows.append(r)
    good = [r for r in rows if "src_t" in r]
    a, b = np.polyfit([r["file_t"] for r in good], [r["src_t"] for r in good], 1)
    for r in rows:   # labels that did not read get their time from the straight-line fit (0.25x file)
        if "src_t" not in r: r["src_t"] = round(a * r["file_t"] + b, 4); r["src_t_fitted"] = True
    out = {"clip": CLIP, "note": "Numbers read from Ryan's leg-overlay clip with Apple Vision (text + 2D body pose). "
           "L/R = inside knee angle in degrees from the overlay label (2D). R3Dflex = the overlay's estimated 3D "
           "right-knee flexion, printed after landing. pose = Vision 2D points [x px, y px, confidence], image "
           "906x1596, y down. No pictures are stored.", "w": T["w"], "h": T["h"], "frames": rows}
    json.dump(out, open(TRACKS, "w"), separators=(",", ":"))
    print(f"wrote {TRACKS}: {len(rows)} frames, labels read on {len(good)}")


# ---------------------------------------------------------------- helpers
def V(p): return np.array([p["x"], p["y"], p["z"]], float)
def P(v): return {"x": round(float(v[0]), 4), "y": round(float(v[1]), 4), "z": round(float(v[2]), 4)}
def cross2(a, b): return float(a[0] * b[1] - a[1] * b[0])
def unit(v):
    n = np.linalg.norm(v); return v / n if n > 1e-9 else v
def inside_angle(a, b, c):
    u, w = unit(a - b), unit(c - b); return math.degrees(math.acos(max(-1, min(1, float(u @ w)))))
def rot_between(a, b):
    """Rotation matrix turning unit a onto unit b."""
    a, b = unit(a), unit(b); v = np.cross(a, b); c = float(a @ b)
    if np.linalg.norm(v) < 1e-9:
        if c > 0: return np.eye(3)
        p = unit(np.cross(a, [1, 0, 0] if abs(a[0]) < 0.9 else [0, 1, 0])); return 2 * np.outer(p, p) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))
def gauss(xs, ys, sigma, at):
    w = np.exp(-0.5 * ((np.asarray(xs) - at) / sigma) ** 2); s = w.sum()
    return None if s < 1e-6 else (w[:, None] * np.asarray(ys)).sum(0) / s if np.ndim(ys) > 1 else float((w * ys).sum() / s)
def ik(hip, ankle, pole, a, b):
    """Knee for thigh a, shank b between hip and ankle, bending toward pole."""
    d = ankle - hip; L = np.linalg.norm(d); L = min(max(L, abs(a - b) + 1e-4), a + b - 1e-4)
    u = unit(d); x = (a * a - b * b + L * L) / (2 * L); h = math.sqrt(max(a * a - x * x, 0))
    side = pole - hip; side = unit(side - u * (side @ u))
    return hip + u * x + side * h


def load_poetry():
    s = open(POETRY).read(); i = s.index("const m = ") + len("const m = ")
    m, _ = json.JSONDecoder().raw_decode(s[i:]); return m


# ---------------------------------------------------------------- legs
def knee_targets(D):
    pts = []
    for r in D["frames"]:
        if "L" not in r or r.get("src_t_fitted"): continue
        L, R = r["L"], r["R"]
        if "R3Dflex" in r and R < 150: R = 180 - r["R3Dflex"]   # shin toward the camera: use the 3D estimate
        pts.append((r["src_t"], L, R))
    pts.sort(); return np.array(pts, float)


def fix_legs(frames, kt, D=None, cam=None):
    src = np.array([f["t"] / K + T0 for f in frames])
    lo, hi = kt[0, 0], kt[-1, 0]
    floor = min(min(V(f["joints"]["leftHeel"])[1], V(f["joints"]["rightHeel"])[1]) for f in frames)
    # bone lengths: the capture's own medians (they hold within a few mm)
    bone = {s: (np.median([np.linalg.norm(V(f["joints"][LEG[s][0]]) - V(f["joints"][LEG[s][1]])) for f in frames]),
                np.median([np.linalg.norm(V(f["joints"][LEG[s][1]]) - V(f["joints"][LEG[s][2]])) for f in frames]))
            for s in ("left", "right")}
    report = []; last_dir = {}
    for f, st in zip(frames, src):
        if st < lo - 0.15 or st > hi + 0.15: continue
        w = min(1.0, max(0.0, min(st - (lo - 0.15), (hi + 0.15) - st) / 0.15))     # ease in and out at the ends
        tL = gauss(kt[:, 0], kt[:, 1], 0.035, st); tR = gauss(kt[:, 0], kt[:, 2], 0.035, st)
        J = {k: V(v) for k, v in f["joints"].items()}
        want = {}
        for s, tgt in (("left", tL), ("right", tR)):
            hip, kn, an = J[LEG[s][0]], J[LEG[s][1]], J[LEG[s][2]]
            cur = inside_angle(hip, kn, an)
            want[s] = cur + (tgt - cur) * w
        planted = {s: min(J[LEG[s][3]][1], J[LEG[s][4]][1]) < floor + 0.04 for s in ("left", "right")}
        # 1. hips rise or sink so the planted legs reach their angle with the feet kept where they are
        dist = {s: math.sqrt(max(bone[s][0] ** 2 + bone[s][1] ** 2 - 2 * bone[s][0] * bone[s][1] * math.cos(math.radians(want[s])), 1e-6))
                for s in ("left", "right")}
        legs = [s for s in ("left", "right") if planted[s]]
        shift = np.zeros(3)
        for _ in range(12):
            g = np.zeros(3); H = np.eye(3) * 0.02
            for s in legs:
                d = J[LEG[s][0]] + shift - J[LEG[s][2]]; n = np.linalg.norm(d); e = n - dist[s]; u = d / n
                g += e * u; H += np.outer(u, u)
            g += 0.02 * shift
            shift -= np.linalg.solve(H, g)
        if legs:
            for k in J:
                if k not in LEG_JOINTS: J[k] = J[k] + shift
        # 2. each knee. Where the clip shows the knee (the camera fit), it turns about the hip–ankle line to the
        #    side the picture shows; otherwise it keeps the 3D capture's side.
        p2 = pose_at(D, st) if D is not None else None
        for s in ("left", "right"):
            hip, kn, an, he, to = (J[n] for n in LEG[s])
            a, b = bone[s]
            if planted[s]:
                knee0 = ik(hip, an, kn, a, b)
                if p2 and cam and all(n in p2 for n in LEG[s][:3]) and min(p2[n][2] for n in LEG[s][:3]) > 0.22:
                    ax = unit(an - hip); c0 = hip + ax * ((knee0 - hip) @ ax); r = knee0 - c0
                    e1 = unit(r); e2 = np.cross(ax, e1); rad = np.linalg.norm(r)
                    hip2, kn2, an2 = (np.array(p2[n][:2]) for n in LEG[s][:3])
                    # the picture's knee, placed relative to the picture's hip and ankle, in body heights
                    want_rel = (kn2 - hip2) / cam["s"]           # the picture's knee, from the picture's hip, in body heights
                    best = None
                    for k in range(72):
                        ph = 2 * math.pi * k / 72; cand = c0 + rad * (math.cos(ph) * e1 + math.sin(ph) * e2)
                        rel = cam["R2"] @ (cand - hip)
                        cost = np.linalg.norm(rel - want_rel) + 0.02 * (1 - math.cos(ph))   # small pull to the capture's side
                        if s in last_dir: cost += 0.06 * (1 - float(unit(cand - c0) @ last_dir[s]))   # no jumps frame to frame
                        if best is None or cost < best[0]: best = (cost, cand)
                    J[LEG[s][1]] = best[1]; last_dir[s] = unit(best[1] - c0)
                else:
                    J[LEG[s][1]] = knee0
            else:   # foot in the air: thigh kept, shin and foot turn about the knee
                kn = hip + unit(kn - hip) * a
                wv = unit(hip - kn)                                    # knee → hip
                sh = an - kn
                perp = sh - wv * (sh @ wv)
                if np.linalg.norm(perp) < 1e-3 * b or inside_angle(hip, kn, an) > 172:
                    perp = np.array([0.0, 0.0, -1.0]); perp = perp - wv * (perp @ wv)   # a straight leg folds backward
                perp = unit(perp); th = math.radians(want[s])
                new = kn + (wv * math.cos(th) + perp * math.sin(th)) * b
                R = rot_between(an - kn, new - kn)
                J[LEG[s][1]] = kn; J[LEG[s][2]] = new
                J[LEG[s][3]] = kn + R @ (he - kn); J[LEG[s][4]] = kn + R @ (to - kn)
        # 3. knees never inside each other
        dk = J["rightKnee"] - J["leftKnee"]; dk[1] = 0
        if np.linalg.norm(dk) < 0.07:
            push = unit(dk if np.linalg.norm(dk) > 1e-4 else np.array([1.0, 0, 0])) * (0.07 - np.linalg.norm(dk)) / 2
            J["rightKnee"] += push; J["leftKnee"] -= push
        for k in J: f["joints"][k] = P(J[k])
        report.append((st, tL, inside_angle(J["leftHip"], J["leftKnee"], J["leftAnkle"]),
                       tR, inside_angle(J["rightHip"], J["rightKnee"], J["rightAnkle"])))
    return report


# ---------------------------------------------------------------- camera + arms
FIT = ("leftShoulder", "rightShoulder", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle")

def pose_at(D, st):
    """Vision 2D pose interpolated at a source time (nearest two frames)."""
    fr = D["frames"]; ts = np.array([r["src_t"] for r in fr])
    i = int(np.searchsorted(ts, st))
    if i <= 0 or i >= len(fr): return None
    lo, hi = i - 1, i                       # the tracker lost the body on two frames at contact: use the nearest seen
    while lo > 0 and "pose" not in fr[lo]: lo -= 1
    while hi < len(fr) - 1 and "pose" not in fr[hi]: hi += 1
    a, b = fr[lo], fr[hi]
    if "pose" not in a or "pose" not in b or ts[hi] - ts[lo] > 0.2: return None
    u = min(1.0, max(0.0, (st - ts[lo]) / max(ts[hi] - ts[lo], 1e-6))); out = {}
    for n in a["pose"]:
        if n in b["pose"]:
            pa, pb = np.array(a["pose"][n]), np.array(b["pose"][n]); out[n] = pa + (pb - pa) * u
    return out


def fit_camera(frames, D):
    """One camera for the whole clip; the player's place in the picture is matched frame by frame
    (the 3D capture's hip travel is partly estimated), so only directions and sizes are fitted."""
    Xs, Ys, per = [], [], []
    for f in frames:
        st = f["t"] / K + T0
        if not (1.6 <= st <= 4.9): continue
        p = pose_at(D, st)
        if not p: continue
        X = [V(f["joints"][n]) for n in FIT if n in p and p[n][2] > 0.5]
        Y = [p[n][:2] for n in FIT if n in p and p[n][2] > 0.5]
        if len(X) < 6: continue
        X, Y = np.array(X), np.array(Y)
        Xs.append(X - X.mean(0)); Ys.append(Y - Y.mean(0)); per.append((f["t"], X.mean(0), Y.mean(0)))
    X, Y = np.vstack(Xs), np.vstack(Ys)
    M, *_ = np.linalg.lstsq(X, Y, rcond=None)                 # Y ≈ X @ M
    U, S, Vt = np.linalg.svd(M.T, full_matrices=False)        # nearest scaled rotation
    s = S.mean(); R2 = U @ Vt                                  # rows: picture x, picture y (down), in court axes
    r3 = np.cross(R2[0], R2[1])
    res = np.linalg.norm(Y - X @ (s * R2.T), axis=1)
    cams = {round(t, 4): my - s * (R2 @ mx) for t, mx, my in per}
    return {"s": s, "R2": R2, "r3": r3, "c": np.mean(list(cams.values()), 0), "cs": cams,
            "rms_px": float(np.sqrt((res ** 2).mean())), "n": len(X)}


def proj(cam, x, t=None):
    c = cam["c"]
    if t is not None and cam["cs"]:
        k = min(cam["cs"], key=lambda u: abs(u - t)); c = cam["cs"][k] if abs(k - t) < 0.02 else c
    return cam["s"] * (cam["R2"] @ x) + c


def fix_arms(frames, D, cam):
    # 2D targets per motion frame: shoulder→elbow and elbow→wrist. The tracker's own left/right labels are right
    # through this clip (checked frame by frame, including the follow-through with his back to the camera, where the
    # arm flung out to the left of the picture is his left arm). A point that jumps far from its neighbours (the racket
    # hand's label landing on the tossing hand at the trophy) is dropped, so the arms never swap where they cross.
    raw = []
    for f in frames:
        st = f["t"] / K + T0; p = pose_at(D, st) if 1.5 <= st <= 6.05 else None
        if not p: raw.append(None); continue
        cur = {}
        for side in ("left", "right"):
            cur[side] = [np.array(p[n], float) if n in p else np.array([0.0, 0.0, 0.0]) for n in ARM[side][:3]]
        if "leftHip" in p and "rightHip" in p:
            cur["hips"] = ((np.array(p["leftHip"][:2]) + np.array(p["rightHip"][:2])) / 2, min(p["leftHip"][2], p["rightHip"][2]))
        raw.append(cur)
    for i in range(len(raw)):
        if raw[i] is None: continue
        for side in ("left", "right"):
            for k in range(3):
                nb = [raw[j][side][k][:2] for j in range(max(0, i - 3), min(len(raw), i + 4))
                      if j != i and raw[j] is not None and raw[j][side][k][2] > 0.3]
                if len(nb) >= 3 and np.linalg.norm(raw[i][side][k][:2] - np.median(nb, 0)) > 220:
                    raw[i][side][k] = raw[i][side][k].copy(); raw[i][side][k][2] = 0.0
    # blur round contact: an arm point the tracker is unsure of is filled from the frames on either side where it
    # sees it clearly (its place relative to the hips, joined smoothly), if that gap is short
    st_of = [f["t"] / K + T0 for f in frames]
    for side in ("left", "right"):
        for k in (1, 2):
            good = [i for i in range(len(raw)) if raw[i] is not None and "hips" in raw[i] and raw[i][side][k][2] >= 0.5]
            for i in range(len(raw)):
                if raw[i] is None or "hips" not in raw[i] or raw[i][side][k][2] >= 0.5 or st_of[i] > 5.5: continue
                lo = max([g for g in good if g < i], default=None); hi = min([g for g in good if g > i], default=None)
                if lo is None or hi is None or st_of[hi] - st_of[lo] > 0.6: continue
                u = (st_of[i] - st_of[lo]) / (st_of[hi] - st_of[lo]); u = u * u * (3 - 2 * u)
                rel = (1 - u) * (raw[lo][side][k][:2] - raw[lo]["hips"][0]) + u * (raw[hi][side][k][:2] - raw[hi]["hips"][0])
                raw[i][side][k] = np.array([*(raw[i]["hips"][0] + rel), 0.55])
    # smooth each tracked point over time (skip gaps), confidence-weighted
    ts = np.array([f["t"] for f in frames]); sm = [None] * len(frames)
    for i in range(len(frames)):
        if raw[i] is None: continue
        sm[i] = {}
        for s in ("left", "right"):
            pts = []
            for k in range(3):
                num = np.zeros(2); den = 0.0; cs = []
                for j in range(max(0, i - 6), min(len(frames), i + 7)):
                    if raw[j] is None: continue
                    q = raw[j][s][k]; w = math.exp(-0.5 * ((ts[j] - ts[i]) / 0.012) ** 2) * q[2]
                    num += w * q[:2]; den += w; cs.append(q[2])
                pts.append((num / den if den > 0 else raw[i][s][k][:2], raw[i][s][k][2]))
            sm[i][s] = pts
        if "hips" in raw[i]:      # hip centre, smoothed the same way
            num = np.zeros(2); den = 0.0
            for j in range(max(0, i - 6), min(len(frames), i + 7)):
                if raw[j] is None or "hips" not in raw[j]: continue
                w = math.exp(-0.5 * ((ts[j] - ts[i]) / 0.012) ** 2) * raw[j]["hips"][1]; num += w * raw[j]["hips"][0]; den += w
            if den > 0: sm[i]["hips"] = num / den
    for i, f in enumerate(frames):        # finish frames the tracker lost: no arm target, finish rule only
        if sm[i] is None and 5.45 <= f["t"] / K + T0 <= 6.3:
            z = (np.zeros(2), 0.0); sm[i] = {"left": [z, z, z], "right": [z, z, z]}
    changed = 0
    for i, f in enumerate(frames):
        if sm[i] is None: continue
        J = {k: V(v) for k, v in f["joints"].items()}
        st = f["t"] / K + T0
        edge = min(1.0, max(0.0, min(st - 1.5, 6.05 - st) / 0.12))
        st_fin = (st - 5.45) / 0.25
        for s in ("left", "right"):
            sh, el, wr, ix = (J[n] for n in ARM[s])
            (p_sh, c0), (p_el, c1), (p_wr, c2) = sm[i][s]
            # in the blur round contact the tracker's shoulder jumps: measure from the 3D shoulder, placed in the
            # picture from the hips (steady there) instead
            if "hips" in sm[i]:
                hm3 = (J["leftHip"] + J["rightHip"]) / 2
                p_sh_v = sm[i]["hips"] + cam["s"] * (cam["R2"] @ (sh - hm3))
                if c0 < 0.4 or np.linalg.norm(p_sh - p_sh_v) > 130: p_sh = p_sh_v
            # the blur at the strike hides the elbow while the hand is still seen: the arm is straight there in the
            # clip (frames 214-222), so the elbow goes on the shoulder–hand line
            if c1 < 0.4 and c2 >= 0.4:
                Lu_, Lf_ = np.linalg.norm(el - sh), np.linalg.norm(wr - el)
                p_el = p_sh + (p_wr - p_sh) * (Lu_ / (Lu_ + Lf_)); c1 = c2
            conf = min(c1, c2)
            w = edge * min(1.0, max(0.0, (conf - 0.15) / 0.3))
            if w <= 0: continue
            def bone(p0, p1, o0, o1):
                L = np.linalg.norm(o1 - o0)
                d2 = (p1 - p0) / cam["s"]                          # picture vector in body heights
                q = cam["R2"][0] * d2[0] + cam["R2"][1] * d2[1]    # same vector in court axes, no depth
                l = np.linalg.norm(q)
                if l >= L: return unit(q) * L
                depth = math.sqrt(L * L - l * l)
                sgn = 1.0 if (o1 - o0) @ cam["r3"] >= 0 else -1.0  # toward or away from the camera: the 3D capture's side
                return q + cam["r3"] * depth * sgn
            up = bone(p_sh, p_el, sh, el); fo = bone(p_el, p_wr, el, wr)
            up = unit((1 - w) * (el - sh) + w * up) * np.linalg.norm(el - sh)
            fo = unit((1 - w) * (wr - el) + w * fo) * np.linalg.norm(wr - el)
            nel = sh + up; nwr = nel + fo
            R = rot_between(wr - el, fo)
            J[ARM[s][1]] = nel; J[ARM[s][2]] = nwr; J[ARM[s][3]] = nwr + R @ (ix - wr)
        # follow-through: the clip hides the racket hand in front of his body and shows the racket head at his left
        # hip (the arm flung out to the left of the picture is the left arm). Where the tracker cannot see the racket
        # hand, it is brought across the front of the body to the left hip.
        if st_fin > 0 and sm[i]["right"][2][1] < 0.45:
            g = min(1.0, st_fin) * (1 - max(0.0, (sm[i]["right"][2][1] - 0.15) / 0.3))
            hipL, hipR, shR = J["leftHip"], J["rightHip"], J["rightShoulder"]
            fwd = unit(np.cross(hipR - hipL, np.array([0.0, 1.0, 0.0])))       # the way the hips face
            if fwd[2] < 0: fwd = -fwd                                            # into the court at the finish
            target = hipL + (hipL - hipR) * 0.3 + fwd * 0.10 + np.array([0, 0.04, 0])
            el, wr = J["rightElbow"], J["rightWrist"]
            Lu, Lf = np.linalg.norm(el - shR), np.linalg.norm(wr - el)
            goal = wr + (target - wr) * g
            nel = ik(shR, goal, shR + (hipR - hipL) * 0.5 + np.array([0, -0.1, 0]) + fwd * 0.05, Lu, Lf)
            nwr = nel + unit(goal - nel) * Lf
            R = rot_between(wr - el, nwr - nel)
            J["rightIndex"] = nwr + R @ (J["rightIndex"] - wr); J["rightElbow"] = nel; J["rightWrist"] = nwr
        # two hands never inside each other: push apart along the line between them
        dv = J["rightWrist"] - J["leftWrist"]; dn = np.linalg.norm(dv)
        if dn < 0.06:
            push = unit(dv if dn > 1e-4 else np.array([1.0, 0, 0])) * (0.06 - dn) / 2
            for n, sg in (("rightWrist", 1), ("rightIndex", 1), ("leftWrist", -1), ("leftIndex", -1)): J[n] = J[n] + sg * push
        for k in J: f["joints"][k] = P(J[k])
        changed += 1
    # temporal smoothing of the rebuilt arms (keeps bone lengths: smooth directions, rebuild)
    for s in ("left", "right"):
        sh_, el_, wr_, ix_ = ARM[s]
        U = np.array([unit(V(f["joints"][el_]) - V(f["joints"][sh_])) for f in frames])
        F = np.array([unit(V(f["joints"][wr_]) - V(f["joints"][el_])) for f in frames])
        Lu = [np.linalg.norm(V(f["joints"][el_]) - V(f["joints"][sh_])) for f in frames]
        Lf = [np.linalg.norm(V(f["joints"][wr_]) - V(f["joints"][el_])) for f in frames]
        for i, f in enumerate(frames):
            lo, hi = max(0, i - 3), min(len(frames), i + 4)
            w = np.exp(-0.5 * ((ts[lo:hi] - ts[i]) / 0.008) ** 2)
            u = unit((w[:, None] * U[lo:hi]).sum(0)); v = unit((w[:, None] * F[lo:hi]).sum(0))
            J = {k: V(x) for k, x in f["joints"].items()}
            R = rot_between(J[wr_] - J[el_], v)
            J[el_] = J[sh_] + u * Lu[i]; nw = J[el_] + v * Lf[i]
            J[ix_] = nw + R @ (J[ix_] - J[wr_]); J[wr_] = nw
            for k in (el_, wr_, ix_): f["joints"][k] = P(J[k])
    return changed


# ---------------------------------------------------------------- torso (hips, shoulders, spine)
UPPER = ("leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist", "leftIndex",
         "rightIndex", "nose", "leftEar", "rightEar", "neck", "chest", "head")


def seg_from_picture(v2, L, cur, cam, calib=1.0):
    """3D vector of length L whose picture is v2 (px); the part the picture hides (toward / away from the lens) comes
    from the length, on the side the current 3D has it."""
    q = (cam["R2"][0] * v2[0] + cam["R2"][1] * v2[1]) / (cam["s"] * calib)
    l = np.linalg.norm(q)
    if l >= L: return unit(q) * L
    sgn = 1.0 if cur @ cam["r3"] >= 0 else -1.0
    return q + cam["r3"] * math.sqrt(L * L - l * l) * sgn


def fix_torso(frames, D, cam):
    """Hip line, shoulder line and spine follow the clip (rotation of the pelvis, of the chest against it, and the
    trunk's lean and arch). Each keeps its 3D length. The upper body turns with the chest; the legs are re-solved
    afterwards by fix_legs (feet stay planted)."""
    names = {"hip": ("leftHip", "rightHip"), "sh": ("leftShoulder", "rightShoulder")}
    G = lambda v: cam["s"] * (cam["R2"] @ v)
    # calibration: the tracker's hip and shoulder points are not the capture's joint centres. A segment's picture can
    # be no longer than its true length; the spine is matched on the walk-up, where the capture stands as the clip does.
    samples = {"hip": [], "sh": [], "sp_c": [], "sp_g": []}
    rows = []
    for f in frames:
        st = f["t"] / K + T0; p = pose_at(D, st) if 1.55 <= st <= 6.0 else None
        rows.append(p)
        if not p or any(n not in p for n in ("leftHip", "rightHip", "leftShoulder", "rightShoulder")): continue
        J = {k: V(v) for k, v in f["joints"].items()}
        for key, (a, b) in names.items():
            if min(p[a][2], p[b][2]) > 0.55:
                samples[key].append((np.linalg.norm(np.array(p[b][:2]) - np.array(p[a][:2])), np.linalg.norm(J[b] - J[a]) * cam["s"]))
        if 1.6 <= st <= 3.1 and min(p[n][2] for n in ("leftHip", "rightHip", "leftShoulder", "rightShoulder")) > 0.55:
            c = (np.array(p["leftShoulder"][:2]) + np.array(p["rightShoulder"][:2]) - np.array(p["leftHip"][:2]) - np.array(p["rightHip"][:2])) / 2
            samples["sp_c"].append(np.linalg.norm(c))
            samples["sp_g"].append(np.linalg.norm(G((J["leftShoulder"] + J["rightShoulder"] - J["leftHip"] - J["rightHip"]) / 2)))
    calib = {}
    for key in ("hip", "sh"):
        pic = np.percentile([a for a, _ in samples[key]], 95); true = np.median([b for _, b in samples[key]])
        calib[key] = max(1.0, pic / true)
    calib["sp"] = float(np.median(samples["sp_c"]) / np.median(samples["sp_g"]))
    # per-frame targets with confidence, then smoothed over time
    ts = np.array([f["t"] for f in frames]); tgt = {k: [None] * len(frames) for k in ("hip", "sh", "sp")}
    for i, (f, p) in enumerate(zip(frames, rows)):
        if not p or any(n not in p for n in ("leftHip", "rightHip", "leftShoulder", "rightShoulder")): continue
        P2 = lambda n: np.array(p[n][:2])
        ch = min(p["leftHip"][2], p["rightHip"][2]); cs = min(p["leftShoulder"][2], p["rightShoulder"][2])
        tgt["hip"][i] = (P2("rightHip") - P2("leftHip"), ch)
        tgt["sh"][i] = (P2("rightShoulder") - P2("leftShoulder"), cs)
        tgt["sp"][i] = ((P2("leftShoulder") + P2("rightShoulder") - P2("leftHip") - P2("rightHip")) / 2, min(ch, cs))
    def smoothed(key, i):
        num = np.zeros(2); den = 0.0
        for j in range(max(0, i - 8), min(len(frames), i + 9)):
            if tgt[key][j] is None: continue
            v, c = tgt[key][j]; w = math.exp(-0.5 * ((ts[j] - ts[i]) / 0.015) ** 2) * max(0.0, c - 0.4)
            num += w * v; den += w
        return (num / den, den) if den > 1e-6 else (None, 0.0)
    changed = 0; report = []
    for i, f in enumerate(frames):
        st = f["t"] / K + T0
        edge = min(1.0, max(0.0, min(st - 1.55, 6.0 - st) / 0.12))
        if edge <= 0: continue
        J = {k: V(v) for k, v in f["joints"].items()}
        hm = (J["leftHip"] + J["rightHip"]) / 2; sm = (J["leftShoulder"] + J["rightShoulder"]) / 2
        Hv, Sv, Sp = J["rightHip"] - J["leftHip"], J["rightShoulder"] - J["leftShoulder"], sm - hm
        new = {}
        for key, cur, L, cal in (("hip", Hv, np.linalg.norm(Hv), calib["hip"]), ("sh", Sv, np.linalg.norm(Sv), calib["sh"]),
                                 ("sp", Sp, np.linalg.norm(Sp), calib["sp"])):
            v, den = smoothed(key, i)
            if v is None: new[key] = cur; continue
            w = edge * min(1.0, den / 0.6)
            n = seg_from_picture(v, L, cur, cam, cal)
            new[key] = unit((1 - w) * cur + w * n) * L
        # pelvis: hip joints about the hip centre
        J["leftHip"], J["rightHip"] = hm - new["hip"] / 2, hm + new["hip"] / 2
        # chest: the whole upper body turns rigidly from (spine, shoulder line) to the new pair, about the hip centre
        def basis(u, s):
            u = unit(u); s = unit(s - u * (s @ u)); return np.column_stack([u, s, np.cross(u, s)])
        R = basis(new["sp"], new["sh"]) @ basis(Sp, Sv).T
        for n in UPPER:
            if n in J: J[n] = hm + R @ (J[n] - hm)
        # then the shoulder line itself (its cartwheel tilt too): each shoulder to its place, its arm going with it
        smid = (J["leftShoulder"] + J["rightShoulder"]) / 2
        for side, sg in (("left", -1), ("right", 1)):
            d = smid + sg * new["sh"] / 2 - J[side + "Shoulder"]
            for n in (side + "Shoulder", side + "Elbow", side + "Wrist", side + "Index"):
                if n in J: J[n] = J[n] + d
        for k in J: f["joints"][k] = P(J[k])
        changed += 1
        report.append((st, new))
    return changed, calib


# ---------------------------------------------------------------- muscles (how hard each group works)
def activations(frames, kt=None):
    """0..1 per frame, from the motion itself (ESTIMATED: kinematics, not measured muscle activity):
    quads   — knee bent under load (holding the squat) + knee straightening fast (the drive);
    glutes  — hip straightening fast (the drive up) + the load;
    calves  — up on the toes while the foot is down + ankle push-off;
    core    — trunk folding forward / uncoiling fast (contact and after);
    chest   — the arch at the trophy stretches it open, the strike pulls it in;
    arm     — the racket arm's grip and forearm as the hand speeds up."""
    n = len(frames); ts = np.array([f["t"] for f in frames]); dt = np.gradient(ts)
    J = [{k: V(v) for k, v in f["joints"].items()} for f in frames]
    floor = min(min(j["leftToe"][1], j["rightToe"][1]) for j in J)
    def ser(fn): return np.array([fn(j) for j in J])
    out = {}
    for s in ("left", "right"):
        knee = ser(lambda j: 180 - inside_angle(j[s + "Hip"], j[s + "Knee"], j[s + "Ankle"]))           # flexion
        hipf = ser(lambda j: 180 - inside_angle((j["leftShoulder"] + j["rightShoulder"]) / 2, j[s + "Hip"], j[s + "Knee"]))
        down = ser(lambda j: 1.0 if min(j[s + "Toe"][1], j[s + "Heel"][1]) < floor + 0.04 else 0.0)
        toes = ser(lambda j: np.clip((j[s + "Heel"][1] - j[s + "Toe"][1] + 0.01) / 0.05, 0, 1))
        dk = -np.gradient(knee) / dt; dh = -np.gradient(hipf) / dt                                      # + = straightening
        out["quad_" + s] = np.clip(0.15 + down * np.clip(knee / 90, 0, 1) * 0.55 + np.clip(dk / 700, 0, 1) * 0.6, 0, 1)
        out["glute_" + s] = np.clip(0.1 + down * np.clip(hipf / 80, 0, 1) * 0.35 + np.clip(dh / 600, 0, 1) * 0.7, 0, 1)
        out["calf_" + s] = np.clip(0.1 + down * toes * 0.6 + np.clip(-np.gradient(toes) / dt / 8, 0, 1) * 0.5, 0, 1)
    lean = ser(lambda j: math.degrees(math.atan2(((j["leftShoulder"] + j["rightShoulder"]) / 2 - (j["leftHip"] + j["rightHip"]) / 2)[2],
                                                 ((j["leftShoulder"] + j["rightShoulder"]) / 2 - (j["leftHip"] + j["rightHip"]) / 2)[1])))
    twist = ser(lambda j: math.degrees(math.atan2(*(lambda a, b: (a[0] * b[2] - a[2] * b[0], a[0] * b[0] + a[2] * b[2]))(
        j["rightShoulder"] - j["leftShoulder"], j["rightHip"] - j["leftHip"]))))
    out["core"] = np.clip(0.15 + np.clip(np.gradient(lean) / dt / 250, 0, 1) * 0.6 + np.clip(np.abs(np.gradient(twist) / dt) / 500, 0, 1) * 0.4, 0, 1)
    wr = ser(lambda j: j["rightWrist"]); speed = np.linalg.norm(np.gradient(wr, axis=0), axis=1) / dt
    # racket drop: the hand falls behind the back and the elbow points up, which stretches the chest open
    out["chest_open"] = ser(lambda j: float(np.clip(((j["leftShoulder"][2] + j["rightShoulder"][2]) / 2 - j["rightWrist"][2]) / 0.12, 0, 1)
                                            * np.clip((j["rightElbow"][1] - j["rightShoulder"][1] + 0.02) / 0.08, 0, 1)))
    out["chest"] = np.clip(0.1 + speed / max(speed.max(), 1e-6) * 0.9, 0, 1)
    out["arm"] = np.clip(0.2 + speed / max(speed.max(), 1e-6) * 0.8, 0, 1)
    # smooth (muscles do not switch in one frame)
    for k, v in out.items():
        sm = np.array([np.average(v[max(0, i - 4):i + 5], weights=np.exp(-0.5 * ((ts[max(0, i - 4):i + 5] - ts[i]) / 0.012) ** 2)) for i in range(n)])
        out[k] = sm
    for i, f in enumerate(frames): f["act"] = {k: round(float(v[i]), 2) for k, v in out.items()}
    return {k: (round(float(v.min()), 2), round(float(v.max()), 2)) for k, v in out.items()}


# ---------------------------------------------------------------- build
def recompute_derived(f):
    """Same derived joints as capture_alcaraz_poetry.py derive()."""
    J = f["joints"]; neck = (V(J["leftShoulder"]) + V(J["rightShoulder"])) / 2; pel = (V(J["leftHip"]) + V(J["rightHip"])) / 2
    J["neck"] = P(neck); J["pelvis"] = P(pel); J["root"] = P(pel); J["chest"] = P(0.58 * neck + 0.42 * pel); J["head"] = dict(J["nose"])


def build():
    D = json.load(open(TRACKS)); m = load_poetry(); frames = m["frames"]
    kt = knee_targets(D)
    cam0 = fit_camera(frames, D)                        # camera from the capture as it is
    nt, calib = fix_torso(frames, D, cam0)              # pelvis, chest and spine first; the legs then fit under them
    print(f"torso (hips, shoulders, spine) fitted on {nt} frames; calibration {dict((k, round(v, 2)) for k, v in calib.items())}")
    for f in frames: recompute_derived(f)
    cam0 = fit_camera(frames, D)
    rep = fix_legs(frames, kt, D, cam0)
    print("legs  src   L want/now   R want/now")
    for r in rep[::14]: print(f"  {r[0]:.2f}   {r[1]:5.0f}/{r[2]:4.0f}   {r[3]:5.0f}/{r[4]:4.0f}")
    cam = fit_camera(frames, D)
    print(f"camera: scale {cam['s']:.0f} px per body height, fit rms {cam['rms_px']:.1f} px on {cam['n']} points, "
          f"depth axis {np.round(cam['r3'], 2)}")
    print(f"arms rebuilt on {fix_arms(frames, D, cam)} frames")
    for f in frames: recompute_derived(f)
    print("muscle activation ranges", activations(frames))
    first = dict(m)
    # CONTACT read off Ryan's clip: the racket hangs behind the back until ~5.2 s (source clock), swings up, and the
    # arm is straight up with the racket over it at frames 218-220 (5.40-5.46 s). The poetry capture's 5.08 s was the
    # end of the racket drop.
    first["events"] = dict(m["events"]); first["events"]["contact"] = round((CONTACT_SRC_CLIP - T0) * K, 4)
    first["timingNote"] = (m["timingNote"] + f" Contact moved to source {CONTACT_SRC_CLIP} s (read off Ryan's leg-overlay "
                           "clip: arm straight up, racket over it), so toss release to contact is now about "
                           f"{(CONTACT_SRC_CLIP - T0) * K - m['events']['tossRelease']:.2f} s.")
    cf = min(frames, key=lambda f: abs(f["t"] - first["events"]["contact"]))
    first["hittingWristHeightM"] = round(cf["joints"]["rightWrist"]["y"] * 1.83, 3)
    first["estimatedContactHeightM"] = round(first["hittingWristHeightM"] + 0.55, 3)
    print(f"contact at game t {first['events']['contact']}: racket wrist {first['hittingWristHeightM']} m, contact ~{first['estimatedContactHeightM']} m")
    first["id"] = "alcaraz_poetry_legs_tracked_first"
    first["source"] = m["source"] + "; legs and arms re-fitted to Ryan's leg-overlay clip (" + CLIP + ")"
    first["note"] = (m["note"] + " Legs and arms re-fitted (alcaraz_legs_arms.py): each knee follows the overlay's "
        "angle frame by frame (its 3D estimate for the kicked-back right leg after landing); planted feet stay put "
        "and the hips rise or sink to fit; a foot in the air turns about its knee. Arms follow the clip's 2D track "
        f"through one fitted camera (rms {cam['rms_px']:.0f} px); each bone keeps its length and the part hidden by the "
        "camera angle (folding toward or away from the lens) comes from that length and the 3D capture's side. "
        "Hands are matched to the 3D capture so they never swap where they cross, and hands and knees never overlap.")
    second = json.loads(json.dumps(first))
    second["id"] = "alcaraz_poetry_legs_tracked_second"; second["role"] = "second"
    second["note"] = ("Same body motion as the first serve: Ryan's clip has one serve and he asked for both to follow "
                      "it. The game flies the ball as a second serve (kick). " + first["note"])
    js = ("// Generated by datasets/serves/tools/alcaraz_legs_arms.py from alcaraz-poetry.js and\n"
          "// datasets/serves/alcaraz/legs-clip.tracks.json. Do not edit by hand.\n"
          "// Carlos Alcaraz only: first and second serve follow Ryan's leg-overlay clip (legs and arms).\n"
          "(function () {\n  const first = " + json.dumps(first, separators=(",", ":")) + ";\n"
          "  const second = JSON.parse(JSON.stringify(first));\n"
          "  second.id = " + json.dumps(second["id"]) + "; second.role = \"second\"; second.note = " + json.dumps(second["note"]) + ";\n"
          "  window.SERVE_MOTIONS = window.SERVE_MOTIONS || {};\n"
          "  const cur = window.SERVE_MOTIONS.alcaraz || (window.SERVE_MOTIONS.alcaraz = {});\n"
          "  cur.first = first;\n  cur.second = second;\n})();\n")
    open(OUT_JS, "w").write(js)
    print(f"wrote {OUT_JS} ({len(js) // 1024} KB)")


if __name__ == "__main__":
    if sys.argv[1:2] == ["extract"]: extract(sys.argv[2], sys.argv[3])
    elif sys.argv[1:2] == ["build"]: build()
    else: print(__doc__)
