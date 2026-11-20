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


def read_sinner_clips():
    s = SINNER.read_text()
    d = json.loads(s[s.find("=", s.find("SERVE_MOTIONS.sinner")) + 1:].strip().rstrip(";"))
    return d


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
def phase_map(ev_from, ev_to, t):
    xs = [ev_from[e] for e in EV if e in ev_from and e in ev_to]
    ys = [ev_to[e] for e in EV if e in ev_from and e in ev_to]
    return np.interp(t, xs, ys, left=None, right=None) + np.where(t < xs[0], t - xs[0], 0) + np.where(t > xs[-1], t - xs[-1], 0)


def sinner_from_clip(clip, ref):
    """clip: sinner-serve.js motion ({t, j:{name:[x,up]}}); ref: roster serve (rows). Returns t, J (frames × N × 3)."""
    ft = np.array([f["t"] for f in clip["frames"]])
    rt, RJ = rows_to_arrays(ref["rows"])
    tm = phase_map(clip["events"], ref["events"], ft)
    R = np.stack([np.stack([np.interp(tm, rt, RJ[:, k, c]) for c in range(3)], -1) for k in range(len(N))], 1)
    J = R.copy()
    have = clip["frames"][0]["j"].keys()
    # the clip's root sits at x = 0; place it on the roster pelvis so the depth joints line up
    rp = (R[:, IX["leftHip"]] + R[:, IX["rightHip"]]) / 2
    cp = np.array([[(f["j"]["leftHip"][0] + f["j"]["rightHip"][0]) / 2, (f["j"]["leftHip"][1] + f["j"]["rightHip"][1]) / 2] for f in clip["frames"]])
    for n in N:
        if n not in have:
            continue
        v = np.array([f["j"][n] for f in clip["frames"]])
        J[:, IX[n], 0] = v[:, 0] - cp[:, 0] + rp[:, 0]
        J[:, IX[n], 1] = v[:, 1]
    # joints the clip lacks ride on their parent with the roster's offset
    for child, parent in (("leftEar", "nose"), ("rightEar", "nose"), ("leftIndex", "leftWrist"), ("rightIndex", "rightWrist"),
                          ("leftHeel", "leftAnkle"), ("rightHeel", "rightAnkle"), ("leftToe", "leftAnkle"), ("rightToe", "rightAnkle")):
        J[:, IX[child]] = J[:, IX[parent]] + (R[:, IX[child]] - R[:, IX[parent]])
    return ft, J


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


def stabilize(t, J, events, hand):
    tq, S = smooth_all(t, J, events["contact"], hand)
    S, L = fix_bones(S, tq)
    S, locks = lock_feet(tq, S, L)
    return tq, S, L, locks


def main():
    players = read_roster()
    clips = read_sinner_clips()
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
            if p["id"] == "sinner":
                clip = clips["first" if role == "first" else "second"]
                t0, J0 = sinner_from_clip(clip, sv)
                ev, src = dict(clip["events"]), clip["source"] + " + depth from " + sv["id"]
            before = (bone_spread(J0), jitter(t0, J0), foot_slide(t0, J0))
            tq, S, L, locks = stabilize(t0, J0, ev, hand)
            flipx = seen_toss_side(tq, S, ev, hand) < 0
            if flipx:  # the user would see the toss arm on the wrong side: turn x round (bones and pinned feet are unchanged)
                S = S.copy(); S[:, :, 0] *= -1
            turned = "turned" if flipx and turned else "sideways" if flipx else "depth" if turned else None
            after = (bone_spread(S), jitter(tq, S, t0), foot_slide(tq, S))
            out.setdefault(p["id"], {})[role] = {
                "id": sv["id"], "source": src, "events": ev, "hz": HZ, "t0": round(float(tq[0]), 4),
                "bonesM": {g: round(v * 1, 4) for g, v in L.items()}, "planted": locks, "turned": turned, "facingVotes": votes,
                "before": dict(zip(("boneSpreadPct", "jitterPct", "footSlidePct"), before)),
                "after": dict(zip(("boneSpreadPct", "jitterPct", "footSlidePct"), after)),
                "rows": [[round(float(x), 4) for x in fr.reshape(-1)] for fr in S],
            }
            report.append(f"{p['id']:18s} {role:6s} {turned or 'kept'} {votes} bones ±{before[0]}% → ±{after[0]}%   jitter {before[1]} → {after[1]}   foot slide {before[2]} → {after[2]}   ({len(t0)} → {len(tq)} frames)")
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
    slot[role] = Object.assign({}, base, { role, reused: !!s.reused, events: s.events, frames, stabilized: { source: s.source, turned: s.turned, facingVotes: s.facingVotes, bonesBodyHeights: s.bonesM, planted: s.planted, before: s.before, after: s.after } });
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
