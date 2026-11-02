# Appearance Scout · log

## Run 1 · 2026-11-02 (local, Ryan's Mac)
briefSeen: look-world v1

Order: #12 (ceo-order, first run). Other open issues for me: none. Teammates (Player Artist, Court Designer, Footage Scout) have no runs logged yet.

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

**Next step**
When #18 stills arrive: read the hex values with `datasets/serves/tools/grab.swift` or a colour sample, fill `outfits.hard` and `outfits.clay` for zverev, shelton, medvedev and djokovic first, and set `confidence: clips`. If #18 is still open, refresh `top20.json` (due after Nov 9) and confirm the signatures for ranks 4–12 against press photos.

---

Before run 1: set up by Claude for Ryan (Nov 1, 2026): `datasets/players/<id>/` for all 20 players (ATP list of Oct 26) with `appearance.json`, `images/` and `video/` (local only). Sinner and Alcaraz done by Claude; Zverev, Medvedev and Djokovic had unconfirmed starting points.
