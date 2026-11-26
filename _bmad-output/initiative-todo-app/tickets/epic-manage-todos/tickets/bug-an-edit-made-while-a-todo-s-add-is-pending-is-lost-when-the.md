---
id: 19
type: bug
title: "An edit made while a todo's add is pending is lost when the add fails"
parent: epic-manage-todos
covers: [R7, R12]
after: []
refined: true
hitl: false
risk: medium
severity: P2
tracker_id: "70"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/70"
tracker_status: backlog
---

# An edit made while a todo's add is pending is lost when the add fails

## Description

When a todo's add fails, the add field gets back the text the add sent. An edit the user typed on the new card while the add was still pending is dropped with the add, so it is lost without a word, against the epic's Outcome that the app never loses their work. A todo the user deleted while its add was pending also comes back into the add field, offered for resubmission. After a failed add, the add field should hold the latest text the user gave that todo, and nothing for a todo the user deleted. Found by epic-manage-todos' retrospective (R1, R2, action A1), which also found no test mixing edit, complete and delete on one todo.

## Reproduction

1. On the test profile, hold `POST /api/todos` (Playwright `page.route`), then add "buy milk".
2. While the add is pending, Edit the new card, change the text to "buy oat milk", and Save.
3. Fail the held add (a 503 problem or no response).
4. Actual: the card goes, "Couldn't add “buy milk”. …" is announced, and the add field holds "buy milk"; "buy oat milk" is gone. Expected: the add field holds "buy oat milk".
5. Repeat steps 1 to 3, but Delete the new card and confirm instead of editing.
6. Actual: the add field holds "buy milk", ready to resubmit the todo the user removed. Expected: the add field is left as it was.

## Cause Hypothesis

The mutation helper drops every follow-up queued behind a failed create and resolves it `dropped` (AD-13, U5), and the card ignores `dropped`, so the edited text lives nowhere. The add form reacts only to its own create's outcome and restores the text that create sent, with no knowledge of what its follow-ups did (retrospective R1 and R2: `mutations.ts`, `chain.createFailed`; `TodoCard.tsx` `save()`; `AddForm.tsx` `submit()`).

## Acceptance Criteria

1. **A failed add gives back the latest text the user gave the todo** (R7)
   **Given** a todo whose add is pending, and one or more edits saved on its card meanwhile (with or without a completion toggle)
   **When** the add fails, by a problem response or no response
   **Then** the add field, if still empty, holds the text of the last edit, cleaned as the field cleans it, with the caret at its end if focus is in the field; the add failure is announced as today; nothing queued behind the failed add is sent
2. **A todo deleted while its add was pending does not come back**
   **Given** a todo whose add is pending, and its delete confirmed meanwhile (with or without earlier edits)
   **When** the add fails with a problem response
   **Then** the add field is left as it was, no text is restored and no id is offered for reuse, and the list does not show the todo
3. **The add form's existing rules still hold**
   **Given** a failed add with no follow-ups, or with only a completion toggle
   **When** it fails
   **Then** the sent text is restored exactly as today: only into an empty field, newer typing never overwritten; resubmitting it unchanged reuses the failed add's id (story 1); and "Add landed after all" still clears the field only while it holds exactly the restored text
4. **A restored edited text is never sent with the failed add's id**
   **Given** the add field holding a restored edited text that differs from the text the failed add sent
   **When** the user submits it, changed or not
   **Then** it is added with a new id, as any changed text is (story 1), so AD-6 never sees the failed add's id with different text and answers no `409`
5. **Tests cover each mix of calls on one todo**
   **Given** the unit tests of the mutation helper and the add form
   **When** they run
   **Then** tests that fail on the current code cover criteria 1 and 2 (an edit, and a delete, each queued behind a failing create); and tests pin the final list state for a delete queued beside a failing edit and beside a failing completion of the same todo, both orders
6. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behaviour already holds, with the evidence recorded in Notes — this supersedes 1 to 5

## Boundaries

- Must not change: U5's rule that follow-ups behind a failed create are not sent, not reverted, and leave the pending count; the add, edit, complete and delete flows when no add fails; the announcement wording, which A10's backlog ticket owns for mixed calls; the API.
- Must not change: an Edit form open but not saved when the add fails is still discarded (EXPERIENCE, Failed add removes a card in use).
- Touch point: EXPERIENCE's Add failed and Follow-ups on a failed add rows describe today's behaviour; this ticket's criteria win where they differ (Notes).

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md, Outcome and R7, R12
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md, Diff-scope review (findings R1 and R2, the verification gap on crossed kinds); Action items A1; Open questions (R1's fix choice)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, State Patterns (Row states: Follow-ups on a failed add, Failed add removes a card in use; Add form states: Add failed, Add landed after all)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md, U5 (follow-ups behind a failed create are dropped)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-6 (POST replay and 409), AD-13 (the helper; a failed create drops its follow-ups)

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): from the retrospective's action item A1, fixed in this epic on a fix branch through the full gate.
- Assumption: the retrospective's open question on R1's fix choice is settled as "the latest edited text comes back in the add field", not "announced as lost": the card is gone, so the add field is the one place the text can live, and it reuses the existing Add failed path. The add failure is still announced for a deleted todo (AD-13 and U5 announce every failed create); A10 owns the announcement wording. EXPERIENCE's Add failed row ("the sent text is restored") should be updated to match through `bmad-ux` once this lands; the build does not edit it.
- Open question: AD-13 says components ignore `dropped`; if the fix changes what the create's outcome carries (for example the latest text, or that the todo was deleted), the plan records the new shape and a spine note is proposed through `bmad-architecture`, not made by the build.
- Open question: if an add with no response landed after all, its dropped delete was never sent, so the refetch shows the todo again; whether that needs more than today's Landed after all behaviour is answered in the build, and recorded in the plan.
- Open question: if the failed add landed after all, the refetch shows the todo with its original text while the add field holds the edited text; whether the field should then clear (today's rule) is answered in the build, and recorded in the plan.
- Risk medium: a rare path (a stalled or failing add plus a quick edit), but it loses what the user typed and touches AD-13's helper, which every action uses.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): the PO's assumption holds: when a pending create fails, the latest edited text comes back in the add field, as a failed add's text already does (EXPERIENCE, Add failed), the safest reading of the epic's Outcome that a user never loses their work. This story updates EXPERIENCE.md's two rows ("Add failed", "Follow-ups on a failed add") to match, with a dated line. The mutation helper's contract as AD-13 states it does not change; if the fix needs it to, the build halts for the user rather than editing the spine.
