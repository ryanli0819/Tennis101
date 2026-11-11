# pending — Front-end Menus Builder request for a first-task id

- Ryan's order (verbatim): none received through the World & Front-end Manager. Standing first task is described in `prompts/frontend-menus-builder.md` only.
- Lead: World & Front-end Manager (`world-frontend-manager`)  Departments: WF  Acceptance criteria: not yet assigned.
- Status: awaiting ASSIGN and a task id. This file is a temporary record until the manager issues an order-id; it is not a CEO order.

## Event 1 · QUESTION · Nov 11, 2026, 6:29 PM ET · frontend-menus-builder → world-frontend-manager · channel: dm

```
[HQ][WF][frontend-menus-builder→world-frontend-manager][pending][QUESTION] request task id before starting first menus task

Task: pending  Round: r1  From: frontend-menus-builder (Front-end Menus Builder)  To: world-frontend-manager  Sent: Nov 11, 2026, 6:29 PM ET
Ryan's order (verbatim): none received through you; standing first task is from my prompt only.
What this message is: I am online and asking you to confirm a task id and send an ASSIGN before I start any work.
Deliverable / decision: none. I will not open a branch, write a patch, or edit game files until I have an id from you.
Proposed first task (from my prompt, for you to confirm or replace):
- Combine PR #31 and PR #29 on branch `agent/frontend-menus-builder` as a local patch only (no push).
- Fix locker-room cards so handedness and backhand come from `ROSTER` (`P.lefty`, `P.backhand`); Shelton, Tien and Nadal are left-handed; Federer has a one-handed backhand; adding a pro needs no code change here.
- Fix the Guide "?" overlap with locker-room ✕ Exit; through you, agree with the Guide Writer that the button hides while `StartFlow.isOpen()`.
- Verify the locker room against the 22-pro roster from PR #44.
- Standing criteria: `onSelect` with the right id (test); setup config unchanged; no exit buttons on welcome or in-match; no guide-button overlap; `node --check` on touched JS; page loads via `python3 -m http.server` with no console errors at desktop and ~400 px; keyboard/screen-reader and reduced motion.
Acceptance criteria table: n/a (QUESTION)
Self-reflection: n/a (QUESTION)
Confidence: n/a
Known gaps: no ASSIGN, no task id, and the parent CEO order for this game work is not in the records yet (HQ-20261111-001 is the org design, status with-ceo).
Needs from others: world-frontend-manager — please issue an ASSIGN with a task id (prompt suggested `.WF.2` under a parent order) and restated acceptance criteria. I will ACK and then begin the self-reflection loop.
Next step: you send the ASSIGN; I ACK and start. If this work is on hold until Ryan approves the HQ design, please say so.
Record: records/2026-11-11/pending-frontend-menus-builder.md (event #1)
```

## Event 2 · RECORD · Nov 11, 2026, 6:38 PM ET · records-release-keeper · channel: records
This file is a pre-id stub written by the Front-end Menus Builder at 6:29 PM ET, before HQ-20261111-004 existed. The same QUESTION is recorded as Event 2 of `records/2026-11-11/HQ-20261111-004.md`, and was answered by ASSIGN HQ-20261111-004.WF.1 (Event 5 of that file). This stub is not a CEO order. It is retained (not deleted; records are append-only) and indexed as a superseded stub. No earlier event text is edited.
