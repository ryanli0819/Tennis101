# Bodies: method and sources (Body Scout)

One `datasets/players/<id>/body.json` per pro on the roster (`datasets/footage/top20.json` → `players`, 22 pros), and
`src/players/bodies.js` (`window.BODIES`) generated from them.

```
python3 -I datasets/players/tools/build_bodies.py           # derive every body.json block and write src/players/bodies.js
python3 -I datasets/players/tools/build_bodies.py --check   # change nothing; fails if a file is stale or a check fails
```

## What is real and what is estimated

| Block in `body.json` | Written by | Status |
|---|---|---|
| `official` (height, weight, birth date, hand, backhand) | hand | **Sourced**: the ATP Tour profile of each player, one link per number. |
| `research` (arm-span ratio, leg shift, build multipliers, movement ratings, flexibility) | hand | **Judgement calls**, each with its `why` and its evidence (a link, or the Appearance Scout's / video notes' file). |
| `reach`, `segments`, `build`, `movement`, `flexibility`, `game` | the tool | **Estimates**, derived from the two blocks above with the ratios below. Each block says `"estimate": true` and its method. Never edit these by hand. |

No player on the roster has a published wingspan, segment length, shoulder or hip width, sprint test or joint range
that I could find (searched Nov 11, 2026). So only height, weight, age, hand and backhand are real measurements; the
rest is the standard human proportion for a man of that height, moved a little where the look or the evidence says so.
Nothing here is presented as measured on the player unless `official` carries it.

## Official numbers

Read on 2026-11-11 from the data each ATP Tour profile page loads
(`https://www.atptour.com/en/-/www/players/hero/<atp id>`; the profile link is in every `official.sources`).

| Player | ATP id | Height | Weight | Born | Hand | Backhand |
|---|---|---|---|---|---|---|
| Alexander Zverev | z355 | 1.98 m | 90 kg | 1997-04-20 | right | two-handed |
| Jannik Sinner | s0ag | 1.91 m | 77 kg | 2001-08-16 | right | two-handed |
| Carlos Alcaraz | a0e2 | 1.83 m | 74 kg | 2003-05-05 | right | two-handed |
| Ben Shelton | s0s1 | 1.93 m | 88 kg | 2002-10-09 | left | two-handed |
| Daniil Medvedev | mm58 | 1.98 m | 83 kg | 1996-02-11 | right | two-handed |
| Flavio Cobolli | c0e9 | 1.83 m | 74 kg | 2002-05-06 | right | two-handed |
| Arthur Fils | f0f1 | 1.85 m | 83 kg | 2004-06-12 | right | two-handed |
| Frances Tiafoe | td51 | 1.88 m | 86 kg | 1998-01-20 | right | two-handed |
| Alex de Minaur | dh58 | 1.83 m | 69 kg | 1999-02-17 | right | two-handed |
| Rafael Jódar | j0dz | 1.91 m | 70 kg | 2006-09-17 | right | two-handed |
| Novak Djokovic | d643 | 1.88 m | 82 kg | 1987-05-22 | right | two-handed |
| Taylor Fritz | fb98 | 1.96 m | 86 kg | 1997-10-28 | right | two-handed |
| Felix Auger-Aliassime | ag37 | 1.93 m | 88 kg | 2000-08-08 | right | two-handed |
| Tommy Paul | pl56 | 1.85 m | 82 kg | 1997-05-17 | right | two-handed |
| Jiri Lehecka | l0bv | 1.85 m | 81 kg | 2001-11-08 | right | two-handed |
| Jakub Mensik | m0ni | 1.96 m | 87 kg | 2005-09-01 | right | two-handed |
| Alejandro Davidovich Fokina | dh50 | 1.80 m | 82 kg | 1999-06-05 | right | two-handed |
| Brandon Nakashima | n0ae | 1.88 m | 83 kg | 2001-08-03 | right | two-handed |
| Learner Tien | t0ha | 1.80 m | 73 kg | 2005-12-02 | left | two-handed |
| Rafael Nadal (retired) | n409 | 1.85 m | 85 kg | 1986-06-03 | left | two-handed |
| Roger Federer (retired) | f324 | 1.85 m | 85 kg | 1981-08-08 | right | one-handed |
| Nick Kyrgios | ke17 | 1.93 m | 85 kg | 1995-04-27 | right | two-handed |

Disagreements between sources: Jódar is 191 cm on the ATP profile and 188 cm on the Next Gen ATP Finals page and
CoreTennis (ATP used). Mensik is 196 cm on the ATP profile; `mensik/appearance.json` says 1.93 m (ATP used).
The game's `ROSTER` (Sinner 1.91 m / 77 kg, Alcaraz 1.83 m / 74 kg) already matches: nothing to change in `index.html`.

## Ratios (fractions of standing height H)

"Checked" says how each reference was verified in the run of Nov 11, 2026. *Page* = the page was opened and read;
*search result* = the number came from a search-result summary of that page, the page itself did not open;
*citation* = a standard reference quoted from the literature, not opened this run.

