"""Python mirror of src/body/ (skeleton + exact IK + gait), for machines with no JavaScript runtime.

Run: python3 -I src/body/check/mirror.py
It follows body.js line for line (legs, pelvis, trunk, arms; not the serve playback or the three.js solver) and runs
the same checks as src/body/test/body.test.mjs: segment lengths add up to the height, knee and elbow stay in range
through a run cycle, planted toes never slide, bones keep their length, cadence rises with speed, lean follows the
acceleration, the split-step hops. Keep it in step with body.js when the gait changes.
"""
import json
import math
import sys

G, TAU, D2R = 9.81, 2 * math.pi, math.pi / 180
MOVE, HEEL_MAX = 0.35, 50
RATIO = dict(ankle=0.039, shank=0.246, thigh=0.245, trunk=0.288, neck=0.052, head=0.130, chest=0.720,
             upperArm=0.186, forearm=0.146, hand=0.108, foot=0.152, shoulderWidth=0.259, hipWidth=0.191)
LIMITS = dict(knee=135, elbow=150)


def clamp(v, a, b): return max(a, min(b, v))
def smooth(u): return u * u * (3 - 2 * u)
def V(x, y, z=0.0): return [x, y, z]
def add(a, b, k=1.0): return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def ln(a): return math.sqrt(dot(a, a))
def scl(a, k): return [a[0] * k, a[1] * k, a[2] * k]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a): l = ln(a) or 1; return [a[0] / l, a[1] / l, a[2] / l]
def lerp3(a, b, k): return [a[i] + (b[i] - a[i]) * k for i in range(3)]


def segments(H, span=0):
    L = {k: v * H for k, v in RATIO.items()}
    if span > 0:
        k = ((span - L["shoulderWidth"]) / 2) / (L["upperArm"] + L["forearm"] + L["hand"])
        for n in ("upperArm", "forearm", "hand"): L[n] *= k
    L["H"] = H
    L["ankleZ"] = L["ankle"]; L["kneeZ"] = L["ankle"] + L["shank"]; L["hipZ"] = L["kneeZ"] + L["thigh"]
    L["shoulderZ"] = L["hipZ"] + L["trunk"]; L["chinZ"] = L["shoulderZ"] + L["neck"]; L["topZ"] = L["chinZ"] + L["head"]
    L["leg"] = L["thigh"] + L["shank"]; L["arm"] = L["upperArm"] + L["forearm"]
    return L


def flexion(a, b, c):
    u, v = sub(a, b), sub(c, b)
    d = dot(u, v) / ((ln(u) * ln(v)) or 1)
    return 180 - math.degrees(math.acos(clamp(d, -1, 1)))


def frame(a, t, pole):
    d = sub(t, a); D = ln(d)
    dr = scl(d, 1 / D) if D > 1e-6 else [0, 0, -1]
    bend = sub(pole, scl(dr, dot(pole, dr)))
    if ln(bend) < 1e-6: bend = cross(dr, [0, 0, 1]) if abs(dr[2]) < 0.9 else [1, 0, 0]
    return D, dr, norm(bend)


def reach_range(l1, l2, flex_max):
    inner = math.pi - flex_max * D2R
    return math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * math.cos(inner)), (l1 + l2) * 0.9999


def two_bone(a, t, l1, l2, pole, flex_max):
    D, dr, bend = frame(a, t, pole); mn, mx = reach_range(l1, l2, flex_max)
    Dc = max(mn, min(mx, D))
    cosA = clamp((l1 * l1 + Dc * Dc - l2 * l2) / (2 * l1 * Dc), -1, 1); sinA = math.sqrt(1 - cosA * cosA)
    return add(add(a, dr, l1 * cosA), bend, l1 * sinA), add(a, dr, Dc)


def foot_geom(L):
    a, toeZ = 0.7 * L["foot"], 0.02
    return a, toeZ, math.hypot(a, L["ankleZ"] - toeZ), math.atan2(L["ankleZ"] - toeZ, a)


def toe_of(f, L):
    a, toeZ, _, _ = foot_geom(L)
    return [f["x"] + f["dir"][0] * a, f["y"] + f["dir"][1] * a, toeZ]


def ankle_at(f, L, heel):
    _, _, rho, b0 = foot_geom(L); T = toe_of(f, L); b = b0 + heel
    return [T[0] - f["dir"][0] * rho * math.cos(b), T[1] - f["dir"][1] * rho * math.cos(b), T[2] + rho * math.sin(b)]


