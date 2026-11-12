#!/usr/bin/env python3
"""Body Scout: turn each pro's researched facts into a full body, and export the game file.

    python3 -I datasets/players/tools/build_bodies.py           # derive + write body.json and src/players/bodies.js
    python3 -I datasets/players/tools/build_bodies.py --check   # change nothing; fail if a file is stale or a check fails

Hand-written (by the Body Scout, one player at a time) in datasets/players/<id>/body.json:
  `official`  sourced height, weight, birth date, hand, backhand (ATP Tour profile), one link per number
  `research`  the scout's judgement calls, each with its why and its evidence: arm-span ratio, leg shift,
              build multipliers, movement ratings, flexibility
Everything else in body.json (`reach`, `segments`, `build`, `movement`, `flexibility`, `game`) is DERIVED here from those
two blocks with the ratios below, so it is reproducible and never edited by hand. Method and references:
datasets/players/BODY_SOURCES.md. Units: metres, kilograms, seconds, degrees; ratios are fractions of standing height H.
"""
import datetime
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PLAYERS_DIR = os.path.join(ROOT, "datasets", "players")
ROSTER_FILE = os.path.join(ROOT, "datasets", "footage", "top20.json")
OUT_JS = os.path.join(ROOT, "src", "players", "bodies.js")

MODEL_VERSION = 1
AS_OF = "2026-11-11"          # ages are computed on this date (the run that sourced the numbers)

# ---- Ratios (fractions of standing height H). See BODY_SOURCES.md for each reference. -------------------------------
# Drillis & Contini 1966 (tabled in Winter 2009): joint heights above the floor. The five vertical pieces add up to 1.
ANKLE_H, KNEE_H, HIP_H, SHOULDER_H, CHIN_H, EYE_H = 0.039, 0.285, 0.530, 0.818, 0.870, 0.936
V = {
    "foot_height": ANKLE_H,                 # floor -> ankle joint
    "shin": KNEE_H - ANKLE_H,               # 0.246  ankle -> knee
    "thigh": HIP_H - KNEE_H,                # 0.245  knee -> hip joint
    "trunk": SHOULDER_H - HIP_H,            # 0.288  hip joint -> shoulder joint
    "head_neck": 1.0 - SHOULDER_H,          # 0.182  shoulder joint -> top of the head (neck 0.052 + head 0.130)
}
NECK, HEAD = CHIN_H - SHOULDER_H, 1.0 - CHIN_H
ARM = {"upper_arm": 0.186, "forearm": 0.146, "hand": 0.108}   # D&C; used as the SPLIT of the arm, scaled to the span
FOOT_LEN = 0.152                            # D&C
OUTER_SHOULDER, CHEST_W, OUTER_HIP = 0.259, 0.174, 0.191      # D&C body widths (outer, with soft tissue)
BIACROMIAL = 0.235                          # bone width acromion to acromion (NHANES III men 20-29: 41.5 cm)
SHOULDER_JOINT_INSET = 0.016                # each shoulder joint centre sits ~3 cm inside the acromion tip (estimate)
BIILIAC = 0.150                             # pelvis bone width, crest to crest (27.0 cm at 182.3 cm; small study)
HIP_JOINT_SPACING = 0.095                   # hip joint centres: ~0.72-0.76 of the inter-ASIS distance (Bell 1989/90)
CHEST_DEPTH = 0.135                         # front to back at the chest (typical adult male; estimate)
SHOULDER_LIFT = 0.030                       # the shoulder girdle rises when the arm goes overhead (estimate)
WRIST_TO_SWEET_SPOT = 0.50                  # m: 68.6 cm racket held at the butt, sweet spot ~52 cm from the butt
# Limb and waist thickness seen from the front, for an average tour build (estimates for the Player Artist).
THICK = {"neck": 0.065, "waist": 0.160, "thigh": 0.100, "calf": 0.063, "upper_arm": 0.055, "forearm": 0.045}
HEAD_W = 0.084

REF_BMI = 23.25             # mean BMI of the Olympic men's tennis fields (London 2012: 23.3, Rio 2016: 23.2)
REF_KG = 80.8               # their mean weight (81.2, 80.4 kg): 1 = average for change of direction
ARM_SPAN_DEFAULT = 1.03     # "traditionally 1 to 1.03 for men" (ARTP 2020, via Wikipedia: Arm span)
SPREAD_DEFAULT = 110        # degrees between the legs in the widest slide / stretch stance, typical tour player (estimate)

