---
id: 9
type: story
title: "Epic 1's quality reports and README are written, with every finding settled"
parent: epic-todo-foundation
covers: [R14, R18, R19, R20]
after: [8]
hitl: false
risk: medium
tracker_id: "12"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/12"
tracker_status: backlog
---

# Epic 1's quality reports and README are written, with every finding settled

## Description

Writes the coverage, accessibility (Lighthouse), performance (first load profiled and documented, API p95 from at least 100 requests per endpoint) and security reports under docs/quality/ on the swept code, fixes or accepts each finding, and writes the README to run, test, read logs, deploy, roll back and extend.

## Requirements

Verify: docs/quality/ holds four dated reports naming epic-todo-foundation, each finding fixed or accepted with a reason, API p95 under 300 ms; a teammate following only the README from a clean clone starts the dev and test profiles healthy and runs pnpm test:all.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: Reports (Coverage, Performance, Accessibility without the manual pass, which is epic 2's, Security)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-19, AD-20 (at each epic's close); Consistency Conventions (Reports naming); Structural Seed (README contents)
