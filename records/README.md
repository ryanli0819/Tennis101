# Tennis101 HQ — records

This is the project's append-only trail: every order, assignment, hand-in, review, approval, and records note, so Ryan can trace any step back to where it went wrong. It follows PROTOCOL.md §8.

The Records & Release Keeper owns the structure of this folder, `README.md`, and `INDEX.md`. Everyone may **append** events to a task record. Only the Records & Release Keeper may restructure files, reformat the index, or fix links.

## Layout

```
records/
  README.md                     # this file
  INDEX.md                      # one row per order (and indexed stubs), newest first
  2026-11-11/
    HQ-20261111-001.md          # the full trail of one order: every event, append-only
  2026-11-02/
    PR-16.md                    # back-filled open-PR stub, mapped to a task id
  ratings/                      # optional: Ryan's scores per order
```

- **Date folder:** the day the order (or PR, for a back-fill stub) was **opened**. Later events go in the same file, even on later days.
- **Working copy:** records are written live at `/workspace/tennis101-hq/records/` on the box.
- **Git:** records (`records/` only, no game code) may go up on branch `records/log` without waiting for the review chain (CEO-DECISION, HQ-20261111-001, Nov 11, 2026, 6:25 PM ET). They merge into `main` only alongside an approved release, and only Ryan merges.

## INDEX.md

One row per open order, newest first:

`| task-id | title | lead dept | status | opened | closed | PR(s) | version | record |`

Status is one of:

`open · assigned · working · in-review · returned · exec-review · with-ceo · approved · pushed · merged · released · blocked · rejected`

Task ids: CEO orders are `HQ-YYYYMMDD-NNN`. Assignments are `<order-id>.<DEPT>.<n>`, with department codes RD, PM, GP, WF, RR, EX.

## Task record format (append-only, newest at the bottom)

```md
# HQ-YYYYMMDD-NNN — <title>
- Ryan's order (verbatim): "<...>"   (from <channel>, <date, time> ET)
- Lead: <dept manager>  Departments: <codes>  Acceptance criteria: <list>

## Event 1 · ORDER · Nov 11, 2026, 6 PM ET · kyle → <manager> · channel: email|dm
<the PROTOCOL §7.2 body, or a short summary plus a link to the full text>
```

Every event header has a **type**, a **time in ET**, a **from**, a **to** (when there is one), and a **channel**.

**Rules:**

- Never edit or delete an earlier event. A correction is a new event that says `corrects event <n>`.
- Every assignment and handoff, every review verdict and revision, and every approval gets an event.
- A message that is not in the record counts as **not sent**.

## How records fit the version history

- **`agents/<slug>/LOG.md`:** each agent's running memory. Every entry starts with `Task: <task-id>` and `briefSeen: <dept> v<n>`.
- **`contemporary/<YYYY-MM-DD-HHh--name.md>`:** created only when a change **lands on `main`**. It gets a `Record:` line pointing at this trail. Docs and version-history files alone do not count as player-visible changes.
- **`versions/<ver>/changes/`:** files move here when a version is published, and keep their `Record:` line. Do not write new notes straight into a published version.
- **`CHANGELOG.md`:** bullets stay as they are, `(<time> · <agent>, PR #n)`, with the task id added after the PR number.

## After a merge

The Records & Release Keeper writes the `contemporary/` change file, closes the task in `INDEX.md`, and publishes a version once 5 or more player-visible changes are waiting.
