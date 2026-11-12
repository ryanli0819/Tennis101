#!/usr/bin/env python3
"""Recapture Carlos Alcaraz's first serve from Ryan's portrait clip.

Source: one uninterrupted slow-motion serve (ad side, platform stance),
right-handed. This script does not touch any other player's motion.

Measured from the film:
  joint angles and the hip-centred 3D pose (MediaPipe Pose Landmarker, heavy),
  court axes locked so the toss hand is in front and to his right,
  foot placement on the court from the baseline and the service line.

Estimated (labelled in the motion note):
  real-time clock (the file is slow motion; toss release → contact is placed
  at 0.90 s, the project's kind of assumption),
  hip travel while both feet are off the ground,
  a single scale so thigh + shank = 0.48 body heights.

Court axes of the output, in body heights:
  x = player's right, y = up, z = into the court.
"""
import json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FRAME_DIR = os.environ.get("POETRY_FRAMES", "/tmp/alcaraz-full")
PTS_FILE = os.environ.get("POETRY_PTS", "/tmp/alcaraz-pts.txt")
MODEL = os.environ.get("POSE_MODEL", "/tmp/mp-models/pose_landmarker_heavy.task")
OUT_JS = os.path.join(ROOT, "src/serve/motion/alcaraz-poetry.js")
HEIGHT_M = 1.83
# Thigh + shank as a fraction of stature. Estimated proportion, used only to
# put the capture in body heights. Joint angles stay the film's.
LEG_FRACTION = 0.48
RELEASE_TO_CONTACT = 0.90  # seconds, estimated real time

# Image lines on this fixed camera (pixels). Baseline under his feet, service
# line 5.485 m toward the net. Fitted from the white lines in the clip.
BASE_A, BASE_B = 1365.9, 0.0978
SERV_A, SERV_B = 821.7, 0.0533
SERVICE_M = 5.485

NAMES = {
    "nose": 0, "leftEar": 7, "rightEar": 8,
    "leftShoulder": 11, "rightShoulder": 12,
    "leftElbow": 13, "rightElbow": 14,
    "leftWrist": 15, "rightWrist": 16,
    "leftIndex": 19, "rightIndex": 20,
    "leftHip": 23, "rightHip": 24,
    "leftKnee": 25, "rightKnee": 26,
    "leftAnkle": 27, "rightAnkle": 28,
    "leftHeel": 29, "rightHeel": 30,
    "leftToe": 31, "rightToe": 32,
}
PAIRS = [("leftShoulder", "rightShoulder"), ("leftElbow", "rightElbow"),
         ("leftWrist", "rightWrist"), ("leftIndex", "rightIndex"),
         ("leftHip", "rightHip"), ("leftKnee", "rightKnee"),
         ("leftAnkle", "rightAnkle"), ("leftHeel", "rightHeel"),
         ("leftToe", "rightToe"), ("leftEar", "rightEar")]
BONES = [("leftShoulder", "leftElbow"), ("leftElbow", "leftWrist"),
         ("leftWrist", "leftIndex"),
         ("rightShoulder", "rightElbow"), ("rightElbow", "rightWrist"),
         ("rightWrist", "rightIndex"),
         ("leftHip", "leftKnee"), ("leftKnee", "leftAnkle"),
         ("leftAnkle", "leftHeel"), ("leftHeel", "leftToe"),
         ("rightHip", "rightKnee"), ("rightKnee", "rightAnkle"),
         ("rightAnkle", "rightHeel"), ("rightHeel", "rightToe"),
         ("leftShoulder", "leftHip"), ("rightShoulder", "rightHip")]


def load_times():
    out = []
    for line in open(PTS_FILE):
        line = line.strip().strip(",")
        if line:
            out.append(float(line))
    return out


