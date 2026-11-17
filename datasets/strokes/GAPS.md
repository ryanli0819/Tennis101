# GAPS — HQ-20261111-008.RD.1 first increment (Sinner + Alcaraz)

Nothing below is filled by invention. Machine-readable copy: `datasets/strokes/<player>.motions.json` → `gaps`, `rejected`.

## 1. Sinner slice — 0 of 5 (documented GAP)
Prime-era Sinner slice footage is not in the RD.4 REVIEW-PASS set. The only chaptered Sinner slice, `jjK_bJYdtCI` [234,266], is AO 2022 practice, pre-prime (Anatomy prime ESTIMATED 2023–2026), view unstated — **not used**, per Event 30 and the ASSIGN. No Sinner slice motion exists.

## 2. Alcaraz slice — 3 of 5 (shortfall 2)
- `zhY7qi0lGFo` [0,40] (Tennis Analytics, oEmbed title "Carlos Alcaraz Backhand Slice Slow Motion"): **view confirmed behind** (camera behind the baseline), **event confirmed by eye: one-handed backhand slices**. The whole clip holds exactly 3 complete slices (≈0:02, 0:05, and one ultra-slow take 0:16–0:28; frames 400–1000 and 1600–2399 are ready/recovery). All 3 exported.
- `zWdzG23i76o` [0,64] (Tennis TV "GENIUS Slice Winner | Tokyo 2026"): **view**: wide high broadcast camera for the rally + close side/behind-oblique replays (0:43–0:52). **Wing**: replay stills show the racket prepared high on his left shoulder and a one-arm high-to-low extension — read as a **backhand slice, medium-low confidence** (evidence/overview/alcaraz_zWdz_wing_a.png, _b.png). **Not exportable**: main player tracked on 32 of 1600 frames (2.0%) in the RD.5 poses; RD.5 published 0. No motion invented.
- `hgHebqz4rA8` rejected (drop shot, 2021). Two more slice takes need new catalogued footage (Scout).

## 3. Sinner backhand — 5 of 5, but 3 are low confidence
RD.5 published **0** from `zIr116qDPus` [22,63] because one long shot lost the player (38.5% tracked). Re-running the same `derive_serve.track_server` on 240-frame windows (no new pose extraction) tracked 2396/2460 frames, and 6 visually confirmed two-handed backhands were found. One (`sinner_bh_2`, contact ≈ 0:25.6) is **rejected**: the figure collapses on 5 keyframes around contact. Of the 5 kept, sinner_bh_1/4/5 are `low` (right wrist hidden behind the body from behind; mean visibility 0.29–0.42 through the swing).

## 4. Alcaraz backhand — 5 of 5, 4 low confidence
4 behind takes (`zIr116qDPus` [63,107], an oblique behind-right camera) + 1 front take (`JWOc8IU0xMM` [20,60], 2023, mirrored, lowConfidence). alcaraz_bh_1/3/4 are low (hitting wrist hidden through the swing). For bh_1–4 the analysed window starts with the take-back already under way, so the ready pose is not captured.

## 5. Slow-motion re-timing — GAP
All clips are slow-motion compilations with an unknown factor. `timeScale: null`; t is video seconds. Re-timing is a GAME-DESIGN decision for the integrator. Forward-swing→contact durations in video frames are recorded for that.

## 6. Depth — not measured
2-D image plane only. `depth: null`. Forward/back motion toward the net, racket-face angle and true rotation angles are not measured; turn angles in measurements.json are ESTIMATED from apparent width and saturate near 90°.

## 7. Grip sourcing for forehand and slice — open question
Backhand 2H is SOURCED (ATP hero JSON, ATP 2026 media guide). No URL found that states the **forehand** grip as one-handed or the **slice** as one-handed for either player; both are labelled MEASURED (visual), alcaraz_sl_2 ESTIMATED (release not visible). The contract says grip "must be SOURCED" — needs the manager's ruling or a Scout/Anatomy source.

## 8. Event / match level
All takes come from compilations (Slow-Mo Tennis, Tennis Analytics) with event and match-vs-practice unstated; years are upload/compilation years (Sinner HI0bvG0pw4w footage is 2024 per the live description — not used here). Not presented as match-level.

