"""Steady serves for every roster pro (Ryan, Nov 19: "Sinner's serve is shaking"; "rebuild it for every single one").

Input:  src/serve/motion/roster-serves.js (MediaPipe world landmarks, ~20 fps, body heights) and, for Sinner,
        src/serve/motion/sinner-serve.js (his own clips: back-side slow motion = 1st, back close-up = 2nd).
Output: src/serve/motion/serves-stable.js (generated; never edit by hand). Loaded after roster-serves.js; replaces the
        frames of each player's live first and second serve. Alcaraz is skipped (alcaraz-tracked.js owns him).

What it does to each serve (all in body heights, x = player's right, y = up, z = into the court):
 1. Smooth: local-linear regression in time (Gaussian weights) resampled at 50 Hz. Torso and legs sigma 45 ms,
    arms 35 ms, the hitting arm 18 ms within 0.15 s of contact so the swing keeps its speed.
 2. Fixed bones: every bone keeps one length for the whole serve (median, left and right pooled). Each joint is
    rebuilt from the pelvis outward along the smoothed bone direction.
 3. Planted feet: where a foot is low and slow it is pinned to one spot (eased in and out over 60 ms); the knee is
    re-solved with two-bone IK in the plane the data bends it in.
 4. Sinner: x and height come from his own clip; depth (z) and the joints that clip lacks (ears, heels, toes, index)
    come from his roster serve at the same phase (events mapped piecewise: start, tossRelease, trophy, contact, finish).
Usage: python3 -I datasets/serves/tools/stabilize_serves.py
"""
import json, math, re, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
ROSTER = ROOT / "src/serve/motion/roster-serves.js"
SINNER = ROOT / "src/serve/motion/sinner-serve.js"
OUT = ROOT / "src/serve/motion/serves-stable.js"

N = ["nose", "leftEar", "rightEar", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist",
     "leftIndex", "rightIndex", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle", "leftHeel",
     "rightHeel", "leftToe", "rightToe"]
IX = {n: k for k, n in enumerate(N)}
HZ = 50.0
EV = ["start", "tossRelease", "trophy", "contact", "finish"]


# ---------------------------------------------------------------- reading the inputs
def read_roster():
    s = ROSTER.read_text()
    players = []
    starts = [m.start() for m in re.finditer(r'\n    \{\n      id: "', s)] + [len(s)]
    for a, b in zip(starts, starts[1:]):
        chunk = s[a:b]
        pm = re.match(r'\n    \{\n      id: "([a-z-]+)", name: "([^"]+)", hand: "([LR])",', chunk)
        if not pm:
            continue
        pid, name, hand = pm.groups()
        body = chunk
        if 'defaultId:' not in body:
            continue
        dm = re.search(r'defaultId: "([^"]*)"', body); default = dm.group(1) if dm else None
        serves = []
        for m in re.finditer(r'id: "([^"]+)", quality: "[^"]*", lowConfidence: (true|false),.*?events: (\{[^}]*\}),\s*rows: (\[\[.*?\]\]),', body, re.S):
            ev = json.loads(re.sub(r'(\w+):', r'"\1":', m.group(3)))
            serves.append({"id": m.group(1), "low": m.group(2) == "true", "events": ev, "rows": np.array(json.loads(m.group(4)))})
        players.append({"id": pid, "name": name, "hand": hand, "default": default, "serves": serves})
    return players


def live_pair(p):
    """Same choice as roster-serves.js expand(): first = defaultId; second = another non-low-confidence serve, else any other."""
    sv = p["serves"]
    first = next((x for x in sv if x["id"] == p["default"]), sv[0] if sv else None)
    if not first:
        return None, None
    second = next((x for x in sv if x is not first and not x["low"]), None) or next((x for x in sv if x is not first), None)
    return first, second


def rows_to_arrays(rows):
    t = rows[:, 0]
    J = rows[:, 1:1 + 3 * len(N)].reshape(len(rows), len(N), 3)
    return t, J


# Pros whose serve follows their own clip (x and height from the clip, depth from the roster serve at the same phase).
# Files are written by export_motion.py; the roster serve still supplies depth, heels, toes, ears and index fingers.
CLIP_PLAYERS = ["sinner", "zverev", "shelton", "federer", "djokovic", "tiafoe", "nadal", "cobolli", "kyrgios"]


def read_clips():
    out = {}
    for pid in CLIP_PLAYERS:
        f = ROOT / f"src/serve/motion/{pid}-serve.js"
        if not f.exists():
            continue
        s = f.read_text()
        key = f"SERVE_MOTIONS.{pid}" if f"SERVE_MOTIONS.{pid} =" in s else f'SERVE_MOTIONS["{pid}"]'
        out[pid] = json.loads(s[s.find("=", s.find(key)) + 1:].strip().rstrip(";").splitlines()[0].rstrip(";"))
    return out


def read_sinner_clips():
    return read_clips()["sinner"]


# ---------------------------------------------------------------- 1. smoothing
def smooth(t, X, tq, sigma, ok=None):
    """Local-linear Gaussian regression of X (frames × ...) at times tq. sigma may be an array per query.
    ok: per-frame mask; rejected frames get no weight (filled from their neighbours)."""
    sig = np.broadcast_to(np.asarray(sigma, float), tq.shape)
    okw = np.ones(len(t)) if ok is None else ok.astype(float)
    out = np.empty((len(tq),) + X.shape[1:])
    Xf = X.reshape(len(t), -1)
    for q, (tt, sg) in enumerate(zip(tq, sig)):
        w = okw * np.exp(-0.5 * ((t - tt) / sg) ** 2)
        if w.sum() < 1e-3:
            w = okw * np.exp(-0.5 * ((t - tt) / (4 * sg)) ** 2)
        if w.sum() < 1e-6:
            w = okw * np.exp(-0.5 * ((t - tt) / 0.5) ** 2)
        d = t - tt
        S0, S1, S2 = w.sum(), (w * d).sum(), (w * d * d).sum()
        det = S0 * S2 - S1 * S1
        a = (w[:, None] * Xf).sum(0)
        b = ((w * d)[:, None] * Xf).sum(0)
        out[q] = ((S2 * a - S1 * b) / det if det > 1e-12 else a / S0).reshape(X.shape[1:])
    return out