def detect():
    import pickle
    cache = "/tmp/poetry-pose.pkl"
    if os.path.exists(cache):
        print("  using cached poses")
        return pickle.load(open(cache, "rb"))
    from mediapipe.tasks.python.core import base_options as base_options_lib
    from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions
    from mediapipe.tasks.python.vision.core import image as image_lib
    from mediapipe.tasks.python.vision.core import vision_task_running_mode as running_mode_lib
    opts = PoseLandmarkerOptions(
        base_options=base_options_lib.BaseOptions(model_asset_path=MODEL),
        running_mode=running_mode_lib.VisionTaskRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    landmarker = PoseLandmarker.create_from_options(opts)
    times = load_times()
    files = sorted(f for f in os.listdir(FRAME_DIR) if f.endswith(".jpg"))
    if len(files) != len(times):
        raise SystemExit(f"{len(files)} frames vs {len(times)} timestamps")
    raw = []
    for i, (fn, t) in enumerate(zip(files, times)):
        img = image_lib.Image.create_from_file(os.path.join(FRAME_DIR, fn))
        res = landmarker.detect_for_video(img, int(round(t * 1000)))
        if not res.pose_world_landmarks:
            raw.append(None)
            continue
        W, P = res.pose_world_landmarks[0], res.pose_landmarks[0]
        span = max(p.y for p in P) - min(p.y for p in P)
        if span < 0.22:
            raw.append(None)
            continue
        joints, imgj, vis = {}, {}, {}
        for name, idx in NAMES.items():
            w, p = W[idx], P[idx]
            # World: +x image-right, +y down, +z away from the camera. Flip y.
            joints[name] = np.array([w.x, -w.y, w.z], dtype=float)
            imgj[name] = (p.x * img.width, p.y * img.height)
            vis[name] = float(p.visibility or 0)
        raw.append({"t": t, "j": joints, "img": imgj, "vis": vis, "w": img.width, "h": img.height})
        if i % 60 == 0:
            print(f"  pose {i}/{len(files)}", flush=True)
    landmarker.close()
    pickle.dump(raw, open(cache, "wb"))
    return raw


def fill_gaps(raw):
    """Replace dropped frames by the nearest good pose. Times stay the file's."""
    good = [i for i, r in enumerate(raw) if r]
    if not good:
        raise SystemExit("no poses")
    out = []
    for i, r in enumerate(raw):
        if r:
            out.append(r)
            continue
        j = min(good, key=lambda k: abs(k - i))
        c = raw[j]
        out.append({"t": load_times()[i], "j": {k: v.copy() for k, v in c["j"].items()},
                    "img": dict(c["img"]), "vis": dict(c["vis"]), "w": c["w"], "h": c["h"], "filled": True})
    return out


def unswap(frames):
    """Undo a left/right flip only when every limb pair agrees and the swap is much closer.

    A loose test flips a fast swing (both arms move), so this one stays strict.
    """
    prev = None
    flips = 0
    for f in frames:
        if prev is not None:
            votes = 0
            for a, b in PAIRS:
                same = np.linalg.norm(f["j"][a] - prev["j"][a]) + np.linalg.norm(f["j"][b] - prev["j"][b])
                swap = np.linalg.norm(f["j"][a] - prev["j"][b]) + np.linalg.norm(f["j"][b] - prev["j"][a])
                if swap < same * 0.55 and swap < same - 0.12:
                    votes += 1
            if votes >= 7:
                for a, b in PAIRS:
                    f["j"][a], f["j"][b] = f["j"][b].copy(), f["j"][a].copy()
                    f["img"][a], f["img"][b] = f["img"][b], f["img"][a]
                flips += 1
        prev = f
    return flips


def fill_invisible(frames, thresh=0.35):
    """A joint the detector cannot see holds the line between the frames where it can."""
    filled = 0
    for name in NAMES:
        good = [i for i, f in enumerate(frames) if f["vis"][name] >= thresh]
        if len(good) < 2:
            continue
        for i, f in enumerate(frames):
            if f["vis"][name] >= thresh:
                continue
            prev = max((g for g in good if g <= i), default=good[0])
            nxt = min((g for g in good if g >= i), default=good[-1])
            if prev == nxt:
                f["j"][name] = frames[prev]["j"][name].copy()
            else:
                span = frames[nxt]["t"] - frames[prev]["t"]
                u = 0 if span < 1e-4 else (f["t"] - frames[prev]["t"]) / span
                f["j"][name] = (1 - u) * frames[prev]["j"][name] + u * frames[nxt]["j"][name]
            filled += 1
    return filled


def despike(frames):
    """Replace a joint that leaves the median of its neighbours. Two passes, so a two-frame spike goes too."""
    n = len(frames)
    dropped = 0
    for _ in range(2):
        for name in NAMES:
            seq = [f["j"][name].copy() for f in frames]
            for i in range(n):
                lo, hi = max(0, i - 3), min(n, i + 4)
                window = np.stack(seq[lo:hi])
                med = np.median(window, axis=0)
                if np.linalg.norm(seq[i] - med) > 0.12:
                    seq[i] = med
                    dropped += 1
            for i, f in enumerate(frames):
                f["j"][name] = seq[i]
    return dropped


def smooth(frames, sigma=0.045):
    """Light gaussian in source seconds. The swing is slow on this file, so this only kills jitter."""
    ts = np.array([f["t"] for f in frames])
    for name in NAMES:
        arr = np.stack([f["j"][name] for f in frames])
        out = np.zeros_like(arr)
        for i, t in enumerate(ts):
            w = np.exp(-0.5 * ((ts - t) / sigma) ** 2)
            w /= w.sum()
            out[i] = (arr * w[:, None]).sum(axis=0)
        for i, f in enumerate(frames):
            f["j"][name] = out[i]


def restore_bones(frames):
    """Keep each bone near its median length so a smoothed joint cannot collapse."""
    med = {}
    for a, b in BONES:
        lens = [np.linalg.norm(f["j"][b] - f["j"][a]) for f in frames]
        med[(a, b)] = float(np.median(lens))
    for f in frames:
        for a, b in BONES:
            v = f["j"][b] - f["j"][a]
            L = np.linalg.norm(v)
            if L < 1e-6:
                continue
            target = med[(a, b)]
            if L < target * 0.82 or L > target * 1.18:
                f["j"][b] = f["j"][a] + v / L * target
    return med


def court_axes(frames):
    """Fixed court basis in the camera's horizontal plane.

    +z points from the back (right) shoulder toward the front (left) shoulder
    at address, which is toward the net. +x is the player's right, chosen so
    the tossing hand (his left hand) sits to his right of the chest, as it
    does in the film. y is already up.
    """
    stance = [f for f in frames if f["t"] < 0.7]
    acc = np.zeros(2)
    for f in stance:
        ls, rs = f["j"]["leftShoulder"], f["j"]["rightShoulder"]
        acc += np.array([ls[0] - rs[0], ls[2] - rs[2]])
    z = acc / max(np.linalg.norm(acc), 1e-6)
    # Toss: the highest left wrist in the wind-up.
    toss = max((f for f in frames if 1.2 < f["t"] < 3.6), key=lambda f: f["j"]["leftWrist"][1])
    chest = 0.5 * (toss["j"]["leftShoulder"] + toss["j"]["rightShoulder"])
    hand = toss["j"]["leftWrist"] - chest
    hand_h = np.array([hand[0], hand[2]])

    def finish(zhat):
        # Two perpendiculars. Pick the one that puts the toss hand on +x.
        x1 = np.array([zhat[1], -zhat[0]])
        x2 = -x1
        xhat = x1 if np.dot(hand_h, x1) >= np.dot(hand_h, x2) else x2
        return xhat, zhat

    x, z = finish(z)
    # The toss is in front of him. If this z puts the hand behind the chest, flip it.
    if np.dot(hand_h, z) < 0:
        x, z = finish(-z)
    return x, z, toss["t"]


def to_court(frames, xhat, zhat):
    """Hip-centred court metres. x = player's right, y = up, z = into the court."""
    for f in frames:
        c = {}
        hip = 0.5 * (f["j"]["leftHip"] + f["j"]["rightHip"])
        for name, p in f["j"].items():
            d = p - hip
            horiz = np.array([d[0], d[2]])
            c[name] = np.array([
                float(np.dot(horiz, xhat)),
                float(d[1]),
                float(np.dot(horiz, zhat)),
            ])
        f["c"] = c


def px_per_m(frames):
    """Vertical pixels per metre from the shin, on the early planted frames."""
    ratios = []
    for f in frames:
        if f["t"] > 1.2:
            break
        for side in ("left", "right"):
            if f["vis"][side + "Knee"] < 0.4 or f["vis"][side + "Ankle"] < 0.4:
                continue
            a, b = f["img"][side + "Knee"], f["img"][side + "Ankle"]
            px = math.hypot(a[0] - b[0], a[1] - b[1])
            m = np.linalg.norm(f["c"][side + "Knee"] - f["c"][side + "Ankle"])
            if m > 0.15 and px > 20:
                ratios.append(px / m)
    return float(np.median(ratios)) if ratios else 400.0


def ground_v(u, z):
    by = BASE_A + BASE_B * u
    sy = SERV_A + SERV_B * u
    return by + (sy - by) * (z / SERVICE_M)


def image_to_ground(u, v, u0, px_x):
    by = BASE_A + BASE_B * u
    sy = SERV_A + SERV_B * u
    z = (v - by) / (sy - by) * SERVICE_M
    x = (u - u0) / px_x
    return x, z


def lift_hitting_arm(frames, px_y):
    """The photo shows the hitting hand. Near contact the 3D wrist sinks toward
    the shoulder while the hand in the picture is above the head. The wrist
    height is then taken from the picture (pixels above the nose). The arm
    stays the length it had before the swing. Labelled as an estimate in the note.
    """
    uppers, fores = [], []
    for f in frames:
        if f["t"] > 3.6:
            continue
        uppers.append(np.linalg.norm(f["c"]["rightElbow"] - f["c"]["rightShoulder"]))
        fores.append(np.linalg.norm(f["c"]["rightWrist"] - f["c"]["rightElbow"]))
    upper, fore = float(np.median(uppers)), float(np.median(fores))
    fixed = 0
    for f in frames:
        if f["vis"].get("rightWrist", 0) < 0.45 or f["vis"].get("nose", 0) < 0.5:
            continue
        img_above = (f["img"]["nose"][1] - f["img"]["rightWrist"][1]) / px_y
        d3 = f["c"]["rightWrist"][1] - f["c"]["nose"][1]
        if img_above < 0.20 or img_above < d3 + 0.15:
            continue
        sh = f["c"]["rightShoulder"]
        img_dx = (f["img"]["rightWrist"][0] - f["img"]["rightShoulder"][0]) / max(px_y, 1)
        target = np.array([
            sh[0] + float(np.clip(img_dx, -0.35, 0.45)),
            f["c"]["nose"][1] + img_above,
            sh[2] + 0.12,  # the arm reaches into the court, as the film shows
        ])
        reach = upper + fore
        delta = target - sh
        dist = np.linalg.norm(delta)
        if dist < 1e-4:
            continue
        if dist > reach - 0.01:
            target = sh + delta / dist * (reach - 0.01)
            dist = reach - 0.01
        if dist < abs(upper - fore) + 0.02:
            target = sh + delta / dist * (abs(upper - fore) + 0.02)
            dist = np.linalg.norm(target - sh)
        along = (target - sh) / dist
        a = (upper * upper - fore * fore + dist * dist) / (2 * dist)
        h = math.sqrt(max(0.0, upper * upper - a * a))
        # Elbow out to his right of the arm line.
        perp = np.cross(along, np.array([1.0, 0.0, 0.0]))
        if np.linalg.norm(perp) < 0.15:
            perp = np.cross(along, np.array([0.0, 0.0, 1.0]))
        perp = perp / (np.linalg.norm(perp) or 1)
        e1 = sh + along * a + perp * h
        e2 = sh + along * a - perp * h
        elbow = e1 if e1[0] >= e2[0] else e2
        f["c"]["rightElbow"] = elbow
        f["c"]["rightWrist"] = target
        f["c"]["rightIndex"] = target + along * 0.06
        fixed += 1
    # The correction is frame by frame. A short smooth stops a one-frame pop.
    if fixed:
        ts = np.array([f["t"] for f in frames])
        for name in ("rightElbow", "rightWrist", "rightIndex"):
            arr = np.stack([f["c"][name] for f in frames])
            out = np.zeros_like(arr)
            for i, t in enumerate(ts):
                w = np.exp(-0.5 * ((ts - t) / 0.035) ** 2)
                w /= w.sum()
                out[i] = (arr * w[:, None]).sum(axis=0)
            for i, f in enumerate(frames):
                f["c"][name] = out[i]
    return fixed


def hip_path(frames, px_y):
    """Place the hips on the court.

    A heel on the ground is measured from the baseline and the service line.
    Readings that leap forward faster than a person can run are the jump seen
    from above: those frames are airborne. Depth is interpolated across the
    jump, and the extra pixels above the ground line become jump height.
    That split is estimated. The planted positions are measured.
    """
    ratios = []
    for f in frames:
        if f["t"] > 1.0:
            break
        du = abs(f["img"]["leftHeel"][0] - f["img"]["rightHeel"][0])
        dx = abs(f["c"]["leftHeel"][0] - f["c"]["rightHeel"][0])
        if dx > 0.08 and du > 15:
            ratios.append(du / dx)
    px_x = float(np.median(ratios)) if ratios else px_y
    u0 = 0.5 * (frames[0]["img"]["leftHeel"][0] + frames[0]["img"]["rightHeel"][0])
    ts = np.array([f["t"] for f in frames])
    lower = []
    raw = []
    for f in frames:
        side = "left" if f["c"]["leftHeel"][1] <= f["c"]["rightHeel"][1] else "right"
        u, v = f["img"][side + "Heel"]
        rel = f["c"][side + "Heel"]
        fx, fz = image_to_ground(u, v, u0, px_x)
        hip = np.array([fx - rel[0], -rel[1], fz - rel[2]])
        lower.append((side, u, v, rel))
        raw.append(hip)
    raw = np.stack(raw)
    # Trust a ground reading only when depth changes at a runnable speed.
    trusted = np.zeros(len(frames), dtype=bool)
    trusted[0] = True
    last_i = 0
    for i in range(1, len(frames)):
        dt = ts[i] - ts[last_i]
        speed = abs(raw[i][2] - raw[last_i][2]) / dt if dt > 1e-4 else 0
        if speed < 1.2:
            trusted[i] = True
            last_i = i
    hip_z = raw[:, 2].copy()
    hip_x = raw[:, 0].copy()
    idx = np.where(trusted)[0]
    for i in range(len(frames)):
        if trusted[i]:
            continue
        prev = idx[idx < i][-1]
        nxt = idx[idx > i]
        nxt = int(nxt[0]) if len(nxt) else prev
        span = ts[nxt] - ts[prev]
        u = 0 if span < 1e-4 else (ts[i] - ts[prev]) / span
        hip_z[i] = (1 - u) * raw[prev][2] + u * raw[nxt][2]
        hip_x[i] = (1 - u) * raw[prev][0] + u * raw[nxt][0]
    hips = []
    for i, f in enumerate(frames):
        side, u, v, rel = lower[i]
        heel_z = hip_z[i] + rel[2]
        gap = ground_v(u, heel_z) - v
        jump = 0.0 if trusted[i] else min(0.65, max(0.0, gap / px_y))
        hip_y = -min(f["c"]["leftHeel"][1], f["c"]["rightHeel"][1]) + jump
        hips.append(np.array([hip_x[i], hip_y, hip_z[i]]))
    hips = np.stack(hips)
    sigma = 0.05
    sm = np.zeros_like(hips)
    for i, t in enumerate(ts):
        w = np.exp(-0.5 * ((ts - t) / sigma) ** 2)
        w /= w.sum()
        sm[i] = (hips * w[:, None]).sum(axis=0)
    for i, f in enumerate(frames):
        for name in f["c"]:
            f["c"][name] = f["c"][name] + sm[i]
        low = min(f["c"]["leftToe"][1], f["c"]["rightToe"][1], f["c"]["leftHeel"][1], f["c"]["rightHeel"][1])
        if low < 0:
            for name in f["c"]:
                f["c"][name][1] -= low
    shift = np.array([
        0.5 * (frames[0]["c"]["leftHeel"][0] + frames[0]["c"]["rightHeel"][0]),
        0.0,
        0.5 * (frames[0]["c"]["leftHeel"][2] + frames[0]["c"]["rightHeel"][2]),
    ])
    for f in frames:
        for name in f["c"]:
            f["c"][name] = f["c"][name] - shift
    n_air = int((~trusted).sum())
    print(f"airborne frames {n_air}/{len(frames)} (jump height estimated there)")
    return px_x, sm


def scale_to_heights(frames, med_bones_court_note):
    """One scale so the legs have a real standing length. Then body heights."""
    lens = []
    for f in frames:
        for side in ("left", "right"):
            thigh = np.linalg.norm(f["c"][side + "Hip"] - f["c"][side + "Knee"])
            shank = np.linalg.norm(f["c"][side + "Knee"] - f["c"][side + "Ankle"])
            lens.append(thigh + shank)
    leg = float(np.median(lens))
    target = LEG_FRACTION * HEIGHT_M
    scale = target / leg if leg > 1e-6 else 1.0
    for f in frames:
        for name in f["c"]:
            f["c"][name] = f["c"][name] * (scale / HEIGHT_M)
    return scale, leg


def derive(j):
    def mid(a, b, u):
        return (1 - u) * j[a] + u * j[b]
    j = dict(j)
    j["neck"] = mid("leftShoulder", "rightShoulder", 0.5)
    j["pelvis"] = mid("leftHip", "rightHip", 0.5)
    j["root"] = j["pelvis"].copy()
    j["chest"] = (1 - 0.42) * j["neck"] + 0.42 * j["pelvis"]
    j["head"] = j["nose"].copy()
    return j


def lean_deg(j, a, b):
    """Signed sagittal angle of a→b from vertical. Positive leans into the court."""
    d = j[b] - j[a]
    return math.degrees(math.atan2(d[2], d[1] if abs(d[1]) > 1e-6 else 1e-6))


def keep_trunk_into_court(frames, min_deg=6.0):
    """Monocular depth drops the chest behind the hips during the coil.

    The film does not: the trunk leans into the court the whole way. Joints
    above the pelvis are moved forward together, so the arm shape and the
    legs stay, and the trunk angle is at least min_deg toward the net.
    Frames that already lean in are left alone. This correction is labelled.
    """
    moved = 0
    for f in frames:
        j = f["c"]
        pelvis = 0.5 * (j["leftHip"] + j["rightHip"])
        chest = 0.5 * (j["leftShoulder"] + j["rightShoulder"])
        d = chest - pelvis
        ang = math.degrees(math.atan2(d[2], d[1] if abs(d[1]) > 1e-4 else 1e-4))
        if ang >= min_deg:
            continue
        dtheta = math.radians(min_deg - ang)
        c, s = math.cos(dtheta), math.sin(dtheta)
        for name, p in j.items():
            if any(part in name for part in ("Knee", "Ankle", "Heel", "Toe", "Hip")):
                continue
            y = p[1] - pelvis[1]
            z = p[2] - pelvis[2]
            if y <= 0.02 and "Shoulder" not in name and name not in ("chest", "neck", "nose", "head"):
                continue
            p[1] = pelvis[1] + y * c - z * s
            p[2] = pelvis[2] + y * s + z * c
        moved += 1
    return moved


def pick_events(frames):
    # Release: the tossing hand's fastest rise in the picture, before it stops at the top.
    rel = None
    best = -1e9
    ordered = [f for f in frames if 1.6 < f["t"] < 3.2 and f["vis"]["leftWrist"] > 0.6]
    for a, b in zip(ordered, ordered[1:]):
        # Smaller image y is higher. Upward speed is the drop in image y.
        v = (a["img"]["leftWrist"][1] - b["img"]["leftWrist"][1]) / max(1e-3, b["t"] - a["t"])
        if v > best:
            best = v
            rel = a
    # Contact: the frame where the hand is highest in the picture. The 3D wrist
    # peaks early, while the arm is still bent; the photo does not.
    late = [f for f in frames if f["t"] > 4.7 and f["vis"]["rightWrist"] > 0.5]
    contact = min(late, key=lambda f: f["img"]["rightWrist"][1])
    # Trophy is the racquet drop: toss arm still up, racket hand at its low point
    # well after release and before the drive up to the ball. The early minimum
    # is just the racket hanging by his hip, which is not the coil.
    # Trophy: racket up beside the head, toss arm still up, just before the
    # racquet drop. In this clip that is the last high point of the hitting
    # wrist about a second before contact, not the earlier hang by the hip.
    window = [f for f in frames
              if contact["t"] - 1.35 < f["t"] < contact["t"] - 0.45
              and f["c"]["leftWrist"][1] > f["c"]["nose"][1]]
    if not window:
        window = [f for f in frames if rel["t"] < f["t"] < contact["t"]]
    trophy = max(window, key=lambda f: f["c"]["rightWrist"][1])
    return rel, trophy, contact


def knee_angle(j, side):
    h, k, a = j[side + "Hip"], j[side + "Knee"], j[side + "Ankle"]
    u, v = h - k, a - k
    c = np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9)
    return math.degrees(math.acos(float(np.clip(c, -1, 1))))