## 9. Not in this increment
The other 20 roster players. RD.4 r2 (remaining-20 Scout catalog) is now REVIEW-PASS (003 Event 38); consume Event 35 recommended ranges exactly. Medvedev `HI0bvG0pw4w` [363,460] (behind) is now a recommended in-window fill (footage 2024 SOURCED from the live description; manager Event 12, 7:38 PM ET), alongside 928wJjWeVyk [161,210], qkQmT4fXKD8 [297,351], _7xV_CE8y28 [58,102]. Left-handers (Shelton, Tien, Nadal) need their own footage; never mirror a right-hander as their motion.

## 10. Considered and not used (this increment)
Side clip `CxttdybdLLI` and front clips `928wJjWeVyk`, `_7xV_CE8y28`, `VrwWzeLm2Eg` (FH): not needed — five behind forehands exist per player. `HI0bvG0pw4w` (both players): behind, but takes cross hard cuts (Alcaraz 1391→1417, 2812). `u6lybamSAQ0` Alcaraz [93,142]: only 2 detections, both low. RD.5's Anatomy-local clips (`3m80hWeNLqg`, `__wut0HlifLQ`, `-Eu80hGbgVA`, `MFpSeZRx83g`) are outside the RD.4 r1 set and not used. `57YDEFal6-o` (practice) not used.

---
# r2 — remaining 20 players (Nov 11, 2026, ~9 PM ET; HQ-20261111-008.RD.1 r2, draft, not reviewed)
Source of truth: `scripts/gaps_r2.json` (exported verbatim into each `<player>-strokes.js` `gaps`). **94 takes** from 17 players; 4 takes rejected in visual QA; Cobolli, Nakashima, Nadal are complete documented gaps. Every shortfall below is honest: no padding, no copying, no mirroring a right-hander for a left-hander, no slice invented, no flagged-outside / last-resort / unsupported clip used as a fill.

## r2.1 Counts vs 5 per family
| Player | FH | BH | Slice | Views (all families) |
|---|---|---|---|---|
| zverev | 5 | 5 | GAP 5 | behind 5, front 5 |
| shelton (L) | 5 | 4 (gap 1) | GAP 5 | behind 9 |
| medvedev | 5 | 3 (gap 2) | GAP 5 | behind 5, front 3 |
| cobolli | GAP 5 | GAP 5 | GAP 5 | — |
| fils | 4 (gap 1) | 4 (gap 1) | 2 (gap 3) | front 4, behind 6 |
| tiafoe | 5 | GAP 5 | GAP 5 | front 5 |
| de-minaur | 5 | GAP 5 | 2 (gap 3) | behind 7 |
| jodar | 5 | GAP 5 | GAP 5 | behind 1, side 4 |
| djokovic | GAP 5 | GAP 5 (2 rejected) | 3 (gap 2; 1 rejected) | front 2, behind 1 |
| fritz | 4 (gap 1) | GAP 5 | GAP 5 | behind 4 |
| auger-aliassime | 5 | 4 (gap 1) | GAP 5 | behind 9 |
| paul | 5 | GAP 5 | GAP 5 | front 5 |
| lehecka | GAP 5 (1 rejected) | GAP 5 | GAP 5 | — |
| mensik | 5 | GAP 5 | GAP 5 | front 5 |
| davidovich-fokina | 1 (gap 4) | GAP 5 | GAP 5 | side 1 |
| nakashima | GAP 5 | GAP 5 | GAP 5 | — |
| tien (L) | 5 | GAP 5 | GAP 5 | front 5 |
| federer | GAP 5 | GAP 5 (1H SOURCED, no in-window clip) | 5 | front 5 |
| nadal (L) | GAP 5 | GAP 5 | GAP 5 | — |
| kyrgios | GAP 5 | GAP 5 | 3 (gap 2) | behind 3 |