UPPER = ["nose", "leftEar", "rightEar", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist", "leftIndex", "rightIndex"]


def good_samples(t, J):
    """Tracker failures in the source (Zverev's 2nd serve folds his upper body below his hips; Jodar's and Paul's last
    frames collapse): a frame whose trunk leans more than 60° loses its whole upper body, and any joint more than
    0.12 body heights from the median of its ±2 neighbouring frames is dropped. Returns frames × joints mask."""
    ok = np.ones(J.shape[:2], bool)
    pel = (J[:, IX["leftHip"]] + J[:, IX["rightHip"]]) / 2
    sp = (J[:, IX["leftShoulder"]] + J[:, IX["rightShoulder"]]) / 2 - pel
    bad = sp[:, 1] < 0.5 * np.linalg.norm(sp, axis=1)
    for n in UPPER:
        ok[bad, IX[n]] = False
    for sd in ("left", "right"):  # legs: an ankle near hip height or a knee above the hip is the tracker, not the body
        hy = J[:, IX[sd + "Hip"], 1]
        legbad = (J[:, IX[sd + "Ankle"], 1] > hy - 0.15) | (J[:, IX[sd + "Knee"], 1] > hy + 0.02)
        for n in ("Knee", "Ankle", "Heel", "Toe"):
            ok[legbad, IX[sd + n]] = False
    for k in range(len(N)):
        for f in range(len(t)):
            lo, hi = max(0, f - 2), min(len(t), f + 3)
            nb = [g for g in range(lo, hi) if g != f and ok[g, k]]
            if len(nb) >= 2 and np.linalg.norm(J[f, k] - np.median(J[nb, k], axis=0)) > 0.12:
                ok[f, k] = False
    return ok, int(bad.sum())


def smooth_all(t, J, contact, hand):
    ok, _ = good_samples(t, J)
    tq = np.arange(t[0], t[-1] + 1e-9, 1 / HZ)
    hit = "left" if hand == "L" else "right"
    arm = {IX[s + n] for s in ("left", "right") for n in ("Elbow", "Wrist", "Index")}
    swing = {IX[hit + n] for n in ("Elbow", "Wrist", "Index")}
    near = np.clip(np.abs(tq - contact) / 0.15, 0, 1)
    out = np.empty((len(tq), len(N), 3))
    for k in range(len(N)):
        if k in swing:
            sg = 0.018 + (0.035 - 0.018) * near
        elif k in arm:
            sg = np.full(len(tq), 0.035)
        else:
            sg = np.full(len(tq), 0.045)
        Jk = J[:, k].copy()
        g = ok[:, k]
        if g.sum() >= 2 and not g.all():  # rejected samples: straight line between the good ones on either side
            for c in range(3):
                Jk[~g, c] = np.interp(t[~g], t[g], J[g, k, c])
        out[:, k] = smooth(t, Jk, tq, sg)
    return tq, out


# ---------------------------------------------------------------- 2. fixed bones
BONES = [  # (parent, child, group) — group shares one length (left = right)
    ("leftShoulder", "leftElbow", "upperArm"), ("rightShoulder", "rightElbow", "upperArm"),
    ("leftElbow", "leftWrist", "forearm"), ("rightElbow", "rightWrist", "forearm"),
    ("leftWrist", "leftIndex", "hand"), ("rightWrist", "rightIndex", "hand"),
    ("leftHip", "leftKnee", "thigh"), ("rightHip", "rightKnee", "thigh"),
    ("leftKnee", "leftAnkle", "shank"), ("rightKnee", "rightAnkle", "shank"),
    ("leftAnkle", "leftHeel", "heel"), ("rightAnkle", "rightHeel", "heel"),
    ("leftAnkle", "leftToe", "foot"), ("rightAnkle", "rightToe", "foot"),
]


def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-9)


def steady_dir(tq, v, L, sigma=0.04):
    """Bone direction over time, weighted by how long the bone looks (a bone pointing at the camera has a noisy
    direction); short frames borrow the direction of their neighbours."""
    l = np.linalg.norm(v, axis=1)
    w = np.clip(l / max(L, 1e-9), 0, 1.2) ** 3 + 1e-4
    u = unit(v)
    out = np.empty_like(u)
    for k, tt in enumerate(tq):
        g = w * np.exp(-0.5 * ((tq - tt) / sigma) ** 2)
        g[k] += w[k] * 2  # the frame itself still counts most when it is clear
        out[k] = (g[:, None] * u).sum(0)
    return unit(out)