# The game's own body physics (index.html bodyStats): 1.85 m / 75 kg reference athlete.
GAME_H, GAME_KG, GAME_TOP, GAME_ACCEL = 1.85, 75.0, 6.6, 8.6

# Normal active ranges of motion, degrees (AAOS, as tabled by the Biomechanics Coach in datasets/anatomy/joints.json).
# Copied here so this tool runs before that file is on main; keep the two in step.
ROM = {
    "hip_abduction": 45, "hip_internal_rotation": 45, "hip_external_rotation": 45, "hip_flexion": 120,
    "trunk_rotation": 45, "ankle_dorsiflexion": 20, "wrist_flexion": 80, "wrist_extension": 70,
    "shoulder_external_rotation": 90, "shoulder_internal_rotation": 70,
}
FLEX_SCALED = ("hip_abduction", "hip_internal_rotation", "hip_external_rotation", "hip_flexion",
               "trunk_rotation", "ankle_dorsiflexion")
PLAYING_SHOULDER = {"shoulder_external_rotation": +10, "shoulder_internal_rotation": -10}   # Ellenbecker


def r3(x):
    return round(x + 1e-12, 3)


def r2(x):
    return round(x + 1e-12, 2)


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def age_on(born, day):
    b, d = datetime.date.fromisoformat(born), datetime.date.fromisoformat(day)
    return d.year - b.year - ((d.month, d.day) < (b.month, b.day))


