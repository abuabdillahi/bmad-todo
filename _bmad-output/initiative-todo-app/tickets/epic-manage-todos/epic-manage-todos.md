---
tracker_id: "3"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/3"
type: epic
title: "A user manages their whole list, instantly, on any device"
parent: initiative-todo-app
covers: [R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R17, R18, R19, R20]
sources: []
companions: []
after: []
refined: true
risk: high
status: done
---

# A user manages their whole list, instantly, on any device

## Description

This epic completes the core loop of the Todo App initiative on top of epic 1's foundation. A user edits, completes, reactivates and deletes todos, with each delete confirmed inline in its card, and each change persists through the `PATCH` and `DELETE` endpoints, which have integration and contract tests (AD-6, AD-15). Every action shows at once and reverts with a message if saving fails, through AD-13's mutation helper and AD-14's announcer, both built in epic 1. Completed todos look distinct, as the `bmad-ux` design specifies, and the empty, loading and error states appear when they should (AD-11). All of it works on phone and desktop and meets WCAG 2.2 AA. The epic closes the app's quality record with the whole-app audits and reviews, and it ships through epic 1's pipeline.

## Outcome

A user manages their whole list without guidance on any device, and it never loses their work.

## Requirements

Each line keeps its parent's number. A shared id is narrowed to this epic's share, as the initiative's breakdown splits it.

- R4 (parent R4): A user marks a todo complete and can return it to active.
- R5 (parent R5; initiative decision 2026-11-24): A user deletes a todo after confirming inline in its card, with no undo. It leaves the list and does not come back on refresh.
- R6 (parent R6; initiative decision 2026-11-24): Completed todos look visibly different from active ones at a glance, and recede, in light and dark modes.
- R7 (parent R7; breakdown epic 2): Edit, complete, reactivate and delete show in the list at once, within C4's UI target, whether or not the save has finished. If a save fails, the change reverts and a message says so. A failed add resubmitted unchanged stores one todo, and a save the API never answers ends in a bounded time (Notes, decision 2026-11-25).
- R8 (parent R8): Every action and list state this epic builds works on desktop and mobile screen widths.
- R9 (parent R9): The list shows a distinct empty state, loading state and error state, each when its condition holds (AD-11).
- R10 (parent R10; breakdown epic 2): A backend API updates and deletes todos.
- R11 (parent R11; breakdown epic 2): Completion, edits and deletions survive a page refresh, a new browser session and a server restart.
- R12 (parent R12; breakdown epic 2): The API rejects an invalid update with a clear error and never leaves a todo half-written or half-deleted. The client refuses an invalid edit with its message, and shows a failed edit, completion, reactivation or delete, and a failed first load, without losing the list or blocking further use.
- R13 (parent R13): A user edits a todo's description, and the new text shows in the list and persists. The same rules apply as for create.
- R14 (parent R14): The whole app meets WCAG 2.2 AA in light and dark modes: axe-core reports no AA violations in any state its e2e tests reach, the whole-app Lighthouse audit finds none, and a keyboard and screen-reader pass of every core action finds no failures (run as Notes, decision 2026-11-25, says).
- R17 (parent R17; breakdown epic 2): Automated tests cover this epic's scenarios (U3, I4, I5, K2–K5, E2–E5, U5's edit, complete and delete half, and the update and delete part of I8, I9, I11, I12, I13, K6, E6, E7, E8) in the AD-20 harness, and the whole suite runs with one command. The e2e tests cover creating, completing, deleting and editing a todo, the empty state and error handling.
- R18 (parent R18; breakdown epic 2): The final whole-app coverage report names its gaps, and each is closed or accepted with a reason.
- R19 (parent R19; breakdown epic 2): Each action is profiled against C4's 100 ms UI target, and every endpoint's API p95 is measured against 300 ms. Every issue found is documented and fixed or accepted.
- R20 (parent R20; breakdown epic 2): The UI is reviewed for XSS in rendered and edited text, the update and delete routes for injection, and everything changed since epic 1's review. The review is documented, and every finding is fixed or accepted with a reason.

## Constraints

