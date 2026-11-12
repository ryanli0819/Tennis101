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
    print(f"unswaps {unswap(raw)}")
    print(f"invisible filled {fill_invisible(raw)}")
    print(f"spikes {despike(raw)}")
    smooth(raw)
    restore_bones(raw)
    xhat, zhat, toss_t = court_axes(raw)
    print(f"axes x {xhat.round(3)} z {zhat.round(3)} toss-peak-src {toss_t:.2f}")
    to_court(raw, xhat, zhat)
    px_y = px_per_m(raw)
    print(f"hitting-arm frames taken from the photo {lift_hitting_arm(raw, px_y)}")
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
    rel, trophy, contact = pick_events(raw)
    # Retime so release → contact is the estimated real duration. Shape stays.
    t_rel, t_con = rel["t"], contact["t"]
    k = RELEASE_TO_CONTACT / (t_con - t_rel)
    t0 = raw[0]["t"]
    for f in raw:
        f["t"] = (f["t"] - t0) * k
    events = {
        "routine": 0.0,
        "start": 0.0,
        "tossRelease": (t_rel - t0) * k,
        "trophy": (trophy["t"] / k + t0 - t0) * k if False else (trophy["t"]),  # already retimed
        "contact": (t_con - t0) * k,
        "finish": raw[-1]["t"],
    }
    # trophy["t"] was overwritten in the loop because trophy is a frame inside raw. Yes.
    events["trophy"] = trophy["t"]
    events["tossRelease"] = rel["t"]
    events["contact"] = contact["t"]
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
        "Near contact the 3D wrist collapsed. The hitting-hand height is taken from the photo, along an arm of the length measured earlier in the clip.",
        "Where monocular depth put the chest behind the hips, the upper body was rotated forward so the trunk leans into the court. The legs were not moved. A serve does not tilt away from the court.",
        f"Real-time scale is estimated: toss release to contact = {RELEASE_TO_CONTACT:.2f} s.",
        f"Overall scale {scale:.3f} anchors thigh+shank to {LEG_FRACTION:.2f} of stature (estimated proportion).",
        "No other player's serve is changed.",
    ]
    motion, deep = write_js(raw, events, scale, note)
    print(f"wrote {OUT_JS}  {len(motion['frames'])} frames  deepest knee {deep:.0f}°")
    print("events", {k: round(v, 3) for k, v in events.items()})
    debug_plots(raw, events)


if __name__ == "__main__":
    main()
