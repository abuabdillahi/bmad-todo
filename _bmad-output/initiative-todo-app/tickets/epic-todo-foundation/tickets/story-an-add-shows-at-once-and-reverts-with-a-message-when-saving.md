---
id: 6
type: story
title: "An add shows at once and reverts with a message when saving fails"
parent: epic-todo-foundation
covers: [R7, R8, R12, R14, R17]
after: [4, 5]
hitl: false
risk: medium
tracker_id: "9"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/9"
tracker_status: in-progress
---

# An add shows at once and reverts with a message when saving fails

## Description

Builds AD-13's mutation helper on story 5's store and announcer and moves story 1's add onto it, so the card shows on top at once, 'Added' is announced on confirmation, and a failed add removes its card, announces why and restores the text into story 4's field.

## Requirements

Verify: On the test profile: an added todo appears on top at once and 'Added' shows after. Stop the api container and add another: it appears, then goes, the banner says the add failed, the text is back in the field, and the earlier todos stay.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: U4 whole; E1's 'appears at once' clause; U5 create-ordering and failed-create (dropped follow-ups) half; K1 failed-add restore and add-landed-after-all clauses; E6 add part (failing and unreachable, reverts with a message, list stays usable); E8 for those states (keyboard, axe-core in light and dark)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-7 (client-minted id), AD-11 (optimistic add on top, also before the first load), AD-13 (the helper whole: order per todo, pending count, revert, dropped follow-ups, per-call promise, revertedAt, invalidate at 0), AD-14 (Added status), AD-20 (the motion-on spec; the offline spec for an offline add and an offline refetch)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: State Patterns (Add form states: Submitted, Add failed, Add landed after all; List states: Add during Loading, Add during Error, Add fails before a first successful load), Information Architecture (List area exceptions), Motion (Add), Interaction Primitives (Focus management: Add failed), Voice and Tone ({t} quoting, the add lead, the Added status)
- initiative — _bmad-output/initiative-todo-app/initiative-todo-app.md: Notes, Decision 2026-11-24 accepted risk under R7
