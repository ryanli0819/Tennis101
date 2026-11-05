# Appearance Scout · log

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