- C1 (parent C1): No authentication or multi-user support in v1; the data model and API must allow adding an owner later without a rewrite (AD-12).
- C3 (parent C3): Favour simplicity and maintainability: the fewest moving parts, and easy for a new developer to understand, run, deploy and extend.
- C4 (parent C4): An action shows within 100 ms, and the API answers within 300 ms at p95 with one user. The UI target is checked here.
- C5 (parent C5): v1 scope is the core loop plus the quality and delivery work in R14–R22. No feature beyond R1–R22 without a dated decision.
- C8 (parent C8): Each story ships its own tests. Each API endpoint gets integration and contract tests as it is built.
- C9 (parent C9): The running API is validated against the machine-readable contract (AD-20's contract suite).
- C10 (parent C10): The browser tests run on Playwright in CI. MCP tools are agent-side only. axe-core and Lighthouse perform the accessibility audits.
- C12 (parent C12): Production runs the CI-tested images on the Hetzner host through epic 1's pipeline; Cloudflare is the ingress only.

## Done when

- On the deployed app, a user edits, completes, reactivates and deletes todos. Delete opens an inline confirm and sends nothing until the user confirms, with no undo. Each change shows at once and persists after a refresh, a new session and a server restart, and an invalid edit is refused with a clear message. A failed add resubmitted unchanged stores one todo.
- Playwright journeys for create, complete, delete, edit, the empty state and error handling pass at phone and desktop widths and by keyboard, with no axe-core AA violations.
- Completed todos look distinct from active ones, and recede, in both light and dark modes. With the API slow, failing or unreachable, the loading and error states show, each action reverts with a message, and the list stays usable.
- The whole-app Lighthouse audit and a manual keyboard and screen-reader pass find no WCAG 2.2 AA failures.
- Documented under `docs/quality/`, with every finding fixed or accepted: a performance profile of each action against C4's 100 ms target, the final whole-app coverage report, and a security review covering XSS in rendered and edited text. Everything is deployed by the CI pipeline.

## Boundaries

- Belongs to epic-todo-foundation: the Docker, compose, CI and deploy setup, the test harness, the create and list endpoints, optimistic add, the `Problem` schema and its type URIs, the mutation helper, the announcer, AD-11's todos store, query function, list-state selector and query policy (with the refresh-failure announcement), and the design tokens for both colour modes. This epic renders the empty, loading and error states and the Loading status from that selector (K5; epic-todo-foundation Notes, decision 2026-11-24). This epic uses them and changes them only where its own actions need it.
- Owns, in its share of shared ids: update and delete (R10), persistence of completion, edits and deletions (R11), edit validation, atomic update and delete, and client handling of failed saves (R12), and optimistic edit, complete and delete (R7).
- Reuses, never duplicates: AD-13's mutation helper for every edit, complete and delete, and AD-14's announcer and `messages.ts` for every outcome message. It adds no second optimistic path, toast or alert, and no problem type outside AD-9's closed set.
- Must not change: create and list behaviour, the API contract for create and list, and the health checks, all as epic 1 delivers them.

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R4–R14, R17–R20) and Constraints (C1–C12)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 2 (the split of each shared id and scenario)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-6–AD-9, AD-11, AD-13–AD-15, AD-19, AD-20, and Deferred (R6, R8 to `bmad-ux`)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U3, I4, I5, K2–K5, E2–E5, the update/delete part of I8, I9, I11, I12, I13, K6, E6, E7, E8, and U5's edit, complete and delete half)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md (A3, A7, A8, F3: what this epic picks up from epic 1)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md and EXPERIENCE.md (the Todo card, Edit form, Delete confirm, list states, focus rules and completed styling this epic builds)

## Notes

