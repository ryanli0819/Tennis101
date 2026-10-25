# Talking points: presenting Tennis101 in an interview

Open the deck at **https://ryanli0819.github.io/Tennis101/presentation/** (arrow keys to move). Keep the [SQL Explorer](https://ryanli0819.github.io/Tennis101/presentation/sql-explorer.html) and the [Agent Control Room](https://ryanli0819.github.io/Tennis101/agents/dashboard.html) open in other tabs for live demos.

## The 30-second pitch
> "Tennis101 is a tennis game where you play inside a real pro's body. In most tennis games every player moves the same and the game carries you to the ball. In mine, height and weight decide your top speed, first step, braking and reach, so Sinner and Alcaraz feel different. To build it faster, I set up a team of ten AI agents with one job each, working in parallel through GitHub. I also captured Sinner's real serve from video, found and fixed where the pose data broke, organized all the data in SQL, and now his real motion drives his character in the game."

## How I figured it out (timeline)
| When | Step | What I decided and why |
|---|---|---|
| Notebook | Build order of 8 steps | Build in an order where each step stands on a working one. |
| Oct 24, ~8 PM | v0.1 match screen + scoring | Get the rules exactly right first (deuce, AD in/out, tiebreak to 7 or 10, serve rotation). |
| Oct 24, ~9 PM | v0.2 footwork | Player-controlled bodies: height and weight → speed, first step, braking, reach; split-step; stamina. |
| Oct 24, ~11 PM | Agent team | Too much for one person, so: 10 agents, each owning a folder, meeting at contracts, landing work as PRs. |
| Oct 24, ~11 PM | Guardrails | Agents never merge; GitHub issues as the message board; website auto-deploys; a version only at 5+ changes. |
| Oct 24, ~11 PM | Serve capture | Recorded Sinner's serve; Apple Vision gave 19 joints per frame. |
| Oct 24, ~11 PM | The bug | At the toss, the skeleton fell apart. I worked out why: the arm in front of the face. My rule: **whichever arm is on top is shown.** |
| Oct 25, ~1 AM | Data + game | SQLite for all data; queries measured the failure; Sinner's real motion now drives his serve in the game. |

## Slide by slide
1. **Title.** The moving dots are Sinner's real serve. "Everything you'll see comes from real data."
2. **Problem.** Three things I dislike in tennis games. End on the rule: trade-offs you can feel.
3. **Plan.** I plan before I build: eight steps, two done, the rest in progress with agents.
4. **Physics.** Point at the table: Sinner wins top speed and reach; Alcaraz wins first step and braking. "Neither is just better." Mention momentum and split-step timing.
5. **Agents.** One job each. Arrows show who uses whose work. Open the live dashboard if there's time.
6. **Guardrails.** "Parallel work breaks without rules": ownership, contracts, PRs, logs as memory, versions at 5+ changes.
7. **Capture.** Walk the pipeline left to right. Note the raw video never leaves my laptop.
8. **The bug.** The strongest story. Left: the raw data stretches his torso up to the ball. Right: after my rule. Explain how I noticed it: I watched frame 60 instead of trusting the numbers.
9. **SQL.** Why a database: to ask questions across players, frames, agents and versions. Rebuilt from the files every time, so it can't drift.
10. **Findings.** The detector loses about 90–100% of head and arm points at the trophy position and racket drop. "That turned a hunch into a number." Offer to run Q2 live.
11. **Result.** 2.95 m contact height, 0.65 s from toss release to contact, 30 of 30 test serves clean.
12. **Learned / next.** Pick one lesson and tell it as a story.

## Questions you may get
**Why SQLite and not just JSON files?**
JSON is good for storing one clip. SQL is good for asking questions across all of them, like "which body parts fail in which phase?" That is a join of joints, joint names and phases. The files stay the source of truth, and the database is rebuilt from them.

**How do you know the cleaned data is right?**
I check it visually: the 20 key frames, with the joints drawn on the real video frames. I also check it with numbers: bone lengths can't grow, the hips can't teleport, and the contact height comes out at a realistic 2.95 m. Rebuilt points are marked, so nothing is hidden.

**What was the hardest bug?**
At the toss, the detector put the neck and shoulders on the raised hand. At contact, it joined his legs with a spectator behind him. The fix was to anchor on the hips, which move smoothly, and make everything else fit a body of the right size. Whichever arm is on top is drawn up to the hand.

**How do the agents not break each other's work?**
- Each owns its own folders.
- They meet at written contracts.
- Each works on its own branch and opens a pull request that I review.
- Each keeps a log as its memory.
- The Serve Analyst must tell the Player Artist through a GitHub issue whenever the motion data changes.

**What would you do differently?**
Collect cleaner video, from a single fixed camera with no crowd behind the player. Also label the serve phases with a second person, to check my labels.

**What's honest about the limits?**
- Hitting is still a placeholder.
- Around contact the arm points are partly rebuilt.
- Hip height during the jump is approximate, because Sinner also moves toward the camera.
- There's one clip per serve so far.

## Demo checklist
- [ ] The deck opens to slide 1 and the dots are moving.
- [ ] The game: press Start match, then Space. Sinner tosses and serves with his real motion.
- [ ] The SQL Explorer: run Q2 and Q3.
- [ ] The dashboard: point at an agent card, its schedule and its log.