def derive(body):
    """Return body.json's derived blocks from its `official` and `research` blocks."""
    o, rs = body["official"], body["research"]
    H, kg = o["heightM"], o["weightKg"]
    mul = {"shoulders": 1.0, "hips": 1.0, "waist": 1.0, "thigh": 1.0, "calf": 1.0, "upperArm": 1.0, "dominantArm": 1.0}
    mul.update(rs["build"].get("mul", {}))
    bmi = kg / (H * H)
    girth = math.sqrt(bmi / REF_BMI)          # thickness grows with the square root of mass per height

    # --- vertical chain: a leg shift moves length between the trunk and the legs, the sum stays H -----------------
    shift = rs["legShift"]["value"]
    seg = {
        "head_neck": r3(V["head_neck"] * H),
        "trunk": r3((V["trunk"] - shift) * H),
        "thigh": r3((V["thigh"] + shift / 2) * H),
        "shin": r3((V["shin"] + shift / 2) * H),
        "foot_height": r3(V["foot_height"] * H),
    }
    total = r3(sum(seg.values()))
    leg = r3(seg["thigh"] + seg["shin"] + seg["foot_height"])
    shoulder_h = r3(leg + seg["trunk"])

    # --- widths and the arm: the arm is whatever closes the span (joint spacing + two arms = arm span) ------------
    span_ratio = rs["armSpanRatio"]["value"]
    published_span = rs["armSpanRatio"].get("publishedM")
    span = r3(published_span if published_span else span_ratio * H)
    shoulder_w = r3(BIACROMIAL * mul["shoulders"] * H)
    shoulder_joint_w = r3(shoulder_w - 2 * SHOULDER_JOINT_INSET * H)
    arm_len = (span - shoulder_joint_w) / 2
    arm_total = sum(ARM.values())
    upper_arm, forearm = r3(arm_len * ARM["upper_arm"] / arm_total), r3(arm_len * ARM["forearm"] / arm_total)
    hand = r3(arm_len - upper_arm - forearm)
    span_sum = r3(shoulder_joint_w + 2 * (upper_arm + forearm + hand))
    pelvis_w, hip_w = r3(BIILIAC * mul["hips"] * H), r3(OUTER_HIP * mul["hips"] * (0.5 + 0.5 * girth) * H)
    hip_joint_w = r3(HIP_JOINT_SPACING * mul["hips"] * H)

    segments = {
        "estimate": True,
        "method": "standard ratios x his sourced height (Drillis & Contini via Winter; widths as in BODY_SOURCES.md), "
                  "moved only by research.legShift, research.armSpanRatio and research.build.mul. Not measured on him.",
        "headNeckM": seg["head_neck"], "headM": r3(HEAD * H), "neckM": r3(NECK * H),
        "trunkM": seg["trunk"], "thighM": seg["thigh"], "shinM": seg["shin"], "footHeightM": seg["foot_height"],
        "legLengthM": leg, "shoulderHeightM": shoulder_h, "eyeHeightM": r3(EYE_H * H),
        "upperArmM": upper_arm, "forearmM": forearm, "handM": hand, "armLengthM": r3(upper_arm + forearm + hand),
        "footLengthM": r3(FOOT_LEN * H),
        "shoulderWidthM": shoulder_w, "shoulderJointSpacingM": shoulder_joint_w,
        "chestDepthM": r3(CHEST_DEPTH * girth * H),
        "pelvisWidthM": pelvis_w, "hipWidthM": hip_w, "hipJointSpacingM": hip_joint_w,
        "check": {
            "what": "head+neck + trunk + thigh + shin + foot height must equal his height (within 1 cm); "
                    "shoulder-joint spacing + 2 x (upper arm + forearm + hand) must equal his arm span",
            "sumM": total, "heightM": H, "diffM": r3(total - H), "ok": abs(total - H) <= 0.01,
            "spanSumM": span_sum, "armSpanM": span, "spanOk": abs(span_sum - span) <= 0.002,
        },
    }

    reach = {
        "armSpanM": span, "armSpanRatio": r3(span / H),
        "estimate": not published_span,
        "method": ("published wingspan" if published_span else
                   "no published wingspan found: arm span = %.3f x height. %s" % (span_ratio, rs["armSpanRatio"]["why"])),
        "standingReachM": r3(shoulder_h + upper_arm + forearm + hand + SHOULDER_LIFT * H),
        "standingReachHow": "flat-footed, fingertips overhead: shoulder height + arm + 3% of height for the raised "
                            "shoulder girdle (estimate)",
        "racketReachM": r3(shoulder_joint_w / 2 + upper_arm + forearm + WRIST_TO_SWEET_SPOT),
        "racketReachHow": "body centre line to the racket's sweet spot, arm straight out at shoulder height, no lean or "
                          "step: half the shoulder-joint spacing + upper arm + forearm + 0.50 m (wrist to sweet spot of "
                          "a 68.6 cm racket). Estimate.",
        "overheadRacketReachM": r3(shoulder_h + SHOULDER_LIFT * H + upper_arm + forearm + WRIST_TO_SWEET_SPOT),
        "overheadRacketReachHow": "sweet spot height with the arm straight up, feet flat (a serve adds the jump). Estimate.",
    }

    # --- build -------------------------------------------------------------------------------------------------
    by_bmi = "lean" if bmi < 21.8 else ("athletic" if bmi < 24.2 else "powerful")
    kind = rs["build"].get("type") or by_bmi
    hand_side = "left" if o["hand"] == "left" else "right"
    prop = {
        "estimate": True,
        "method": "fractions of his height, seen from the front. Widths: Drillis & Contini outer widths; thickness "
                  "baselines are estimates for an average tour build, scaled by sqrt(BMI / 23.25) and by "
                  "research.build.mul (the features the Appearance Scout and the video notes call out).",
        "headW": HEAD_W, "headH": r3(HEAD), "neckW": r3(THICK["neck"] * girth),
        "shoulderW": r3(OUTER_SHOULDER * mul["shoulders"] * (0.5 + 0.5 * girth)),
        "biacromialW": r3(BIACROMIAL * mul["shoulders"]),
        "chestW": r3(CHEST_W * mul["shoulders"] * girth),
        "waistW": r3(THICK["waist"] * girth * mul["waist"]),
        "hipW": r3(OUTER_HIP * mul["hips"] * (0.5 + 0.5 * girth)),
        "thighW": r3(THICK["thigh"] * girth * mul["thigh"]),
        "calfW": r3(THICK["calf"] * girth * mul["calf"]),
        "upperArmW": r3(THICK["upper_arm"] * girth * mul["upperArm"]),
        "forearmW": r3(THICK["forearm"] * girth * mul["upperArm"]),
        "racketArm": hand_side,
        "racketArmUpperW": r3(THICK["upper_arm"] * girth * mul["upperArm"] * mul["dominantArm"]),
        "racketArmForearmW": r3(THICK["forearm"] * girth * mul["upperArm"] * mul["dominantArm"]),
        "legToHeight": r3(leg / H), "armSpanToHeight": r3(span / H),
    }
    build = {
        "bmi": round(bmi, 1), "bmiHow": "weight / height^2 from the official numbers",
        "type": kind, "typeHow": rs["build"].get("typeWhy") or
        "from BMI: under 21.8 lean, 21.8-24.2 athletic, above powerful (men's Olympic tennis mean 23.25)",
        "massSits": rs["build"]["massSits"], "look": rs["build"]["look"],
        "proportions": prop,
    }

    # --- movement ----------------------------------------------------------------------------------------------
    mv = rs["movement"]
    years = age_on(o["born"], AS_OF)
    prime = rs.get("modelAge") == "prime"
    over = 0 if prime else max(0, years - 30)
    age_top, age_quick = 1 - 0.006 * over, 1 - 0.008 * over
    h, w = H / GAME_H, kg / GAME_KG
    long_leg = math.sqrt((leg / H) / HIP_H)
    top = GAME_TOP * math.sqrt(h) / w ** 0.25 * long_leg * mv["mover"] * age_top
    accel = GAME_ACCEL / w / math.sqrt(h) * mv["quick"] * age_quick
    cod = math.sqrt(REF_KG / kg) * mv["cod"] * age_quick
    movement = {
        "estimate": True,
        "method": "no per-player tracking speeds are published for most of the tour, so: the game's own body formula "
                  "(top = 6.6 x sqrt(h) / w^0.25, accel = 8.6 / w / sqrt(h), h = height / 1.85, w = weight / 75; its "
                  "6.6 m/s matches the ATP's 23.58 km/h maximum speed for men's tennis) x a small rating from the "
                  "evidence below x age (after 30: -0.6% top speed and -0.8% first step per year; legends are "
                  "modelled at their prime).",
        "ageOn": {"date": AS_OF, "years": years, "modelled": "prime" if prime else "current"},
        "ratings": {"mover": mv["mover"], "quick": mv["quick"], "cod": mv["cod"], "why": mv["why"]},
        "ageFactor": {"topSpeed": r3(age_top), "firstStep": r3(age_quick)},
        "topSpeedMps": r2(top), "topSpeedKmh": round(top * 3.6, 1),
        "accelMps2": r2(accel),
        "changeOfDirection": r2(cod),
        "changeOfDirectionHow": "1 = average tour player: sqrt(80.8 kg / his weight) x rating x age (a lighter body "
                                "stops and restarts faster)",
        "slides": mv["slides"],
        "published": mv.get("published", []),
        "evidence": mv.get("evidence", []),
    }

    # --- flexibility -------------------------------------------------------------------------------------------
    fx = rs["flexibility"]
    flex, spread = fx["flex"], fx["spreadDeg"]
    typical = flex == 1.0
    rom = {}
    for name, deg in ROM.items():
        if name in FLEX_SCALED:
            rom[name] = {"deg": round(deg * flex), "source": "typical elite range" if typical else
                         "estimate: normal range x his flex %.2f (%s)" % (flex, fx["why"])}
        elif name in PLAYING_SHOULDER:
            rom[name] = {"deg": deg + PLAYING_SHOULDER[name], "arm": hand_side,
                         "source": "typical elite range (playing shoulder of tour players: about +10 external, "
                                   "-10 internal rotation; Ellenbecker)"}
        else:
            rom[name] = {"deg": deg, "source": "typical elite range"}
    half = math.radians(spread / 2)
    flexibility = {
        "estimate": True,
        "method": "normal active ranges (AAOS, from the Biomechanics Coach's datasets/anatomy/joints.json), changed "
                  "per player only with evidence; nobody on the roster has published goniometer numbers.",
        "flex": flex, "flexWhy": fx["why"],
        "rangesDeg": rom,
        "widestStance": {
            "spreadDeg": spread,
            "spreadHow": "angle between the legs in his widest slide or stretch (110 = typical tour player, 180 = full "
                         "split). " + fx.get("spreadWhy", "Typical value: no evidence he goes wider or less wide."),
            "widthM": r2(2 * leg * math.sin(half)), "hipDropM": r2(leg * (1 - math.cos(half))),
        },
        "evidence": fx.get("evidence", []),
    }

    # --- the block the code reads ------------------------------------------------------------------------------
    split_depth = r2(1 - math.cos(half))
    game = {
        "heightM": H, "weightKg": kg, "armSpanM": span, "legLengthM": leg,
        "shoulderW": shoulder_w, "hipW": hip_w, "shoulderJointW": shoulder_joint_w, "hipJointW": hip_joint_w,
        "reachM": reach["racketReachM"], "overheadReachM": reach["overheadRacketReachM"],
        "eyeHeightM": segments["eyeHeightM"],
        "topSpeed": movement["topSpeedMps"], "accel": movement["accelMps2"], "cod": movement["changeOfDirection"],
        "flex": flex, "splitDepth": split_depth,
        "lefty": hand_side == "left",
        "why": {
            "heightM": "official (ATP Tour profile)",
            "weightKg": "official (ATP Tour profile)",
            "armSpanM": ("published wingspan" if published_span else
                         "estimate: %.3f x height, %s" % (span_ratio, rs["armSpanRatio"]["why"])),
            "legLengthM": "hip joint to floor: (0.530%s) x height (Drillis & Contini%s)" % (
                " + %.3f" % shift if shift else "", "; " + rs["legShift"]["why"] if shift else ""),
            "shoulderW": "bone width acromion to acromion: 0.235 x height%s" % (
                " x %.2f (%s)" % (mul["shoulders"], rs["build"]["mulWhy"]) if mul["shoulders"] != 1 else ""),
            "hipW": "outer hip width: 0.191 x height, scaled by build%s" % (
                " and x %.2f" % mul["hips"] if mul["hips"] != 1 else ""),
            "shoulderJointW": "shoulder joint centres: shoulderW minus ~3 cm a side (for the skeleton)",
            "hipJointW": "hip joint centres: 0.095 x height (for the skeleton: the legs hang from here, not from the hip's outer edge)",
            "reachM": "body centre to sweet spot, arm straight out, standing still; a lean or a step adds to it",
            "overheadReachM": "sweet spot height with the arm straight up, feet flat (serve contact before the jump)",
            "eyeHeightM": "0.936 x height (Drillis & Contini)",
            "topSpeed": "m/s, estimate: body formula x mover %.2f x age %.3f. %s" % (mv["mover"], age_top, mv["why"]),
            "accel": "m/s^2, estimate: body formula x first step %.2f x age %.3f" % (mv["quick"], age_quick),
            "cod": "1 = average: sqrt(80.8 / weight) x %.2f x age %.3f" % (mv["cod"], age_quick),
            "flex": fx["why"],
            "splitDepth": "share of his leg length the hips drop in his widest stance: 1 - cos(%d deg / 2)" % spread,
            "lefty": "official.hand (ATP Tour profile): the racket is in his %s hand, he bounces and tosses with "
                     "the other; the game mirrors captured serves for left-handers from this flag" % hand_side,
        },
    }
    return {"reach": reach, "segments": segments, "build": build, "movement": movement,
            "flexibility": flexibility, "game": game}


