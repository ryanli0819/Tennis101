# Tennis101 version history

Newest first. Each version is a git tag (`vX.Y.Z`) with an exact publish time (America/Indianapolis, with UTC offset).

A new version is published only once **5 or more changes** have built up. Until then, each change waits in [`contemporary/`](contemporary/). Agent 6 manages this (rules: `docs/agents/prompts/6-version-history.md`).

## v0.2.1 — 2026-10-24 23:12:36 -04:00
- HUD no longer shows player speed. It shows height, weight, stamina and split-step feedback only.
- Team of 10 nightly agents planned (`docs/agents/TEAM.md`).

## v0.2.0 — 2026-10-24 20:54:11 -04:00
- You move Sinner yourself: arrow keys, or drag on the court.
- Movement comes from each player's real height and weight: top speed, first step, braking and reach.
- Momentum: changing direction means braking first. You can be wrong-footed.
- Split-step (Shift): time it with the opponent's hit for a faster first step.
- Stamina only partly comes back between points. Tired legs are slower.
- Placeholder hitting: you hit when the ball comes inside your reach ring.
- The page also runs as a plain local file.

## v0.1.0 — 2026-10-24 20:43:00 -04:00
- Night-match pixel court, Sinner vs Alcaraz.
- Full scoring: deuce, advantage, tiebreak to 7 or 10, best of 3 or 5.
- Broadcast scoreboard in the bottom-left corner.
- Simulated rallies and manual test buttons.
- Playable copy: `backup/index-v1-scoreboard.html`.