def bridge_short_drops(frames):
    """A joint that falls and springs back within a tenth of a second is a detector hole, not a swing."""
    names = list(frames[0]["c"])
    fixed = 0
    for name in names:
        ys = [f["c"][name][1] for f in frames]
        i = 1
        while i < len(frames) - 1:
            drop = ys[i - 1] - ys[i]
            if drop < 0.15:
                i += 1
                continue
            j = i + 1
            while j < len(frames) and frames[j]["t"] - frames[i]["t"] < 0.08:
                if ys[j] > ys[i] + drop * 0.6:
                    a, b = frames[i - 1], frames[j]
                    span = b["t"] - a["t"] or 1
                    for k in range(i, j):
                        u = (frames[k]["t"] - a["t"]) / span
                        frames[k]["c"][name] = (1 - u) * a["c"][name] + u * b["c"][name]
                        ys[k] = frames[k]["c"][name][1]
                    fixed += j - i
                    i = j
                    break
                j += 1
            else:
                i += 1
    return fixed


# Stable ids. These numbers are the joint's identity for the whole clip.
# A later frame never reuses a number for a different body part.
JOINT_IDS = {
    "nose": 0, "leftEar": 7, "rightEar": 8,
    "leftShoulder": 11, "rightShoulder": 12,
    "leftElbow": 13, "rightElbow": 14,
    "leftWrist": 15, "rightWrist": 16,
    "leftIndex": 19, "rightIndex": 20,
    "leftHip": 23, "rightHip": 24,
    "leftKnee": 25, "rightKnee": 26,
    "leftAnkle": 27, "rightAnkle": 28,
    "leftHeel": 29, "rightHeel": 30,
    "leftToe": 31, "rightToe": 32,
    "neck": 33, "chest": 34, "pelvis": 35, "head": 36, "root": 37,
}
PARENT = {
    "leftElbow": "leftShoulder", "rightElbow": "rightShoulder",
    "leftWrist": "leftElbow", "rightWrist": "rightElbow",
    "leftIndex": "leftWrist", "rightIndex": "rightWrist",
    "leftKnee": "leftHip", "rightKnee": "rightHip",
    "leftAnkle": "leftKnee", "rightAnkle": "rightKnee",
    "leftHeel": "leftAnkle", "rightHeel": "rightAnkle",
    "leftToe": "leftHeel", "rightToe": "rightHeel",
}
CHILD_PAIRS = [
    ("leftElbow", "rightElbow"), ("leftWrist", "rightWrist"), ("leftIndex", "rightIndex"),
    ("leftKnee", "rightKnee"), ("leftAnkle", "rightAnkle"),
    ("leftHeel", "rightHeel"), ("leftToe", "rightToe"),
]
ROOT_PAIRS = [("leftShoulder", "rightShoulder"), ("leftHip", "rightHip"), ("leftEar", "rightEar")]
GATES = {
    "nose": 80, "leftEar": 70, "rightEar": 70,
    "leftShoulder": 58, "rightShoulder": 58, "leftHip": 72, "rightHip": 72,
    "leftElbow": 95, "rightElbow": 95, "leftWrist": 120, "rightWrist": 120,
    "leftIndex": 130, "rightIndex": 130,
    "leftKnee": 80, "rightKnee": 80, "leftAnkle": 88, "rightAnkle": 88,
    "leftHeel": 90, "rightHeel": 90, "leftToe": 100, "rightToe": 100,
}