ORDER = ["_about", "player", "name", "sourcedOn", "official", "research",
         "reach", "segments", "build", "movement", "flexibility", "game"]
ABOUT = ("Body Scout. `official` (sourced, one link per number) and `research` (judgement calls with their why and "
         "evidence) are written by hand. `reach`, `segments`, `build`, `movement`, `flexibility` and `game` are derived "
         "from them by datasets/players/tools/build_bodies.py: do not edit those by hand, change `research` and run the "
         "tool. A block marked \"estimate\": true is an estimate in every number, by the method it states. "
         "Method and references: datasets/players/BODY_SOURCES.md.")


def validate(pid, body, problems):
    o = body["official"]
    for key in ("heightM", "weightKg", "born", "hand", "backhand"):
        if key not in o:
            problems.append("%s: official.%s missing" % (pid, key))
        if not str(o.get("sources", {}).get(key, "")).startswith("http"):
            problems.append("%s: official.sources.%s has no link" % (pid, key))
    if o.get("hand") not in ("right", "left"):
        problems.append("%s: official.hand must be right or left, not %r" % (pid, o.get("hand")))
    g, s = body["game"], body["segments"]["check"]
    if g.get("lefty") is not (o.get("hand") == "left") or "lefty" not in g["why"]:
        problems.append("%s: game.lefty must be true or false, from official.hand, with its why" % pid)
    if not s["ok"]:
        problems.append("%s: segments add up to %.3f m, height is %.3f m" % (pid, s["sumM"], s["heightM"]))
    if not s["spanOk"]:
        problems.append("%s: arm pieces give %.3f m, arm span is %.3f m" % (pid, s["spanSumM"], s["armSpanM"]))
    if not 0.8 <= g["flex"] <= 1.2:
        problems.append("%s: flex %.2f outside 0.8-1.2" % (pid, g["flex"]))
    if not 1.00 <= body["reach"]["armSpanRatio"] <= 1.06:
        problems.append("%s: arm span ratio %.3f outside 1.00-1.06" % (pid, body["reach"]["armSpanRatio"]))
    for key in ("heightM", "weightKg", "armSpanM", "legLengthM", "shoulderW", "hipW", "reachM", "eyeHeightM",
                "topSpeed", "accel", "cod", "flex", "splitDepth"):
        if not isinstance(g.get(key), (int, float)):
            problems.append("%s: game.%s is not a number" % (pid, key))
        if key not in g["why"]:
            problems.append("%s: game.why.%s missing" % (pid, key))
    for block in ("movement", "flexibility"):
        for ev in body[block].get("evidence", []) + body[block].get("published", []):
            if not str(ev.get("url", "")).startswith(("http", "datasets/")):
                problems.append("%s: %s evidence without a link or file" % (pid, block))


