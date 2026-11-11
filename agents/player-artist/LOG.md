# Player Artist · log

## Run 1 · 2026-11-11 · briefSeen: look-world v1

Branch `agent/pixel-characters` (Ryan asked for this branch, not `agent/player-artist`). Teammates: Appearance Scout's files were the input; this run also filled the missing body numbers (see that log). Body Scout has no `body.json` yet. No `Motion update:` issue was open. Sinner and Alcaraz stay the reference looks already in `index.html`.

**Done**
- `src/players/roster.js`: the other 20 pros, same fields as `ROSTER` (height, weight, HUD colour, outfits per court, `look`). Left-handers: Shelton, Tien, Nadal. One-handed backhand: Federer. Skill points are copied onto `PLAYER_SKILLS` at load and are marked game-design in `appearance.json`.
- `src/players/looks.js`: signature drawing for headband, cap, backwards cap, bandana, waves, mop and a short crop, plus Sinner's cap and Alcaraz's hair so the preview can show them. `paint()` is the standing portrait. No brand marks. One skin tone for everyone.
- `src/players/pose.js`: `getPose(i)` and `JOINTS`, a standing skeleton in court metres from `heightM`, plus the racket from `racketPose` when a match is running. This is the fallback until Body Animator ships `src/body/`.
- `src/players/preview.html`: all 22, front and back, grass / hard / clay, with a tag for sourced colour, dress code, withheld, or neutral default. `node src/players/roster.test.mjs` checks the 20 records.
- `index.html` hooks only: load the three scripts, append `ROSTER_REST`, merge hair and racket colours, call `PlayerArt` for the new head styles, mirror a lefty's racket and shoulders, skip the sleeve and lengthen the shorts when the look says so, and keep a one-handed backhand on one hand. Scoring is untouched. `window.PLAYERS` and `window.pos` are exposed so `getPose` can see them.
- Checked in a headless browser: the welcome page loads, the locker room lists 22, walking on as Nadal puts the racket on his left (`racketX` negative) with the bandana look, and a 400 px-wide match still wraps the buttons. No page exception.

**Decisions**
- The animated body stays in `drawPlayer`. `getPose` does not replace it, so the run cycle and the serve motion are unchanged. The new looks are drawn on that body.
- `look.torso` (Medvedev narrow, Shelton and Tiafoe wide, Jódar and Tien slim) is a pixel scale taken from the words already in the appearance files, not a measured shoulder width.
- Kits without a cited colour use a navy or dusty default and say so. They are not presented as what he wore.

**Open problems**
- Most clay kits, and the hard kits without a 2025 US Open write-up, are still the neutral default. See the Appearance Scout log for the list.
- The locker room (`src/lockerroom/lockerroom.js`) prints "RIGHT-HANDED" for every card. That file is the Locker Room Designer's. It should read `P.lefty` and `P.backhand`.
- `getPose` is a standing pose. It does not follow the run cycle. When `src/body/` arrives, draw from that and delete the fallback.
- No `body.json`, so reach is still `0.44 * height + 0.69` and limb lengths are the shared skeleton scaled by height and `look.torso`.
- Sinner's game height (1.91 m) disagrees with the 2026 media guide (1.88 m). Left unchanged.
- Shelton's Paris 2026 clip is a navy kit; the hard-court sprite uses the US Open grey kit. Both are noted on his appearance file.

**Next step**
Replace `game-design-default` shirt colours when stills arrive, and rebuild the sprite widths from Body Scout's `body.json` (shoulder and hip) instead of `look.torso`.
