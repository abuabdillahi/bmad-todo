---
id: 9
type: story
title: "The whole app's coverage, performance and accessibility reports are written, with every finding settled"
parent: epic-manage-todos
covers: [R8, R14, R18, R19]
after: [8]
hitl: false
risk: medium
tracker_id: "50"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/50"
tracker_status: in-progress
---

# The whole app's coverage, performance and accessibility reports are written, with every finding settled

## Description

Writes the final whole-app coverage report, a performance profile of each action (add, edit, complete, reactivate, delete) against C4's 100 ms UI target with API p95 for every endpoint, and the accessibility report: the whole-app Lighthouse audit, the axe results, and an agent's keyboard pass and accessibility-tree pass of every core action, with the person's screen-reader check noted as the epic's Notes say; fixes or accepts each finding and updates the README for the new actions and routes.

## Requirements

Verify: docs/quality/ holds dated coverage, performance and accessibility reports naming epic-manage-todos, each finding fixed or accepted with a reason; every action shows within 100 ms and every endpoint's p95 is under 300 ms from at least 100 requests; Lighthouse reports no accessibility failures; pnpm test:all passes.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: Reports (Coverage, Performance, Accessibility)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-20 (at each epic's close: Lighthouse and the C4 profile against todo-test, at least 100 requests per endpoint); Consistency Conventions (Reports naming); Structural Seed (README contents)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Key Flows (Flow 2: every core action by keyboard and screen reader), Accessibility Floor

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): No agent can drive a real screen reader. R14's manual pass is run here as an agent's keyboard-only pass of every core action (Flow 2) and an accessibility-tree pass recording what a screen reader is given: names, roles, states, focus order and every live-region message. The accessibility report says so and leaves a dated line for the user's own screen-reader check, which they may add to spike 13's session on the phone (TalkBack) or run on desktop; any failure becomes a new bug. This story does not wait on it.