def fix_bones(J, tq=None):
    J = J.copy()
    tq = np.arange(len(J)) / HZ if tq is None else tq
    L = {}
    for a, b, g in BONES:
        L.setdefault(g, []).append(np.linalg.norm(J[:, IX[b]] - J[:, IX[a]], axis=1))
    L = {g: float(np.median(np.concatenate(v))) for g, v in L.items()}
    pel = (J[:, IX["leftHip"]] + J[:, IX["rightHip"]]) / 2
    neck = (J[:, IX["leftShoulder"]] + J[:, IX["rightShoulder"]]) / 2
    hipW = float(np.median(np.linalg.norm(J[:, IX["rightHip"]] - J[:, IX["leftHip"]], axis=1))) / 2
    shW = float(np.median(np.linalg.norm(J[:, IX["rightShoulder"]] - J[:, IX["leftShoulder"]], axis=1))) / 2
    spine = float(np.median(np.linalg.norm(neck - pel, axis=1)))
    L.update(hipHalf=hipW, shoulderHalf=shW, spine=spine)
    # head: offsets of nose and ears from the neck keep their median length
    old = J.copy()
    hipDir = steady_dir(tq, old[:, IX["rightHip"]] - old[:, IX["leftHip"]], 2 * hipW)
    J[:, IX["leftHip"]] = pel - hipDir * hipW
    J[:, IX["rightHip"]] = pel + hipDir * hipW
    neckN = pel + steady_dir(tq, neck - pel, spine) * spine
    shDir = steady_dir(tq, old[:, IX["rightShoulder"]] - old[:, IX["leftShoulder"]], 2 * shW)
    J[:, IX["leftShoulder"]] = neckN - shDir * shW
    J[:, IX["rightShoulder"]] = neckN + shDir * shW
    for n in ("nose", "leftEar", "rightEar"):
        v = old[:, IX[n]] - neck
        ln = float(np.median(np.linalg.norm(v, axis=1)))
        J[:, IX[n]] = neckN + steady_dir(tq, v, ln) * ln
    for a, b, g in BONES:  # BONES is ordered parent-first along each chain
        J[:, IX[b]] = J[:, IX[a]] + steady_dir(tq, old[:, IX[b]] - old[:, IX[a]], L[g]) * L[g]
    return J, L


