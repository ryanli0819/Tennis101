"""Python mirror of src/ball/ball.js (same equations, same fixed step) used to tune and check numbers
while no JS runtime is available. Semi-implicit Euler like cannon-es Body.integrate."""
import math, random

M, R = 0.0577, 0.0335
A = math.pi * R * R
RHO, CD, G = 1.2, 0.55, 9.81
KD = 0.5 * RHO * CD * A / M
KL = 0.5 * RHO * A / M
TAU_SPIN = 6.0
ALPHA = 0.55          # I / (m R^2), thin-walled pressurised ball (Cross 2002)
H = 1 / 480
NET_C, NET_P, POST_X = 0.914, 1.07, 6.40
CORD_R = 0.02

SURF = {
    "hard":  dict(e=0.775, slope=0.004, mu=0.60, ex=0.10),
    "clay":  dict(e=0.795, slope=0.006, mu=0.80, ex=0.25),
    "grass": dict(e=0.715, slope=0.004, mu=0.48, ex=0.0),
}

def cl(v, w):
    if v < 1e-6 or w < 1e-6: return 0.0
    S = R * w / v
    return min(0.35, 1 / (2 + 1 / S))

def accel(v, w):
    sp = math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
    ax = -KD * sp * v[0]; ay = -KD * sp * v[1]; az = -KD * sp * v[2] - G
    wm = math.sqrt(w[0]**2 + w[1]**2 + w[2]**2)
    if wm > 1e-6 and sp > 1e-6:
        c = cl(sp, wm)
        cx = w[1]*v[2] - w[2]*v[1]; cy = w[2]*v[0] - w[0]*v[2]; cz = w[0]*v[1] - w[1]*v[0]
        cm = math.sqrt(cx*cx + cy*cy + cz*cz)
        if cm > 1e-9:
            f = KL * c * sp * sp / cm
            ax += f*cx; ay += f*cy; az += f*cz
    return ax, ay, az

def net_h(x):
    return NET_C + (NET_P - NET_C) * min(1.0, abs(x) / POST_X)

def bounce(b, s):
    v, w = b["v"], b["w"]
    vn = -v[2]
    e = max(0.5, s["e"] - s["slope"] * max(0.0, vn - 7))
    vz2 = e * vn
    # contact point velocity (horizontal)
    cx = v[0] - R * w[1]; cy = v[1] + R * w[0]
    cs = math.hypot(cx, cy)
    k = 1 + 1 / ALPHA
    if cs > 1e-9:
        jmax = s["mu"] * (1 + e) * vn          # per unit mass
        jgrip = (1 + s['ex']) * cs / k
        j = min(jmax, jgrip)
        jx, jy = -j * cx / cs, -j * cy / cs
        v[0] += jx; v[1] += jy
        I = ALPHA * R * R   # per unit mass
        w[0] += R * jy / I; w[1] += -R * jx / I
        b["grip"] = jgrip <= jmax
    v[2] = vz2
    b["p"][2] = max(b["p"][2], R)

def cord(b, prev):
    """Swept test of the ball against the net (cloth plane y=0 below the cord, cord cylinder on top)."""
    p, v, w = b["p"], b["v"], b["w"]
    y0, y1 = prev[1], p[1]
    # cord: distance in y-z plane from the axis (y=0, z=h-r) at closest point of the segment
    best = None
    n = 8
    for i in range(n + 1):
        u = i / n
        x = prev[0] + (p[0]-prev[0])*u; y = y0 + (y1-y0)*u; z = prev[2] + (p[2]-prev[2])*u
        if abs(x) > POST_X: continue
        az = net_h(x) - CORD_R
        d = math.hypot(y, z - az)
        if d < R + CORD_R and (best is None or u < best[0]):
            best = (u, x, y, z, az, d)
            break
    if (y0 < 0) != (y1 < 0) and best is None:
        u = y0 / (y0 - y1)
        x = prev[0] + (p[0]-prev[0])*u; z = prev[2] + (p[2]-prev[2])*u
        if abs(x) <= POST_X and z < net_h(x) - CORD_R:
            # into the cloth: the ball dies and drops on the hitter's side
            s = 1 if y0 > 0 else -1
            p[0], p[1], p[2] = x, s*(R+0.01), z
            v[0] *= 0.25; v[1] = -0.1 * v[1]; v[2] = min(v[2], 0) * 0.3
            for k in range(3): w[k] *= 0.3
            return "cloth"
        return None
    if best is None: return None
    u, x, y, z, az, d = best
    ny, nz = y / d, (z - az) / d
    vn = v[1]*ny + v[2]*nz
    if vn >= 0: return None
    # normal: low restitution; tangential friction
    ty, tz = -nz, ny
    vt = v[1]*ty + v[2]*tz
    vn2 = -0.3 * vn
    vt2 = vt * 0.8
    v[1] = vn2*ny + vt2*ty; v[2] = vn2*nz + vt2*tz; v[0] *= 0.85
    for k in range(3): w[k] *= 0.5
    p[0], p[1], p[2] = x, ny*(R+CORD_R+1e-3), az + nz*(R+CORD_R+1e-3)
    return "cord"

