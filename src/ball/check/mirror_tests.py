"""The assertions of tests/ball.test.mjs, run on the Python mirror (for machines without Node).
Run: python3 -I src/ball/check/mirror_tests.py src/ball/check
Keep mirror.py in step with ball.js / surfaces.js when either changes."""
import sys, math, time
sys.path.insert(0, sys.argv[1])
from mirror import *
import mirror
solve = lambda frm, tgt, spd, top, side, s, thmax=40, cto=0, gyro=0, kto=0: mirror.solve(frm, tgt, spd, top, side, SURF[s], thmax, cto, gyro, kto)

def fly(p, v, w, s, until="bounce2", tmax=6):
    b = make(p, v, w); ev = []; path = []
    while b["t"] < tmax:
        step(b, SURF[s], ev)
        path.append(dict(t=b["t"], x=b["p"][0], y=b["p"][1], z=b["p"][2], vz=b["v"][2]))
        nb = sum(e[0] == "bounce" for e in ev)
        if until == "bounce1" and nb >= 1: break
        if until == "bounce2" and nb >= 2: break
        if until == "apex" and nb >= 1 and b["v"][2] < 0: break
    bounces = [dict(t=e[1], x=e[2][0], y=e[2][1], vin=e[3], vout=e[4]) for e in ev if e[0] == "bounce"]
    nets = [e[0] for e in ev if e[0] in ("cord", "cloth")]
    return bounces, nets, path

def V(speed, deg, d=(0, 1)):
    L = math.hypot(*d); th = math.radians(deg)
    return (speed*math.cos(th)*d[0]/L, speed*math.cos(th)*d[1]/L, speed*math.sin(th))

heightAt = lambda path, y: next((p["z"] for p in path if p["y"] >= y), float("nan"))
peakAfter = lambda path, t: max(p["z"] for p in path if p["t"] > t)
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m)

reb = {}
for s in SURF:
    bz, _, path = fly((0, -5, 2.54 + R), (0, 0, 0), (0, 0, 0), s, "apex")
    reb[s] = peakAfter(path, bz[0]["t"]) - R
ok(1.35 <= reb["hard"] <= 1.47 and reb["clay"] > reb["hard"] and reb["grass"] < reb["hard"], f"drop {reb}")

L = lambda top: ((0, -12, 1), V(25, 11.5), spin_vec((0, 1), top, 0))
fl = fly(*L(0), "hard", "bounce1")[0][0]["y"]; tp = fly(*L(2500), "hard", "bounce1")[0][0]["y"]; bk = fly(*L(-1500), "hard", "bounce1")[0][0]["y"]
ok(tp < fl - 1 and bk > fl, f"topspin {tp:.2f} flat {fl:.2f} back {bk:.2f}")

out = lambda rpm: fly((0, 3, R + 1e-4), (0, 20, -8), spin_vec((0, 1), rpm, 0), "hard", "bounce1")[0][0]["vout"]
ang = lambda v: math.degrees(math.atan2(v[2], v[1]))
t_, f_, b_ = out(2500), out(0), out(-1500)
ok(t_[1] > f_[1] > b_[1] and ang(t_) < ang(f_) < ang(b_), f"bounce vy {t_[1]:.1f} {f_[1]:.1f} {b_[1]:.1f} ang {ang(t_):.1f} {ang(f_):.1f} {ang(b_):.1f}")

box = lambda b: -4.115 - R <= b["x"] <= R and 0 <= b["y"] <= 6.40 + R
for s in SURF:
    frm = (0.5, -12.3, 2.9)
    for name, spd, top, side, cto, tgt in (("1st wide", 40, 600, 1200, -1, (-3.6, 5.6)), ("1st T", 44, 600, 1200, -1, (-0.4, 5.6)), ("2nd kick", 32, 3800, 800, 1, (-2.2, 5.0))):
        v, w, lp = solve(frm, tgt, spd, top, side, s, 40, cto, 1500 if name == "2nd kick" else 0, 1)
        exact = math.hypot(lp[0]-tgt[0], lp[1]-tgt[1]) < 0.1
        bz, nets, path = fly(frm, v, w, s, "bounce1")
        cross = next(p for p in path if p["y"] >= 0)
        ok(exact and not nets and cross["z"] > net_h(cross["x"]) + R and box(bz[0]), f"serve {s} {name}: net z {cross['z']:.2f} land ({bz[0]['x']:.2f},{bz[0]['y']:.2f})")

