# Appearance Scout · log

## Run 6 · 2026-11-11 (pixel characters, branch agent/pixel-characters) · briefSeen: look-world v1

The roster is still the 22 in `datasets/footage/top20.json` `players` (Cerúndolo stays in `extra`). Sinner and Alcaraz were already finished, so this pass is the other 20. No new teammate logs changed the look. Body Scout has a prompt and no `body.json` yet.

**Done**
- Every one of the 20 `appearance.json` files now has a `body` block: height, weight, hand, backhand, with a source link. Active players are from the 2026 ATP media guide (player bios PDF). Nadal: Wikipedia height and hand, plus the ATP overview archived in Dec 2018 for 185 cm / 85 kg. Federer: Wikipedia height and one-handed backhand; weight 85 kg is the Tennis Companion ATP-derived table, because the media guide's legends page does not print it.
- `game` block: reach is the game's own formula (`0.44 * height + 0.69`), marked derived. `letRate` and the eight skill points are marked `game-design` or `estimate`, not measurements. Favourite serve is a one-line summary of the style already in the file, or `withheld`.
- Outfits: grass stays all white (dress code, `hexKind: dress-code`). Hard-court colours that a 2025 US Open article actually names are filled and marked `named-colour-approximate` (the hex is not a photo sample): Zverev grape purple, Shelton space grey and white with pink shoes, Medvedev purple, Tiafoe red, Fritz dark grey and black with blue shoes, Djokovic all black. Nadal's clay yellow shirt and white trousers were already cited. Kyrgios's red backwards cap and red shoes are the 2022 statement look already in his file. Everything else is `game-design-default` or `withheld`, not a guessed kit presented as fact.
- Menšík's signature said 1.93 m. The media guide says 1.96 m / 86 kg. The signature line now says 1.96 m, and the old figure is in `body.conflicts`.