# ---------------------------------------------------------------- 3. planted feet
def ease(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def two_bone(hip, ankle, knee_hint, L1, L2, prev_side=None):
    d = ankle - hip
    dl = np.linalg.norm(d)
    reach = L1 + L2 - 1e-4
    if dl > reach:  # cannot reach: straight leg toward the target
        u = d / dl
        return hip + u * L1, hip + u * reach, prev_side
    u = d / max(dl, 1e-9)
    a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    side = knee_hint - hip - u * np.dot(knee_hint - hip, u)
    if prev_side is not None:  # a nearly straight leg gives no clear knee direction: the previous frame's leads
        side = side + 0.03 * (prev_side - u * np.dot(prev_side, u))
    sn = np.linalg.norm(side)
    side = side / sn if sn > 1e-6 else (prev_side if prev_side is not None else np.array([0.0, 0.0, 1.0]))
    return hip + u * a + side * h, ankle, side


def lock_feet(tq, J, L):
    J = J.copy()
    dt = 1 / HZ
    info = []
    for s in ("left", "right"):
        a, he, to = IX[s + "Ankle"], IX[s + "Heel"], IX[s + "Toe"]
        low = np.minimum(J[:, he, 1], J[:, to, 1])
        floor = np.percentile(low, 5)
        sp = np.linalg.norm(np.gradient(J[:, a, [0, 2]], dt, axis=0), axis=1)
        planted = (low < floor + 0.03) & (sp < 0.45)
        k = 0
        while k < len(tq):
            if not planted[k]:
                k += 1
                continue
            e = k
            while e + 1 < len(tq) and planted[e + 1]:
                e += 1
            if e - k + 1 >= 4:
                ramp = int(round(0.06 * HZ))
                lo, hi = max(0, k - ramp), min(len(tq) - 1, e + ramp)
                pin = {j: J[k:e + 1, j].mean(0) for j in (a, he, to)}
                for f in range(lo, hi + 1):
                    w = 1.0 if k <= f <= e else ease(1 - (k - f) / ramp) if f < k else ease(1 - (f - e) / ramp)
                    for j in (a, he, to):
                        J[f, j] = J[f, j] * (1 - w) + pin[j] * w
                info.append((s, round(float(tq[k]), 2), round(float(tq[e]), 2)))
            k = e + 1
        # knee by IK on every frame (keeps the fixed thigh and shank after the ankle moved)
        hp, kn = IX[s + "Hip"], IX[s + "Knee"]
        ps = None
        for f in range(len(tq)):
            K, A, ps = two_bone(J[f, hp], J[f, a], J[f, kn], L["thigh"], L["shank"], ps)
            shift = A - J[f, a]
            J[f, kn] = K
            for j in (a, he, to):
                J[f, j] = J[f, j] + shift
    return J, info


# ---------------------------------------------------------------- Sinner: his own clip + roster depth
def phase_map(ev_from, ev_to, t, keys=EV):
    xs = [ev_from[e] for e in keys if e in ev_from and e in ev_to]
    ys = [ev_to[e] for e in keys if e in ev_from and e in ev_to]
    t = np.asarray(t, float)
    return np.interp(t, xs, ys) + np.where(t < xs[0], t - xs[0], 0) + np.where(t > xs[-1], t - xs[-1], 0)


def sinner_from_clip(clip, ref):
    """clip: an exported own-clip motion ({t, j:{name:[x,up]}}); ref: the pro's roster serve (rows).
    Returns t, J (frames × N × 3) and the events on the clip's clock.
    Only the events the clip really shows ("knownEvents") line the two up. A clip that starts late (after the bounces,
    or at the trophy) gets its missing beginning from the roster serve at the same phase, eased into the clip's first
    frame over 0.35 s; its missing events are the roster's, mapped onto the clip's clock (Nov 27)."""
    known = clip.get("knownEvents") or EV
    ft = np.array([f["t"] for f in clip["frames"]])
    rt, RJ = rows_to_arrays(ref["rows"])
    tm = phase_map(clip["events"], ref["events"], ft, known)
    R = np.stack([np.stack([np.interp(tm, rt, RJ[:, k, c]) for c in range(3)], -1) for k in range(len(N))], 1)
    J = R.copy()
    have = clip["frames"][0]["j"].keys()
    rp = (R[:, IX["leftHip"]] + R[:, IX["rightHip"]]) / 2
    cp = np.array([[(f["j"]["leftHip"][0] + f["j"]["rightHip"][0]) / 2, (f["j"]["leftHip"][1] + f["j"]["rightHip"][1]) / 2] for f in clip["frames"]])
    for n in N:
        if n not in have:
            continue
        v = np.array([f["j"][n] for f in clip["frames"]])
        J[:, IX[n], 0] = v[:, 0] - cp[:, 0] + rp[:, 0]
        J[:, IX[n], 1] = v[:, 1]
    for child, parent in (("leftEar", "nose"), ("rightEar", "nose"), ("leftIndex", "leftWrist"), ("rightIndex", "rightWrist"),
                          ("leftHeel", "leftAnkle"), ("rightHeel", "rightAnkle"), ("leftToe", "leftAnkle"), ("rightToe", "rightAnkle")):
        J[:, IX[child]] = J[:, IX[parent]] + (R[:, IX[child]] - R[:, IX[parent]])
    ev = {e: clip["events"][e] for e in EV if e in clip["events"] and e in known}
    for e in EV:   # what the clip doesn't show: the roster's moment on the clip's clock
        if e not in ev and e in ref["events"]:
            ev[e] = round(float(phase_map(ref["events"], clip["events"], [ref["events"][e]], known)[0]), 4)
    if "start" not in known or ev["start"] < ft[0] - 1e-6:
        pre_r = rt[rt < tm[0] - 1e-6]
        if len(pre_r):
            pre_t = phase_map(ref["events"], clip["events"], pre_r, known)
            off = J[0] - RJ[np.searchsorted(rt, tm[0]) - 1 if np.searchsorted(rt, tm[0]) > 0 else 0]
            w = np.clip(1 - (pre_t[-1] + (pre_t[1] - pre_t[0] if len(pre_t) > 1 else 0.02) - pre_t) / 0.35, 0, 1)
            w = w * w * (3 - 2 * w)
            P = RJ[rt < tm[0] - 1e-6] + off[None] * w[:, None, None]
            ft, J = np.concatenate([pre_t, ft]), np.concatenate([P, J])
    return ft, J, ev


# ---------------------------------------------------------------- measuring
def bone_spread(J):
    out = {}
    for a, b, g in BONES[:10]:
        l = np.linalg.norm(J[:, IX[b]] - J[:, IX[a]], axis=1)
        out.setdefault(g, []).append(np.std(l) / np.mean(l))
    return round(100 * float(np.mean([x for v in out.values() for x in v])), 1)


def jitter(t, J, at=None):
    """Mean second difference at the raw clip's frame times `at` (body-height %), all joints."""
    at = t if at is None else at
    X = np.stack([np.stack([np.interp(at, t, J[:, k, c]) for c in range(3)], -1) for k in range(len(N))], 1)
    acc = X[2:] - 2 * X[1:-1] + X[:-2]
    return round(100 * float(np.linalg.norm(acc, axis=2).mean()), 3)


def foot_slide(tq, J):
    s = 0.0
    for side in ("left", "right"):
        a = J[:, IX[side + "Ankle"]]
        low = a[:, 1] < np.percentile(a[:, 1], 30)
        s += float(np.linalg.norm(np.diff(a[:, [0, 2]], axis=0), axis=1)[low[1:]].sum())
    return round(100 * s, 1)


# ---------------------------------------------------------------- build
def facing_fix(sv, hand):
    """Ryan, Nov 19: from the user's end most pros served "with the wrong hand". Most broadcast clips store the body
    turned half round (facing away from the net): for a right-hander standing side-on, seen from behind, the toss arm
    should reach out to his right (+x, he faces his right side) and the toss-side shoulder and foot lead toward the
    net (+z). The toss arm's side before the trophy decides x; the toss shoulder and toss foot leading decide z. Both wrong =
    turned 180° about the vertical (x → −x, z → −z), the usual case; only one = that axis alone is flipped.
    The racket stays in the hand the roster gives him. Returns (rows, kind, votes)."""
    t, J = rows_to_arrays(sv["rows"]); E = sv["events"]
    hit = "left" if hand == "L" else "right"; toss = "right" if hit == "left" else "left"; want = 1 if hand == "R" else -1
    pel = (J[:, IX["leftHip"]] + J[:, IX["rightHip"]]) / 2
    m = (t >= E["start"]) & (t <= E["trophy"])
    if m.sum() < 2:
        m = t <= E["trophy"]
    # x as the game shows it: anatomize() squares the shoulders (toss shoulder on his left) and moves each arm with its
    # shoulder, so the toss hand lands at (wrist − its shoulder) + the shoulder's new place. Window: start → toss.
    mx = (t >= E["start"]) & (t <= E["tossRelease"])
    if mx.sum() < 2:
        mx = m
    mid = (J[:, IX["leftShoulder"]] + J[:, IX["rightShoulder"]]) / 2
    seen = J[mx, IX[toss + "Wrist"], 0] - pel[mx, 0] - (J[mx, IX[toss + "Shoulder"], 0] - mid[mx, 0])
    vals = [want * seen.mean(),
            (J[m, IX[toss + "Shoulder"], 2] - J[m, IX[hit + "Shoulder"], 2]).mean(),
            (J[m, IX[toss + "Ankle"], 2] - J[m, IX[hit + "Ankle"], 2]).mean()]
    flipx = vals[0] < 0                           # what the user sees: the toss arm on the wrong side
    flipz = (vals[1] + vals[2]) / 2 < -0.03       # depth: the racket side leading toward the net
    rows = sv["rows"].copy()
    for k in range(len(N)):
        if flipz: rows[:, 3 + 3 * k] *= -1
    return rows, flipz, [round(float(v), 2) for v in vals]


def seen_toss_side(tq, S, E, hand):
    """Where the user sees the toss hand (+ = correct side), measured on the finished serve the way the game draws it
    (anatomize squares the shoulders and moves each arm with its shoulder). Window: start → toss release."""
    hit = "left" if hand == "L" else "right"; toss = "right" if hit == "left" else "left"; want = 1 if hand == "R" else -1
    m = (tq >= E["start"]) & (tq <= E["tossRelease"])
    if m.sum() < 2:
        m = tq <= E["trophy"]
    pel = (S[m, IX["leftHip"]] + S[m, IX["rightHip"]]) / 2
    mid = (S[m, IX["leftShoulder"]] + S[m, IX["rightShoulder"]]) / 2
    return float(want * (S[m, IX[toss + "Wrist"], 0] - pel[:, 0] - (S[m, IX[toss + "Shoulder"], 0] - mid[:, 0])).mean())


def contact_at_peak(tq, S, ev, hand, reach=0.2):
    """Ryan, Nov 24: hitting points were far too low (some clips marked contact 1.5-1.7 m up). Contact is where the
    racket hand is highest, searched within 0.2 s of the clip's mark and after the toss; finish is kept after it."""
    hit = "left" if hand == "L" else "right"
    c0 = ev["contact"]
    m = (tq >= max(ev["tossRelease"] + 0.1, c0 - reach)) & (tq <= c0 + reach)
    if m.sum() < 2:
        return ev, 0.0
    c = float(tq[m][np.argmax(S[m, IX[hit + "Wrist"], 1])])
    ev = dict(ev, contact=round(c, 4))
    ev["finish"] = round(max(ev["finish"], c + 0.05), 4)
    ev["trophy"] = round(min(ev["trophy"], c - 0.08), 4)
    return ev, round(c - c0, 3)


def rotate_to(u, v, w):
    """Unit vector a fraction w of the way from u to v (slerp)."""
    d = float(np.clip(np.dot(u, v), -1, 1)); a = math.acos(d)
    if a < 1e-6:
        return u
    return (math.sin((1 - w) * a) * u + math.sin(w * a) * v) / math.sin(a)


def sinner_style(tq, S, ev, hand):
    """GAME-DESIGN from Ryan's notes on Sinner (Nov 24), on top of his own clip:
    1. Hands from the bottom: after the bounces both arms drop and hang (toss hand by the front thigh, racket hand by
       the back thigh), then the toss arm sweeps up from there. 0.4 s is added before the clip's start for the drop;
       the routine ends there (events.set). Bones keep their length (directions blend).
    2. Feet: the front foot points toward the net post (45° between his front and the net), the back foot along the
       baseline, so from behind both shoes show their length; after contact the front foot turns to the net for the
       landing. Foot and heel lengths are his own.
    Returns the new times, frames and events; the forward jump is the game's (travel.fwd)."""
    face = 1.0 if hand == "R" else -1.0
    toss, hit = ("left", "right") if hand == "R" else ("right", "left")
    pre = int(round(0.4 * HZ))
    tq = np.concatenate([tq[0] - (np.arange(pre, 0, -1) / HZ), tq])
    S = np.concatenate([np.repeat(S[:1], pre, 0), S])
    start = ev["start"]
    ev = dict(ev, set=round(start - 0.4, 4))
    w_down = lambda t: float(np.clip((t - (start - 0.4)) / 0.3, 0, 1))
    def w_low(t, back):
        if t < start - 0.1: return w_down(t) ** 2 * (3 - 2 * w_down(t))
        u = float(np.clip((t - (start - 0.1)) / back, 0, 1)); return 1 - u * u * (3 - 2 * u)
    low_up = {toss: unit(np.array([0.22 * face, -1.0, 0.12])), hit: unit(np.array([0.05 * face, -1.0, -0.10]))}
    low_fo = {toss: unit(np.array([0.40 * face, -1.0, 0.25])), hit: unit(np.array([0.10 * face, -1.0, -0.05]))}
    back = {toss: 0.22, hit: 0.35}
    for f, t in enumerate(tq):
        for sd in (toss, hit):
            w = w_low(t, back[sd])
            if w <= 0:
                continue
            sh, el, wr = IX[sd + "Shoulder"], IX[sd + "Elbow"], IX[sd + "Wrist"]
            ix = IX[sd + "Index"]
            Lu = np.linalg.norm(S[f, el] - S[f, sh]); Lf = np.linalg.norm(S[f, wr] - S[f, el]); Lh = np.linalg.norm(S[f, ix] - S[f, wr])
            du = rotate_to(unit(S[f, el] - S[f, sh]), low_up[sd], w)
            df = rotate_to(unit(S[f, wr] - S[f, el]), low_fo[sd], w)
            dh = rotate_to(unit(S[f, ix] - S[f, wr]), low_fo[sd], w)
            S[f, el] = S[f, sh] + du * Lu; S[f, wr] = S[f, el] + df * Lf; S[f, ix] = S[f, wr] + dh * Lh
    front, rear = toss, hit
    land = lambda t: float(np.clip((t - ev["contact"]) / 0.15, 0, 1))
    for f, t in enumerate(tq):
        for sd, d0, d1 in ((front, np.array([0.7 * face, 0, 0.7]), np.array([0.25 * face, 0, 1.0])),
                           (rear, np.array([1.0 * face, 0, 0.0]), np.array([0.6 * face, -0.3, 0.75]))):
            a, to, he = IX[sd + "Ankle"], IX[sd + "Toe"], IX[sd + "Heel"]
            Lt = np.linalg.norm(S[f, to] - S[f, a]); Lh = np.linalg.norm(S[f, he] - S[f, a])
            d = unit(d0 + (d1 - d0) * land(t))
            S[f, to] = S[f, a] + unit(d + np.array([0, -0.35, 0])) * Lt
            S[f, he] = S[f, a] + unit(-d + np.array([0, -0.9, 0])) * Lh
    return tq, S, ev


# ---------------------------------------------------------------- per-pro serve style (watched, Nov 24)
# GAME-DESIGN values from watching each pro's serve frame by frame (watch-tennis-video skill; nothing downloaded) and
# Ryan's notes. Each entry names what was seen and where. Applied after the steadying, on the finished serve.
STYLES = {
    "djokovic": {"seen": "youtube 32nyPw9YUEA 95-103 s (court level, super slow motion): ball held on the strings in front of the waist, a still pause, toss arm straight up while the racket hangs, deep bend with hips forward and the back arched",
                 "hold": ("ballOnRacket", 0.45), "hipDrop": 0.05, "leanBack": 14},
    "nadal":    {"seen": "Ryan: like Djokovic but left-handed, more head and neck tilt, side spin (game: SERVE_SIDESPIN)",
                 "hold": ("ballOnRacket", 0.4), "hipDrop": 0.04, "leanBack": 12, "headTilt": 18},
    "kyrgios":  {"seen": "youtube oZ7hwsx1MmU 4-16 s (Indian Wells 2015 slow motion): quick short windup, little knee bend, explosive jump (both feet high), lands on the front foot with the back leg kicked out level",
                 "quick": 0.72, "kickBack": 0.25, "jump": 0.12, "fwd": 0.5},
    "medvedev": {"seen": "youtube ZJ39LcNagSM 31-39 s (US Open, from behind): tall and upright, slight knee bend, racket arm swung out almost straight at shoulder height, toss arm straight up, tall jump",
                 "racketWide": 1.0, "jump": 0.05},
    "cobolli":  {"seen": "youtube XewX3v0Ku6o 16-24 s (side view slow motion): long trophy with the racket up behind the head, very deep forward knee bend, arched back, explosive tucked jump, lands on the front foot",
                 "hipDrop": 0.09, "leanBack": 10, "jump": 0.12, "kickBack": 0.18, "fwd": 0.5},
    "fils":     {"seen": "youtube LvA9IJcS2ok 380-391 s (front view compilation): deep crouch at the trophy, racket raised early behind the head, explosive jump",
                 "hipDrop": 0.08, "jump": 0.12, "fwd": 0.4},
    "de-minaur": {"seen": "youtube LvA9IJcS2ok 252-276 s (front view compilation): quick compact motion, short trophy, moderate bend, moves well into the court and kicks the back leg",
                  "quick": 0.85, "hipDrop": 0.04, "kickBack": 0.15, "fwd": 0.8},
    "jodar":    {"seen": "youtube jNnhYeRfyYo 26-38 s (US Open practice): racket and ball held together at the chest for a long moment, both arms drop and split (racket wide and straight back), wide platform stance with a deep bend, explosive jump",
                 "hold": ("chestTogether", 0.5), "hipDrop": 0.08, "racketWide": 0.6, "jump": 0.1, "fwd": 0.4},
    "federer":  {"seen": "Ryan's back-view clip (deep bend, chest opening); the clip already carries it, a little extra bend",
                 "hipDrop": 0.03},
}


def _bump(t, a, peak, b):
    if t <= a or t >= b: return 0.0
    u = (t - a) / (peak - a) if t < peak else (b - t) / (b - peak)
    u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)