def step(b, s, events):
    v, w, p = b["v"], b["w"], b["p"]
    ax, ay, az = accel(v, w)
    decay = math.exp(-H / TAU_SPIN)
    w[0] *= decay; w[1] *= decay; w[2] *= decay
    v[0] += ax*H; v[1] += ay*H; v[2] += az*H
    prev = list(p)
    p[0] += v[0]*H; p[1] += v[1]*H; p[2] += v[2]*H
    b["t"] += H
    r = cord(b, prev)
    if r: events.append((r, b["t"], tuple(p), tuple(v)))
    if p[2] < R and v[2] < 0:
        before = tuple(v)
        bounce(b, s)
        events.append(("bounce", b["t"], tuple(p), before, tuple(v)))

def make(p, v, w=(0, 0, 0)):
    return dict(p=list(p), v=list(v), w=list(w), t=0.0)

def run(b, s, until=lambda b, ev: False, tmax=6):
    ev = []
    traj = []
    while b["t"] < tmax:
        step(b, s, ev)
        traj.append((b["t"], *b["p"]))
        if until(b, ev): break
    return ev, traj

def spin_vec(d, top_rpm, side_rpm, gyro_rpm=0):
    w = 2 * math.pi / 60
    L = math.hypot(*d); dx, dy = d[0]/L, d[1]/L
    return ((-dy * top_rpm + dx * gyro_rpm) * w, (dx * top_rpm + dy * gyro_rpm) * w, side_rpm * w)

def first_landing(p, v, w, s):
    b = make(p, v, w)
    ev, _ = run(b, s, lambda b, ev: any(e[0] in ("bounce", "cloth") for e in ev), 5)
    for e in ev:
        if e[0] == "bounce": return e[2], ev
        if e[0] == "cloth": return None, ev
    return None, ev

def solve(frm, tgt, speed, top, side, s, thmax=40, curveTo=0, gyro=0, kickTo=0):
    """Elevation by secant/bisection on along-range, azimuth by fixed point on the lateral miss."""
    aim = [tgt[0], tgt[1]]
    best = None
    for outer in range(4):
        dx, dy = aim[0]-frm[0], aim[1]-frm[1]
        L = math.hypot(dx, dy); d = (dx/L, dy/L)
        sd = abs(side) * (1 if (curveTo * -d[1]) >= 0 else -1) if curveTo else side
        if curveTo and curveTo * -d[1] == 0: sd = abs(side)
        gy = abs(gyro) * (1 if (kickTo * d[1]) >= 0 else -1) if kickTo else gyro
        w = spin_vec(d, top, sd, gy)
        def rng(th):
            v = (speed*math.cos(th)*d[0], speed*math.cos(th)*d[1], speed*math.sin(th))
            lp, ev = first_landing(frm, v, w, s)
            if lp is None or (lp[1] > 0) != (tgt[1] > 0) or any(e[0] == "cord" for e in ev):   # touched the net: too low
                return -1.0, None, v
            return (lp[0]-frm[0])*d[0] + (lp[1]-frm[1])*d[1], lp, v
        want = (tgt[0]-frm[0])*d[0] + (tgt[1]-frm[1])*d[1]
        lo, hi = math.radians(-20), math.radians(thmax)
        for it in range(18):
            mid = (lo+hi)/2
            r, lp, v = rng(mid)
            if r < want: lo = mid
            else: hi = mid
        r, lp, v = rng((lo+hi)/2)
        if lp is None: r, lp, v = rng(hi)
        if lp is None: return None
        best = (v, w, lp)
        ex, ey = tgt[0]-lp[0], tgt[1]-lp[1]
        if math.hypot(ex, ey) < 0.03: break
        aim[0] += ex; aim[1] += ey
    return best

