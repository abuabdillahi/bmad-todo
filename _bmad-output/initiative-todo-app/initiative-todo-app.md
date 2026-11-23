---
id:
type: initiative
title: "Individuals manage personal todos in a simple, durable full-stack app"
sources: ["_bmad-output/initiative-todo-app/prd-todo-app.md", "_bmad-output/initiative-todo-app/notes-quality-infra.md"]
companions: ["_bmad-output/initiative-todo-app/test-strategy.md"]
after: []
risk: high
---

# Individuals manage personal todos in a simple, durable full-stack app

## Description

The first version of a full-stack Todo app, built from the PRD in `prd-todo-app.md` and the testing, Docker and QA notes in `notes-quality-infra.md`. One person opens the app, sees their list, and adds, edits, completes and deletes tasks without guidance. The list is still there after a refresh, a new session or a server restart. The scope is deliberately minimal: the core loop done well. It ships in Docker, is tested at every layer from the first story, and meets WCAG 2.2 AA. It closes with documented coverage, performance and security reviews, so a future developer can extend it with confidence. Every push is tested in CI on GitHub, and a passing main branch deploys itself to production, tentatively on Cloudflare.

## Outcome

An individual can manage their personal tasks without onboarding and trust that the list persists. Success means users complete every core action unguided and the app stays stable across refreshes and sessions.

## Requirements

- R1 (prd ¶2): A user creates a todo by entering a short text description, and it appears in the list.
- R2 (prd ¶2): Every todo has a description, a completion status and its creation time.
- R3 (prd ¶2): Opening the app shows the user's todo list straight away, with no onboarding or explanation.
- R4 (prd ¶2): A user marks a todo complete and can return it to active.
- R5 (prd ¶2): A user deletes a todo. It leaves the list and does not come back on refresh.
- R6 (prd ¶3): Completed todos look visibly different from active ones at a glance.
- R7 (prd ¶3, ¶5): Add, edit, complete and delete show in the list at once, within C4's UI target, whether or not the save has finished. If a save fails, the change reverts and a message says so.
- R8 (prd ¶3): Every action works on desktop and mobile screen widths.
- R9 (prd ¶3): The list shows a distinct empty state, loading state and error state, each when its condition holds.
- R10 (prd ¶4): A backend API creates, lists, updates and deletes todos.
- R11 (prd ¶4, ¶7): Todos and their status survive a page refresh, a new browser session and a server restart.
- R12 (prd ¶4, ¶5): The API rejects invalid input with a clear error and never leaves a todo half-written. The client shows failures without losing the list or blocking further use.
- R13 (prd ¶4; decision 2026-11-23): A user edits a todo's description, and the new text shows in the list and persists. The same rules apply as for create.
- R14 (decision 2026-11-23; qi Q3): The app meets WCAG 2.2 AA. An automated audit reports no AA violations, and a manual keyboard and screen-reader pass finds no failures.
- R15 (qi D3): Each service exposes a health check, each container reports healthy or unhealthy, and every container's logs can be read in one place.
- R16 (qi D4): The app runs as a development, a test and a production environment, chosen by configuration with no code change.
- R17 (qi T1, T3, T4, T5): Automated unit, integration, contract, component and end-to-end tests cover the scenarios in the test strategy. The end-to-end tests cover creating, completing, deleting and editing a todo, the empty state and error handling. The whole suite runs with one command in the test environment.
- R18 (qi Q1): A coverage report is produced from the suites. It names the gaps, and each gap is closed or accepted with a reason.
- R19 (qi Q2): The running app's performance is profiled and measured against C4's targets. Every issue found is documented and fixed or accepted.
- R20 (qi Q4): The code is reviewed for common security issues, such as XSS and injection. The review is documented, and every finding is fixed or accepted with a reason.
- R21 (decision 2026-11-23): Every push runs the full automated suite in CI, and its result shows on the commit.
- R22 (decision 2026-11-23): A push to the main branch whose suite passes deploys to production with no manual step. A failing suite deploys nothing.