def _rot_xy(v, pivot, ang):
    c, s_ = math.cos(ang), math.sin(ang); d = v - pivot
    return pivot + np.array([c * d[0] - s_ * d[1], s_ * d[0] + c * d[1], d[2]])


def _resample(tq, S, warp):
    """New uniform 50 Hz frames for a time warp (old time → new time, monotonic)."""
    nt = np.array([warp(t) for t in tq]); grid = np.arange(nt[0], nt[-1] + 1e-9, 1 / HZ)
    out = np.empty((len(grid),) + S.shape[1:])
    for k in range(S.shape[1]):
        for c in range(3): out[:, k, c] = np.interp(grid, nt, S[:, k, c])
    return grid, out


def apply_style(pid, tq, S, ev, hand, L, own_clip=False):
    st = STYLES.get(pid)
    if not st:
        return tq, S, ev, {}
    if own_clip:   # the pro's own clip already carries his bend, lean, arm path, speed and jump: keep only what it can't show
        st = {k: v for k, v in st.items() if k in ("seen", "hold", "headTilt", "fwd")}
    S = S.copy(); ev = dict(ev)
    face = 1.0 if hand == "R" else -1.0
    toss, hit = ("left", "right") if hand == "R" else ("right", "left")
    f = np.array([face, 0.0, 0.0])
    # QUICK: the windup (start → trophy) runs faster
    if st.get("quick"):
        k, a, b = st["quick"], ev["start"], ev["trophy"]
        warp = lambda t: t if t <= a else a + (t - a) * k if t <= b else a + (b - a) * k + (t - b)
        tq, S = _resample(tq, S, warp)
        ev = {n: round(warp(v), 4) for n, v in ev.items()}
    # HOLD: a still pause before the toss in a set pose (body frozen on the first frame)
    if st.get("hold"):
        kind, dur = st["hold"]
        pre = int(round(dur * HZ)); start = ev["start"]
        tq = np.concatenate([tq[0] - (np.arange(pre, 0, -1) / HZ), tq]); S = np.concatenate([np.repeat(S[:1], pre, 0), S])
        ev["set"] = round(min(ev.get("set", 1e9), start - dur), 4)
        poses = {"ballOnRacket": {hit: ((0.25, -1, 0.15), (1.0, -0.15, 0.2)), toss: ((0.35, -1, 0.2), (1.0, -0.05, 0.25))},
                 "chestTogether": {hit: ((0.3, -1, 0.2), (0.55, 0.9, 0.2)), toss: ((0.3, -1, 0.2), (0.6, 0.9, 0.25))}}[kind]
        for fi, t in enumerate(tq):
            w = _bump(t, start - dur - 0.01, start - dur + 0.18, start + 0.14) if t < start - 0.05 or t > start - dur + 0.18 else 1.0
            if t >= start - dur + 0.18 and t <= start - 0.05: w = 1.0
            if w <= 0: continue
            for sd, (du, dfo) in poses.items():
                sh, el, wr, ix = (IX[sd + n] for n in ("Shoulder", "Elbow", "Wrist", "Index"))
                Lu, Lf, Lh = (np.linalg.norm(S[fi, b_] - S[fi, a_]) for a_, b_ in ((sh, el), (el, wr), (wr, ix)))
                tu = unit(np.array([du[0] * face, du[1], du[2]])); tf = unit(np.array([dfo[0] * face, dfo[1], dfo[2]]))
                u_ = rotate_to(unit(S[fi, el] - S[fi, sh]), tu, w); f_ = rotate_to(unit(S[fi, wr] - S[fi, el]), tf, w)
                h_ = rotate_to(unit(S[fi, ix] - S[fi, wr]), tf, w)
                S[fi, el] = S[fi, sh] + u_ * Lu; S[fi, wr] = S[fi, el] + f_ * Lf; S[fi, ix] = S[fi, wr] + h_ * Lh
    E = ev
    upper = [IX[n] for n in N if not any(x in n for x in ("Hip", "Knee", "Ankle", "Heel", "Toe"))]
    for fi, t in enumerate(tq):
        load = _bump(t, E["tossRelease"] - 0.15, E["trophy"], E["contact"] - 0.04)
        pel = (S[fi, IX["leftHip"]] + S[fi, IX["rightHip"]]) / 2
        # HIP DROP: the body above the knees sinks at the trophy (knees re-solved below)
        if st.get("hipDrop"):
            d = np.array([0, -st["hipDrop"] * load, 0])
            for k in upper + [IX["leftHip"], IX["rightHip"]]: S[fi, k] += d
            pel = pel + d
        # LEAN BACK: the upper body arches away from where he faces (rotation in the picture plane about the pelvis)
        if st.get("leanBack"):
            ang = math.radians(st["leanBack"]) * load * face
            for k in upper: S[fi, k] = _rot_xy(S[fi, k], pel, ang)
        # HEAD TILT: the head tips back and over from the neck while he watches the toss
        if st.get("headTilt"):
            neck = (S[fi, IX["leftShoulder"]] + S[fi, IX["rightShoulder"]]) / 2
            ang = math.radians(st["headTilt"]) * _bump(t, E["tossRelease"] - 0.1, E["trophy"], E["contact"] + 0.05) * face
            for n in ("nose", "leftEar", "rightEar"): S[fi, IX[n]] = _rot_xy(S[fi, IX[n]], neck, ang)
        # RACKET WIDE: the racket arm swings out almost straight, back from where he faces, at shoulder height
        if st.get("racketWide"):
            w = st["racketWide"] * _bump(t, E["tossRelease"] - 0.25, (E["tossRelease"] + E["trophy"]) / 2, E["trophy"] + 0.08)
            if w > 0:
                sh, el, wr, ix = (IX[hit + n] for n in ("Shoulder", "Elbow", "Wrist", "Index"))
                tgt = unit(np.array([-0.85 * face, 0.2, -0.3]))
                for a_, b_ in ((sh, el), (el, wr), (wr, ix)):
                    Lb = np.linalg.norm(S[fi, b_] - S[fi, a_]); S[fi, b_] = S[fi, a_] + rotate_to(unit(S[fi, b_] - S[fi, a_]), tgt, w) * Lb
        # KICK BACK: after contact the back foot flies up behind him
        if st.get("kickBack"):
            w = _bump(t, E["contact"] - 0.02, E["contact"] + 0.14, E["finish"] + 0.2)
            if w > 0:
                for n in ("Ankle", "Heel", "Toe"): S[fi, IX[hit + n]] += np.array([-0.08 * face, st["kickBack"], -0.1]) * w
        # knees: fixed thigh and shin between the moved hip and the ankle
        for sd in ("left", "right"):
            K, A, _ = two_bone(S[fi, IX[sd + "Hip"]], S[fi, IX[sd + "Ankle"]], S[fi, IX[sd + "Knee"]], L["thigh"], L["shank"])
            sh_ = A - S[fi, IX[sd + "Ankle"]]; S[fi, IX[sd + "Knee"]] = K
            for n in ("Ankle", "Heel", "Toe"): S[fi, IX[sd + n]] += sh_
    travel = {k: st[k] for k in ("fwd",) if st.get(k)}
    if st.get("jump"): travel["up"] = st["jump"]
    return tq, S, ev, {"travel": travel, "seen": st["seen"]}