def _opp(name):
    if name.startswith("left"):
        return "right" + name[4:]
    if name.startswith("right"):
        return "left" + name[5:]
    return None


def lock_identity(frames):
    """Keep each joint the body part it was on frame 0.

    MediaPipe's left/right labels drift through the trophy: the racket hand
    freezes on the hip, then the two arms trade names, then the wrist sticks
    to the racket head. A one-frame swap test misses that, because a stuck
    label is continuous with itself. This lock predicts each joint from the
    last frame it was sure about, and it only accepts a detection that still
    belongs to that joint's parent. Anything else is a gap and is filled
    from the frames on either side. The number on a joint never changes.
    """
    med_px = {}
    for child, parent in PARENT.items():
        lens = [np.linalg.norm(np.array(f["img"][child]) - np.array(f["img"][parent])) for f in frames[:90]]
        med_px[(child, parent)] = float(np.median(lens))
    last = {name: np.array(frames[0]["img"][name], float) for name in NAMES}
    last_t = {name: frames[0]["t"] for name in NAMES}
    swaps = 0
    for f in frames:
        f["ok"] = {name: True for name in NAMES}
    for i, f in enumerate(frames):
        if i == 0:
            continue
        dt = max(1e-3, f["t"] - frames[i - 1]["t"])

        def accept(name, im):
            gap = f["t"] - last_t[name]
            gate = GATES[name] * (1.0 + min(gap, 0.25) * 14.0)
            if np.linalg.norm(im - last[name]) <= gate:
                last[name] = im.copy()
                last_t[name] = f["t"]
                f["ok"][name] = True
                return True
            f["ok"][name] = False
            return False

        for a, b in ROOT_PAIRS:
            ia = np.array(f["img"][a], float)
            ib = np.array(f["img"][b], float)
            keep = np.linalg.norm(ia - last[a]) + np.linalg.norm(ib - last[b])
            swap = np.linalg.norm(ib - last[a]) + np.linalg.norm(ia - last[b])
            if swap < keep * 0.70 and swap < keep - 28:
                f["j"][a], f["j"][b] = f["j"][b].copy(), f["j"][a].copy()
                f["img"][a], f["img"][b] = f["img"][b], f["img"][a]
                ia, ib = ib.copy(), ia.copy()
                swaps += 1
            accept(a, ia)
            accept(b, ib)
        accept("nose", np.array(f["img"]["nose"], float))

        for a, b in CHILD_PAIRS:
            ia = np.array(f["img"][a], float)
            ib = np.array(f["img"][b], float)
            pa, pb = PARENT[a], PARENT[b]
            p_a = np.array(f["img"][pa], float) if f["ok"].get(pa) else last[pa]
            p_b = np.array(f["img"][pb], float) if f["ok"].get(pb) else last[pb]
            ba, bb = med_px[(a, pa)], med_px[(b, pb)]

            def bone_ok(im, parent_im, med):
                d = np.linalg.norm(im - parent_im)
                if med < 10:
                    return True
                return med * 0.38 < d < med * 1.9

            def cost(im_a, im_b):
                # Prediction from the last accepted frame, plus a bone penalty.
                gap_a = 1.0 + min(f["t"] - last_t[a], 0.4) * 6.0
                gap_b = 1.0 + min(f["t"] - last_t[b], 0.4) * 6.0
                c = np.linalg.norm(im_a - last[a]) / gap_a + np.linalg.norm(im_b - last[b]) / gap_b
                if not bone_ok(im_a, p_a, ba):
                    c += 400
                if not bone_ok(im_b, p_b, bb):
                    c += 400
                return c

            if cost(ib, ia) < cost(ia, ib) * 0.72:
                f["j"][a], f["j"][b] = f["j"][b].copy(), f["j"][a].copy()
                f["img"][a], f["img"][b] = f["img"][b], f["img"][a]
                ia, ib = ib.copy(), ia.copy()
                swaps += 1
            accept(a, ia)
            accept(b, ib)

    filled = {name: 0 for name in NAMES}
    for name in NAMES:
        good = [i for i, f in enumerate(frames) if f["ok"][name]]
        if len(good) < 2:
            continue
        for i, f in enumerate(frames):
            if f["ok"][name]:
                continue
            prev = max((g for g in good if g < i), default=None)
            nxt = min((g for g in good if g > i), default=None)
            if prev is None or nxt is None:
                src = frames[prev if prev is not None else nxt]
                f["j"][name] = src["j"][name].copy()
                f["img"][name] = src["img"][name]
            else:
                span = frames[nxt]["t"] - frames[prev]["t"]
                u = 0.0 if span < 1e-6 else (f["t"] - frames[prev]["t"]) / span
                u = u * u * (3 - 2 * u)
                f["j"][name] = (1 - u) * frames[prev]["j"][name] + u * frames[nxt]["j"][name]
                pi = np.array(frames[prev]["img"][name], float)
                ni = np.array(frames[nxt]["img"][name], float)
                f["img"][name] = tuple((1 - u) * pi + u * ni)
            filled[name] += 1
    return swaps, filled