## Constraints

- C1 (prd ¶4): No authentication or multi-user support in v1, but the data model and API must allow adding an owner to todos, and auth, later without a rewrite.
- C2 (prd ¶1, ¶4): Full-stack: a frontend client backed by a server API with durable server-side storage. Browser-only storage does not meet R11.
- C3 (prd ¶1, ¶5): Favour simplicity and maintainability: the fewest moving parts, and easy for a new developer to understand, run, deploy and extend.
- C4 (prd ¶5): Interactions feel instantaneous under normal conditions. The target is assumed (see Notes): an action shows within 100 ms, and the API answers within 300 ms at p95 with one user.
- C5 (prd ¶1, ¶6): v1 scope is the core loop plus the quality and delivery work in R14–R22. No feature beyond R1–R22 without a dated decision.
- C6 (decision 2026-11-23; qi D1): The frontend and the backend each have a Dockerfile with a multi-stage build, a non-root runtime user and a container health check.
- C7 (qi D2, D4): One docker-compose.yml orchestrates every container (the app, plus a database if the architecture has one). It runs them on their own network, with volumes for persistent data, configuration from environment variables, and dev and test profiles.
- C8 (qi T2, T3): Testing runs throughout. The tracer story sets up the test infrastructure for every layer, before any other feature, and each story ships its own tests. Each API endpoint gets integration and contract tests as it is built.
- C9 (qi T3): The API contract is written in a machine-readable form, and the running API is validated against it with Postman MCP or an equivalent.
- C10 (qi T4, T5, Q2, Q3): Tooling: Playwright MCP automates the browser tests. Chrome DevTools MCP is used to debug, inspect and profile. axe-core, run through Playwright, and Lighthouse perform the accessibility audits.
- C11 (decision 2026-11-23): The code is hosted on GitHub at `git@github.com:abuabdillahi/bmad-todo.git`, and CI and deployment run from it.
- C12 (decision 2026-11-23): Production runs on Cloudflare, tentatively, unless the architecture finds that this rules out a requirement or constraint.

## Done when

- In an unguided session, a first-time user creates, views, edits, completes and deletes a todo on desktop and on a phone, with no help.
- A todo that was added, edited and then completed is still present, with its text and status, after a page refresh, a new browser session and a server restart.
- One command runs the full automated suite (unit, integration, contract, component and end-to-end) in the test environment, and it passes. The coverage report lists its gaps, each closed or accepted.
- The automated accessibility audit reports no WCAG 2.2 AA violations, and a manual keyboard and screen-reader pass of every core action finds no failures.
- The performance and security reviews are documented, every finding is fixed or accepted, and measured interactions meet C4's targets.
- A push to main runs the suite in CI and, when it passes, deploys to production with no manual step. The deployed app reports healthy. The dev and test profiles start healthy through compose, with logs readable, from the README, which tells a new developer how to run, deploy and extend the app.

## Boundaries

- Out in v1 (prd ¶6): user accounts and authentication, collaboration or sharing, task prioritization, deadlines or due dates, notifications.
- Out in v1 (assumed, see Notes): filtering or search, undo, load and stress testing, external penetration testing, and browsers beyond those Playwright runs by default.
- Touch point: GitHub, which hosts the repository and runs CI and deployment, needing repository secrets for deployment; owner: epic-todo-foundation.
- Touch point: Cloudflare, the tentative production host, needing an account and an API token; owner: epic-todo-foundation.
- Tracer path: a user adds a todo in the browser, the API stores it, and it is still in the list after a refresh. All of it runs in compose, with a passing e2e test proving it.

## References

- prd — _bmad-output/initiative-todo-app/prd-todo-app.md, ¶1–¶7 (¶2 user actions and todo fields, ¶3 frontend experience, ¶4 API and persistence, ¶5 non-functional, ¶6 exclusions, ¶7 success measures)
- notes — _bmad-output/initiative-todo-app/notes-quality-infra.md, T1–T5 testing, D1–D4 Docker, Q1–Q4 quality
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (layers, scenario catalogue U/I/K/E, reports)