def dump(obj):
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def js_file(bodies):
    out = {}
    for pid, b in bodies.items():
        seg = {k: v for k, v in b["segments"].items() if k.endswith("M")}
        prop = {k: v for k, v in b["build"]["proportions"].items() if k not in ("estimate", "method")}
        game = {k: v for k, v in b["game"].items() if k != "why"}
        out[pid] = {
            "name": b["name"], "hand": b["official"]["hand"], "backhand": b["official"]["backhand"],
            "build": b["build"]["type"], "game": game, "proportions": prop, "segments": seg,
            "flexDeg": {k: v["deg"] for k, v in b["flexibility"]["rangesDeg"].items()},
            "widestStance": {k: b["flexibility"]["widestStance"][k] for k in ("spreadDeg", "widthM", "hipDropM")},
        }
    head = (
        "/* GENERATED by datasets/players/tools/build_bodies.py from datasets/players/<id>/body.json. Do not edit by hand.\n"
        "   Body Scout: each pro's real body. BODIES[id].game = heightM, weightKg, armSpanM, legLengthM, shoulderW, hipW,\n"
        "   shoulderJointW, hipJointW, reachM, overheadReachM, eyeHeightM (metres, kg), topSpeed (m/s), accel (m/s^2),\n"
        "   cod (1 = average), flex (0.8-1.2), splitDepth (share of leg length the hips drop in his widest stance),\n"
        "   lefty (true = the racket is in his left hand; from the ATP's playing hand, the same fact as BODIES[id].hand).\n"
        "   proportions = fractions of height for drawing; segments = metres; flexDeg = joint ranges in degrees.\n"
        "   Heights and weights are official (ATP Tour); the rest are estimates by the methods in\n"
        "   datasets/players/BODY_SOURCES.md. The game must run without this file: read it as (window.BODIES || {})[id]. */\n"
    )
    return head + "window.BODIES = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n" + \
        "window.BODIES_MODEL = " + json.dumps({"version": MODEL_VERSION, "asOf": AS_OF, "players": len(out)}) + ";\n"