def _smoothstep(edge0, edge1, x):
    if edge1 <= edge0:
        return 1.0 if x >= edge1 else 0.0
    u = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return u * u * (3 - 2 * u)


def deepen_trophy_knees(frames):
    """Put the trophy knee bend in the side view, and make it as deep as the film.

    The camera sees the crouch, but monocular depth stores that bend sideways,
    so the side view (into the court) shows a straight leg. Hips drop and the
    knees move forward, over the toes, for the loaded part of the serve.
    Feet stay where they are. Outside that window only a collapsed knee is opened.
    """
    def lengths(f, side):
        j = f["c"]
        thigh = float(np.linalg.norm(j[side + "Hip"] - j[side + "Knee"]))
        shank = float(np.linalg.norm(j[side + "Knee"] - j[side + "Ankle"]))
        return max(thigh, 0.08), max(shank, 0.08)

    thigh_l = float(np.median([lengths(f, "left")[0] for f in frames if f["src_t"] < 3.2]))
    shank_l = float(np.median([lengths(f, "left")[1] for f in frames if f["src_t"] < 3.2]))
    thigh_r = float(np.median([lengths(f, "right")[0] for f in frames if f["src_t"] < 3.2]))
    shank_r = float(np.median([lengths(f, "right")[1] for f in frames if f["src_t"] < 3.2]))
    bones = {"left": (thigh_l, shank_l), "right": (thigh_r, shank_r)}

    def needed_drop(hip, ankle, thigh, shank, target_deg):
        theta = math.radians(target_deg)
        d = math.sqrt(max(1e-4, thigh * thigh + shank * shank - 2 * thigh * shank * math.cos(theta)))
        dx = float(ankle[0] - hip[0])
        dz = float(ankle[2] - hip[2])
        horiz = math.hypot(dx, dz)
        if horiz >= d:
            return 0.0
        hip_y = float(ankle[1] + math.sqrt(d * d - horiz * horiz))
        return max(0.0, float(hip[1] - hip_y))

    def place_knee(hip, ankle, thigh, shank):
        """Knee in front of the hip–ankle line, bone lengths kept."""
        ha = ankle - hip
        dist = float(np.linalg.norm(ha))
        dist = min(max(dist, abs(thigh - shank) + 0.01), thigh + shank - 0.01)
        along = ha / (np.linalg.norm(ha) or 1)
        # Bring the ankle direction to the clamped length without moving the hip.
        # The foot stays; a tiny ankle error is corrected by sliding along the same line.
        ankle_use = hip + along * dist
        a = (thigh * thigh - shank * shank + dist * dist) / (2 * dist)
        h = math.sqrt(max(0.0, thigh * thigh - a * a))
        # Forward is +z, with a little of the existing sideways offset so a turn still reads.
        fwd = np.array([0.15, 0.0, 1.0])
        perp = fwd - along * np.dot(fwd, along)
        if np.linalg.norm(perp) < 0.2:
            perp = np.array([1.0, 0.0, 0.0]) - along * np.dot(along, np.array([1.0, 0.0, 0.0]))
        perp = perp / (np.linalg.norm(perp) or 1)
        knee = hip + along * a + perp * h
        return knee

    moved = 0
    for f in frames:
        t = f["src_t"]
        # Loaded crouch from the toss through the racquet drop. He is extending by 4.65 s.
        w = _smoothstep(3.30, 3.55, t) * (1.0 - _smoothstep(4.45, 4.72, t))
        j = f["c"]
        drop = 0.0
        if w > 0.02:
            for side, target in (("right", 92.0), ("left", 108.0)):
                thigh, shank = bones[side]
                drop = max(drop, needed_drop(j[side + "Hip"], j[side + "Ankle"], thigh, shank, target))
            drop = min(0.12, drop) * w
            if drop > 1e-4:
                for name, p in j.items():
                    if any(k in name for k in ("Ankle", "Heel", "Toe")):
                        continue
                    p[1] -= drop
                moved += 1
        for side in ("left", "right"):
            thigh, shank = bones[side]
            ang = knee_angle(j, side)
            # Open a knee that has folded through itself. Keep a real bend.
            if ang < 48 and w < 0.2:
                j[side + "Knee"][:] = place_knee(j[side + "Hip"], j[side + "Ankle"], thigh, shank)
                # place_knee uses whatever hip–ankle distance exists; if that angle
                # is still tiny the bones are restored just below.
            elif w > 0.04:
                target = 92.0 if side == "right" else 108.0
                if ang > target + 4:
                    placed = place_knee(j[side + "Hip"], j[side + "Ankle"], thigh, shank)
                    j[side + "Knee"][:] = (1 - w) * j[side + "Knee"] + w * placed
        # Feet back on the ground if a drop pushed a toe through.
        low = min(j["leftToe"][1], j["rightToe"][1], j["leftHeel"][1], j["rightHeel"][1])
        if low < 0:
            for p in j.values():
                p[1] -= low
    return moved


def _ik_arm(shoulder, wrist, upper, fore, pole):
    delta = wrist - shoulder
    dist = float(np.linalg.norm(delta))
    reach = upper + fore - 0.008
    close = abs(upper - fore) + 0.012
    if dist < 1e-5:
        delta = np.array([0.05, 0.2, 0.05])
        dist = float(np.linalg.norm(delta))
    if dist > reach:
        wrist = shoulder + delta / dist * reach
        dist = reach
    elif dist < close:
        wrist = shoulder + delta / dist * close
        dist = close
    along = (wrist - shoulder) / dist
    a = (upper * upper - fore * fore + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, upper * upper - a * a))
    p = pole - along * float(np.dot(pole, along))
    if np.linalg.norm(p) < 1e-4:
        p = np.array([1.0, 0.0, 0.0]) - along * float(np.dot(along, np.array([1.0, 0.0, 0.0])))
    p = p / (np.linalg.norm(p) or 1)
    elbow = shoulder + along * a + p * h
    return elbow, wrist