## Notes

- Assumption: Completion can be undone: a completed todo can be marked active again (prd ¶2 says only completion). The control is a UX choice.
- Assumption: A description is required (non-empty after trimming) and capped at 200 characters to keep it short, on create and on edit.
- Assumption: The list is ordered by creation time, newest first.
- Assumption: Delete is immediate, with no confirmation dialog and no undo.
- Assumption: "Instantaneous" (C4) means the UI reflects an action within 100 ms and the API answers within 300 ms at p95 under single-user load.
- Assumption: WCAG AA means WCAG 2.2 level AA, the current version.
- Assumption: No minimum coverage percentage gates a build. The deliverable is the report, with each gap closed or accepted (qi Q1).
- Assumption: Performance testing is single-user profiling against C4's targets. Load and stress testing are out of v1.
- Assumption: The security review is a code review by the team or an agent, not an external penetration test.
- Assumption: The accessibility audit runs inside every e2e test, so each story proves its own UI, and a full Lighthouse audit runs at the close of each epic.
- Assumption: Browser coverage is the set Playwright runs by default. Wider cross-browser testing is out of v1.
- Open question: The stack beyond Docker (frontend, backend, storage, test frameworks, contract format) is not chosen yet. Waits: `bmad-architecture` and epic 1.
- Assumption: CI and deployment run on GitHub Actions, the CI built into GitHub.
- Open question: Does Cloudflare keep C2, C6, C7 and R11 intact? As far as known, Cloudflare runs containers on ephemeral disk. Production may then need a managed Cloudflare store, such as D1 or Durable Objects, with compose and volumes serving dev and test only. Waits: `bmad-architecture`, before epic 1.
- Decision: 2026-11-23, user: Editing a todo's text is in v1 (R13), replacing the assumption that it was out.
- Decision: 2026-11-23, user: One shared list per deployment is acceptable for v1.
- Decision: 2026-11-23, user: Docker packages and runs the app (C6). The rest of the stack is settled with the architect.
- Decision: 2026-11-23, user: Basic accessibility is in v1 (R14), widened the same day to WCAG AA with audits (qi Q3). R14 now states WCAG 2.2 AA alone, because it covers keyboard operation (2.1.1) and what a screen reader announces (1.3.1, 4.1.2, 4.1.3).
- Decision: 2026-11-23, user: Testing, Docker and QA notes (`notes-quality-infra.md`) are folded in from the top: R14 widened, R15–R20 and C6–C10 added, and the scenarios kept in `test-strategy.md`.
- Decision: 2026-11-23, user: CI runs the tests on every push, and deployment is automated (R21, R22).
- Decision: 2026-11-23, user: The remote is GitHub, at `git@github.com:abuabdillahi/bmad-todo.git` (C11).
- Decision: 2026-11-23, user: Cloudflare is the tentative production host, unless the architecture rules it out (C12).
- Decision: 2026-11-23, user: The initiative is sliced into two epics, built in order: epic-todo-foundation, then epic-manage-todos. The cut rule is one capability delivered and deployed together. A separate polish epic was declined, because it would rebuild the same UI.
- Decision: 2026-11-23, user: Quality work (tests, audits, coverage, performance and security reviews) sits inside the epic whose code it proves. A separate QA epic was declined as bolted on (C8).
- Decision: 2026-11-23, user: Optimistic add is built in epic 1 as the pattern epic 2 reuses, so epic 2 doesn't rework the add path.
- Decision: 2026-11-23, user: Epic 2 stays one epic for now. A split is decided when it is refined.
- Decision: 2026-11-23, user: `bmad-architecture` runs next. It is the home of the shared decisions (stack, contract format, data model, storage, test tooling, the Cloudflare fit), and both epics will cite it.
