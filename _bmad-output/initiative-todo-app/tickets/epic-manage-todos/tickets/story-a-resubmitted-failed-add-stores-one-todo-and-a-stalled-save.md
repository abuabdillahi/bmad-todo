---
id: 1
type: story
title: "A resubmitted failed add stores one todo, and a stalled save gives up in time"
parent: epic-manage-todos
covers: [R7, R12, R17]
after: ["1.6", "1.7"]
refined: true
hitl: false
risk: high
tracker_id: "42"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/42"
tracker_status: done
---

# A resubmitted failed add stores one todo, and a stalled save gives up in time

## Description

Makes AD-13's mutation helper safe before edit, complete and delete build on it (epic-todo-foundation retrospective A3, findings R1, R2, R9; the user's Decision of 2026-11-25 in the epic's Notes). A failed add whose text comes back unchanged is resubmitted with its first id, so AD-6's idempotent replay stores one todo even when the first request landed. A stalled API can hold an optimistic change for at most about 10 s through nginx, and 15 s at the client. The unused `MutationSpec.position` goes. The e2e specs share one set of helpers (retrospective A7), so every later story's e2e tests start from them.

## Requirements

Verify: On the test profile, pause the api container for 12 s while adding a todo: within about 10 s the card goes and the banner says the add failed because the server isn't available. Unpause and, if the text is still in the field, press Add without changing it. After a refresh exactly one todo with that text is listed.

1. **A resubmitted unchanged add reuses its id** (R7, R12)
   **Given** an add failed (with any `FailureKind`) and its text was restored into the add field
   **When** the user submits the field with that text unchanged
   **Then** the request carries the failed add's id, not a new one
   **And** if the first request had been stored, the server answers with the stored todo (AD-6's `200` replay), the list holds that todo once, and "Added “{t}”." is announced as for a `201`
   **And** if it had not been stored, the todo is created as usual

2. **Changed text is a new todo** (R7, R12)
   **Given** an add failed and its text was restored into the add field
   **When** the user changes the text in any way (even back and forth to a different value) and submits
   **Then** a new id is minted, so a `409` conflict never comes from a reused id
   **And** a failed add whose text was never restored, because the field was not empty, is never resubmitted under its id

3. **A resubmitted create starts a fresh chain** (R7; U5)
   **Given** a resubmitted add is pending with a follow-up queued behind it on the same id
   **When** the resubmitted create succeeds
   **Then** the follow-up is sent, not dropped because the earlier create with that id failed
   **And** if the resubmitted create fails too, its follow-ups are dropped, as for any failed create

4. **A stalled API ends the save within about 10 s** (R7, R12)
   **Given** the API has accepted a request but does not answer
   **When** 10 s pass with no response
   **Then** nginx answers with AD-4's literal `503` unavailable problem, the add reverts with the unavailable reason, and the list stays usable
   **And** nginx still connects with its 1 s connect timeout, and every other `/api` route answers a stalled API the same way

5. **The client gives up on a write with no response after 15 s** (R7, R12)
   **Given** a write request (create today; update and delete use the same rule when later stories add them) has had no response for 15 s
   **When** the 15 s pass
   **Then** the client stops waiting, the failure is classified `network` (AD-9), and the change reverts with the network reason
   **And** a fetch the caller's own signal aborts is still a cancellation, never `network` (AD-9, AD-11), and the list's `GET` gets no client timeout

6. **The e2e specs share one set of helpers** (R17)
   **Given** the e2e specs
   **When** a spec needs a unique description, a todo's list item, the Announcer's message, a message string, or a visible error that is not in a `role="status"` region
   **Then** it imports one shared helper for it, and no spec defines its own copy (retrospective A7, duplication map, P2)
   **And** every existing e2e test still passes, with axe-core in each, in every Playwright project

7. **Tests cover each rule**
   **Given** `pnpm test:all`
   **When** it runs
   **Then** unit tests (U4, U5) cover criteria 1–3 and 5 at the helper and the client, a component test (K1) covers the field's resubmit with the same and with a changed text, and e2e tests (E6, E8) cover a response lost after the server stored the todo (Playwright `page.route` lets the request through, then aborts the response) and a stalled API, each followed by a resubmit leaving one todo

## Boundaries

- Must not change: the create and list contract and status codes (AD-6), the add form's restore rule (the text comes back only into an empty field), "Add landed after all" clearing the field, the optimistic add on top, the Announcer's wording, or how the list's `GET` is cancelled.
- No new problem type, toast or test-only switch in app code (AD-9, AD-14, AD-20).

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md: findings R1, R2 and R9 (action A3), the duplication map and P2 (action A7)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: U4 and U5 (a follow-up behind a resubmitted create), K1 (a resubmitted restored add), E6 add part (a stalled API and a lost response revert with a message), E8 for those states
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-4 (nginx answers upstream failures, 504 included, with the unavailable problem), AD-6 (POST 200 replay, 409), AD-7 (client-minted id), AD-9 (network, cancellation), AD-13 (the helper), AD-20 (e2e: page.route only); Deferred (a write that fails may have been applied; revisit with a resubmit that reuses the failed id)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: State Patterns (Add form states: Add failed, Add landed after all; Row states: Landed after all, Add succeeded on 201 or 200 replay)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Add form, Text field)

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): The shape of the user's 2026-11-25 first story is settled: (a) the failed add's id is reused only when its restored text is resubmitted unchanged, since a changed text under the same id would answer `409`; (b) nginx's `proxy_read_timeout` for `/api` is 10 s, so a stalled API becomes AD-4's existing `503` unavailable problem, and the API client aborts a write with no response after 15 s, a backstop for when nginx itself does not answer, classified `network`; (c) `MutationSpec.position` is removed, not made to work, because no planned action places a todo anywhere but the top and a revert already restores a todo's place.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Retrospective A7's shared e2e helpers go into this story, the first in the epic that adds e2e tests, not a story of their own.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The architecture spine's Deferred line on a failed write that may have landed names this story's id reuse as its revisit condition. The spine is not edited in this run (the user limited architecture changes to the AD-20 and AD-9 notes); the plan records the as-built behaviour, and the line is left for the architect.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): AC2's "changes the text in any way" is read as the submitted text differing from the restored text: text edited and returned to exactly the restored value counts as unchanged and reuses the id. This is safe under AD-6, since the API replays only when the description matches, and it is what PR #52 built and K1 pins (deferred item from the 2.1 plan's review).
- Check beyond the criteria (risk high): a reviewer runs the Verify by hand on the test profile, pausing the api container with `docker compose -p todo-test pause api`, so the request lands after nginx has given up, the real "landed after all" path.
- Where the findings pointed: `apps/web/src/todos/mutations.ts` (addTodo mints an id per call; `position`), `apps/web/src/api/client.ts` (`createTodo` sends no signal), `apps/web/nginx.conf` (`proxy_connect_timeout 1s` only).
