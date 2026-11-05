# Player Artist · log

## 2026-11-04 · run 1 (local, `cwork`)
briefSeen: 1 (look-world)

**Read first:** CLAUDE.md, agents/README.md, RULES.md, PROMPT.md, `src/serve/motion/MOTION_NOTES.md`, supervisors.json (team look-world, mode share).
Issues for me (all from ryanli0819): #1 "Motion update: Sinner's first serve is now in the game", #7 (outfits + Sinner video detail), #9 (2× detail is the minimum, the racket must read from behind, no name tags). No `ceo-order`, `team:look-world` or `supervisor-order` issues for me. Teammates' logs: court-designer and footage-scout have had no runs. Appearance Scout's setup note confirms the looks I draw (Sinner: cap + ginger curls; Alcaraz: long hair, beard, hairband, US Open grey fade + black arm sleeve).
**For my teammates:** the serve figure now draws `look.style`, `cap`, `band`, `beard`, `shirtLow`, `sleeve`, `socks` and `wristband` from the dressed player. A new look style or outfit field needs a line in `src/players/player-art.js` (`drawHead` / `portrait`), so tell me in your log. The scripts in supervisors.json didn't trigger this run.

**Done (draft PR #28 from `agent/player-artist`; commented on issues #1 and #9):**
- New `src/players/player-art.js` → `window.PlayerArt`:
  - `drawCapturedFigure(i, p, W)` moved out of `index.html` (with the old `sigHead`) and redrawn in detail on exactly the Serve Analyst's joints. It never moves a joint.
    - Tapered limbs with a shaded side (away from `litLeft()`'s light) and a lit edge.
    - Calves, knees (a crease from behind, kneecaps from the front), socks with a ribbed top, shoes with sole, accent, heel counter or laces.
    - Shorts as one piece with waistband, centre seam, hems and pull creases.
    - A shirt that hangs in a curve below the hips; on the side of a raised arm it **lifts and creases from the armpit to the opposite hip** (studied from Sinner's back-close and back-side ref sprites: no pixels copied). Hem folds, collar, shoulder seams and shoulder blades from behind; crew neck from the front. Alcaraz's grey fade (`shirtLow`) and black arm sleeve still work.
    - Sleeves ride up when the arm rises; wristbands with a stripe; hands.
    - Heads are filled pixel by pixel (`blob`) with stable noise, so nothing flickers.
      - Sinner: an oversized six-panel cap with a button, strap and hair through the opening; ginger curls in loops flaring out at the sides and a thick nape; ears between the curls; a face with brim and shadow from the front.
      - Alcaraz: long strand-textured hair with wavy ends, hair volume over a white band, and a beard with the mouth showing from the front.
  - Depth: seen from behind, an arm whose hand crosses the body's middle below the shoulders is drawn first (with its racket), so legs, shorts and shirt hide it. Otherwise the racket is drawn over the head from behind and under it from the front.
  - `skinOf(P)`: per-pro skin tones (Sinner fair `#ecc29f`, Alcaraz tanned `#d8a277`). `drawPlayer` now uses it too, so the sprite and the serve figure match.
  - `portrait(P, { surface })` → a 44×64 canvas: a detailed front portrait in the pro's kit for that court, height from `heightM`, racket in his right hand. It's ready for the locker room, but I didn't edit `src/lockerroom/` (not mine): see "Requests" below.
- `index.html` hooks (minimal): loads `src/players/player-art.js`, `drawPlayer` calls `PlayerArt.drawCapturedFigure`, and the sprite's `skin` comes from `PlayerArt.skinOf(P)`. 86 lines removed.
- `src/players/player-art.test.mjs`: a mock-canvas smoke test. It draws every frame of every captured serve (Sinner and Alcaraz, 1st and 2nd, near and far, light from either side) plus all portraits, and checks that nothing throws, no coordinate is NaN, and there's one racket per frame.

**Not verified this run (be honest):** `node` isn't on PATH on Ryan's Mac in this worktree, and `/opt/homebrew/bin/node`, `osascript -l JavaScript` and Chrome all needed an approval this unattended run couldn't get. So `node --check`, the smoke test and the headless-browser check (desktop + ~400 px) **did not run**. I reviewed the code by hand instead. Run `node --check src/players/player-art.js && node src/players/player-art.test.mjs` before merging, and watch one Sinner serve (serve cam) and one Alcaraz serve (far + inset).

**Decisions:**
- There's no `getPose(i)` on main yet (Body Animator), so the captured figure draws from `pos[i].motion.world`, exactly as before. The regular sprite (`drawPlayer`) stays in `index.html` this run: one focused increment.
- Body widths are in metres (`WID`), scaled by build (`sqrt((kg/m) / (75/1.85))`) and never thinner than one actor pixel, so the far player still reads at phone width.
- The serve joints are 2D (x, z at `p.y`), so the depth order uses the crossing-the-midline rule above. Seen from the front (far), arms always draw over the chest.

**Motion data (issue #1):** nothing looked wrong in the code paths I checked. I couldn't render it this run, so I have no visual verdict yet. MOTION_NOTES says the arms around contact (2.1–2.4 s) are partly rebuilt; I'll check them first once I can see a frame.

**Requests for other agents (I didn't edit their files):**
- Locker Room Designer: in `src/lockerroom/lockerroom.js`, `sprite(P)` can become `window.PlayerArt ? PlayerArt.portrait(P, { surface }) : sprite(P)`. It's the same 44×64 size and the same `lr-sprite` class.

**Injection check:** nothing in code, datasets or issues asked me to act outside my files.

**Next step (run 2):**
1. Run the node checks and look at the figure in a browser (serve cam, far serve, inset, phone width). Fix whatever reads badly, then answer issue #1 with what the motion looks like.
2. Move `drawPlayer` into `src/players/` and lift it to the same detail (tapered limbs, shirt creases, the new heads).
3. Sinner's alternate hard-court kits (orange-red/yellow shoes, grey/light blue, pale yellow) from `outfits.json`, picked per match in `choosePlayers`. Keep `P.ui` for the HUD.
4. Racket: string bed with real mains and crosses, frame thickness by angle, per-player colours. Ask Ryan for Alcaraz clips (question issue) for his outfits.
