# Tennis101 HQ — records index

One row per order and one row per back-fill stub, **newest first** (CEO orders as a group, then stubs by opened time), per PROTOCOL.md §8.1. Reformatted by the Records & Release Keeper on Nov 11, 2026, 6:51 PM ET for HQ-20261111-002.RR.1 r2 (Event 19 REVIEW-RETURN). Status vocabulary: `open · assigned · working · in-review · returned · exec-review · with-ceo · approved · pushed · merged · released · blocked · rejected`.

**Snapshot time for statuses: Nov 11, 2026, 6:53 PM ET.** 001 `approved` (CEO-DECISION, canonical event 6). 002 `in-review` (Event 19 REVIEW-RETURN, Event 20 ACK, Event 21 r2 HANDIN at 6:53 PM ET). 003 `working` (Event 26 HANDIN from Motion Capture; other assignees still in progress). 004 `with-ceo` (Event 14 EXEC-PASS, Event 15 CEO-REPORT, 6:47 PM ET). 005 `with-ceo` (three HANDINs, Events 18–20 REVIEW-PASS, Event 21 REPORT, Event 22 EXEC-PASS at 6:51 PM ET noting the order remains open, Event 23 CEO-REPORT at 6:51 PM ET). 006 `with-ceo` (Event 26 EXEC-PASS, Event 27 CEO-REPORT).

Stub first-column ids are `PR-<n>` / `ISSUE-22` / `pending-frontend-menus-builder` — unique, and they do not reuse a live order or assignment id. Mapped-to HQ assignments are in each stub body (Event 2, or Event 1 for PR-45) and are mentioned in the title. They are manager-confirmed or manager-corrected (Event 19), except PR-45's mapped-to `HQ-20261111-003.RD.3`, which is the reasoned id from Event 19.

Fresh open-PR MEASURE at this snapshot (cursor-github `list_pull_requests` state=open): **17** open PRs — #44, #43, #42, #31–#23 (no #22), #21, #20, #19, #16, #4. PR #45 was created at 6:42 PM ET, was open at the 6:44 PM ET review (18 PRs), and **merged** at 6:50 PM ET (`merge_commit_sha=a6bd5f1a2c7fecdd344986e961e5b9144b3cfc7f`). See `records/2026-11-11/PR-45.md`.