| What | Ratio | Reference | Checked |
|---|---|---|---|
| Joint heights: ankle 0.039, knee 0.285, hip 0.530, shoulder 0.818, chin 0.870, eye 0.936 | → shin 0.246, thigh 0.245, trunk 0.288, head + neck 0.182 (they add up to 1.000) | Drillis R, Contini R. *Body Segment Parameters*. Tech. Rep. 1166-03, New York University, 1966; tabled in Winter DA, *Biomechanics and Motor Control of Human Movement*, 4th ed., Wiley 2009. The same numbers the Biomechanics Coach uses (`datasets/anatomy/joints.json` → `bodyProportions`, on its branch). | citation |
| Arm split: upper arm 0.186, forearm 0.146, hand 0.108; foot length 0.152 | used as the *split* of the arm (see below) | Drillis & Contini, as above | citation |
| Outer widths: shoulders 0.259, chest 0.174, hips 0.191 | body outline for drawing | Drillis & Contini, as above | citation |
| Arm span | 1.03 × H by default; 1.02 for compact builds, up to 1.05 for long-armed ones | "The ratio of height to arm span is traditionally considered 1 to 1.03 for men" ([Wikipedia: Arm span](https://en.wikipedia.org/wiki/Arm_span), citing Sylvester et al., ARTP statement on pulmonary function testing 2020, BMJ Open Respir Res) | page |
| Shoulder bone width (acromion to acromion) | 0.235 | NHANES III (1988–1994): men 20–29 average 41.5 cm, men 20+ 41.1 cm ([CDC table, archived](https://webarchive.library.unt.edu/eot2008/20081024180411/http://www.cdc.gov/nchs/data/nhanes/t54.pdf)); divided by a typical 1.76 m | search result (the PDF did not open); the 1.76 m divisor is mine |
| Shoulder joint centres | bone width − 0.016 H each side (about 3 cm) | my estimate: the centre of the ball of the humerus sits inside and below the tip of the acromion | estimate |
| Pelvis bone width (crest to crest, bi-iliac) | 0.150 | 27.0 cm (SD 2.0) in 17 men of mean height 182.3 cm ([PMC3011859, table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC3011859/table/T1)). A small sample: low confidence. | search result |
| Hip joint centres | 0.095 | Bell AL, Pedersen DR, Brand RA. Prediction of hip joint centre location from external landmarks (1989); J Biomech 1990;23:617–621: each centre about 0.36 of the inter-ASIS distance from the midline; a CT study put it 12% of that distance inside each ASIS. With an inter-ASIS distance of about 0.13 H (my estimate) → 0.095 H. | search result + estimate |
| Chest depth | 0.135 | typical adult man (about 24 cm); no reference opened | estimate |
| Raised shoulder | + 0.03 H to overhead reach | the shoulder girdle lifts when the arm goes up | estimate |
| Wrist to the racket's sweet spot | 0.50 m | 68.6 cm (27 in) racket held at the butt, sweet spot about 52 cm from the butt | estimate |
| Thickness seen from the front: neck 0.065, waist 0.160, thigh 0.100, calf 0.063, upper arm 0.055, forearm 0.045; head width 0.084 | for an average tour build | my estimates for the Player Artist | estimate |
| Reference build | BMI 23.25, 80.8 kg | Olympic men's tennis fields: London 2012 1.866 m / 81.2 kg / BMI 23.3, Rio 2016 1.86 m / 80.4 kg / BMI 23.2 ([Topend Sports: Anthropometry and Tennis](https://www.topendsports.com/sport/tennis/anthropometry.htm)) | page |

### The checks the tool runs on every player
1. **Height**: head + neck + trunk + thigh + shin + foot height = his official height, within 1 cm (rounding only).
2. **Arm span**: shoulder-joint spacing + 2 × (upper arm + forearm + hand) = his arm span. Drillis & Contini's arm
   pieces add up to 0.44 H a side, which with any real shoulder width gives a span well over height (1.07 H or more),
   so the arm is scaled to close the span (the quantity people actually measure) and their numbers are used only for
   how the arm divides into upper arm, forearm and hand.
3. Arm-span ratio inside 1.00–1.06, `flex` inside 0.8–1.2, every `official` number has a link, every game number has a `why`.
4. The generated `bodies.js` parses, has the 22 roster players, and `index.html`'s `ROSTER` agrees on height and weight.

### How a look changes a body (`research`)
- **`armSpanRatio`**: 1.03 unless the Appearance Scout's notes say long arms or limbs (Zverev, Mensik 1.045; Medvedev 1.05;
  Auger-Aliassime, Kyrgios 1.04) or a compact build (Alcaraz, Cobolli, de Minaur, Paul 1.02).
- **`legShift`**: moves a few thousandths of H from the trunk to the legs for players described as long-limbed
  (Medvedev +0.006, Zverev and Mensik +0.004, Auger-Aliassime +0.003). The height check still holds.
- **`build.mul`**: multipliers on shoulders, waist, thigh, calf and arm thickness for the features called out in
  `appearance.json` / `style.json` (Alcaraz's thick thighs, Shelton's and Fritz's shoulders, Nadal's left arm,
  Medvedev's thin limbs and narrow torso...). On top of that every thickness scales with √(BMI / 23.25).
- **Build type**: from BMI (under 21.8 lean, 21.8–24.2 athletic, above powerful), overridden only with a stated reason
  (Djokovic lean, Federer athletic).

## Movement

Published per-player speeds barely exist. What was found:
- **ATP / Tennis Data Innovations**: "maximum speed" of men's tennis **23.58 km/h** (6.55 m/s), against the NBA's 23.83 and
  professional soccer's 30.16 ([ATP physicality index explainer, Nov 25, 2023](https://www.atptour.com/en/news/physicality-index-detailed-explainer-2023); page).
  The game's reference athlete runs 6.6 m/s, so `bodyStats` is already on that scale.
- **Tennis Australia Game Insight Group** (three Australian Opens, runs of 3 m or more): Djokovic 36.02 km/h top and
  14.89 average top speed, Nadal 26.84 / 15.38, Federer 26.03 / 15.55
  ([tennis.com, Nov 29, 2016](https://www.tennis.com/news/articles/tennis-australia-djokovic-halep-are-the-sport-s-fastest-players); page).
  Match observations with an unpublished method (and not comparable with the ATP figure): stored under
  `movement.published`, not used as anyone's top speed.
- **Who is quick**: Arthur Fils's list of the quickest men on tour, Indian Wells 2026
  ([HITC](https://www.hitc.com/arthur-fils-picks-the-seven-quickest-players-in-mens-tennis/); page): Davidovich Fokina,
  Mpetshi Perricard, himself, Shelton, Monfils, Alcaraz, de Minaur. Thiem on de Minaur
  ([ATP feature, 2020](https://www.atptour.com/en/news/de-minaur-us-open-2020-speed-feature); search result).

So `game.topSpeed`, `accel` and `cod` are **estimates**: the game's own body formula (`bodyStats`: top = 6.6 · √h / w^0.25,
accel = 8.6 / w / √h, with h = height / 1.85 and w = weight / 75) × a small rating from that evidence (`research.movement`:
`mover` 1.00–1.07, `quick` 1.00–1.12, `cod` 1.00–1.15; exactly 1.00 where nothing was found) × age (after 30: −0.6% top
speed and −0.8% first step per year, my estimate; Nadal and Federer are modelled at their prime). `cod` = √(80.8 kg / weight) × rating × age.

## Flexibility

`flexibility.rangesDeg` starts from the normal active ranges the Biomechanics Coach tabled (AAOS, *Joint Motion: Method of
Measuring and Recording*, 1965, as in Norkin & White; `datasets/anatomy/joints.json` on `agent/biomechanics-coach`, copied
into the tool until it is on `main`), with the tour player's playing shoulder at about +10° external and −10° internal
rotation (Ellenbecker et al., J Orthop Sports Phys Ther 1996;24(6):336–341; citation). Hips, trunk rotation and ankle
dorsiflexion are multiplied by `flex` only for players with evidence:
- **Djokovic** `flex` 1.2, legs 165° apart in his widest stance: "I always have worked a lot on my flexibility, since a young age"
  ([Tennis365, Jul 8, 2023](https://www.tennis365.com/tennis-news/novak-djokovic-optimal-weight-longevity-flexibility-injury); page);
  filmed doing the splits ([Yahoo](https://www.yahoo.com/lifestyle/watch-62-tennis-star-novak-155000686.html); headline only).
- **Alcaraz** 1.06 / 130° (the low lunge in `alcaraz/style.json`), **Medvedev** 1.06 / 125° ("Pretzel", "Octopus").
- Everyone else: `"source": "typical elite range"`, 110° between the legs (my estimate of a normal tour slide).

`game.splitDepth` = 1 − cos(spread / 2): the share of his leg length the hips drop in that widest stance
(0.43 typical, 0.58 Alcaraz, 0.87 Djokovic). `flexibility.widestStance` gives the width and the drop in metres.

## What the game gets (`window.BODIES[id]`)
`game` (the contract in `agents/README.md`, plus `shoulderJointW`, `hipJointW` and `overheadReachM`), `proportions`
(fractions of height, for the Player Artist), `segments` (metres, for the Body Animator's skeleton), `flexDeg`,
`widestStance`, `hand`, `backhand`, `build`. `reachM` is the standing reach to the sweet spot with the arm straight out
(about 1.25–1.33 m); the game's current reach ring (`0.44 · height + 0.69`) is about 0.25 m longer because it includes a lean.

## Rules kept
Metres, kilograms, seconds, degrees. No skin tones or ethnicity. No photos or video in the repo. Fan-site wingspan
guesses (for example "203 cm" for Medvedev, with no source) were not used.