def reach_foot(f, hip, pz, L, leg_max):
    for d in range(0, HEEL_MAX + 1, 5):
        A = ankle_at(f, L, d * D2R); h = math.hypot(hip[0] - A[0], hip[1] - A[1])
        if h >= leg_max: continue
        z_max = A[2] + math.sqrt(leg_max * leg_max - h * h)
        if z_max >= pz or d == HEEL_MAX: return d * D2R, z_max
    return HEEL_MAX * D2R, -1


def foot_dir(h, r, sd): return norm([h[0] + r[0] * sd * 0.18, h[1] + r[1] * sd * 0.18, 0])


class Body:
    def __init__(self): self.st = {}

    def step(self, i, dt, p, P, rk):
        L = segments(P["heightM"]); H = L["H"]
        R = -1 if P["side"] == "far" else 1
        s = self.st.setdefault(i, dict(t=0, phase=0, freq=0, yaw=0, acc=[0, 0], vPrev=None, feet=None, px=None, py=None,
                                       air=False, airT=0, landAt=-9, sliding=False, steps=0, H=None))
        if s["H"] != H or s["px"] is None or math.hypot(p["x"] - s["px"], p["y"] - s["py"]) > 1.0:
            s.update(H=H, feet=None, yaw=0, vPrev=None, phase=0)
        s["px"], s["py"] = p["x"], p["y"]; s["t"] += dt
        v = [p["vx"], p["vy"]]; sp = math.hypot(*v)
        if s["vPrev"] is not None and dt > 0:
            k = 1 - math.exp(-dt / 0.08)
            s["acc"][0] += ((v[0] - s["vPrev"][0]) / dt - s["acc"][0]) * k
            s["acc"][1] += ((v[1] - s["vPrev"][1]) / dt - s["acc"][1]) * k
        s["vPrev"] = v
        h0, r0 = [0, R], [R, 0]
        lat, fwd = v[0] * r0[0] + v[1] * r0[1], v[0] * h0[0] + v[1] * h0[1]
        side_run = sp > 3 and abs(lat) > 1.5 * abs(fwd)
        s["yaw"] += ((-math.copysign(1, lat) * 50 * D2R if side_run else 0) - s["yaw"]) * (1 - math.exp(-dt * 8))
        cy, sy = math.cos(s["yaw"]), math.sin(s["yaw"])
        h = [h0[0] * cy - h0[1] * sy, h0[0] * sy + h0[1] * cy, 0]; r = [h[1], -h[0], 0]
        legL, run = L["hipZ"], clamp(sp / 4, 0, 1)
        stride = legL * 2.3 * max(sp * sp / (G * legL), 1e-6) ** 0.3
        if not side_run and abs(lat) > abs(fwd): stride *= 0.6
        moving = sp > MOVE
        freq = sp / stride if moving else 0
        duty = clamp(0.62 - 0.05 * sp, 0.25, 0.62)
        swing_dur = clamp((1 - duty) / freq, 0.12, 0.5) if moving else 0.2
        half = (0.2 if p.get("receiving") else 0.16) * H * (1 - run) + 0.05 * H * run
        leg_max = 0.985 * L["leg"]
        air, slide_on, split_air = p["air"] > 0, p["slide"] > 0, 0.22
        since = s["t"] - s["landAt"]
        crouch = ((0.075 if p.get("receiving") else 0.03) * H * (1 - run) + 0.045 * H * run
                  + (rk.get("crouch", 0) * H if rk else 0)
                  + (0.07 * H * math.exp(-since / 0.15) if since < 0.6 else 0) + (0.12 * H if slide_on else 0))
        bob = -0.012 * H * run * math.cos(2 * TAU * (s["phase"] - (1 - duty / 2))) if moving else 0
        hop = 0
        if air:
            if not s["air"]:
                s["air"], s["airT"] = True, 0
                for f in s["feet"] or []: f.update(planted=False, sw=None, lift=0, frm=[f["x"], f["y"]])
            s["airT"] += dt
            u = clamp(s["airT"] / split_air, 0, 1)
            hop = 4 * (G * split_air ** 2 / 8) * u * (1 - u)
        elif s["air"]:
            s["air"], s["landAt"] = False, s["t"]
            for f in s["feet"] or []: f.update(planted=True, liftT=s["t"])
        pz = L["hipZ"] - crouch + bob + hop
        pg = [p["x"], p["y"], 0]
        lead = min(duty / freq / 2, 0.25) if moving else 0

        def home(sd, ahead):
            vz = pz - L["ankleZ"]; max_ahead = 0.85 * math.sqrt(max(0, leg_max ** 2 - vz * vz))
            dx, dy = v[0] * ahead, v[1] * ahead; m = math.hypot(dx, dy)
            if m > max_ahead: dx, dy = dx * max_ahead / m, dy * max_ahead / m
            return [pg[0] + r[0] * sd * half + dx, pg[1] + r[1] * sd * half + dy]

        def hip_of(sd): return [p["x"] + r[0] * sd * L["hipWidth"] / 2, p["y"] + r[1] * sd * L["hipWidth"] / 2]
        if s["feet"] is None:
            s["feet"] = []
            for sd in (-1, 1):
                o = home(sd, 0)
                s["feet"].append(dict(sd=sd, x=o[0], y=o[1], dir=foot_dir(h, r, sd), planted=not air, sw=None, liftT=-9, lift=0, slid=False))
        F = s["feet"]

        def lift(f, dur):
            f.update(planted=False, slid=False, sw=dict(frm=[f["x"], f["y"]], u=0, dur=dur), liftT=s["t"])
        if moving and not s["freq"]:
            far = []
            for f in F:
                o = home(f["sd"], lead); far.append(math.hypot(f["x"] - o[0], f["y"] - o[1]))
            k = 0 if far[0] >= far[1] else 1
            s["phase"] = (1.9999 - 0.5 * k) % 1
        s["freq"] = freq
        ph_before = s["phase"]
        if moving and not air and not slide_on: s["phase"] = (s["phase"] + freq * dt) % 1
        for k, f in enumerate(F):
            if air or slide_on: continue
            a, b = (ph_before + 0.5 * k) % 1, (s["phase"] + 0.5 * k) % 1
            if moving and b < a and f["planted"] and s["t"] - f["liftT"] > 0.5 / freq: lift(f, swing_dur)
        if slide_on:
            m = math.hypot(*p["slideV"]) or 1; dv = [p["slideV"][0] / m, p["slideV"][1] / m]
            side = math.copysign(1, dv[0] * r[0] + dv[1] * r[1]) if dv[0] * r[0] + dv[1] * r[1] else 1
            for f in F:
                o = 0.55 * L["leg"] if f["sd"] == side else -0.25 * L["leg"]
                f["x"] = pg[0] + dv[0] * o + r[0] * f["sd"] * 0.06 * H; f["y"] = pg[1] + dv[1] * o + r[1] * f["sd"] * 0.06 * H
                f.update(planted=False, sw=None, slid=True, lift=0)
            s["sliding"] = True
        elif s["sliding"]:
            s["sliding"] = False
            for f in F: f.update(planted=True, slid=False, liftT=s["t"])
        if air:
            for f in F:
                u = smooth(clamp(s["airT"] / split_air, 0, 1)); o = [pg[0] + r[0] * f["sd"] * 0.19 * H, pg[1] + r[1] * f["sd"] * 0.19 * H]
                frm = f.get("frm") or [f["x"], f["y"]]
                f["x"] = frm[0] + (o[0] - frm[0]) * u; f["y"] = frm[1] + (o[1] - frm[1]) * u; f["dir"] = foot_dir(h, r, f["sd"])
        if not moving and not air and not slide_on:
            for k, f in enumerate(F):
                o, other = home(f["sd"], 0), F[1 - k]
                if f["planted"] and other["planted"] and math.hypot(f["x"] - o[0], f["y"] - o[1]) > 0.11 * H: lift(f, 0.2)
        heel = [0, 0]
        for k, f in enumerate(F):
            if not f["planted"]: continue
            hd, z_max = reach_foot(f, hip_of(f["sd"]), pz, L, leg_max)
            drop, other = pz - z_max, F[1 - k]
            if drop > 0.02 * H and (moving or drop > 0.06 * H) and not (other["sw"] and other["sw"]["u"] < 0.3 and not moving):
                lift(f, min(swing_dur, 0.3)); continue
            heel[k] = hd; pz = min(pz, max(z_max, pz - 0.06 * H))
        pz = max(pz, L["ankleZ"] + 1.05 * reach_range(L["thigh"], L["shank"], LIMITS["knee"])[0])
        for f in F:
            if not f["sw"]: continue
            sw = f["sw"]; sw["u"] = min(1, sw["u"] + (dt / sw["dur"] if dt > 0 else 0))
            rem, o = (1 - sw["u"]) * sw["dur"], home(f["sd"], lead)
            tg = [o[0] + v[0] * rem, o[1] + v[1] * rem]; e = smooth(sw["u"])
            f["x"] = sw["frm"][0] + (tg[0] - sw["frm"][0]) * e; f["y"] = sw["frm"][1] + (tg[1] - sw["frm"][1]) * e
            f["dir"] = norm(lerp3(f["dir"], foot_dir(h, r, f["sd"]), min(1, e + 0.2)))
            f["lift"] = (0.05 + 0.05 * run) * H * math.sin(math.pi * sw["u"])
            if sw["u"] >= 1: f.update(sw=None, planted=True, lift=0); s["steps"] += 1
        J = {}
        pel = [p["x"], p["y"], pz]; J["pelvis"] = pel
        J["leftHip"] = hip_of(-1) + [pz]; J["rightHip"] = hip_of(1) + [pz]
        lean_a = clamp(math.hypot(*s["acc"]) / G, 0, 0.45); am = math.hypot(*s["acc"]) or 1
        lx = s["acc"][0] / am * lean_a + (v[0] / sp * 0.06 * run if sp > 0.01 else 0)
        ly = s["acc"][1] / am * lean_a + (v[1] / sp * 0.06 * run if sp > 0.01 else 0)
        bend = (0.36 if p.get("receiving") else 0.08) + (rk.get("crouch", 0) * 3 if rk else 0) + (0.25 * math.exp(-since / 0.15) if since < 0.6 else 0)
        lx += h[0] * bend; ly += h[1] * bend
        if slide_on:
            m = math.hypot(*p["slideV"]) or 1; lx -= p["slideV"][0] / m * 0.3; ly -= p["slideV"][1] / m * 0.3
        lm = math.hypot(lx, ly)
        if lm > 0.7: lx, ly = lx * 0.7 / lm, ly * 0.7 / lm
        up = norm([lx, ly, 1])
        J["chest"] = add(pel, up, RATIO["chest"] * H - L["hipZ"])
        sm = add(pel, up, L["trunk"]); J["neck"] = add(sm, up, L["neck"])
        tilt = rk.get("tilt", 0) * H if rk else 0
        wristR = add(rk["g"], rk["u"], -0.4 * L["hand"]) if rk else None
        wristL = (add(rk["g"], rk["u"], 0.09 - 0.4 * L["hand"]) if rk.get("twoHands") else add(rk["g"], rk["u"], 0.22) if rk.get("throat") else None) if rk else None

        def shoulders(tw):
            c, sn = math.cos(tw), math.sin(tw); rc = [r[0] * c - r[1] * sn, r[0] * sn + r[1] * c, 0]
            return add(add(sm, rc, -L["shoulderWidth"] / 2), [0, 0, 1], tilt / 2), add(add(sm, rc, L["shoulderWidth"] / 2), [0, 0, 1], -tilt / 2)
        twist = 0
        if wristR:
            def ok(tw):
                sl, sr = shoulders(tw)
                return ln(sub(wristR, sr)) <= 0.98 * L["arm"] and (not wristL or ln(sub(wristL, sl)) <= 0.98 * L["arm"])
            if not ok(0):
                for d in range(5, 61, 5):
                    if ok(d * D2R): twist = d * D2R; break
                    if ok(-d * D2R): twist = -d * D2R; break
        J["leftShoulder"], J["rightShoulder"] = shoulders(twist)
        arm_swing = 0.35 * run * math.sin(TAU * s["phase"])

        def free_hand(sh, sd): return add(add(add(sh, [0, 0, 1], -(0.92 - 0.25 * run) * L["arm"]), h, sd * arm_swing * L["arm"]), r, sd * 0.06)

        def arm(sd, target):
            sh = J["leftShoulder"] if sd < 0 else J["rightShoulder"]
            pole = [-h[0] * 0.3 + r[0] * sd * 0.5, -h[1] * 0.3 + r[1] * sd * 0.5, -1]
            return two_bone(sh, target or free_hand(sh, sd), L["upperArm"], L["forearm"], pole, LIMITS["elbow"])
        J["rightElbow"], J["rightWrist"] = arm(1, wristR)
        J["leftElbow"], J["leftWrist"] = arm(-1, wristL)
        feet = []
        for k, f in enumerate(F):
            nm, hp = ("left", J["leftHip"]) if f["sd"] < 0 else ("right", J["rightHip"])
            A = ankle_at(f, L, heel[k]) if f["planted"] else [f["x"], f["y"], L["ankleZ"] + (hop if air else 0) + f.get("lift", 0)]
            d = sub(A, hp); dl = ln(d)
            if not f["planted"] and dl > leg_max: A = add(hp, d, leg_max / dl)
            pole = [f["dir"][0] + r[0] * f["sd"] * 0.15, f["dir"][1] + r[1] * f["sd"] * 0.15, 0.1]
            J[nm + "Knee"], J[nm + "Ankle"] = two_bone(hp, A, L["thigh"], L["shank"], pole, LIMITS["knee"])
            feet.append(dict(planted=f["planted"], slid=f.get("slid", False), toe=toe_of(f, L), ankleMiss=ln(sub(J[nm + "Ankle"], A))))
        return dict(joints=J, feet=feet)