def check_js(js, ids, problems):
    """Read the generated file back the way the page does (two plain assignments of JSON) and re-check it."""
    try:
        start, mid = js.index("window.BODIES = ") + 16, js.index(";\nwindow.BODIES_MODEL = ")
        loaded = json.loads(js[start:mid])
        json.loads(js[mid + 24:js.rindex(";")])
    except ValueError as e:
        problems.append("bodies.js does not parse: %s" % e)
        return
    if list(loaded) != ids:
        problems.append("bodies.js has %d players, the roster %d" % (len(loaded), len(ids)))
    for pid, b in loaded.items():
        g, s = b["game"], b["segments"]
        total = s["headNeckM"] + s["trunkM"] + s["thighM"] + s["shinM"] + s["footHeightM"]
        if abs(total - g["heightM"]) > 0.01:
            problems.append("bodies.js %s: segments add up to %.3f m, height %.2f m" % (pid, total, g["heightM"]))
        if g["hipJointW"] >= g["hipW"] or g["shoulderJointW"] >= g["shoulderW"]:
            problems.append("bodies.js %s: joints wider than the body" % pid)
        if g.get("lefty") is not (b["hand"] == "left"):
            problems.append("bodies.js %s: game.lefty does not match his hand (%s)" % (pid, b["hand"]))
        if not (5 < g["topSpeed"] < 9 and 5 < g["accel"] < 13):
            problems.append("bodies.js %s: speed outside a human range" % pid)