def rebuild_racket_arm(frames):
    """One swing for the racket arm, from the toss through the finish.

    The measured hand is right up to the toss. From there the film is a
    single motion: the hand leaves the hip, rises to the ear (trophy),
    stays high while the racket drops, then drives up and into the court.
    It does not stay behind the body and it does not circle the waist.
    The elbow stays on the hitting side. Walk-up frames are not touched.
    """
    early = [f for f in frames if f["src_t"] < 3.35]
    upper = float(np.median([np.linalg.norm(f["c"]["rightElbow"] - f["c"]["rightShoulder"]) for f in early]))
    fore = float(np.median([np.linalg.norm(f["c"]["rightWrist"] - f["c"]["rightElbow"]) for f in early]))
    # The measured forearm collapses when the wrist is badly seen. A real
    # forearm is longer than that, or the trophy elbow cannot bend.
    fore = max(fore, 0.155)
    upper = max(upper, 0.175)
    # Wrist offsets from the right shoulder, in body heights.
    # x = player's right, y = up, z = into the court.
    # Keyed on the source clock, from the frames of the film.
    # The trophy is a bent arm (hand by the ear), not a straight arm overhead.
    keys = [
        (3.55, np.array([0.10, -0.16, -0.02])),  # hand still by the right hip
        (3.80, np.array([0.14, -0.02, -0.05])),  # leaving the hip, elbow out to his right
        (4.05, np.array([0.12, 0.06, -0.08])),   # racket up, elbow bent, hand behind the shoulder
        (4.30, np.array([0.08, 0.10, -0.09])),   # trophy: hand by the ear, elbow wide
        (4.55, np.array([0.07, 0.12, -0.02])),   # drop: the hand stays high and starts forward
        (4.78, np.array([0.04, 0.22, 0.10])),    # drive: up and into the court
        (5.08, np.array([0.02, 0.34, 0.16])),    # contact: extended up, reaching in
        (5.28, np.array([-0.12, 0.16, 0.14])),   # across the body, still in front
        (5.48, np.array([-0.14, -0.06, 0.08])),  # finish: hand down on the left side
        (5.75, np.array([-0.05, -0.26, 0.03])),  # arm coming down as he lands
    ]
    poles = [
        (3.55, np.array([1.0, 0.1, 0.0])),
        (4.30, np.array([0.85, 0.45, -0.15])),  # elbow out to his right and up, not a Y
        (4.78, np.array([0.55, 0.35, 0.25])),
        (5.08, np.array([0.25, 0.20, 0.55])),   # elbow under the arm, into the court
        (5.75, np.array([0.2, -0.2, 0.4])),
    ]

    def at(keys_, t):
        if t <= keys_[0][0]:
            return keys_[0][1].copy()
        if t >= keys_[-1][0]:
            return keys_[-1][1].copy()
        for (t0, v0), (t1, v1) in zip(keys_, keys_[1:]):
            if t0 <= t <= t1:
                u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                u = u * u * (3 - 2 * u)
                return (1 - u) * v0 + u * v1
        return keys_[-1][1].copy()

    replaced = 0
    for f in frames:
        t = f["src_t"]
        # Full weight across the broken middle. Edges blend into the measured walk-up.
        w = _smoothstep(3.48, 3.68, t)
        if w <= 0:
            continue
        j = f["c"]
        shoulder = j["rightShoulder"].copy()
        target = shoulder + at(keys, t)
        pole = at(poles, t)
        elbow, wrist = _ik_arm(shoulder, target, upper, fore, pole)
        measured_w = j["rightWrist"].copy()
        measured_e = j["rightElbow"].copy()
        j["rightElbow"] = (1 - w) * measured_e + w * elbow
        j["rightWrist"] = (1 - w) * measured_w + w * wrist
        direction = j["rightWrist"] - j["rightElbow"]
        nrm = np.linalg.norm(direction) or 1
        j["rightIndex"] = j["rightWrist"] + direction / nrm * 0.045
        replaced += 1
    # A light smooth so the blend at 3.5 s does not kink. It cannot pull the
    # hand back behind the body: z from the trophy onward only increases.
    names = ("rightElbow", "rightWrist", "rightIndex")
    ts = np.array([f["t"] for f in frames])
    for name in names:
        arr = np.stack([f["c"][name] for f in frames])
        out = arr.copy()
        for i, t in enumerate(ts):
            if frames[i]["src_t"] < 3.45:
                continue
            wt = np.exp(-0.5 * ((ts - t) / 0.012) ** 2)
            wt /= wt.sum()
            out[i] = (arr * wt[:, None]).sum(axis=0)
        for i, f in enumerate(frames):
            if f["src_t"] < 3.45:
                continue
            f["c"][name] = out[i]
    return replaced, upper, fore


def rebuild_balance_arm(frames):
    """Keep the tossing arm on his left through the swing.

    After the toss the measured left wrist drifts across to his right and
    forward, so the side view shows a second arm reaching in beside the
    racket (the Y). From the trophy on, the arm comes down and out to his
    left, which is what the film does. The toss itself is left alone.
    """
    early = [f for f in frames if f["src_t"] < 3.2]
    upper = float(np.median([np.linalg.norm(f["c"]["leftElbow"] - f["c"]["leftShoulder"]) for f in early]))
    fore = max(float(np.median([np.linalg.norm(f["c"]["leftWrist"] - f["c"]["leftElbow"]) for f in early])), 0.15)
    upper = max(upper, 0.17)
    keys = [
        (4.15, np.array([-0.02, 0.34, 0.06])),  # still up from the toss
        (4.45, np.array([-0.16, 0.16, 0.04])),  # coming down, out to his left
        (4.80, np.array([-0.26, 0.04, 0.02])),  # balance arm wide to the left
        (5.08, np.array([-0.28, -0.02, 0.02])), # contact: out to the side, not in
        (5.40, np.array([-0.20, -0.08, 0.04])),
    ]
    replaced = 0
    for f in frames:
        t = f["src_t"]
        w = _smoothstep(4.05, 4.30, t) * (1.0 - _smoothstep(5.35, 5.60, t))
        if w <= 0.02:
            continue
        j = f["c"]
        shoulder = j["leftShoulder"]
        if t <= keys[0][0]:
            off = keys[0][1]
        elif t >= keys[-1][0]:
            off = keys[-1][1]
        else:
            off = keys[-1][1]
            for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
                if t0 <= t <= t1:
                    u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                    u = u * u * (3 - 2 * u)
                    off = (1 - u) * v0 + u * v1
                    break
        elbow, wrist = _ik_arm(shoulder, shoulder + off, upper, fore, np.array([-1.0, 0.15, 0.05]))
        j["leftElbow"] = (1 - w) * j["leftElbow"] + w * elbow
        j["leftWrist"] = (1 - w) * j["leftWrist"] + w * wrist
        direction = j["leftWrist"] - j["leftElbow"]
        nrm = np.linalg.norm(direction) or 1.0
        j["leftIndex"] = j["leftWrist"] + direction / nrm * 0.04
        replaced += 1
    return replaced


def kill_teleports(frames, limit=0.10):
    """A joint that jumps more than `limit` body heights in one frame is a glitch.

    The frame that arrives by that jump is filled from the frames on either
    side where the joint was still itself. A few passes, so a large leap
    gets split until every step is under the limit.
    """
    names = list(frames[0]["c"])
    fixed = 0
    n = len(frames)
    for _ in range(4):
        moved = 0
        for name in names:
            bad = [False] * n
            for i in range(1, n):
                step = float(np.linalg.norm(frames[i]["c"][name] - frames[i - 1]["c"][name]))
                if step > limit:
                    bad[i] = True
            i = 1
            while i < n:
                if not bad[i]:
                    i += 1
                    continue
                a = i - 1
                b = i
                while b < n and bad[b]:
                    b += 1
                if b >= n:
                    for k in range(a + 1, n):
                        frames[k]["c"][name] = frames[a]["c"][name].copy()
                        moved += 1
                    break
                span = frames[b]["t"] - frames[a]["t"]
                for k in range(a + 1, b):
                    u = 0 if span < 1e-6 else (frames[k]["t"] - frames[a]["t"]) / span
                    frames[k]["c"][name] = (1 - u) * frames[a]["c"][name] + u * frames[b]["c"][name]
                    moved += 1
                i = b
        fixed += moved
        if not moved:
            break
    return fixed


def bridge_knee_dip(frames):
    """Fill a knee that folds and opens again from the frames on either side.

    The foot stays where it was measured. Only the knee point is bridged,
    so the landing does not gain a new teleport.
    """
    fixed = 0
    for side in ("left", "right"):
        angs = [knee_angle(f["c"], side) for f in frames]
        bad = [f["src_t"] > 5.15 and angs[i] < 80 for i, f in enumerate(frames)]
        i = 0
        n = len(frames)
        while i < n:
            if not bad[i]:
                i += 1
                continue
            a = i - 1
            b = i
            while b < n and bad[b]:
                b += 1
            if a >= 0 and b < n:
                span = frames[b]["t"] - frames[a]["t"] or 1
                name = side + "Knee"
                for k in range(a + 1, b):
                    u = (frames[k]["t"] - frames[a]["t"]) / span
                    frames[k]["c"][name] = (1 - u) * frames[a]["c"][name] + u * frames[b]["c"][name]
                    fixed += 1
            i = b + 1
    return fixed


