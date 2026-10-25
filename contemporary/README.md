# contemporary/: changes waiting for the next version

Each change to the game that is not in a published version yet waits here as one file. Once there are **5 or more**, the Version Keeper publishes them together as a new version (see `CHANGELOG.md`) and empties this folder.

## What counts as a change
One merged PR, or one direct commit to `main`, that changes what the game does or looks like (`index.html`, `src/`, game assets). Docs, agent instructions and version history files alone do not count.

## One file per change
Name: `YYYY-MM-DD-HHh--short-name.md` (for example `2026-10-25-05h--ball-bounce.md`), using the hour the change landed on `main`, Eastern time. The date in the name keeps the files in order.

```md
# Short title a player would understand
- Landed: Oct 25, 5 AM
- Source: Ball Physicist, PR #12 (commit abc1234)
- Change: one or two plain sentences on what a player will notice.
```

The list of waiting changes is just the files in this folder, oldest first.
