"""SERVE CHECKLIST: whose serve footage is in the project and whose Ryan still needs to fetch.

    python3 -I tools/intake/serve_checklist.py      # writes datasets/footage/SERVE_CHECKLIST.md and prints it

Run it again after every inbox drop. It reads only what is on disk:
- the roster (src/serve/motion/roster-serves.js),
- the pros whose live serve follows their own clip (CLIP_PLAYERS in datasets/serves/tools/stabilize_serves.py, plus
  Alcaraz's tracked serve),
- serve videos filed by the intake (datasets/serves/<id>/, datasets/video/<id>/serve*/), and which of them the motion
  files already use,
- segments of Ryan's slow-motion compilation that already have keypoints (datasets/footage/top20.json),
- links to fetch (top20.json plus the ones checked on Nov 24),
- PICTURE QUALITY of every own serve clip (Ryan, Nov 27: "make sure the image quality is good, so that you could
  identify everything; I'll fetch things again if the quality isn't clear enough"), from its keypoints file:
  how tall the player is in the picture (pixels, median over the clip), how sure the body tracker is of his joints
  (median confidence), frame rate and frame size. Grades (GAME-DESIGN thresholds for reading joints by eye and by the
  tracker): GOOD = player ≥ 550 px tall and confidence ≥ 0.6; USABLE = ≥ 350 px and ≥ 0.45; REFETCH otherwise.
"""
import glob, json, math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "datasets/footage/SERVE_CHECKLIST.md")
VIDEO = (".mov", ".mp4", ".m4v")

roster = re.findall(r'id: "([a-z-]+)", name: "([^"]+)", hand: "([LR])"', open(os.path.join(ROOT, "src/serve/motion/roster-serves.js")).read())
stab = open(os.path.join(ROOT, "datasets/serves/tools/stabilize_serves.py")).read()
clip_players = set(re.search(r"CLIP_PLAYERS = \[([^\]]*)\]", stab).group(1).replace('"', "").replace(" ", "").split(","))
clip_players.add("alcaraz")                                  # alcaraz-tracked.js (Ryan's leg-overlay clip)
used_text = "".join(open(f).read()[:400000] for f in glob.glob(os.path.join(ROOT, "src/serve/motion/*-serve.js")))
used_text += open(os.path.join(ROOT, "datasets/serves/tools/export_motion.py")).read()
used_text += open(os.path.join(ROOT, "datasets/serves/tools/alcaraz_legs_arms.py")).read()
top = json.load(open(os.path.join(ROOT, "datasets/footage/top20.json")))
PEOPLE = {p["id"]: p for p in top["players"] + top.get("extra", []) + top.get("legends", [])}

# Checked by watching on Nov 24 (✓ = a clean serve seen at those seconds); the rest come from top20.json.
CHECKED = {
    "djokovic": [("1st", "https://www.youtube.com/watch?v=32nyPw9YUEA", "✓ 95-103 s, court level"),
                 ("2nd", "https://www.youtube.com/watch?v=Qi7EhhmxxbY", "kick serve, back view (not watched yet)"),
                 ("2nd", "https://www.youtube.com/watch?v=1pcSmqbJ3bI", "1st and 2nd serve (not watched yet)")],
    "nadal": [("1st", "https://www.youtube.com/watch?v=VXTxuWxafKg", "super slow motion, Cincinnati 2013")],
    "kyrgios": [("1st", "https://www.youtube.com/watch?v=oZ7hwsx1MmU", "✓ 4-16 s")],
    "medvedev": [("1st", "https://www.youtube.com/watch?v=ZJ39LcNagSM", "✓ 31-39 s, from behind")],
    "cobolli": [("1st", "https://www.youtube.com/watch?v=XewX3v0Ku6o", "✓ 16-24 s"), ("2nd", "https://www.youtube.com/watch?v=iTzvJaTh9SQ", "spin serve")],
    "fils": [("1st", "https://www.youtube.com/watch?v=LvA9IJcS2ok", "✓ about 380-391 s, front view")],
    "de-minaur": [("1st", "https://www.youtube.com/watch?v=LvA9IJcS2ok", "✓ from 4:10, front view"), ("2nd", "https://www.youtube.com/watch?v=2TUIxZtAWnM", "slice serve")],
    "jodar": [("1st", "https://www.youtube.com/watch?v=jNnhYeRfyYo", "✓ 26-38 s")],
}