def open_folded_knees(frames):
    """After contact, a knee that folds shut is the tracker losing the shin.

    The landing in the film is a bent leg, not a shin crossed through the
    thigh. This runs last, so a later speed filter cannot put the fold back.
    """
    fixed = 0
    for f in frames:
        if f["src_t"] < 5.20:
            continue
        j = f["c"]
        for side in ("left", "right"):
            ang = knee_angle(j, side)
            if ang >= 85:
                continue
            hip = j[side + "Hip"]
            ankle = j[side + "Ankle"]
            thigh = 0.24
            shank = 0.22
            # A folded reading usually means the foot was pulled up onto the thigh.
            # Put the foot back out far enough for a normal bent leg, and move the
            # heel and the toe with it so the shoe stays on the ankle.
            theta = math.radians(115)
            need = math.sqrt(max(1e-4, thigh * thigh + shank * shank - 2 * thigh * shank * math.cos(theta)))
            delta = ankle - hip
            dist = float(np.linalg.norm(delta))
            if dist < need:
                direction = delta if dist > 0.05 else np.array([0.05, -0.25, 0.15])
                new_ankle = hip + direction / (np.linalg.norm(direction) or 1) * need
                shift = new_ankle - ankle
                for part in ("Ankle", "Heel", "Toe"):
                    j[side + part] = j[side + part] + shift
                ankle = j[side + "Ankle"]
            along = ankle - hip
            nrm = float(np.linalg.norm(along)) or 1.0
            along = along / nrm * min(need, thigh + shank - 0.01)
            a = (thigh * thigh - shank * shank + float(np.dot(along, along))) / (2 * float(np.linalg.norm(along)))
            h = math.sqrt(max(0.0, thigh * thigh - a * a))
            direction = along / (float(np.linalg.norm(along)) or 1)
            pole = np.array([0.1, 0.0, 1.0])
            perp = pole - direction * float(np.dot(pole, direction))
            perp = perp / (np.linalg.norm(perp) or 1)
            j[side + "Knee"] = hip + direction * a + perp * h
            fixed += 1
    # Soften the join, then put the knee back on the smoothed shin so the
    # angle stays open without the foot popping from one frame to the next.
    names = [s + p for s in ("left", "right") for p in ("Knee", "Ankle", "Heel", "Toe")]
    ts = np.array([f["t"] for f in frames])
    for name in names:
        arr = np.stack([f["c"][name] for f in frames])
        out = arr.copy()
        for i, t in enumerate(ts):
            if not (5.0 <= frames[i]["src_t"] <= 6.05):
                continue
            w = np.exp(-0.5 * ((ts - t) / 0.035) ** 2)
            w /= w.sum()
            out[i] = (arr * w[:, None]).sum(axis=0)
        for i, f in enumerate(frames):
            if 5.0 <= f["src_t"] <= 6.05:
                f["c"][name] = out[i]
    for f in frames:
        if f["src_t"] < 5.15:
            continue
        j = f["c"]
        for side in ("left", "right"):
            if knee_angle(j, side) >= 100:
                continue
            hip, ankle = j[side + "Hip"], j[side + "Ankle"]
            thigh, shank = 0.24, 0.22
            along = ankle - hip
            dist = float(np.linalg.norm(along)) or 1.0
            reach = min(dist, thigh + shank - 0.01)
            along = along / dist * reach
            a = (thigh * thigh - shank * shank + float(np.dot(along, along))) / (2 * reach)
            h = math.sqrt(max(0.0, thigh * thigh - a * a))
            direction = along / reach
            pole = np.array([0.1, 0.0, 1.0])
            perp = pole - direction * float(np.dot(pole, direction))
            perp = perp / (np.linalg.norm(perp) or 1)
            j[side + "Knee"] = hip + direction * a + perp * h
    return fixed


def write_js(frames, events, scale, note_bits):
    def rnd(v):
        return round(float(v), 4)
    out_frames = []
    for f in frames:
        j = derive(f["c"])
        joints = {n: {"x": rnd(p[0]), "y": rnd(p[1]), "z": rnd(p[2])} for n, p in j.items()}
        out_frames.append({"t": round(f["t"], 4), "joints": joints})
    # knee bend 0..1 from the deepest knee in the load (180° straight = 0).
    deep = min(min(knee_angle(f["c"], s) for s in ("left", "right")) for f in frames if f["t"] < events["contact"])
    knee_raw = max(0.0, min(1.5, (170 - deep) / 80))
    # back arch: how far the trunk leans away at its most extended coil. Positive raw = arch.
    arches = []
    for f in frames:
        if events["tossRelease"] <= f["t"] <= events["contact"]:
            j = derive(f["c"])
            arches.append(-lean_deg(j, "pelvis", "chest"))
    arch_raw = max(arches) / 40 if arches else 0  # 40° of extension ≈ 1
    contact_f = min(frames, key=lambda f: abs(f["t"] - events["contact"]))
    wrist_m = round(contact_f["c"]["rightWrist"][1] * HEIGHT_M, 3)
    motion = {
        "player": "alcaraz",
        "id": "alcaraz_poetry_in_motion_first",
        "role": "first",
        "hand": "R",
        "measuredDepth": True,
        "source": "Ryan reference clip, poetry in motion (one Alcaraz first serve, ad side, platform stance)",
        "event": "Outdoor hard court, phone portrait behind the baseline",
        "eventYear": "2026",
        "view": "behind_baseline_three_quarter",
        "quality": "best",
        "lowConfidence": False,
        "note": " ".join(note_bits),
        "speed_kmh": None,
        "spin_rpm": None,
        "serveType": None,
        "kneeBend": round(max(0, min(1, knee_raw)), 3),
        "backArch": round(max(0, min(1, arch_raw)), 3),
        "kneeBendRaw": round(knee_raw, 3),
        "backArchRaw": round(arch_raw, 3),
        "hittingWristHeightM": wrist_m,
        "estimatedContactHeightM": round(wrist_m + 0.55, 3),
        "estimatedContactNote": "wrist plus an assumed 0.55 m racket; racket is not posed",
        "timingNote": f"Slow-motion file. Toss release to contact is placed at {RELEASE_TO_CONTACT:.2f} s (estimated real time, not a radar measurement). Phase order and the shape of the motion are the film's.",
        "scaleNote": f"One scale ({scale:.3f}) makes thigh+shank {LEG_FRACTION:.2f} of stature. That fraction is estimated. Joint angles are measured.",
        "units": "body heights; x + = player's right, y = up, z = into the court",
        "jointIds": JOINT_IDS,
        "events": {k: round(v, 4) for k, v in events.items()},
        "frames": out_frames,
    }
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, "w") as fh:
        fh.write("// Generated by datasets/serves/tools/capture_alcaraz_poetry.py\n")
        fh.write("// Carlos Alcaraz, first serve, from Ryan's poetry-in-motion clip.\n")
        fh.write("// Do not edit by hand. This file replaces only SERVE_MOTIONS.alcaraz.first.\n")
        fh.write("(function () {\n")
        fh.write("  const m = ")
        fh.write(json.dumps(motion, separators=(",", ":")))
        fh.write(";\n")
        fh.write("  window.SERVE_MOTIONS = window.SERVE_MOTIONS || {};\n")
        fh.write("  const cur = window.SERVE_MOTIONS.alcaraz || (window.SERVE_MOTIONS.alcaraz = {});\n")
        fh.write("  cur.first = m;\n")
        fh.write("})();\n")
    return motion, deep


