---
id: 2
type: story
title: "The security headers are tested on assets, a missing asset and the unavailable response"
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
tracker_id: "24"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/24"
tracker_status: done
---

# The security headers are tested on assets, a missing asset and the unavailable response

## Description

The header profile test checks `web`'s security headers on `/` and `/api/health` only. A hashed asset under `/assets/` (with its one-year `Cache-Control`), a missing asset (404) and nginx's 503 unavailable response are not tested, so an `add_header` added in one of those locations could silently drop the CSP and the other headers there. Report P1's asset caching was checked by hand with `curl` only.

## Requirements

1. **A hashed asset carries the security headers and a year's cache** (R20; AD-19)
   **Given** `todo-test` is up
   **When** a client requests a hashed asset that the served `index.html` links to
   **Then** the response is `200`, carries every AD-19 header with the values `/` carries, and has `Cache-Control: max-age=31536000`
2. **The page itself is revalidated on every load** (report P1)
   **Given** `todo-test` is up
   **When** a client requests `/`
   **Then** the response has `Cache-Control: no-cache`, as well as the AD-19 headers it is already tested for
3. **A missing asset is a 404 with the security headers, never the page** (AD-19; report P1)
   **Given** `todo-test` is up
   **When** a client requests an asset path under `/assets/` that does not exist
   **Then** the response is `404`, carries every AD-19 header, and its body is not `index.html`
4. **The unavailable response carries the security headers** (AD-4, AD-19)
   **Given** the `api` container is stopped and `web-test` is up, which in `pnpm test:all` is only the contract-unavailable step (`apps/api/test/unavailable/`), so this check lives there
   **When** a client requests `GET /api/todos`
   **Then** the response is nginx's `503` unavailable problem and carries every AD-19 header
5. **The tests catch the mistake they exist for**
   **Given** an `add_header` line is added inside nginx's asset location
   **When** `pnpm test:all` runs
   **Then** it fails on criterion 1 or 3. This is proved once by hand and recorded in the plan, not left in the code.
6. **The suite passes**
   **Given** the change
   **When** `pnpm test:all` runs, locally and in CI
   **Then** it passes, and each new test's title starts with a scenario id

## Boundaries

- Must not change: nginx's configuration, unless a new test exposes a real defect. Then the fix stays inside AD-19 and the plan says what was wrong.
- Must not change: the order of `pnpm test:all`'s steps, or the AD-4 body nginx sends. Adding the header check to the contract-unavailable step keeps AD-20's rule for it (every `/api` route answers the literal `503` problem); the plan notes it for the next AD-20 amendment.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Findings R3 and action item A4
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-19 and AD-20 (Profile tests)
- report — docs/quality/2026-11-25-epic-todo-foundation-performance.md, finding P1 (asset caching)

## Notes

- Decision: 2026-11-25, user: Retrospective action A4 gets its own backlog ticket at epic-todo-foundation's closure.
- Where the finding pointed: `apps/api/test/profile/headers.profile.test.ts:16`, and the warning about `add_header` at `apps/web/nginx.conf:11-12`.