if __name__ == "__main__":
    print("KD", KD, "KL", KL)
    # ITF drop test
    for name, s in SURF.items():
        b = make((0, -5, 2.54 + R), (0, 0, 0))
        ev, traj = run(b, s, lambda b, ev: any(e[0]=="bounce" for e in ev) and b["v"][2] < 0, 4)
        top = max(z for t, x, y, z in traj if t > ev[0][1])
        print(f"drop {name}: rebound {top - R:.3f} m (bottom of ball)  impact {ev[0][3][2]:.2f}")
    # CPR-like oblique test: 30 m/s at 16 deg, no spin
    for name, s in SURF.items():
        b = make((0, 0, R + 1e-4), (0, 30*math.cos(math.radians(16)), -30*math.sin(math.radians(16))))
        ev, _ = run(b, s, lambda b, ev: len(ev) > 0, 1)
        _, _, p, vi, vo = ev[0]
        mu_eff = (vi[1]-vo[1]) / (vo[2]-vi[2]); e_eff = vo[2] / -vi[2]
        print(f"oblique {name}: vy {vi[1]:.1f}->{vo[1]:.1f}  vz {vi[2]:.2f}->{vo[2]:.2f}  mu_eff {mu_eff:.2f} e {e_eff:.2f} angle out {math.degrees(math.atan2(vo[2], vo[1])):.1f}")
    # spin and bounce angle, same incoming velocity
    s = SURF["hard"]
    for lab, wx in (("top", -2500), ("flat", 0), ("back", 1500)):
        w = wx*2*math.pi/60
        b = make((0, 0, R + 1e-4), (0, 20, -8), (w, 0, 0))
        ev, _ = run(b, s, lambda b, ev: len(ev) > 0, 1)
        vo = ev[0][4]
        print(f"bounce {lab}: out vy {vo[1]:.2f} vz {vo[2]:.2f} angle {math.degrees(math.atan2(vo[2], vo[1])):.1f}")
    # topspin lands shorter than flat, same launch
    for lab, top in (("flat", 0), ("top", 2500)):
        lp, _ = first_landing((0, -12, 1.0), (0, 25*math.cos(0.2), 25*math.sin(0.2)), spin_vec((0, 1), top, 0), s)
        print(f"launch 25 m/s 11.5deg {lab}: lands y={lp[1]:.2f}")
    # typical rally shots per surface: bounce height + height when reaching y = 12.4 (behind baseline)
    import time
    for name, s in SURF.items():
        for lab, spd, top, ty in (("drive", 24, 2400, 9.0), ("flat", 26, 300, 9.0), ("slice", 15, -2400, 3.5)):
            t0 = time.time()
            sol = solve((1.0, -12.0, 1.0), (-1.5, ty), spd, top, 0, s, 25 if top < 0 else 40)
            v, w, lp = sol
            b = make((1.0, -12.0, 1.0), v, w)
            ev, traj = run(b, s, lambda b, ev: sum(e[0]=="bounce" for e in ev) >= 2, 6)
            bz = [e for e in ev if e[0]=="bounce"]
            tb = bz[0][1]
            post = [r for r in traj if r[0] > tb]
            peak = max(post, key=lambda r: r[3])
            netz = min((r for r in traj if r[2] > 0), key=lambda r: r[0])[3]
            at = next((r for r in post if r[2] >= 12.4), None)
            second = bz[1][2] if len(bz) > 1 else None
            print(f"{name:5s} {lab:5s} th={math.degrees(math.asin(v[2]/spd)):5.1f} net z={netz:.2f} land=({lp[0]:.2f},{lp[1]:.2f}) t={tb:.2f}"
                  f" in vz={bz[0][3][2]:.1f} out v=({bz[0][4][1]:.1f},{bz[0][4][2]:.1f}) peak z={peak[3]:.2f}@y={peak[2]:.1f}"
                  f" z@12.4={(at[3] if at else float('nan')):.2f} 2nd y={second[1] if second else float('nan'):.1f}  solve {1000*(time.time()-t0):.0f}ms")
    # serves: from (0.5, -12.3, 2.9) into the deuce box of the far court (x in [-4.115, 0], y in [0, 6.4])
    for name, s in SURF.items():
        for lab, spd, top, side, tgt in (("1st", 40, 600, -1200, (-3.6, 5.6)), ("1st-T", 44, 600, -1200, (-0.4, 5.6)), ("2nd", 32, 3800, 1800, (-2.2, 5.0))):
            sol = solve((0.5, -12.3, 2.9), tgt, spd, top, side, s)
            if not sol: print(name, lab, "no solution"); continue
            v, w, lp = sol
            b = make((0.5, -12.3, 2.9), v, w)
            ev, traj = run(b, s, lambda b, ev: sum(e[0]=="bounce" for e in ev) >= 2, 6)
            bz = [e for e in ev if e[0]=="bounce"]
            netz = min((r for r in traj if r[2] > 0), key=lambda r: r[0])[3]
            at = next((r for r in traj if r[2] >= 12.4), None)
            print(f"{name:5s} serve {lab}: th={math.degrees(math.asin(v[2]/spd)):5.1f} net z={netz:.2f} land=({lp[0]:.2f},{lp[1]:.2f}) t={bz[0][1]:.2f} speed at bounce={math.sqrt(sum(c*c for c in bz[0][3])):.1f}"
                  f" out=({bz[0][4][0]:.1f},{bz[0][4][1]:.1f},{bz[0][4][2]:.1f}) z@12.4={(at[3] if at else float('nan')):.2f} x@12.4={(at[1] if at else float('nan')):.2f}")
    # net cord: a drive that just clips the tape
    s = SURF["hard"]
    for z0 in (0.80, 0.84, 0.86, 0.88, 0.90, 0.92, 0.93, 0.95):
        b = make((0, -1.0, z0), (0, 14, 0.4), spin_vec((0, 1), 1500, 0))
        ev, traj = run(b, s, lambda b, ev: any(e[0]=="bounce" for e in ev), 3)
        print("cord test z0", z0, [(e[0], round(e[2][1], 2)) for e in ev])