def stabilize(t, J, events, hand):
    tq, S = smooth_all(t, J, events["contact"], hand)
    S, L = fix_bones(S, tq)
    S, locks = lock_feet(tq, S, L)
    return tq, S, L, locks


def main():
    players = read_roster()
    clips = read_clips()
    out, report = {}, []
    for p in players:
        if p["id"] == "alcaraz":
            continue
        first, second = live_pair(p)
        if not first:
            report.append(f"{p['id']}: no serve")
            continue
        jobs = [("first", first)] + ([("second", second)] if second else [])
        for role, sv in jobs:
            hand = p["hand"]
            rows, turned, votes = facing_fix(sv, hand)
            sv = dict(sv, rows=rows)
            t0, J0 = rows_to_arrays(rows)
            ev, src = dict(sv["events"]), sv["id"]
            if p["id"] in clips:
                cl = clips[p["id"]]
                clip = cl["first"] if role == "first" else cl.get("second", cl["first"])
                t0, J0, ev = sinner_from_clip(clip, sv)
                src = clip["source"] + " + depth from " + sv["id"] + ("" if not clip.get("knownEvents") else " (start filled from it)")
            before = (bone_spread(J0), jitter(t0, J0), foot_slide(t0, J0))
            tq, S, L, locks = stabilize(t0, J0, ev, hand)
            flipx = seen_toss_side(tq, S, ev, hand) < 0
            if flipx:  # the user would see the toss arm on the wrong side: turn x round (bones and pinned feet are unchanged)
                S = S.copy(); S[:, :, 0] *= -1
            turned = "turned" if flipx and turned else "sideways" if flipx else "depth" if turned else None
            ev, moved = contact_at_peak(tq, S, ev, hand, 0.06 if p["id"] in clips else 0.2)   # own clips: contact was read by eye
            travel, styled = None, {}
            if p["id"] == "sinner":
                tq, S, ev = sinner_style(tq, S, ev, hand)
                travel = {"fwd": 0.7}   # GAME-DESIGN (Ryan: "make him jump forward"): lands about 0.7 m inside the baseline
            tq, S, ev, styled = apply_style(p["id"], tq, S, ev, hand, L, own_clip=p["id"] in clips)
            if styled.get("travel"): travel = dict(travel or {}, **styled["travel"])
            after = (bone_spread(S), jitter(tq, S, t0), foot_slide(tq, S))
            out.setdefault(p["id"], {})[role] = {
                "id": sv["id"], "source": src, "events": ev, "hz": HZ, "t0": round(float(tq[0]), 4),
                "bonesM": {g: round(v * 1, 4) for g, v in L.items()}, "planted": locks, "turned": turned, "facingVotes": votes, "contactMovedS": moved, "travel": travel, "style": styled.get("seen"),
                "before": dict(zip(("boneSpreadPct", "jitterPct", "footSlidePct"), before)),
                "after": dict(zip(("boneSpreadPct", "jitterPct", "footSlidePct"), after)),
                "rows": [[round(float(x), 4) for x in fr.reshape(-1)] for fr in S],
            }
            report.append(f"{p['id']:18s} {role:6s} {turned or 'kept'} contact {moved:+.2f}s bones ±{before[0]}% → ±{after[0]}%   jitter {before[1]} → {after[1]}   foot slide {before[2]} → {after[2]}   ({len(t0)} → {len(tq)} frames)")
            if not second:  # only one captured serve: the roster reuses it as the second serve, so reuse the steady one
                out[p["id"]]["second"] = dict(out[p["id"]]["first"], reused=True)
    hdr = ("/* Generated by datasets/serves/tools/stabilize_serves.py — do not edit by hand.\n"
           "   Steady serves for every roster pro except Alcaraz (alcaraz-tracked.js): smoothed in time (50 Hz), every bone one\n"
           "   fixed length, planted feet pinned, knees re-solved. Sinner's x and height come from his own clips\n"
           "   (sinner-serve.js), depth from his roster serve at the same phase. Loaded after roster-serves.js. */\n")
    js = hdr + "(function () {\n  const N = " + json.dumps(N) + ";\n  const S = " + json.dumps(out, separators=(",", ":")) + ";\n" + r"""
  const MID = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });
  const SM = window.SERVE_MOTIONS = window.SERVE_MOTIONS || {};
  for (const id in S) for (const role in S[id]) {
    const s = S[id][role], slot = SM[id] || (SM[id] = {}), base = slot[role] || {};
    const frames = s.rows.map((r, k) => {
      const joints = {};
      for (let i = 0; i < N.length; i++) joints[N[i]] = { x: r[3 * i], y: r[3 * i + 1], z: r[3 * i + 2] };
      const neck = MID(joints.leftShoulder, joints.rightShoulder, 0.5), pelvis = MID(joints.leftHip, joints.rightHip, 0.5);
      Object.assign(joints, { neck, pelvis, root: pelvis, chest: MID(neck, pelvis, 0.42), head: joints.nose });
      return { t: +(s.t0 + k / s.hz).toFixed(4), joints };
    });
    slot[role] = Object.assign({}, base, { role, reused: !!s.reused, events: s.events, frames, travel: s.travel || undefined, stabilized: { source: s.source, turned: s.turned, facingVotes: s.facingVotes, bonesBodyHeights: s.bonesM, planted: s.planted, before: s.before, after: s.after } });
    if (s.source !== base.source) slot[role].source = s.source;
    if (!slot[role].hand) slot[role].hand = "R";
  }
})();
"""
    OUT.write_text(js)
    print("\n".join(report))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
