---
name: watch-tennis-video
description: Watch a YouTube tennis video frame by frame (in the background, without downloading it) and write what a player looks like, how they hit serves, forehands, backhands and volleys, and how they run into datasets/players/<id>/style.json. Also produce dense ~10 fps motion sequences for the Serve Analyst, Racket Coach, Animator and Body Animator. Use when Ryan gives YouTube links (especially Tennis TV) and player names to train the agents or improve character animations.
---

# Watch a tennis video and train the agents

Ryan gives one or more YouTube links and the players to study. You watch the video yourself, frame by frame, and write
down only what you can see. The agents (Appearance Scout, Player Artist, Racket Coach, Animator, Body Animator, Serve Analyst)
read the result from `datasets/players/<id>/style.json`.

## Rules (from the project)

- **Never download the video** (no yt-dlp, no screen recording, no saved frames). Frames are only drawn onto a canvas
  inside the YouTube page and looked at with a screenshot. Nothing from the video is written to disk or committed.
- **Off Ryan's screen.** Use the built-in browser with its pane closed (`mcp__ccd_view__close_pane` `preview`). It keeps
  working hidden. Don't open the pane or Claude in Chrome.
- **Only what you saw.** Every observation names its video and time (`"v1 39.5"`). Anything you could not see goes in
  `notSeen`, never a guess. No skin tones or ethnicity; colours of clothes, hair, headwear and gear are fine.
- Know which hand the player uses before you call a stroke a forehand or a backhand. From behind, the player's right is
  screen-right. A left-hander (Shelton, Nadal) hits forehands on his left side.
- Prefer court-level or slow-motion / replay angles for swing and serve analysis.
- For any motion that will become animation data, sample at approximately **10 frames per second** (0.1 s steps) over the full kinetic chain (unit turn → contact → finish / recovery).
- Explicitly capture **serves** (first + second) and **volleys** in addition to groundstrokes and running.
- Never invent joint angles or timings; only record what is visible. Put missing phases in `notSeen`.

## Steps

1. **Open the video** in the built-in browser: `navigate` to the `youtube.com/watch?v=…` URL, then close the pane.
   `javascript_tool` → paste the whole of `frames.js` (this folder). It returns the title and length and hides the page
   behind a black canvas.
2. **Scan it**: `await sheet(range(0, 54, 6), 3)` then `screenshot`. Keep each call to about 9 frames (unbuffered seeks
   are slow; a call over ~45 s times out). Note the camera: *court-level* (behind one player, big and sharp — best for
   swings) or *broadcast* (high and wide — players small, fine for footwork and court position). Note who is near and
   far, the outfits and the scoreboard names, and which times are replays or close-ups.
3. **Pick moments** for each player: 2+ forehands, 2+ backhands, 1+ first serve, 1+ second serve, 1+ volley, a split step,
   a wide run and recovery, a slide or lunge, a close-up for the look. Camera cuts jump between points, so check the
   frames belong to one shot.
4. **Step through each moment**: `await crops(range(t-0.6, t+0.6, 0.2), fx, fy, fw, fh, 3)` with a box around the
   player (fractions of the frame; start wide, then tighten). For a swing, look for: stance (open, semi-open, closed),
   unit turn, takeback height and loop, one or two hands, contact point (in front, beside, late), finish (over the
   shoulder, across the body, around the neck, reverse), legs (load, jump, kick-back), and recovery.
   For running: ready stance width, split-step timing and depth, first step (crossover, jab, drop step), stride, side
   shuffle, how they brake (slide, plant, lunge), recovery steps.

4b. **Dense motion capture for animation**  
   For each chosen stroke or movement sequence that will feed the animation agents:
   - Use `await crops(range(t_start, t_end, 0.1), fx, fy, fw, fh, 3)` (or `sheet` if the whole body fits) so you get ~10 frames per second.
   - Typical windows:
     - Serve: trophy → contact → follow-through (~1.2–1.8 s)
     - Forehand / backhand: unit turn → contact → finish (~0.8–1.2 s)
     - Volley: split / unit turn → contact → recovery (~0.4–0.7 s)
     - Running / recovery: 8–12 consecutive frames covering acceleration, plant, or slide.
   - Note camera angle, player scale, and whether the sequence is continuous or cut.

5. **Write `datasets/players/<id>/style.json`** (shape below). If the file exists, add the new video to `observed` and
   merge; don't throw away earlier notes. A player with no folder yet gets one.
6. **Point the agents at it**: `gameHints` speaks to each agent in its own terms (Player Artist: sprite colours and
   the exaggeration; Racket Coach: swing path; Animator / Body Animator: poses and timing; Serve Analyst: trophy, toss, contact).
7. Close the tab or leave it on `about:blank`. Commit the JSON (`style.json` only) with the links in the message.

## style.json

```json
{
  "player": "alcaraz", "name": "Carlos Alcaraz", "hand": "right",
  "observed": [{ "id": "v1", "url": "…", "title": "…", "event": "Paris 2026", "surface": "hard (indoor)",
                 "camera": "court-level behind the near player", "watchedOn": "YYYY-MM-DD" }],
  "appearance": { "outfit": { "event": "Paris 2026", "shirt": "#hex + words", "shorts": "…", "shoes": "…",
                  "accessories": ["…"] }, "hair": "…", "headwear": "…", "build": "…", "seen": ["v1 65.0"] },
  "forehand": { "stance": "…", "takeback": "…", "contact": "…", "finish": "…", "legs": "…", "seen": ["…"],
                "confidence": "clear | partial | glimpse" },
  "backhand": { "hands": "two | one", "stance": "…", "takeback": "…", "contact": "…", "finish": "…", "legs": "…",
                "seen": ["…"], "confidence": "…" },
  "serve": {
    "type": "flat | kick | slice",
    "toss": "…",
    "trophy": "…",
    "contact": "…",
    "finish": "…",
    "legs": "…",
    "seen": ["v1 12.3-13.8"],
    "confidence": "clear | partial | glimpse",
    "fpsNotes": "sampled at 0.1 s"
  },
  "volley": {
    "type": "forehand | backhand | punch | block",
    "stance": "…",
    "contact": "…",
    "finish": "…",
    "seen": ["…"],
    "confidence": "…"
  },
  "running": { "ready": "…", "splitStep": "…", "firstStep": "…", "recovery": "…", "braking": "…", "seen": ["…"] },
  "motionSequences": [
    {
      "stroke": "serve-first | serve-second | forehand | backhand | volley | running",
      "video": "v1",
      "start": 12.3,
      "end": 13.8,
      "step": 0.1,
      "camera": "court-level behind",
      "notes": "clear kinetic chain, contact at frame ~7",
      "keyFrames": ["trophy", "contact", "finish"]
    }
  ],
  "mannerisms": ["…"],
  "gameHints": {
    "player-artist": "…",
    "racket-coach": "swing path and racket face at contact…",
    "animator": "20-frame run cycle notes + plant/slide timing…",
    "body-animator": "joint sequencing and weight transfer…",
    "serve-analyst": "trophy pose, toss height, contact point relative to body…"
  },
  "notSeen": ["…"]
}