PLAYERS = [dict(id="sinner", heightM=1.91, side="near"), dict(id="alcaraz", heightM=1.83, side="far")]
fails = passes = 0


def ok(c, msg):
    global fails, passes
    if c: passes += 1
    else: fails += 1; print("FAIL", msg)


def drive(T, vel, air=None, slide=None, racket=True):
    body = Body(); dt = 1 / 60; out = []
    pos = [dict(x=0, y=-12, vx=0, vy=0, air=0, slide=0, slideV=[0, 0]), dict(x=0, y=12, vx=0, vy=0, air=0, slide=0, slideV=[0, 0])]
    n = 0
    while n * dt < T:
        t = n * dt
        for i, p in enumerate(pos):
            w = vel(t, i); dvx, dvy = w[0] - p["vx"], w[1] - p["vy"]; dl = math.hypot(dvx, dvy)
            rate = (11 if dvx * p["vx"] + dvy * p["vy"] < 0 else 8.6) * dt
            if dl > 1e-9 and not p["air"] > 0: k = min(1, rate / dl); p["vx"] += dvx * k; p["vy"] += dvy * k
            if air and air(t, i) and not p["air"] > 0: p["air"] = 0.22
            if p["air"] > 0: p["air"] -= dt
            if slide and slide(t, i) and not p["slide"] > 0: p["slide"] = 0.32; p["slideV"] = [p["vx"] * 1.4, p["vy"] * 1.4]
            if p["slide"] > 0:
                p["slide"] = max(0, p["slide"] - dt); k = p["slide"] / 0.32; p["vx"], p["vy"] = p["slideV"][0] * k, p["slideV"][1] * k
            p["x"] += p["vx"] * dt; p["y"] += p["vy"] * dt
        poses = []
        for i, p in enumerate(pos):
            R = 1 if PLAYERS[i]["side"] == "near" else -1
            rk = dict(g=[p["x"] + R * 0.4, p["y"] + R * 0.18, 0.96], u=[R * 0.34 / 1.05, R * 0.3 / 1.05, 0.89 / 1.05], throat=True) if racket else None
            poses.append(body.step(i, dt, p, PLAYERS[i], rk))
        out.append(dict(t=t, pose=json.loads(json.dumps(poses))))
        n += 1
    return out, body