| task-id | title | lead dept | status | opened | closed | PR(s) | version | record |
|---|---|---|---|---|---|---|---|---|
| HQ-20261111-006 | First GP order: stand ready; do not change second-serve or physics-ball defaults | GP | with-ceo | Nov 11, 2026, 6:30 PM ET |  |  |  | records/2026-11-11/HQ-20261111-006.md |
| HQ-20261111-005 | First PM order: one skeleton; Player Artist and PR #44; racket paths waiting on stroke keypoints | PM | with-ceo | Nov 11, 2026, 6:30 PM ET |  | #44, #28, #27, #26, #16 |  | records/2026-11-11/HQ-20261111-005.md |
| HQ-20261111-004 | First WF order: fix locker-room "RIGHT-HANDED" label | WF | with-ceo | Nov 11, 2026, 6:30 PM ET |  | #29, #31, #24, #4, #43 |  | records/2026-11-11/HQ-20261111-004.md |
| HQ-20261111-003 | First RD order: continue 22-player anatomy; settle Cobolli and Sinner heights; serve-data gaps | RD | working | Nov 11, 2026, 6:30 PM ET |  | #42, #21, #45 |  | records/2026-11-11/HQ-20261111-003.md |
| HQ-20261111-002 | First RR order: QA health table for 17 open PRs; records setup; reconcile PR #43 version notes | RR | in-review | Nov 11, 2026, 6:30 PM ET |  |  |  | records/2026-11-11/HQ-20261111-002.md |
| HQ-20261111-001 | Design the Grok Bot HQ team, prompts, review chain and records protocol | EX | approved | Nov 11, 2026, 6:05 PM ET |  |  |  | records/2026-11-11/HQ-20261111-001.md |
| PR-45 | Captured serves for all 22 roster players (mapped-to HQ-20261111-003.RD.3; MERGED 6:50 PM ET) | RD | merged | Nov 11, 2026, 6:42 PM ET | Nov 11, 2026, 6:50 PM ET | #45 |  | records/2026-11-11/PR-45.md |
| pending-frontend-menus-builder | pending — Front-end Menus Builder request for a first-task id (superseded by HQ-20261111-004 Event 2) | WF | open | Nov 11, 2026, 6:29 PM ET |  |  |  | records/2026-11-11/pending-frontend-menus-builder.md |
| PR-44 | Pixel characters for the rest of the roster (mapped-to HQ-20261111-005.PM.2) | PM | open | Nov 11, 2026, 2:57 PM ET |  | #44 |  | records/2026-11-11/PR-44.md |
| PR-43 | HQ campus and pixel buildings around the court (mapped-to HQ-20261111-004.WF.2; version notes under 002.RR.1) | WF | open | Nov 11, 2026, 2:47 PM ET |  | #43 |  | records/2026-11-11/PR-43.md |
| PR-42 | Body Scout: real bodies for all 22 pros (body.json + window.BODIES) (mapped-to HQ-20261111-003.RD.2) | RD | open | Nov 11, 2026, 2:40 PM ET |  | #42 |  | records/2026-11-11/PR-42.md |
| PR-31 | Start page: pixel-art title, How to play, controls choice, transitions (mapped-to parent HQ-20261111-004) | WF | open | Nov 4, 2026, 7:37 PM ET |  | #31 |  | records/2026-11-04/PR-31.md |
| PR-30 | First person: look down at the bounce, up with the toss, see your own hands, ball and racket (historical GP PR under parent HQ-20261111-006) | GP | open | Nov 4, 2026, 7:33 PM ET |  | #30 |  | records/2026-11-04/PR-30.md |
| PR-29 | Locker room: head to head, handedness, keyboard radio group (related to parent HQ-20261111-004; not 004.WF.1) | WF | open | Nov 4, 2026, 7:27 PM ET |  | #29 |  | records/2026-11-04/PR-29.md |
| PR-28 | Player Artist: detailed serve figure + locker-room portrait (src/players/) (mapped-to HQ-20261111-005.PM.2) | PM | open | Nov 4, 2026, 7:24 PM ET |  | #28 |  | records/2026-11-04/PR-28.md |
| PR-27 | Animator: direction changes — decel → plant → crossover / drop step / push-off → acceleration lean (mapped-to HQ-20261111-005.PM.1) | PM | open | Nov 4, 2026, 7:02 PM ET |  | #27 |  | records/2026-11-04/PR-27.md |
| PR-26 | Body Animator: jointed skeleton driven by the footwork (src/body/) (mapped-to HQ-20261111-005.PM.1) | PM | open | Nov 4, 2026, 6:54 PM ET |  | #26 |  | records/2026-11-04/PR-26.md |
| PR-25 | Serve Controller: hit your own serve — toss, power, aim, sweet spot, ace requirements (historical GP PR under parent HQ-20261111-006) | GP | open | Nov 4, 2026, 6:53 PM ET |  | #25 |  | records/2026-11-04/PR-25.md |
| PR-24 | Court Designer: stadium, courts, net and ball move to src/court/ (richer, cached) (mapped-to HQ-20261111-004.WF.2) | WF | open | Nov 4, 2026, 6:39 PM ET |  | #24 |  | records/2026-11-04/PR-24.md |
| PR-23 | Ball Physicist: real ball on cannon-es (opt-in ?ball=physics) (historical GP PR under parent HQ-20261111-006) | GP | open | Nov 2, 2026, 2:15 PM ET |  | #23 |  | records/2026-11-02/PR-23.md |
| PR-21 | Biomechanics Coach: Alcaraz separated from the crowd, joint ranges, serve / split-step / return-stance data, game check (mapped-to HQ-20261111-003.RD.2) | RD | open | Nov 2, 2026, 1:56 PM ET |  | #21 |  | records/2026-11-02/PR-21.md |
| ISSUE-22 | ISSUE #22 (not a PR): a clip that shows the receiver (return stance) (mapped-to HQ-20261111-003.RD.2) | RD | open | Nov 2, 2026, 1:56 PM ET |  | issue #22 |  | records/2026-11-02/ISSUE-22.md |
| PR-20 | Controls: WASD / arrows / touch / gamepad schemes, getMoveInput() (historical GP PR under parent HQ-20261111-006) | GP | open | Nov 2, 2026, 1:44 PM ET |  | #20 |  | records/2026-11-02/PR-20.md |
| PR-19 | Skills Coach: one STEP table, safe profile reads, Agility slide bonus, skill tests (historical GP PR under parent HQ-20261111-006) | GP | open | Nov 2, 2026, 1:40 PM ET |  | #19 |  | records/2026-11-02/PR-19.md |
| PR-16 | Racket Coach: move the racket into src/racket/ + racket tests (#11) (mapped-to HQ-20261111-005.PM.3) | PM | open | Nov 2, 2026, 1:36 PM ET |  | #16 |  | records/2026-11-02/PR-16.md |
| PR-4 | Guide Writer: How to play guide (mapped-to HQ-20261111-004.WF.3) | WF | open | Oct 26, 2026, 12:14 PM ET |  | #4 |  | records/2026-10-26/PR-4.md |
