---
id: 2
type: story
title: "The security headers are tested on assets, a missing asset and the unavailable response"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
---

# The security headers are tested on assets, a missing asset and the unavailable response

## Description

The header profile test checks `web`'s security headers on `/` and `/api/health` only. A hashed asset under `/assets/` (with its one-year `Cache-Control`), a missing asset (404) and nginx's 503 unavailable response are not tested, so an `add_header` added in one of those locations could silently drop the CSP and the other headers there. Report P1's asset caching was checked by hand with `curl` only.

## Requirements

Verify: `pnpm test:all` passes, and its profile step checks the AD-19 security headers on a hashed asset (plus its `Cache-Control`), on a missing asset that answers 404, and on the 503 unavailable response; adding an `add_header` inside the asset location makes the step fail.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Findings R3 and action item A4
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-19 and AD-20 (Profile tests)
- report — docs/quality/2026-11-25-epic-todo-foundation-performance.md, finding P1 (asset caching)

## Notes

- Decision: 2026-11-25, user: Retrospective action A4 gets its own backlog ticket at epic-todo-foundation's closure.
- Where the finding pointed: `apps/api/test/profile/headers.profile.test.ts:16`, and the warning about `add_header` at `apps/web/nginx.conf:11-12`.