**Conflicts**
- Cobolli: the media guide says 1.73 m (5'8") / 74 kg. Wikipedia says 1.83 m. Weight agrees. The game uses 1.83 m and keeps the guide figure in `body.conflicts`.
- Jódar: guide, Australian Open and US Open pages say 1.91 m / 70 kg. Roland-Garros says 69 kg. The game uses 70 kg. The old "about 1.91 m" note is confirmed.
- Small weight gaps vs Tennis Companion (guide used): de Minaur 68 not 69, Paul 81 not 82, Davidovich Fokina 79 not 80, Nakashima 83 not 84.
- Sinner and Alcaraz were not edited. The same guide lists Sinner at 1.88 m / 77 kg (the game has 1.91 m / 77 kg) and Alcaraz at 1.83 m / 73 kg (the game has 74 kg). Left as they are so the finished sprites do not shift.
- Shelton: `style.json` (Paris 2026, indoor hard) shows a dark navy kit and a white headband. The US Open 2025 day-1 report shows space grey, white, sleeveless, pink shoes. Hard-court kit in the game is the US Open one. The headband and dark wavy hair come from the Paris clip.
- Alcaraz in `style.json` (Paris 2026) has no hairband and a navy shirt with neon-yellow shorts. `ROSTER` still uses Ryan's long-hair, white-band, US Open look. Not changed.

**Still open**
- Hex values for the default kits need stills (issue #18). Do not treat `game-design-default` as a real shirt.
- Federer's US Open and clay shirts were left white on purpose (`hexKind: withheld`).
- Mannerisms marked to confirm still need clips.

**Next step**
When #18 stills arrive, sample the real hex and set `hexKind` to `clips`, starting with the players still on the neutral default: Fils, Cobolli, de Minaur, Jódar, Auger-Aliassime, Paul, Lehečka, Menšík, Davidovich Fokina, Nakashima, Tien, and Nadal's hard-court colour.

## Run 5 · 2026-11-09 (local pipeline, CEO order #35) · briefSeen: look-world v1

Order #35: the roster is now 22 (Cerúndolo out; Federer, Nadal and Kyrgios in). Ratings: none yet. Teammates: no new log entries that change my work. Other open issues for me: #18 (stills, still waiting on Ryan).

**Done**
- New `datasets/players/{federer,nadal,kyrgios}/appearance.json` in the same shape as the others, plus `images/.gitkeep` and `video/.gitkeep`. All three parse. `rank: null` with a `rankNote`, and `sourcedOn: 2026-11-09`.
- New optional field `era` says which look we use: **Federer** at his peak headband era (about 2004–2012), with the 2001 ponytail + bandana noted; **Nadal** in the 2005–2008 "pirate" era (long hair, bandana, sleeveless shirt, capri pants), which reads best in pixels and which he calls part of his identity, with the later short-hair look noted; **Kyrgios** in 2022 (backwards cap, red cap and shoes as a statement).
- Sources: 9 / 9 / 7 links, one per claim (ESPN, Tennis.com, Tennis365, Euronews, Irish Times, Eurosport, theScore, Inverse, Punto de Break and others).
- Every personality claim left in `personality` has a link. Anything I could not source went to a new `personality.toConfirm` list instead of being stated: Federer's between-point habits, his fist pump and his all-court style; Nadal's "Vamos" fist pump and his topspin baseline style; Kyrgios's serve routine and his forehand/drop shots.

**Still to check**
- Heights (Federer and Nadal about 1.85 m, Kyrgios about 1.93 m) are general knowledge, not sourced. Hair details too.
- Hex colours: only the grass all-white is set. Nadal's 2005 clay kit (yellow shirt, white pirate trousers) is in the notes without hex. Waiting on #18 stills.
- Mannerisms need clips (Footage Scout has #36 for these three).
- For the Player Artist: Kyrgios's underarm/tweener serve should be an AI serve option, like Bublik's.

**Decisions**
- `top20.json` is from Nov 2 (7 days old), so no refresh this run.
- Cerúndolo's file stays as it is (he is parked in `extra`, like Rublev, Rune and Tsitsipas).
- No instructions in repo content asked me to act outside my files.

**Next step**
Find sources for the `toConfirm` items and the heights. Then outfits from #18 stills when they arrive. Refresh `top20.json` after Nov 16.

## Run 4 · 2026-11-05 (HQ sync, CEO orders #12 and #33, review round 2) · briefSeen: look-world v1

Fixed exactly what Look & World's round-1 review asked:
1. **Lehečka** (live No. 15 on the Nov 2 list) added: `datasets/players/lehecka/appearance.json` with a signature and a personality from public media, one link per claim (Tennis Majors, Tennis365, ATP Tour, Punto de Break). Signature/build is general knowledge, so `confidence: to research`; height still to confirm.
2. **Ranks**: every `appearance.json` now has `rank` and `rankedOn: 2026-11-02` from `datasets/footage/top20.json` (PR #15), e.g. Zverev 1, Sinner 2. Bublik's file is kept with `rank: null` and a `rankNote` (in `extra`, No. 21+).
3. **Style lines**: Djokovic's style now has sources (ATP on his return, Tennis365, The Racquet on the sliding splits); Alcaraz's has the ATP forehand drop shot piece.

**Decisions**
- No photos, no hex values guessed; outfits still wait on #18.
- Rublev, Rune and Tsitsipas folders still have no `appearance.json`; they are in `extra`, so left alone.

**Next step**
Outfits when #18 stills arrive; confirm Lehečka's height and look against press photos.

## Run 3 · 2026-11-05 (HQ sync, CEO order #33, issue #33) · briefSeen: look-world v1

Order: "Do research on your own and acquire their personalities and appearances according to their very own media portrayal" (Look & World's criteria: personality and signature for all 20, from public media, a source link per claim, unconfirmed items marked, no photos).

**Done**
- All 20 `appearance.json` files now have a `sources` list (`{claim, url}`, 2–4 links each) from interviews, features and press: ATP Tour, Tennis.com, tournament sites, TIME, Hypebeast, Racquet, Tennis Majors, Tennis365, Punto de Break and others. Also `sourcedOn: 2026-11-05`.
- Djokovic and Alcaraz had empty personalities. Both are now filled: Djokovic's bouncing under pressure and his heart celebration; Alcaraz's smile ("the key to everything") and crowd shots.
- Every other player got a sourced `personality.notes` line: Shelton's phone celebration and "boring" off court, Medvedev's crowd trolling and "tantrums are who I am", Tien "talks like he plays", de Minaur's Demon camera sign, Fils's "Siu", and so on. Celebrations were added where a source shows them.
- `confidence`: the five `to research` players and Djokovic (`medium`) are now `public`, because their personality is sourced.

**Decisions / still unconfirmed**
- Signatures (hair, build) are still general knowledge without a link. The `source` text says so. Linking them needs photos, and photos stay out of git, so #18 is still open.
- Low-quality SEO pages (fake 2026 bios, "girlfriend" pages) were skipped. Gossip and private-life items were left out (RULES).
- Mannerisms marked "to confirm" still need clips (Footage Scout's catalog, PR #15).

**Next step**
Outfits per court. When #18 stills or the Footage Scout clips arrive, read the hex values and set `confidence: clips`.

## Run 2 · 2026-11-02 (local pipeline, Ryan's Mac)
briefSeen: look-world v1

Order: #12 (ceo-order). This continues the HQ-sync run below, which did ranks 2 and 4–10. Other open issues for me: none. Teammates (Player Artist, Court Designer, Footage Scout) have no runs logged yet.

**Done**
- `top20.json` is from Oct 26 (7 days old), so no refresh this run.
- No photos or video exist for anyone except Sinner and Alcaraz (other players only have serve keypoints in `datasets/serves/`). So this run used public sources.
- Filled `signature`, `exaggerate`, `personality` and `source` for the 9 players who were all `to research`: fritz, paul, nakashima, tien, mensik, cerundolo, davidovich-fokina, bublik, jodar. Also filled Sinner's empty `personality`.
- Outfit facts confirmed this run: Fritz walked on at Wimbledon 2026 in a custom all-white suit with quick-release trousers he tore off on court (a possible walk-on animation). Mensik wore a maroon/pink look at the 2026 US Open mixed doubles; the hex values still need to be read from images.
- Opened #18 (`needs:ryan`), asking for one still per player per event (US Open, clay, Wimbledon 2026) plus a short clip of each serve routine.

**Decisions**
- I did not invent hex values. Public pages don't give reliable 2026 kit colours, so all hard/clay outfits except Sinner's and Alcaraz's are still `to research`. Grass stays all white with trims to research.
- Confidence: `public` where a source backs the signature (fritz, mensik, bublik, jodar); `to research` where it is general knowledge only (paul, nakashima, tien, cerundolo, davidovich-fokina).
- For the Player Artist and the AI: Bublik's underarm serve is well documented. It should become an AI serve option and part of his look.
- Jodar's height: the Delray Beach tournament page says 1.91 m / 70 kg, while other sites say 1.85 to 1.91 m. I used about 1.91 m.

**Open problems**
- Folders `rune`, `rublev` and `tsitsipas` exist in `datasets/players/` but have no `appearance.json`, and they are not in the Oct 26 top 20 (probably left over from the serve compilation). I left them alone. Ryan: keep them or drop them?
- Mannerisms (bounce counts, towel habits) are general and need clips to confirm.
- Search results were full of auto-generated SEO pages with made-up 2026 stats. I only used the tournament, ATP-adjacent and major press sources named in each `source`.
- No instructions found in repo content that asked me to act outside my files.

- Djokovic (rank 12) still has the starting point Claude set up (confidence `medium`). He is the last of the 20 still needing a signature/personality pass.
- My first write of this log dropped the run-1 entry below by mistake; restored.

**Next step**
Djokovic signature and personality first. Then, when #18 stills arrive: read the hex values with `datasets/serves/tools/grab.swift` or a colour sample, fill `outfits.hard` and `outfits.clay` for zverev, shelton, medvedev and djokovic first, and set `confidence: clips`. If #18 is still open, refresh `top20.json` (due after Nov 9) and confirm the signatures for ranks 4–12 against press photos.

## Run 1 · 2026-11-02 (HQ sync, CEO order #12) · briefSeen: 1
- Done (first increment): signature, `exaggerate` and personality for ranks 2 and 4–10 — Zverev, Shelton, Medvedev, Cobolli, Auger-Aliassime, Fils, Tiafoe, de Minaur. Confidence `public` (well-documented looks and on-court character), not yet checked against images.
- Decision: outfits stay `to research`. No uploads in `datasets/players/<id>/images/` yet, and kit colours change every season, so no hex values were guessed.
- Next step (then): ranks 11–20 signatures and personalities, then outfits from Ryan's images or press photos.

---

Before run 1: set up by Claude for Ryan (Nov 1, 2026): `datasets/players/<id>/` for all 20 players (ATP list of Oct 26) with `appearance.json`, `images/` and `video/` (local only). Sinner and Alcaraz done by Claude; Zverev, Medvedev and Djokovic had unconfirmed starting points.