- Waits on epic-todo-foundation because: it needs the deployed create and list API and its contract, the data model and storage, AD-13's mutation helper with AD-11's todos store and AD-14's announcer, the DESIGN.md tokens for light and dark modes, the compose profiles, the test harness, CI and automated deploy, and the list UI.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): It stays one epic at 13 entries: one capability, shipped together. This settles the open question on its size.
- Decision: 2026-11-24, user: Delete confirms inline in the card ("Delete this todo?" with Delete and Cancel), with no undo, for WCAG 3.3.4 (initiative Notes). K4 and E3 now include the confirm step, and the `DELETE` endpoint and AD-13's helper are unchanged.
- Decision: 2026-11-24, user: Light and dark modes are in v1, following the system setting. Completed todos must recede in both (initiative Notes; EXPERIENCE, Inspiration & Anti-patterns).
- Decision: 2026-11-24, po: This epic's share of the test-strategy updates: K3's paste and counter case, K4 and E3's confirm step, every K5 case, and I11's control-character rejection on update (spine AD-8, AD-11, AD-14).
- Decision: 2026-11-24, po: E6 is split by action. This epic owns its edit, complete and delete part and the list's error-state part, and epic 1 owns the add part.
- Decision: 2026-11-25, user: This epic's first story makes AD-13's mutation helper safe to build on, before edit, complete or delete use it (epic-todo-foundation retrospective A3, findings R1, R2, R9). It covers three things: a restored add that is resubmitted reuses its todo id (or replay is keyed on it), so a lost response cannot store the todo twice (AD-6); `createTodo` gets a timeout, with an nginx `proxy_read_timeout` to match, so a stalled API cannot hold an optimistic card for nginx's default 60 s; and `MutationSpec.position` either works or is removed. Its shape and criteria are settled when this epic is refined.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Retrospective A7's shared e2e helpers (`uniqueDescription`, `todoItem`, `announcement`, the message strings, a visible-only error locator that excludes `[role="status"]`) go into the first story that adds e2e tests, story 1, not a story of their own. This settles the open question on A7.
- Decision: 2026-11-25, user: The backlog from epic-todo-foundation's retrospective is scheduled around this epic. Before this epic's first story, as standalone builds: #32 (a storage failure reports internal, not unavailable), #35 (no todo text in error-path logs), #24 (security headers on assets, 404 and 503), #25 (README and `APP_ENV`) and #34 (compose project name), because this epic's endpoints and review build on that code. At this epic's refine, these move into it and are ordered with its stories: #31 (the real Android keyboard spike) before the edit-field story, #30 (Shift+Enter over an IME) and #29 (undo after a drop) with the edit field, and #33 (a shortened todo can split a character) with the first story that adds edit, complete or delete messages. #26 and #27 (deploy edge cases) and #28 (nginx's own 4xx errors are HTML, security report S3) have no deadline and are revisited at this epic's closing security review. A3 stays this epic's first story.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The epic is refined. Its Requirements are the parent lines it covers, each numbered as its parent id and narrowed to this epic's share per the initiative breakdown; Constraints are the parent lines that bind it. Risk is raised to high, its children's highest (stories 1 and 4).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Story 1 is the user's A3 story (Decision 2026-11-25 above), refined with full criteria: a failed add resubmitted with its unchanged restored text reuses its id; nginx's `proxy_read_timeout` for `/api` is 10 s and the API client aborts a write after 15 s with no response (`network`); `MutationSpec.position` is removed. Details in its Notes.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Backlog #33, #30, #29 and #31 move into this epic with `tickets.py move` as entries 10, 11, 12 and 13, ordered as the 2026-11-25 Decision says: 10 (#33) just before story 3, the first story whose messages quote a todo on complete, reopen or delete; 11 (#30) and 12 (#29) right after story 4, the edit field, which shares the add field's text-field rules, so each fix covers both fields.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The order set on 2026-11-24 for #31 is reversed: the edit-field story (4) is built without waiting, and #31 moves into this epic as entry 13, its one open hitl item, run by the user on a real phone against production after stories 4 and 11 ship. Any defect it finds becomes a new bug. No entry waits on it, the refactor sweep and closing stories included.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): test-strategy.md gains I12 (security headers, AD-19) and I13 (no todo text in logs, AD-17, AD-19), so new tests stop borrowing I8, I2, I10 and I7. Story 2, the first story that touches those test files, re-tags them. The architecture spine gains two notes only, through `bmad-architecture` in update mode: AD-20's contract-unavailable step also checks headers, and AD-9 names the todo routes, list and create among them, as answering a storage failure with `unavailable`.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): #26, #27 and #28 stay in the backlog until the closing security review (story 8), which decides each. Fixes that would touch the workflow's deploy steps, secrets, the host or the tunnel are proposed to the user, not built.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Tracer bullet: story 3, completing and reactivating a todo, the thinnest path through every layer the epic touches (card, helper, API client, PATCH, service, SQLite, deploy). Story 1 precedes it by the user's 2026-11-25 Decision, and story 2 builds the routes it calls; the first entry is therefore not the tracer, by decision.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Build order: 1 (helper safety), 2 (update and delete routes), 10 (#33), 3 (complete, the tracer), 4 (edit, the story least certain), 11 (#30), 12 (#29), 13 (#31, hitl), 5 (delete with confirm), 6 (list states), 7 (refactor sweep), 8 (security review), 9 (coverage, performance and accessibility reports, README). Stories 1, 2 and 10 share no code and can build in parallel; story 3 waits on 10 so its complete, reopen and deleted-elsewhere messages are built and tested on the fixed quote; 5 can build beside 11 and 12. Stories 3, 4, 5 and 6 are one lane through the card and the list area. The reports come after the sweep and the security review so they measure the final code, as in epic 1.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Shared scenarios split across stories: I4 and I5 whole, and the update and delete part of I8, I9, I11, I12 and I13, are story 2's; U3, K2 and E2 story 3's; K3 and E4 story 4's; K4 and E3 story 5's; K5 and E5 story 6's. U5, K6, E6, E7 and E8 go to the story that builds each action (E6's list error-state part to story 6). Story 1 adds U4, U5, K1 and E6 add-part tests for the resubmit and the stalled save.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): R14's manual keyboard and screen-reader pass: no agent can drive a real screen reader. Story 9 runs an agent's keyboard-only pass of every core action and an accessibility-tree pass of what a screen reader is given (names, roles, states, focus order, every live-region message), and the accessibility report leaves a dated line for the user's own screen-reader check, which they may add to spike 13's session on the phone (TalkBack) or run on desktop. Any failure becomes a new bug. The epic's closing work does not wait on it.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The spine's Deferred line on a write that may have landed names story 1's id reuse as its revisit condition. The spine is not edited for it in this run, because the user limited architecture changes to the AD-20 and AD-9 notes; story 1's plan records the as-built behaviour for the architect.
- Decision: 2026-11-25, user: AD-4 and AD-6 are amended to match story 8's fix for #28 (nginx answers its own 400 and 413 under `/api/` with AD-9's validation problem, through a reserved path it answers itself) and `DELETE`'s documented `400` (PR #63).
- Decision: 2026-11-25, user: The security review's proposals are built in this epic before it closes: #26 (entry 15), #27 (entry 16) and S10 (entry 17, the deploy job in a `production` environment). The user moves the deploy secrets into that environment themselves (entry 18, hitl).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Entries 15, 16 and 17 form one lane after story 8, since all three change `.github/workflows/ci.yml`; story 9 builds beside them. Entry 18, like spike 13, does not hold the epic's closure, but issue #3 closes only once it is done.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): epic-manage-todos' retrospective action items A1–A4 enter this epic as entries 19–22 (#70–#73), each fixed on a fix branch through the full gate before issue #3 closes. They share no code, need no `after`, and can build in parallel, after every built entry; none waits on entry 18 (#65). The retrospective's A6–A16 go to the backlog (#74–#84); A5 and A17 stay on #26 and #65. The epic now has 22 entries, superseding the 13 of the 2026-11-25 size Decision.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): the retrospective's in-scope fixes, entries 19–22 (#70–#73), land before the epic is set done and #3 closes.
- Decision: 2026-11-26, user: all non-essential work stops and closing this epic comes first. po's reading: entry 19 (#70, a pending add's edit lost when the add fails, against this epic's Outcome) stays and lands before closure; entries 20–22 (#71–#73, test- and docs-only) move to the backlog; the watch for #26's first scheduled run continues. This supersedes the 2026-11-26 po Decision that entries 19–22 land before closure.
- Decision: 2026-11-26, user: check, simplify and close this epic. The scheduled deploy catch-up (entry 15's build, PR #67) is removed by PR #87 (merge acf8b5e), since GitHub fired no scheduled run in the two hours after its cron reached main; the deploy job's steps are back to what they were before PR #67, apart from entry 17's `environment: production`; entry 16's `dispatch-off-main` stays. Entry 15 (#26) is closed as not planned; README keeps its remedy (re-run a cancelled tip deploy).
- Decision: 2026-11-26, user: entry 18 (#65) is done: the five deploy secrets live in environment `production`, which only main may deploy to; main run 45727428285 attempt 3 redeployed b167cfe and passed its public health check.
- Decision: 2026-11-26, po on the user's instruction: backlog tickets #71, #74, #75 and #81 are dropped as moot (they were about the removed catch-up), and #82 and #83 as process-only (they stay retrospective action items A14 and A15). #76 loses its catch-up parts. #72 closes when the closing-reports PR puts the 2026-11-25 edge results into the security report's S2 and S3 (its other parts are true after #65 or moot). Kept: #73, #76, #77, #78, #79, #80, #84. No new ticket.
- Decision: 2026-11-26, user: the epic is closed after its retrospective accepted it (accepted-with-open-items) and the PO's closure check passed: every Requirement, constraint and `Done when` line holds against the code, the `docs/quality/` reports at d0884e2 and main run 45741129446 (test and deploy, public health ok). Accepted deviations: the screen-reader half of R14 is the user's optional check (2026-11-25 Decision); restart persistence is proven only for create; a new session's persistence is tested only for create (complete, edit and delete keep no client-side state); the UI journeys ran on todo-test, production only through the API. Dropped: 2.15 (#26). Open items left in the backlog: #73, #76, #77, #78, #79, #80, #84.