## r2.2 Per-family reasons (verbatim from gaps_r2.json)
- **zverev backhand** missing 0: Filled with 5 FRONT takes (JWOc8IU0xMM [176,212], lowConfidence, mirrored). No behind BH in the recommended set (zIr116qDPus Zverev chapter is 2026, flagged outside the 2020-2025 prime).
- **zverev slice** missing 5: Prime slice is a Scout-documented GAP (m5Csn8OPX_U 2014 is last-resort, not a fill). No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **shelton backhand** missing 1: 4 behind takes from zIr116qDPus [213,264] (very slow chapter; only 4 complete swings with a readable contact). JWOc8IU0xMM 2023 BH is flagged outside prime. Left-hander: own footage only, never mirrored.
- **shelton slice** missing 5: Scout GAP. No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **medvedev backhand** missing 2: 3 FRONT takes from JWOc8IU0xMM [60,89]. iuOvL1HdYOc BH [18,34] (IW 2023 practice) was inspected (evidence/r2/label/medvedev_iuOvL1HdYOc_15-372_mdPR_p0.png) but not used: same court/outfit/session as the JWOc chapter, so its swings may be the same swings re-edited; flagged practice. Not padded.
- **medvedev slice** missing 5: pcOrBrfeDzA [0,75] (whole clip, view to-confirm) inspected: wide side-on court-level footage, main player tracked on 54% of frames; the one close-up slice (about 58-60 s) is a very slow preparation whose contact is not inside a readable tracked window (evidence/r2/label/medvedev_pcOrBrfeDzA_0-75_mdSL_p*.png, evidence/r2/confirm/A_p3.png). No contact labelled by eye -> no take. No motion invented.
- **fils forehand** missing 1: 4 FRONT takes from VrwWzeLm2Eg [330,396] (only front in the recommended set).
- **fils backhand** missing 1: 4 behind takes from zIr116qDPus [424,458] (34 s chapter).
- **fils slice** missing 3: ChqBBm3aunU [0,24] (24 s, behind, non-mirrored original) holds 2 complete slices with a readable contact; a third (~12 s) is still in preparation at the end of its tracked window. Lefty-Analytics mirrored edit rejected. No motion invented.
- **tiafoe backhand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **tiafoe slice** missing 5: Scout GAP. No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **de-minaur backhand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **de-minaur slice** missing 3: AlmahjLVguM [0,33] (behind) holds 2 complete slices with a readable contact. No motion invented.
- **fritz forehand** missing 1: 4 behind takes from HI0bvG0pw4w [277,363]. The front fills 928wJjWeVyk [366,392] and PoF1iCUIGtc [383,416] were downloaded and tracked but not labelled in this run -> shortfall of 1, next step.
- **fritz backhand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **fritz slice** missing 5: Scout GAP. No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **auger-aliassime backhand** missing 1: 4 behind takes from zIr116qDPus [317,371] (footage year unstated).
- **auger-aliassime slice** missing 5: Prime slice is a Scout GAP. No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **paul backhand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **paul slice** missing 5: R40jQPWhQXE [0,23] (whole clip, view to-confirm): main player tracked on 19% of frames even with windowed tracking (evidence/r2/scan json) -> no usable pose. No motion invented.
- **lehecka forehand** missing 5: No usable take. The only candidate in CxttdybdLLI [466,487] (lehecka_fh_1) was REJECTED in visual QA: it is a serve (ball bounce, toss, trophy pose), not a forehand; the other swing in the 21 s range has its contact on a hard cut. No motion invented.
- **lehecka backhand** missing 5: Prime BH is a Scout GAP (only 2023 practice, flagged).
- **lehecka slice** missing 5: Scout GAP.
- **mensik backhand** missing 5: Prime BH is a Scout GAP (2024-upload leads flagged).
- **mensik slice** missing 5: Prime slice is a Scout GAP.
- **tien backhand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented. Left-hander: never mirrored from a right-hander.
- **tien slice** missing 5: Scout GAP.
- **kyrgios forehand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **kyrgios backhand** missing 5: J0n8o5JEdhE BH withdrawn by Scout (stroke: null); iy47YdeRTD8 is post-prime. No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **kyrgios slice** missing 2: 3 behind takes from J0n8o5JEdhE [206,236] (AO 2022 practice, in window, practice flag). 30-s range.
- **federer forehand** missing 5: No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **federer backhand** missing 5: One-handed backhand is SOURCED (ATP hero 'BackHand: One-Handed', RD.2). The recommended set has no in-window Federer topspin/drive backhand clip (2019 and later uploads flagged outside 2004-2012). The 5 slice takes are one-handed (visual) and are NOT relabelled as backhand drives. No 1H motion invented or copied from a 2H player.
- **djokovic forehand** missing 5: Slow-Mo compilation chapters 2024-2026 are flagged outside the 2011-2023 prime; No clip in the Scout Event 35 recommended set (003 Event 38 PASS) for this family at prime. No motion invented.
- **djokovic backhand** missing 5: No usable take. Qv-PM-z-IHs [0,191] (behind, upload 2021, footage year unstated): both candidates REJECTED in visual QA (djokovic_bh_1 shows no readable swing; djokovic_bh_2 collapses at contact); the rest of the clip is long untracked or the same swing re-shown.
- **djokovic slice** missing 2: 3 takes from HmwlTzu9GN4 [0,55] (AO 2012 practice courts): sl_1, sl_3 FRONT (lowConfidence, mirrored) and sl_4 BEHIND (re-labelled after QA). sl_2 REJECTED (prep/contact not readable). Ids keep their original numbers.
- **jodar backhand** missing 5: Scout GAP (VYpPRQC0wMM backhand label unsupported).
- **jodar slice** missing 5: Scout GAP.
- **davidovich-fokina forehand** missing 4: 7RiYQgRsE4w (no chapters; whole clip [0,144] = full duration; side, 30 fps, heavy motion blur): only 1 forehand with a readable wing and contact.
- **davidovich-fokina backhand** missing 5: 7RiYQgRsE4w backhands inspected (evidence/r2/confirm/C_p1.png): wing and contact not readable through motion blur from the side. No take.
- **davidovich-fokina slice** missing 5: b_2IzkOxVgU upload 2024 flagged outside the 2022/2025 window.
- **cobolli forehand** missing 5: Complete documented GAP (Scout): no clean chaptered in-prime fill; BYbrT2Xadb8 2022 flagged, 2024 uploads flagged, AGGN3-VNtvg mixed Groundstrokes practice. Confirmed: none is in the recommended set. No motion invented.
- **cobolli backhand** missing 5: Complete documented GAP (Scout): no clean chaptered in-prime fill; BYbrT2Xadb8 2022 flagged, 2024 uploads flagged, AGGN3-VNtvg mixed Groundstrokes practice. Confirmed: none is in the recommended set. No motion invented.
- **cobolli slice** missing 5: Complete documented GAP (Scout): no clean chaptered in-prime fill; BYbrT2Xadb8 2022 flagged, 2024 uploads flagged, AGGN3-VNtvg mixed Groundstrokes practice. Confirmed: none is in the recommended set. No motion invented.
- **nakashima forehand** missing 5: Complete documented GAP (Scout): DSuc7PM4tEw 2021 practice flagged; dpHVCmdQzL4 oEmbed 401, not catalogued. Confirmed: none is in the recommended set. No motion invented.
- **nakashima backhand** missing 5: Complete documented GAP (Scout): DSuc7PM4tEw 2021 practice flagged; dpHVCmdQzL4 oEmbed 401, not catalogued. Confirmed: none is in the recommended set. No motion invented.
- **nakashima slice** missing 5: Complete documented GAP (Scout): DSuc7PM4tEw 2021 practice flagged; dpHVCmdQzL4 oEmbed 401, not catalogued. Confirmed: none is in the recommended set. No motion invented.
- **nadal forehand** missing 5: Complete documented GAP (Scout): no recommended clay-prime chaptered fill; f1qdyFC-Yas 2022 practice and VuoLaoVa3u0 2021 flagged outside; Ril7Cq2iiK4 (16377 s) not a fill; xm2zi36uZEg 2013 Indian Wells is hard court, not a clay-prime fill. LEFT-HANDER: never mirrored from a right-hander. No motion invented.
- **nadal backhand** missing 5: Complete documented GAP (Scout): no recommended clay-prime chaptered fill; f1qdyFC-Yas 2022 practice and VuoLaoVa3u0 2021 flagged outside; Ril7Cq2iiK4 (16377 s) not a fill; xm2zi36uZEg 2013 Indian Wells is hard court, not a clay-prime fill. LEFT-HANDER: never mirrored from a right-hander. No motion invented.
- **nadal slice** missing 5: Complete documented GAP (Scout): no recommended clay-prime chaptered fill; f1qdyFC-Yas 2022 practice and VuoLaoVa3u0 2021 flagged outside; Ril7Cq2iiK4 (16377 s) not a fill; xm2zi36uZEg 2013 Indian Wells is hard court, not a clay-prime fill. LEFT-HANDER: never mirrored from a right-hander. No motion invented.