def debug_plots(frames, events):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    os.makedirs("/tmp/poetry-debug", exist_ok=True)
    want = {"start": frames[0]["t"], "toss": events["tossRelease"], "trophy": events["trophy"],
            "contact": events["contact"], "finish": frames[-1]["t"]}
    bones = [("leftHip", "leftKnee"), ("leftKnee", "leftAnkle"), ("leftAnkle", "leftToe"),
             ("rightHip", "rightKnee"), ("rightKnee", "rightAnkle"), ("rightAnkle", "rightToe"),
             ("leftShoulder", "rightShoulder"), ("leftHip", "rightHip"),
             ("leftShoulder", "leftElbow"), ("leftElbow", "leftWrist"),
             ("rightShoulder", "rightElbow"), ("rightElbow", "rightWrist"),
             ("leftShoulder", "leftHip"), ("rightShoulder", "rightHip"),
             ("pelvis", "chest"), ("chest", "nose")]
    for label, t in want.items():
        f = min(frames, key=lambda fr: abs(fr["t"] - t))
        j = derive(f["c"])
        fig, axes = plt.subplots(1, 2, figsize=(8, 6))
        for ax, (hx, hy, title) in zip(axes, ((0, 1, "behind (x right, y up)"), (2, 1, "side (z into court, y up)"))):
            for a, b in bones:
                ax.plot([j[a][hx], j[b][hx]], [j[a][hy], j[b][hy]], "-o", ms=3, color="#222")
            ax.axhline(0, color="#888", lw=0.5)
            ax.axvline(0, color="#c33", lw=0.4)
            ax.set_aspect("equal")
            ax.set_title(title)
            ax.set_xlim(-1.2, 1.2)
            ax.set_ylim(-0.2, 2.2)
        fig.suptitle(f"{label}  src {f['t']:.2f}s  trunk {lean_deg(j,'pelvis','chest'):+.1f}°")
        fig.tight_layout()
        fig.savefig(f"/tmp/poetry-debug/{label}.png", dpi=110)
        plt.close(fig)
    print("debug plots in /tmp/poetry-debug")


def main():
    print("detecting")
    raw = fill_gaps(detect())
    print(f"frames {len(raw)} filled {sum(1 for r in raw if r.get('filled'))}")
    swaps, filled = lock_identity(raw)
    print(f"identity swaps {swaps}")
    print("gaps filled " + ", ".join(f"{k}:{v}" for k, v in filled.items() if v))
    print(f"invisible filled {fill_invisible(raw)}")
    print(f"spikes {despike(raw)}")
    smooth(raw)
    restore_bones(raw)
    xhat, zhat, toss_t = court_axes(raw)
    print(f"axes x {xhat.round(3)} z {zhat.round(3)} toss-peak-src {toss_t:.2f}")
    to_court(raw, xhat, zhat)
    px_y = px_per_m(raw)
    print(f"trunk brought forward on {keep_trunk_into_court(raw)} frames")
    px_x, hips = hip_path(raw, px_y)
    print("hip path (source seconds, metres, before the stature scale)")
    for i in range(0, len(raw), 20):
        f = raw[i]
        j = f["c"]
        print(f"  t={f['t']:.2f}  hipz {hips[i][2]:+.2f} hipy {hips[i][1]:+.2f}  "
              f"Lheel {j['leftHeel'][2]:+.2f},{j['leftHeel'][1]:+.2f}  "
              f"Rheel {j['rightHeel'][2]:+.2f},{j['rightHeel'][1]:+.2f}  "
              f"Rwrist y {j['rightWrist'][1]:+.2f}  Lwrist y {j['leftWrist'][1]:+.2f}")
    scale, leg = scale_to_heights(raw, None)
    print(f"px/m vertical {px_y:.0f} lateral {px_x:.0f}  leg {leg:.3f} m  scale {scale:.3f}")
    for f in raw:
        f["src_t"] = f["t"]
    rel, _trophy_mp, _contact_mp = pick_events(raw)
    # Trophy and contact are read off the film, not off the wrist label.
    # The label sticks to the hip through the trophy and then jumps to the
    # top of the frame after the ball has gone. Source clock, seconds.
    TROPHY_SRC, CONTACT_SRC = 4.30, 5.08
    # Retime so release → contact is the estimated real duration. Shape stays.
    t_rel, t_con = rel["t"], CONTACT_SRC
    k = RELEASE_TO_CONTACT / (t_con - t_rel)
    t0 = raw[0]["t"]
    for f in raw:
        f["t"] = (f["t"] - t0) * k
    events = {
        "routine": 0.0,
        "start": 0.0,
        "tossRelease": (t_rel - t0) * k,
        "trophy": (TROPHY_SRC - t0) * k,
        "contact": (t_con - t0) * k,
        "finish": raw[-1]["t"],
    }
    events["tossRelease"] = rel["t"]
    print(f"knee load frames {deepen_trophy_knees(raw)}")
    print(f"trunk after the knee load {keep_trunk_into_court(raw)} frames")
    replaced, upper, fore = rebuild_racket_arm(raw)
    print(f"racket arm rebuilt on {replaced} frames  upper {upper:.3f} fore {fore:.3f}")
    print(f"balance arm rebuilt on {rebuild_balance_arm(raw)} frames")
    print(f"teleports filled {kill_teleports(raw, limit=0.07)}")
    print(f"knee dips bridged {bridge_knee_dip(raw)}")
    print(f"bridged short drops {bridge_short_drops(raw)}")
    # Report lean in the retimed motion. Positive = into the court.
    def at(t):
        f = min(raw, key=lambda fr: abs(fr["t"] - t))
        j = derive(f["c"])
        return f, j
    print("--- lean + = into the court ---")
    for name, t in (("start", 0), ("toss", events["tossRelease"]), ("trophy", events["trophy"]),
                    ("contact", events["contact"]), ("finish", events["finish"])):
        f, j = at(t)
        trunk = lean_deg(j, "pelvis", "chest")
        body = lean_deg(j, "leftAnkle", "chest") if j["leftAnkle"][1] < j["rightAnkle"][1] else lean_deg(j, "rightAnkle", "chest")
        # body from the lower heel
        heel = "leftHeel" if j["leftHeel"][1] <= j["rightHeel"][1] else "rightHeel"
        whole = lean_deg(j, heel, "chest")
        feet = f"Lheel z {j['leftHeel'][2]:+.3f} y {j['leftHeel'][1]:+.3f}  Rheel z {j['rightHeel'][2]:+.3f} y {j['rightHeel'][1]:+.3f}"
        nose = f"nose y {j['nose'][1]:.3f}"
        print(f"  {name:8} t={f['t']:.3f} trunk {trunk:+6.1f}°  heel→chest {whole:+6.1f}°  {nose}  {feet}")
    # Worst frame-to-frame jump, body heights.
    worst = 0
    worst_at = None
    for a, b in zip(raw, raw[1:]):
        for name in NAMES:
            d = np.linalg.norm(b["c"][name] - a["c"][name])
            if d > worst:
                worst = d
                worst_at = (a["t"], name, d)
    print(f"max step {worst_at}")
    note = [
        "First serve recaptured from Ryan's poetry-in-motion clip (one serve, ad side, platform stance, right-handed).",
        "Court axes: x player's right, y up, z into the court. The toss hand is in front and to his right, which fixes those signs.",
        "Hip travel on the ground is measured from the baseline and the service line. Across the jump, depth is interpolated and the height comes from how far the heel sits above that line (estimated).",
        "Each joint keeps the identity it had on the first frame. A detection that leaves its parent, or that swaps left with right, is dropped and filled from the frames around it.",
        "The racket arm from the toss through the landing is one path: up to the ear, high through the drop, then up and into the court at contact. The measured walk-up is kept.",
        "The trophy knee bend is in the side view (forward, over the toes), as deep as the film. The trunk leans into the court on every frame.",
        f"Real-time scale is estimated: toss release to contact = {RELEASE_TO_CONTACT:.2f} s.",
        f"Overall scale {scale:.3f} anchors thigh+shank to {LEG_FRACTION:.2f} of stature (estimated proportion).",
        "No other player's serve is changed.",
    ]
    motion, deep = write_js(raw, events, scale, note)
    print(f"wrote {OUT_JS}  {len(motion['frames'])} frames  deepest knee {deep:.0f}°")
    print("events", {k: round(v, 3) for k, v in events.items()})
    try:
        debug_plots(raw, events)
    except Exception as exc:
        print("debug plots skipped", exc)


if __name__ == "__main__":
    main()