def own_videos(pid):
    seen, out = set(), []
    for pat in (f"datasets/serves/{pid}/*", f"datasets/video/{pid}/serve*/*"):
        for f in glob.glob(os.path.join(ROOT, pat)):
            if f.lower().endswith(VIDEO) and f.lower() not in seen:
                seen.add(f.lower()); out.append(os.path.relpath(f, ROOT))
    return sorted(out)


def quality(video):
    """Grade one clip. Two independent trackers: Apple Vision (<clip>.keypoints.json, the intake) and YOLO11m-pose
    (<clip>.yolo.keypoints.json, tools/intake/yolo_pose.py). A tracker's own confidence can be confidently wrong, so the
    grade rests on where the two AGREE: the median distance between the same joint in both, as % of the player's
    height (Nov 27). Also: how tall the player is in the picture, and YOLO's median joint confidence.
    GOOD = player >= 550 px, trackers within 4 % of his height, YOLO confidence >= 0.6; USABLE = >= 350 px and within
    8 %, or a small player (>= 250 px) both read within 3 % with YOLO >= 0.85 (body readable, hands and racket too
    small); REFETCH otherwise (GAME-DESIGN thresholds). Without a YOLO file it falls back to Vision's confidence."""
    base = os.path.splitext(os.path.join(ROOT, video))[0].replace(" ", "-")
    kp, yk = base + ".keypoints.json", base + ".yolo.keypoints.json"
    if not os.path.exists(kp):
        return None
    d = json.load(open(kp)); W, H = d.get("width") or 0, d.get("height") or 0
    V = {f["i"]: f.get("joints") or {} for f in d.get("frames", [])}
    tall, conf = [], []
    for j in V.values():
        ys = [v[1] for v in j.values()]; cs = [v[2] for v in j.values() if len(v) > 2]
        if len(ys) >= 8:
            tall.append((max(ys) - min(ys)) * H / 0.9)        # nose-to-ankle is ~0.9 of standing height
            conf.append(sorted(cs)[len(cs) // 2])
    if not tall:
        return {"grade": "REFETCH", "why": "no player found", "size": f"{W}x{H}", "fps": round(d.get("fps", 0))}
    tall.sort(); conf.sort()
    px, c = tall[len(tall) // 2], conf[len(conf) // 2]
    q = {"px": round(px), "conf": round(c, 2), "size": f"{W}x{H}", "fps": round(d.get("fps", 0))}
    agree = yconf = None
    if os.path.exists(yk):
        Y = {f["i"]: f.get("joints") or {} for f in json.load(open(yk)).get("frames", [])}
        gaps, ycs = [], []
        for i, vj in V.items():
            yj = Y.get(i) or {}
            for n in vj:
                if n in yj:
                    gaps.append(math.hypot((vj[n][0] - yj[n][0]) * W, (vj[n][1] - yj[n][1]) * H) / px * 100)
            ycs += [v[2] for v in yj.values()]
        if gaps:
            gaps.sort(); ycs.sort()
            agree, yconf = gaps[len(gaps) // 2], ycs[len(ycs) // 2]
            q.update(agreePct=round(agree, 1), yoloConf=round(yconf, 2))
    why = []
    if agree is not None:
        grade = ("GOOD" if px >= 550 and agree <= 4 and yconf >= 0.6
                 else "USABLE" if (px >= 350 and agree <= 8) or (px >= 250 and agree <= 3 and yconf >= 0.85)
                 else "REFETCH")   # a small player both trackers read the same way: body readable, hands and racket not
        if agree > 4: why.append("trackers disagree by %.1f %% of his height" % agree)
        if yconf < 0.6: why.append("YOLO unsure (%.2f)" % yconf)
    else:
        grade = "GOOD" if px >= 550 and c >= 0.6 else "USABLE" if px >= 350 and c >= 0.45 else "REFETCH"
        if c < 0.6: why.append("joints unclear (%.2f)" % c)
        why.append("no YOLO check yet")
    if px < 550: why.insert(0, "player only %d px tall" % px + (": body readable, hands and racket too small" if grade == "USABLE" else ""))
    q.update(grade=grade, why=", ".join(why) if grade != "GOOD" or agree is None else "")
    return q


def second_clip(vids):
    return [v for v in vids if re.search(r"2nd|second|kick", os.path.basename(v), re.I)]


rows, todo, qual = [], [], []
for pid, name, hand in roster:
    vids = own_videos(pid)
    used = [v for v in vids if os.path.basename(v).replace(" ", "-").rsplit(".", 1)[0].lower() in used_text.lower()
            or os.path.basename(v) in used_text]
    comp = [c for c in PEOPLE.get(pid, {}).get("clips", []) if str(c.get("stroke", "")).startswith("serve") and c.get("keypoints")]
    links = CHECKED.get(pid) or [("1st" if c["stroke"] == "serve1" else "2nd", c["url"], c.get("notes", "")[:60])
                                 for c in PEOPLE.get(pid, {}).get("clips", []) if str(c.get("stroke", "")).startswith("serve") and c.get("url")][:2]
    if pid in clip_players:
        first = "✅ in, used"
    elif vids:
        first = "📥 in, rebuild next"
    elif comp:
        first = "🟡 compilation segment only"
    else:
        first = "❌ fetch"
    sec_v = second_clip(vids)
    own_js = os.path.join(ROOT, f"src/serve/motion/{pid}-serve.js")
    if pid in clip_players and os.path.exists(own_js) and '"second":{' in open(own_js).read():
        second = "✅ in, used"
    elif pid == "alcaraz":
        second = "✅ same clip (one serve)"
    elif sec_v:
        second = "📥 in, rebuild next"
    else:
        second = "❌ fetch"
    for v in vids:
        q = quality(v)
        if q: qual.append((name, os.path.basename(v), q))
    mine = [q for n_, v_, q in qual if n_ == name]
    if mine and all(q["grade"] == "REFETCH" for q in mine) and not first.startswith("✅"):   # flag only when no clip is usable
        first = "⚠️ in, picture too poor: refetch"
    rows.append((name, hand, first, second, len(vids), len(comp)))
    if not first.startswith("✅") or not second.startswith("✅"):
        need = []
        if first.startswith(("❌", "🟡", "⚠️")): need.append("1st serve" + (" (sharper clip)" if first.startswith("⚠️") else ""))
        if second.startswith("❌"): need.append("2nd serve")
        if need:
            todo.append((name, need, links))

md = ["# Serve footage checklist", "",
      "Generated by `tools/intake/serve_checklist.py` from what is on disk; run it again after every inbox drop.",
      "Name clips `<player> serve back.mov` or `<player> 2nd serve back.mov` (one serve, fixed camera, from behind if possible).",
      "Quality: the player should fill most of the frame height (at least ~550 px tall), sharp, 720p or more; slow motion helps.", "",
      "✅ in, used: the live serve follows this clip · 📥 in, rebuild next: filed, not built yet · "
      "🟡 compilation segment only: a short segment of Ryan's slow-motion compilation has keypoints, an own clip is better · ⚠️ picture too poor: refetch a sharper or closer clip · ❌ fetch: nothing yet", "",
      "| Pro | Hand | 1st serve | 2nd serve | Own clips | Compilation segments |", "|---|---|---|---|---|---|"]
md += [f"| {n} | {'L' if h == 'L' else 'R'} | {a} | {b} | {v} | {c} |" for n, h, a, b, v, c in rows]
md += ["", "## Picture quality of the clips that are in", "",
       "Two trackers read every clip (Apple Vision and YOLO11m-pose). The gap is how far apart they put the same joint, as % of the player's height: small = both see the body the same way.",
       "GOOD: every joint readable · USABLE: works, a sharper or closer clip would be better · REFETCH: too small or blurry to read the body.", "",
       "| Pro | Clip | Grade | Player height | Vision vs YOLO gap | YOLO confidence | Vision confidence | Frame | fps | Why |", "|---|---|---|---|---|---|---|---|---|---|"]
md += [f"| {n} | {v} | {q['grade']} | {q.get('px', '-')} px | {str(q['agreePct']) + ' %' if 'agreePct' in q else '-'} | {q.get('yoloConf', '-')} | {q.get('conf', '-')} | {q['size']} | {q['fps']} | {q.get('why', '')} |" for n, v, q in qual]
md += ["", "## To fetch", ""]
for name, need, links in todo:
    md.append(f"- [ ] **{name}**: {' and '.join(need)}")
    for kind, url, note in links:
        md.append(f"  - {kind}: {url}" + (f" ({note})" if note else ""))
open(OUT, "w").write("\n".join(md) + "\n")
print("\n".join(md))
print(f"\nwrote {os.path.relpath(OUT, ROOT)}")