## r2.3 Rejected in visual QA (kept in each file's `rejected`, not exported as motion)
- **lehecka_fh_1**: the window is a **serve** (ball bounce, toss, trophy pose), not a forehand → Lehecka FH is now 0 (complete gap). Sheet: `evidence/r2/compare/rejected/lehecka_fh_1.png`.
- **djokovic_bh_1**: no readable backhand swing in the window (racket barely travels), 11 collapsed frames. `evidence/r2/compare/rejected/djokovic_bh_1.png`.
- **djokovic_bh_2**: skeleton collapses at contact (19 collapsed + 4 spiked frames). `evidence/r2/compare/rejected/djokovic_bh_2.png`.
- **djokovic_sl_2**: slice prep/contact not readable on the confirm strip (`evidence/r2/confirm/D_djsl_p0.png`); rule events were out of order.

## r2.4 Other r2 gaps / caveats
1. **Federer 1H backhand drive**: SOURCED one-handed (ATP hero JSON `BackHand: One-Handed`, f324, web.archive 20260525022217; RD.2 `players/federer.md`), audited — but **no in-window drive clip** in the recommended set, so GAP. The 5 Federer slices are one-handed by eye (MEASURED visual) and are not relabelled as drives.
2. **Left-handers**: Shelton (9 takes, all behind) and Tien (5 takes, all front) are from their own footage, tracked on the left arm (`track_server(doc, "L")`). Nadal: complete gap — no clay-prime fill; nothing mirrored from a right-hander.
3. **Front/side views** (lowConfidence): 50 behind, 39 front, 5 side; 60 of 94 takes are lowConfidence (quality low), 34 medium. The 39 front takes are mirrored to the behind convention (`mirrored: true`); the 5 side takes are not mirrored (`mirrored: false`), and their left-right axis is mostly the depth axis, so it is **not** measured. Paul, Mensik, Tiafoe and Tien forehands are front-only because the recommended set has nothing behind for them at prime.
4. **Events**: contact is VISUAL on all 94 takes; the other five phase events are VISUAL on 77 takes and rule-derived (labelled ESTIMATED in `eventLabels`, rule values in `qa.autoEvents`) on 17: shelton_bh_1–3, fils_sl_1, tiafoe_fh_1/3, auger-aliassime_bh_2–4, tien_fh_2/3, kyrgios_sl_1, federer_sl_1, jodar_fh_2/3/5, davidovich-fokina_fh_1. Next step is to label them by eye.
5. **Collapse gate vs low balls**: de-minaur_fh_5 (low wide ball) had 23 frames removed by the collapse gate; the exported 20 frames still show the deep knee bend, but the deepest squat frames may be among those removed. r2 rule: 10+ collapsed frames → `lowConfidence` (also shelton_fh_5, kyrgios_sl_2, fils_bh_1, jodar_fh_4).
6. **Short takes** (real samples kept, not padded): 17 keyframes on shelton_bh_3 and jodar_fh_5; 18 on shelton_bh_2, auger-aliassime_bh_2/3, tiafoe_fh_1, federer_sl_1.
7. **Practice** (flagged, not match-level): Kyrgios J0n8o5JEdhE (AO 2022), Federer _YE-k1QwZfg (2011), Djokovic HmwlTzu9GN4 (AO 2012). Footage year unstated on zIr116qDPus, VrwWzeLm2Eg, Qv-PM-z-IHs, ChqBBm3aunU, AlmahjLVguM.
8. Soft cuts: zverev_bh_1 and djokovic_sl_3 end their windows before a wipe/dissolve seen by eye (`windowEndVisual`); every other take passed the keyframe image-jump check (`evidence/r2/dissolve_check.json`).
9. Still null: depth, speedKmh, spinRpm, timeScale (all times are video seconds of slow-motion footage).

