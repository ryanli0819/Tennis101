# Tennis101 version history

Newest first. Each version is a git tag (`vX.Y.Z`) with the approximate time it was published (Eastern time, to the hour).

A new version is published only once **5 or more changes** have built up. Until then, each change waits in [`contemporary/`](contemporary/). The Version Keeper manages this (rules: `agents/version-keeper/PROMPT.md`).

## v0.7.0 — Oct 28, 2026, 9 PM
- Smoother serves: Sinner's captured serves are smoothed and drawn on a curve between video frames, and the computer's serve has a real racket drop behind the back: one flowing motion from toss to finish. (Oct 28, 9 PM · Claude for Ryan, 759639e)
- More pixels on the players: Players and rackets are drawn at three times the court's pixel detail, so faces, hair, hands and the racket read clearly. (Oct 28, 9 PM · Claude for Ryan, 759639e)
- A racket that swings on the beat: The takeback starts as the ball comes, the racket loops and swings forward at the last moment, meets the ball at its own height, then follows through. (Oct 28, 9 PM · Claude for Ryan, 759639e)
- A slice you can read: The body tilts and the racket sweeps in one motion from about 2 o'clock (high, behind) to 4 o'clock for Sinner or 5 o'clock for Alcaraz (low, in front), with a faint trail. The computer decides early, so you can read its windup. (Oct 28, 9 PM · Claude for Ryan, 759639e)
- Slices float slower: A slice travels at about half the speed of a drive (about 14 m/s against 29 m/s) and still bounces low. (Oct 28, 9 PM · Claude for Ryan, 759639e)

## v0.6.0 — Oct 28, 2026, 10 AM
- Players run like players: Running frames: a 4-step run with swinging arms, a side-step shuffle, a back-pedal, a planted stance when changing direction, and a ready stance. (Oct 27, 10 PM · Claude for Ryan, direct commit)
- Slice to pull your opponent in: Hold E (or tap Slice) as you hit for a short, low slice; your opponent has to run up toward the net. (Oct 27, 10 PM · Claude for Ryan, direct commit)
- A packed stadium all around: An oval bowl of tiers surrounds the court, packed with people up to the roof, with aisles and floodlights at night. (Oct 27, 10 PM · Claude for Ryan, direct commit)
- Cleaner screen: No names over the players and no height/weight box; just a slim stamina strip, with tips popping up above the buttons. (Oct 28, 10 AM · Claude for Ryan, 9b44cd8)
- Detailed players: Twice the pixel detail on the players: textured hair and caps, faces, shaded jerseys with collars, wristbands, socks and proper shoes. (Oct 28, 10 AM · Claude for Ryan, 9b44cd8)
- A real racket: The racket has a handle, throat, frame and strings, and keeps its true shape from every camera angle and through every stroke. (Oct 28, 10 AM · Claude for Ryan, 9b44cd8)

## v0.5.0 — Oct 27, 2026, 11 PM
- WASD always moves; arrows or a click aim the serve: WASD now always moves your player, including walking to your serving spot before you serve. Aim your serve with the arrow keys or by clicking or tapping the service box. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- The whole serve, from the bounce: Every serve shows GET SET, then the ball bouncing, then the full windup and contact, with a close camera behind the server. V switches to first person. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- Serves curve like real ones: First serves skim low over the net and bend toward the line; second serves kick: a high arc, then a jump after the bounce. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- A real returner on the other side: The computer reads your toss and gets most serves back (about 93% of serves that land in). Aces are rare (about 4%) and need a perfect spot. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- Cleaner background: No stands or crowd behind the court; just the sky and the back wall, matched to each surface. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- Exit only where it belongs: No exit buttons on the welcome page or during a match. The locker room and the help guide have one. (Oct 27, 11 PM · Claude for Ryan, 6afc716)
- Outfits for each court: Sinner wears his real kits from the clips: all black on clay, navy and white on hard, all white on grass. (Oct 27, 11 PM · Claude for Ryan, 6afc716)

## v0.4.0 — Oct 27, 2026, 9 PM
- Points serve by themselves: About 4 seconds after each point the next serve comes by itself, with a READY countdown. No key needed. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- Aim your serve, with an ace chance: While you serve, A/D aims sideways and W/S sets the depth. A perfect spot with the receiver on the wrong side gives a big ace chance (stored in ACE_CHANCE). (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- Faults, double faults and lets: Serves can miss the box or hit the net; a second serve follows, and a second miss is a double fault. Lets are replayed, at each player's own let rate. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- Esc pauses; every screen has an exit: Esc opens Pause (Resume, New match, Exit to home). Setup screens have ✕ Exit, and the welcome page has Back to match. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- Faster movement and a slide: Base running speed is about 25% higher. Space slides in the direction you move: furthest on clay, least on grass. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- First-person view when you serve: From the countdown until just after you hit, you see the court through your own eyes at your pro's real eye height. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- A setting for each court: Grass is a summer afternoon (based on Ryan's references), clay a warm late afternoon, and hard a night session under floodlights. (Oct 27, 9 PM · Claude for Ryan, a8ea102)
- Sinner's real second serve: After a fault, Sinner serves with his real second serve, captured from video (toss over the head), instead of repeating his first. (Oct 27, 9 PM · Claude for Ryan, a8ea102)

## v0.3.0 — Oct 25, 2026, 2 PM
- The game opens on a welcome page: choose best of 3 or 5, then grass, red clay or hard, then enter the locker room and pick your pro. (Oct 25, 2 PM · Claude for Ryan, a2c842d)
- Skill points: 8 skills from 1 to 20, where every point adds the same step (for example, +2% top speed per Speed point). (Oct 25, 2 PM · Claude for Ryan, a2c842d)
- WASD controls: W toward the net, S back, A left, D right. How fast you move comes from the body and the Speed skill. (Oct 25, 2 PM · Claude for Ryan, a2c842d)
- Volleys out of the air, and a net camera that moves in when you pass the service line. (Oct 25, 2 PM · Claude for Ryan, a2c842d)
- Grass, red clay and hard courts change colour, pace and bounce height. (Oct 25, 2 PM · Claude for Ryan, a2c842d)
- Sinner serves with his real, captured motion: toss from his hand, contact at about 2.95 m. (Oct 25, 1 AM · Claude for Ryan, e9cdd3d)

## v0.2.1 — Oct 24, 2026, 11 PM
- HUD no longer shows player speed. It shows height, weight, stamina and split-step feedback only.
- Team of 10 nightly agents planned (`docs/agents/TEAM.md`).

## v0.2.0 — Oct 24, 2026, 9 PM
- You move Sinner yourself: arrow keys, or drag on the court.
- Movement comes from each player's real height and weight: top speed, first step, braking and reach.
- Momentum: changing direction means braking first. You can be wrong-footed.
- Split-step (Shift): time it with the opponent's hit for a faster first step.
- Stamina only partly comes back between points. Tired legs are slower.
- Placeholder hitting: you hit when the ball comes inside your reach ring.
- The page also runs as a plain local file.

## v0.1.0 — Oct 24, 2026, 9 PM
- Night-match pixel court, Sinner vs Alcaraz.
- Full scoring: deuce, advantage, tiebreak to 7 or 10, best of 3 or 5.
- Broadcast scoreboard in the bottom-left corner.
- Simulated rallies and manual test buttons.
- Playable copy: `backup/index-v1-scoreboard.html`.
