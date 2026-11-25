---
id: 13
type: spike
title: "Does the add field behave as specified with a real Android keyboard?"
covers: [R13, R14]
after: [4, 11]
assignee: ""
refined: true
hitl: true
risk: medium
tracker_id: "31"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/31"
tracker_status: done
parent: epic-manage-todos
---

# Does the add field behave as specified with a real Android keyboard?

## Description

The add field's Enter handling for composing keyboards was proven only with synthetic trusted keys in Chromium (story 1.8). Two review findings could not be settled without a real Android keyboard: whether Enter with `enterkeyhint="done"` arrives in a way that inserts a newline instead of submitting, and whether clearing the field after a successful add can rewrite the value while a composition is still open. Either, if true, would be medium. The edit field (story 4) shares the same text-field rules, and story 11 changes Shift+Enter over a composing keyboard, so both fields are checked once they are on production. No story waits on the answer. The user runs it by hand on their own Android phone against production; no agent can.

## Approach

1. When story 4 and story 11 are deployed, the user opens production in Chrome on their Android phone, with Gboard and, if installed, one other keyboard (for example Samsung Keyboard or SwiftKey).
2. In the add field, per keyboard: Enter while a word is still composing (underlined); Enter after the word is committed (after a space); an add followed at once by more typing, to see whether the clearing touches the new text; Shift+Enter on a keyboard that has it.
3. The same Enter and Shift+Enter cases in a todo's edit field (Edit, change the text, Enter).
4. Time box: 30 minutes. Good enough: each case is recorded as works or fails, with what was seen.

## Acceptance Criteria

1. **Each case is run on a real phone against production**
   Verify: this ticket's Notes list each keyboard and case with what happened, the phone model and the Android and Chrome versions
2. **Each failing case has a home**
   Verify: each failing case is a new bug ticket, named in this ticket's Notes, created through the product owner
3. **The answer is recorded where the edit and add fields' owners find it**
   Verify: a dated Decision line in this ticket's Notes says whether the text-field rules hold on real Android keyboards

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-todo-added-in-the-browser-is-still-there-after-a-refresh-t-plan.md, Review Triage Log #2 (maybe-false, deferred as medium, unverified)
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 follow-up review pass, finding 1 of 7 (maybe-false, deferred as medium, unverified)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings ("Real Android IME behaviour stays untested") and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field, and the accessibility table's expected Android behaviour

## Notes

- Decision: 2026-11-25, user: This untested risk moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The order set on 2026-11-24 (this spike before the edit-field story) is reversed: the edit field (story 4) is built without waiting, and this spike moves into epic-manage-todos as entry 13 (`tickets.py move`), its one open hitl item, run by the user on a real phone against production after story 4 and story 11 ship. Any defect it finds becomes a new bug. No story, and not the epic's closing stories, waits on it.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Refined: devices, cases, the time box and where the answer goes are set in Approach.
- Result: 2026-11-25, user, against production on a Samsung SM-A166P/DS, Android 16, Chrome 158.0.8127.92, with Samsung Keyboard: every case in Approach was run and works. Add field: Enter while a word is composing submits; Enter after a committed word submits; typing straight after an add keeps the new text; Shift+Enter inserts no line break and submits nothing. Edit field: the same Enter and Shift+Enter cases work. No case failed, so no bug was opened. Gboard was not reported.
- Decision: 2026-11-25, user (result reported by the user, recorded by po): The text-field rules hold on a real Android keyboard (Samsung Keyboard on Android 16, Chrome 158) in both the add and the edit field. The two deferred medium findings (Enter with `enterkeyhint="done"` inserting a newline; clearing after an add rewriting an open composition) are not reproduced there and are closed. Gboard was not tested; reopen with a new bug only if a Gboard user reports a failure.