# r3: Event 19 follow-ups + parent visual QA (Nov 11, 2026, ~9:30–10:20 PM ET; HQ-20261111-008.RD.1 r3, draft, not reviewed)
Same assignment, not a new task. The r1 and r2 sections above are history. The counts below supersede r2.1 for Fritz, Tiafoe, Fils and Tien FH only; every other family is unchanged.

## r3.1 Count changes (takes + documented gap = 5 holds for every family; verify)
| Family | r2 | r3 | Gap | Why |
|---|---|---|---|---|
| Fritz FH | 4 | **5** | 0 | fritz_fh_5 added. It is a front take from 928wJjWeVyk [366,392] (368.0–370.25 s, contact frame 190): `mirrored: true`, `lowConfidence: true`, 21 real keyframes, all phases VISUAL. PoF1iCUIGtc [383,416] was inspected and not needed. It is a different swing from the 4 HI0bvG0pw4w behind takes |
| Tiafoe FH | 5 | **3** | 2 | tiafoe_fh_2 rejected as a duplicate/incomplete take; tiafoe_fh_5 rejected as a two-handed backhand (both parent-confirmed). Remaining: fh_1 (OvGakC-KQZs), fh_3, fh_4 (PoF1iCUIGtc) |
| Fils FH | 4 | **3** | 2 | fils_fh_3 rejected as a two-handed backhand (parent-confirmed). Remaining: fh_1, fh_2, fh_4 (VrwWzeLm2Eg) |
| Tien FH | 5 | **3** | 2 | tien_fh_3 and tien_fh_1 rejected; both are backhands. Remaining: fh_2, fh_4, fh_5. All three had r2 contacts mid take-back and were fixed by eye |