def check_limbs(frames, label):
    kmin = emin = 999; kmax = emax = slide = bone = miss = 0
    for n, f in enumerate(frames):
        for i in (0, 1):
            J, L = f["pose"][i]["joints"], segments(PLAYERS[i]["heightM"])
            for s in ("left", "right"):
                k = flexion(J[s + "Hip"], J[s + "Knee"], J[s + "Ankle"]); e = flexion(J[s + "Shoulder"], J[s + "Elbow"], J[s + "Wrist"])
                kmin, kmax, emin, emax = min(kmin, k), max(kmax, k), min(emin, e), max(emax, e)
                bone = max(bone, abs(ln(sub(J[s + "Hip"], J[s + "Knee"])) - L["thigh"]), abs(ln(sub(J[s + "Knee"], J[s + "Ankle"])) - L["shank"]),
                           abs(ln(sub(J[s + "Shoulder"], J[s + "Elbow"])) - L["upperArm"]), abs(ln(sub(J[s + "Elbow"], J[s + "Wrist"])) - L["forearm"]))
            for k, ft in enumerate(f["pose"][i]["feet"]):
                if ft["planted"]: miss = max(miss, ft["ankleMiss"])
                if n:
                    pr = frames[n - 1]["pose"][i]["feet"][k]
                    if ft["planted"] and pr["planted"] and not ft["slid"]:
                        slide = max(slide, math.hypot(ft["toe"][0] - pr["toe"][0], ft["toe"][1] - pr["toe"][1]))
    ok(kmin >= 0 and kmax <= LIMITS["knee"] + 0.5, f"{label}: knee {kmin:.1f}–{kmax:.1f}°")
    ok(emin >= 0 and emax <= LIMITS["elbow"] + 0.5, f"{label}: elbow {emin:.1f}–{emax:.1f}°")
    ok(slide < 1e-9, f"{label}: a planted toe slid {slide} m")
    ok(bone < 1e-3, f"{label}: a bone changed length by {bone} m")
    ok(miss < 0.01, f"{label}: a planted ankle missed its spot by {miss:.3f} m")
    print(f"  {label}: knee {kmin:.0f}–{kmax:.0f}°, elbow {emin:.0f}–{emax:.0f}°, worst planted-ankle miss {miss * 100:.1f} cm")