def check_roster(bodies, problems):
    """index.html's ROSTER must carry the sourced height and weight. Returns the lines it compared."""
    import re
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    seen = []
    for pid, h, kg in re.findall(r'\{ id: "([\w-]+)",[^\n]*?heightM: ([\d.]+), weightKg: ([\d.]+)', html):
        o = bodies.get(pid, {}).get("official")
        if not o:
            problems.append("ROSTER has %s, but there is no body.json for him" % pid)
        elif float(h) != o["heightM"] or float(kg) != o["weightKg"]:
            problems.append("ROSTER %s: %s m / %s kg, sourced %.2f m / %d kg" % (pid, h, kg, o["heightM"], o["weightKg"]))
        seen.append(pid)
    return seen


def main():
    check = "--check" in sys.argv
    ids = [p["id"] for p in json.load(open(ROSTER_FILE, encoding="utf-8"))["players"]]
    problems, stale, bodies = [], [], {}
    for pid in ids:
        path = os.path.join(PLAYERS_DIR, pid, "body.json")
        if not os.path.exists(path):
            problems.append("%s: no body.json" % pid)
            continue
        old_text = open(path, encoding="utf-8").read()
        body = json.loads(old_text)
        body["_about"] = ABOUT
        body.update(derive(body))
        body = {k: body[k] for k in ORDER if k in body}
        validate(pid, body, problems)
        new_text = dump(body)
        if new_text != old_text:
            stale.append(path)
            if not check:
                open(path, "w", encoding="utf-8").write(new_text)
        bodies[pid] = body
    js = js_file(bodies)
    check_js(js, ids, problems)
    in_roster = check_roster(bodies, problems)
    old_js = open(OUT_JS, encoding="utf-8").read() if os.path.exists(OUT_JS) else ""
    if js != old_js:
        stale.append(OUT_JS)
        if not check:
            os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
            open(OUT_JS, "w", encoding="utf-8").write(js)

    print("%-18s %5s %5s %5s %6s %6s %6s %6s %5s %5s %5s %5s" % (
        "player", "H", "kg", "BMI", "span", "leg", "reach", "top", "acc", "cod", "flex", "split"))
    for pid, b in bodies.items():
        g = b["game"]
        print("%-18s %5.2f %5.0f %5.1f %6.3f %6.3f %6.3f %6.2f %5.2f %5.2f %5.2f %5.2f" % (
            pid, g["heightM"], g["weightKg"], b["build"]["bmi"], g["armSpanM"], g["legLengthM"], g["reachM"],
            g["topSpeed"], g["accel"], g["cod"], g["flex"], g["splitDepth"]))
    print("%d of %d players; %s" % (len(bodies), len(ids),
          ("stale: " + ", ".join(os.path.relpath(p, ROOT) for p in stale)) if stale and check else
          ("wrote %d file(s)" % len(stale) if stale else "everything up to date")))
    print("left-handers (game.lefty, from official.hand): %s" % (
        ", ".join(pid for pid, b in bodies.items() if b["game"]["lefty"]) or "none"))
    print("index.html ROSTER compared with the sourced height and weight: %s" % (", ".join(in_roster) or "none found"))
    for p in problems:
        print("PROBLEM", p)
    if problems or (check and stale) or len(bodies) != len(ids):
        sys.exit(1)


if __name__ == "__main__":
    main()