Totals: **90 r2-scope takes** (FH 55, BH 20, slice 15; 50 behind, 35 front, 5 side; 56 lowConfidence). With r1, 113 motions. Sinner and Alcaraz are unchanged (md5 identical to r1).

## r3.2 Phase events on the 17 (eye-labelled from `evidence/r3/confirm/R3EV_<id>_p0.png`)
- **Fully VISUAL (7):** shelton_bh_2, shelton_bh_3, fils_sl_1, auger-aliassime_bh_3, federer_sl_1, tiafoe_fh_3 (after contact fix), tien_fh_2 (after contact fix).
- **Partly VISUAL (9):** backswing, forward and finish are VISUAL; **start and unitTurn stay ESTIMATED** because the film opens with the take-back already under way, so the ready position and unit turn are not on film. Takes: shelton_bh_1, tiafoe_fh_1, auger-aliassime_bh_2, auger-aliassime_bh_4, kyrgios_sl_1, jodar_fh_2, jodar_fh_3, jodar_fh_5, davidovich-fokina_fh_1. Rule values were kept, not invented, and the labels read "ESTIMATED … NOT readable by eye on the r3 phase strips (<why>)".
- **Rejected (1):** tien_fh_3 (see r3.3).
- Over all 90 takes, phases are fully VISUAL on 81.