frm, tgt = (0.5, -12.3, 2.9), (-2.2, 5.0)
kv, kw, _ = solve(frm, tgt, 32, 3800, 800, "hard", 40, 1, 1500, 1); fv, fw, _ = solve(frm, tgt, 32, 0, 0, "hard")
kb, _, kp = fly(frm, kv, kw, "hard"); fb, _, fp = fly(frm, fv, fw, "hard")
turn = lambda b: math.degrees(math.atan2(b["vout"][0], b["vout"][1]) - math.atan2(b["vin"][0], b["vin"][1]))
jk = turn(kb[0]); jf = turn(fb[0])
ok(heightAt(kp, 11) > heightAt(fp, 11) and jk > 4 and abs(jf) < 1, f"kick z@11 {heightAt(kp, 11):.2f} vs {heightAt(fp, 11):.2f}, sideways at bounce {jk:.2f} vs {jf:.2f}")

pace, high = {}, {}
for s in SURF:
    pace[s] = fly((0, 3, R + 1e-4), (0, 30*math.cos(0.2793), -30*math.sin(0.2793)), (0, 0, 0), s, "bounce1")[0][0]["vout"][1]
    v, w, _ = solve((1, -12, 1), (-1.5, 9), 28, 1800, 0, s)
    high[s] = heightAt(fly((1, -12, 1), v, w, s)[2], 12.4)
ok(pace["clay"] < pace["hard"] < pace["grass"] and high["clay"] > high["hard"] > high["grass"], f"pace {pace} high {high}")

res = {}
for s in SURF:
    v, w, _ = solve((1, -12, 1), (-1.5, 3.5), 15, -2400, 0, s, 25)
    bz, _, path = fly((1, -12, 1), v, w, s)
    res[s] = (peakAfter(path, bz[0]["t"]), bz[0]["vout"][1], bz[0]["y"])
    ok(res[s][0] < 1.3 and abs(res[s][2] - 3.5) < 0.3, f"slice {s} peak {res[s][0]:.2f} land {res[s][2]:.2f} vy {res[s][1]:.2f}")
ok(res["clay"][1] < res["hard"][1] < res["grass"][1], "slice clay checks up, grass skids")

shot = lambda z0: fly((0, -1, z0), (0, 14, 0.4), spin_vec((0, 1), 1500, 0), "hard", "bounce1")
o, bk, cl, cn = shot(0.93), shot(0.88), shot(0.80), shot(0.97)
ok(o[1][:1] == ["cord"] and o[0][0]["y"] > 0 and bk[1][:1] == ["cord"] and bk[0][0]["y"] < 0 and cl[1][:1] == ["cloth"] and cl[0][0]["y"] < 0 and not cn[1],
   f"net over {o[1]} {o[0][0]['y']:.2f} back {bk[1]} {bk[0][0]['y']:.2f} cloth {cl[1]} clean {cn[1]}")

t0 = time.time(); worst = 0
for s in SURF:
    for tgt in ((-3, 7), (3.5, 10.5), (0, 8)):
        v, w, _ = solve((1, -12, 1), tgt, 30, 2000, 200, s)
        b = fly((1, -12, 1), v, w, s, "bounce1")[0][0]
        worst = max(worst, math.hypot(b["x"]-tgt[0], b["y"]-tgt[1]))
ok(worst < 0.1, f"aim worst miss {worst*100:.1f} cm ({(time.time()-t0)*1000/9:.0f} ms per solve in Python)")

# game-range check: rally shots as shots.js plays them
for s in SURF:
    for spd, top in ((25, 1500), (34, 2300)):
        for tgt in ((-2.5, 6.5), (2.5, 10.8)):
            v, w, lp = solve((1, -12, 1), tgt, spd, top, 0, s)
            bz, nets, path = fly((1, -12, 1), v, w, s)
            cross = next(p for p in path if p["y"] >= 0)
            print(f"  {s} {spd} m/s {top} rpm -> {tgt}: th {math.degrees(math.asin(v[2]/spd)):.1f} net z {cross['z']:.2f} t {bz[0]['t']:.2f} landed ({lp[0]:.2f},{lp[1]:.2f}) 2nd y {bz[1]['y'] if len(bz)>1 else float('nan'):.1f}")
