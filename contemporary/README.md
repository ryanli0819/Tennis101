# contemporary/: changes waiting for the next version

Each change to the game that is not in a published version yet waits here as one file. Once there are **5 or more**, Agent 6 publishes them together as a new version (see `CHANGELOG.md`) and empties this folder.

## What counts as a change
One merged PR, or one direct commit to `main`, that changes what the game does or looks like (`index.html`, `src/`, game assets). Docs, agent instructions and version history files alone do not count.

## One file per change
Name: `YYYY-MM-DDTHH-MM-SS-0400--short-name.md`, using the time the change landed on `main`, in America/Indianapolis time with its UTC offset (`-0400` in summer, `-0500` in winter).

```md
# Short title a player would understand
- Landed: 2026-10-25 05:12:03 -04:00
- Source: Agent 1 · Ball physics, PR #12 (commit abc1234)
- Change: one or two plain sentences on what a player will notice.
```

The list of waiting changes is just the files in this folder, oldest first.