## r3.3 Rejected in r3 (kept in each file's `rejected`; sheets in `evidence/r3/compare/rejected/`)
None of these was re-used as a backhand: the catalog ranges were used as FH, and Tiafoe BH and Tien BH are Scout GAPs. Each is a lead for the Scout, not used here.
1. **tien_fh_3** (VrwWzeLm2Eg): two-handed backhand, with contact ~1246 and both hands over the left shoulder at 1260–1270. Evidence: `R3C_tien3_dense.png`.
2. **tien_fh_1** (VrwWzeLm2Eg), found with the parent-requested contact zoom. Tien is left-handed, so his forehand side is the right of the front image. Here the take-back (60–86) and the contact (ball on the strings ~92) are on the **left** of the image with both arms on the racket, and the finish is two-handed and high (104–118). That makes it a backhand; the labelled contact 76 was in the take-back. Evidence: `R3C_tien1_contact.png`, `R3C_tien1_dense.png`.
3. **tiafoe_fh_2** (PoF1iCUIGtc): the same slow-motion swing as tiafoe_fh_3, in a shorter window ([289.07, 291.08] vs [289.07, 294.42] s), with contact 475 in the take-back. A duplicate/incomplete take (parent-confirmed). Evidence: `front_audit/tiafoe_fh_2.png`, `compare/rejected/tiafoe_fh_2.png`.
4. **tiafoe_fh_5** (PoF1iCUIGtc): a two-handed backhand: two hands, contact on the BH side, two-handed high finish (parent-confirmed). Evidence: `R3C_tiafoe_fh45.png` (bottom), `compare/rejected/tiafoe_fh_5.png`.
5. **fils_fh_3** (VrwWzeLm2Eg): a two-handed backhand: two hands, contact on the player's left (right of the front image), two-handed finish (parent-confirmed). Evidence: `front_audit/fils_fh_3.png`, `compare/rejected/fils_fh_3.png`.

## r3.4 Contact fixes (a visual check showed a real error; fixed by re-running and documented)
The VrwWzeLm2Eg and PoF1iCUIGtc slow-motion front clips hold the take-back for a long time, and the r2 contacts sat while the racket was still held high.
- **tiafoe_fh_3**: 559 → **660 ±4**. The ball is visible reaching the racket (`R3C_tiafoe_zoom.png`, `R3C_tiafoe_zoom2.png`).
- **tien_fh_2**: 565 → **703 ±10**. A first r3 read of 656 was also early and was caught in a re-check. The racket head lags at 648–680, the shaft is horizontal on his hitting side at ~688–703, the head whips up at 706–710, and the finish is at 738. The struck ball is not visible. Evidence: `R3C_tien2_contact4.png`, `R3C_tien2_contact5.png`, `R3C_tien2_finish.png`.
- **tien_fh_4**: 1368 → **1393 ±8**. The racket is held high to 1368, the shaft is horizontal at ~1390–1393, the head whips up at 1396, and the finish is ~1408. Forward moved 1360→1376 and finish 1398→1408 so the events follow the real take-back. Evidence: `R3C_tien4_contact.png`, `R3C_tien4_dense.png`.
- **tien_fh_5**: 1815 → **1982 ±10**. The racket is held high 1800–1940, drops at ~1945–1960, the shaft is horizontal at ~1980, the head whips up at ~1990, and the finish is 2010. Forward moved 1803→1945 and finish 1842→2010. **Caveat:** the camera zooms out during the take and a second person enters the frame. Bone-length CV is 0.42 (export log), so the joint scale on this take is the weakest of the Tien takes. It remains lowConfidence. Evidence: `R3C_tien5_contact.png`, `R3C_tien5_late.png`.
- Keyframes were re-selected from the same tracks. Normalisation is per take, so the joint values of these 4 takes differ from r2; no joint was edited.

## r3.5 Not re-audited (per the parent: no new full-roster audit)
- Paul FH 1–5, Mensik FH 1–5, Zverev BH 1–5 and Medvedev BH 1–3 looked plausible on `front_audit/page_0–6.png` but were not contact-zoomed.
- tiafoe_fh_1 (OvGakC-KQZs, 24 fps) and fils_fh_1/2/4 were not contact-zoomed.
- tiafoe_fh_4: parent-confirmed genuine FH, with the ball at the racket at ~964–968. The labelled 972 ±4 is at the edge of that, so it was left.

## r3.6 Kyle's standing decisions (Event 22) restated
- `timeScale`, depth, speedKmh and spinRpm stay **null until MEASURED**. No tempo was invented.
- Every front take is lowConfidence and must **not** become a match default. That covers the front-only Paul, Mensik, Tiafoe, Tien and Fils FH, and fritz_fh_5.
- Coverage is thin: 90 of 300 r2 slots, 56 of them lowConfidence. Tiafoe, Fils and Tien FH are now 3 front takes each. Cobolli, Nakashima, Nadal and Lehečka remain complete gaps, and nothing was invented. The missing Alcaraz FH/BH clip is still not on disk and was not invented.
