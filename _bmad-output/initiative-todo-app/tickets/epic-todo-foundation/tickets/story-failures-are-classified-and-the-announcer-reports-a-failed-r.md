---
id: 5
type: story
title: "Failures are classified, and the announcer reports a failed refresh"
parent: epic-todo-foundation
covers: [R8, R12, R14, R17]
after: [3, 4]
hitl: false
risk: medium
tracker_id: "8"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/8"
tracker_status: in-progress
---

# Failures are classified, and the announcer reports a failed refresh

## Description

Builds AD-9's client failure classification, AD-11's todos store, query function, list-state selector and query policy, and AD-14's announcer, adding the leads and reasons to story 4's messages.ts and classifying story 3's problems, all of which story 6's helper uses; once the list is loaded a failed background fetch keeps the list and is announced.

## Requirements

Verify: On the test profile with a todo listed, stop the api container, switch to another tab and back: the list stays and the bottom banner says the refresh failed and why. Dismiss, by mouse or keyboard, clears it and focus lands on the add field.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: K7 whole; K6 for the Dismiss button; epic 2's K5 tests the list states it renders from this selector
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-9 (FailureKind; a cancellation is never network), AD-11 (todos store, query function, selector, query policy; refresh failure announced once loaded), AD-14 (announcer: three kinds, replacement rule, messages.ts)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Announcer, Dismiss button), Voice and Tone (Composition, Leads, Reasons, Overrides), State Patterns (List states: Refresh failed, Refetching; Announcer states), Motion (Announcer in, Announcer replaced, Dismiss), Information Architecture (regions in DOM and tab order), Interaction Primitives (Focus management: Dismiss, Announcer message appears; Pointer and touch); DESIGN.md Components (Announcer, Dismiss button), Layout & Spacing (Announcer placement per width)