for P in PLAYERS:
    L = segments(P["heightM"])
    ok(abs(L["ankle"] + L["shank"] + L["thigh"] + L["trunk"] + L["neck"] + L["head"] - P["heightM"]) < 1e-9, f"{P['id']}: column")
    ok(abs(L["topZ"] - P["heightM"]) < 1e-9, f"{P['id']}: top of head")
L = segments(1.91, 1.98)
ok(abs(L["shoulderWidth"] + 2 * (L["upperArm"] + L["forearm"] + L["hand"]) - 1.98) < 1e-9, "armSpanM rescales the arms")


def rally_vel(t, i):
    if t < 1.5: return [6.6, 0]
    if t < 3: return [-6.6, 0]
    if t < 4.5: return [0, (-1 if i else 1) * 5]
    if t < 6: return [0, (1 if i else -1) * 3]
    if t < 7.5: return [2 * math.sin(t * 3), 0]
    return [4, 0]


R1, _ = drive(9, rally_vel, air=lambda t, i: abs(t - 7.6) < 0.01, slide=lambda t, i: abs(t - 8.4) < 0.01)
check_limbs(R1, "rally footwork")
R2, _ = drive(9, rally_vel, air=lambda t, i: abs(t - 7.6) < 0.01, slide=lambda t, i: abs(t - 8.4) < 0.01, racket=False)
check_limbs(R2, "free arms")


