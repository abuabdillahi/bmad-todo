---
type: epic
title: "A todo is saved and comes back, deployed and tested"
parent: initiative-todo-app
covers: [R1, R2, R3, R7, R8, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22]
sources: []
companions: []
after: []
refined: false
risk: high
---

# A todo is saved and comes back, deployed and tested

## Description

This is the platform baseline and the tracer path for the Todo App initiative. The app runs in Docker, and its first story sets up every test layer behind one command. CI on GitHub tests every push, and a passing `main` branch deploys itself to production, tentatively on Cloudflare. On this base, a user opens the app, sees the list and adds a todo. The todo shows at once, is validated against the API contract and stored, and survives a refresh, a new session and a restart. Epic 2 builds on its API and contract, data model, optimistic-update pattern, Docker and test setup, pipeline and list UI.

## Outcome

A user can add a todo on the live app and find it there later, and every developer change after this is tested and deployed automatically.

## Done when

- On the deployed app, a user adds a todo. It shows at once and is still there after a refresh, a new browser session and a server restart. An invalid description is refused with a clear message, and a failed save reverts with a message.
- One command runs the unit, integration, contract, component and e2e suites in the test profile, with axe-core in every e2e test, and they pass. The coverage report lists epic 1's gaps, each closed or accepted.
- The frontend and backend images are multi-stage builds with a non-root user and a health check. `docker compose` starts the dev and test profiles with every container healthy and its logs readable.
- A push runs the suite in CI. A passing push to `main` deploys to production with no manual step, and the deployed app reports healthy.
- The Lighthouse audit, a security review of the API, containers and dependencies, and API timings against C4's 300 ms p95 are documented under `docs/quality/`, with every finding fixed or accepted. The README tells a new developer how to run, deploy and extend the app.

## Boundaries

- Belongs to epic-manage-todos: editing, completing, reactivating and deleting todos, the update and delete endpoints, the empty, loading and error list states, and the final whole-app audits and reports.
- Owns, in its share of shared ids: create and list (R10), persistence of created todos (R11), create validation, atomic create and the failed-add message (R12), and optimistic add (R7), the pattern epic 2 reuses.
- Touch point: GitHub, which hosts the repository and runs CI and deployment, needing repository secrets for deployment; owner: epic-todo-foundation.
- Touch point: Cloudflare, the tentative production host, needing an account and an API token; owner: epic-todo-foundation.

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R1–R3, R7, R8, R10–R12, R14–R22) and Constraints (C1–C12)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 1 (the split of each shared id and scenario)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U1, U2, U4, I1–I3, I6, I7, K1, E1, and the create/list part of I8, I9, K6, E7, E8)

## Notes

- Open question: Does Cloudflare keep C2, C6, C7 and R11 intact, given that its container disk is ephemeral? Waits: `bmad-architecture`, before this epic is refined.
- Open question: The stack beyond Docker is not chosen yet (frontend, backend, storage, test frameworks, contract format, coverage tool). Waits: `bmad-architecture`.
