# Footage Scout · log

## 2026-11-05 — CEO orders #10 (round 2) and #32 "Find it yourself on youtube" (run by the HQ sync)
briefSeen: 1 (look-world)

- **Rankings:** kept the Nov 2 list (read live last run); no change needed for this order.
- **Searched YouTube myself** (YouTube search results page, titles and channels only; nothing downloaded): "<name> serve / forehand / backhand slow motion", then plain "<name> serve" etc. where nothing came up.
- **Added 59 clips for the 18 players who were missing strokes.** Every one of the live top 20 now has at least one serve1, forehand and backhand entry. Each link checked with YouTube oEmbed on Nov 5 (`oembed` field); one link that failed oEmbed (a Lehecka backhand short) was left out.
- Main channels: Courtside Tennis Highlights, Slow-Mo Tennis, Volley Viper Tennis, Love Tennis, Tennis Pro TV, Tennis Analytics (short single-stroke slow-mo; this channel also posts mirrored "Righty"/"Lefty" edits — those are noted and not used).
- **Weak spots (noted per player in `searched` and the clip notes):** no slow-motion serve found for **Fils** or **Nakashima** (practice video + a match-highlights fallback with the broadcast camera behind the server); **Jodar**'s and **Lehecka**'s backhands come from court-level practice videos, not stroke-only clips. Tien is left-handed (noted).
- `view` and `range` stay `null` unless the title says the view: the clips' chapters/descriptions don't give stroke time ranges, and I can't watch them.
- **Asked Ryan:** nothing new; recording a clip is only needed for the few players we turn into joints next (Zverev, Shelton, Medvedev in ranking order).
- **Next step:** set views and ranges when clips are recorded; keypoints for the next pros added to the game.

## 2026-11-02 — CEO order #10 (run by the HQ sync)
briefSeen: 1 (look-world)

- **Rankings:** read live from the official ATP page (atptour.com/en/rankings/singles, list of Nov 2, 2026). Changes since Oct 26: Zverev is No. 1, Sinner No. 2; Fils 7, Tiafoe 8, de Minaur 9, Jodar 10, Auger-Aliassime 13, **Lehecka new at 15**, Mensik 16, Davidovich Fokina 17. Bublik dropped out and moved to `extra` (kept there so `tools/intake/intake.py` still recognises him).
- **Clips found** (links only, `range: null`, status `to record`):
  - Sinner: forehand ×5, backhand ×3, 2nd serve ×1 (Slow-Mo Tennis and Courtside Tennis Highlights, court level, mostly 4K 60–120 fps).
  - Alcaraz: forehand ×2, backhand ×1, 2nd serve ×1, slice/drop shot ×1 (Slow-Mo Tennis, Volley Viper Tennis).
  - Titles and channels checked with YouTube oEmbed. I couldn't watch the clips, so `view` stays `null` and the time ranges aren't set: fill them in when the clip is recorded.
- **Asked Ryan:** a `needs:ryan` issue listing the clips to screen-record (Sinner first, then Alcaraz).
- Decisions: one catalog entry per stroke, even when two strokes come from the same video, so each recording maps to one entry.
- **Next step:** set the views and ranges once Ryan records the clips. Then do the rest of the top 20 in ranking order: Zverev, Shelton, Medvedev, Cobolli.