def steps(sp): return drive(3, lambda t, i: [0, sp])[1].st[0]["steps"]   # running forward (no side shuffle)
s2, s6 = steps(2), steps(6)
ok(s6 > s2, f"cadence {s2} vs {s6}")
print(f"  cadence: {s2} steps in 3 s at 2 m/s, {s6} at 6 m/s")

f, _ = drive(1.2, lambda t, i: [6.6 if t < 0.7 else 0, 0])
at = lambda t: next(q for q in f if q["t"] >= t)["pose"][0]["joints"]
a, b = at(0.2), at(0.85)
ok(a["chest"][0] - a["pelvis"][0] > 0.03, f"lean forward {a['chest'][0] - a['pelvis'][0]:.3f}")
ok(b["chest"][0] - b["pelvis"][0] < -0.01, f"lean back {b['chest'][0] - b['pelvis'][0]:.3f}")
print(f"  lean: chest {100 * (a['chest'][0] - a['pelvis'][0]):.0f} cm ahead speeding up, {100 * (b['pelvis'][0] - b['chest'][0]):.0f} cm behind braking")

f, _ = drive(1.2, lambda t, i: [0, 0], air=lambda t, i: abs(t - 0.5) < 0.01)
z = lambda t: next(q for q in f if q["t"] >= t)["pose"][0]["joints"]["pelvis"][2]
base, top, land = z(0.45), z(0.61), z(0.8)
ok(top - base > 0.04, f"hop {top - base:.3f}")
ok(land < base - 0.02, f"landing crouch {base - land:.3f}")
ok(all(not ft["planted"] for ft in next(q for q in f if q["t"] >= 0.61)["pose"][0]["feet"]), "feet off the ground")
print(f"  split-step: hop {100 * (top - base):.1f} cm, landing crouch {100 * (base - land):.1f} cm")

print(f"{passes} passed, {fails} failed")
sys.exit(1 if fails else 0)
