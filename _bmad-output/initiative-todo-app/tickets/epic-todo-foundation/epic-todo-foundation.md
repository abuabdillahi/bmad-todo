---
type: epic
title: "A todo is saved and comes back, deployed and tested"
parent: initiative-todo-app
covers: [R1, R2, R3, R7, R8, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# A todo is saved and comes back, deployed and tested

## Description

This is the platform baseline and the tracer path for the Todo App initiative, and the first implementation of every decision in the architecture spine (AD-1–AD-20). The app runs in Docker from one `compose.yml` with dev, test and prod profiles (AD-16, AD-17), and its first story sets up every test layer behind one command (AD-20). One GitHub Actions workflow tests every push, and a passing `main` deploys the images it tested to the Hetzner host, reached through a Cloudflare Tunnel (AD-1, AD-3, AD-18). On this base, a user opens the app, sees the list and adds a todo. The todo shows at once, is validated against the API contract and stored, and survives a refresh, a new session and a restart. Epic 2 builds on its API and contract, data model, mutation helper and announcer, Docker and test setup, pipeline and list UI.

## Outcome

A user can add a todo on the live app and find it there later, and every developer change after this is tested and deployed automatically.

## Done when

- On the deployed app, a user adds a todo. It shows at once and is still there after a refresh, a new browser session and a server restart. An invalid description is refused with a clear message, and a failed save reverts with a message.
- One command runs the unit, integration, contract, component and e2e suites in the test profile, with axe-core in every e2e test in both colour schemes, and they pass. The coverage report lists epic 1's gaps, each closed or accepted.
- The frontend and backend images are multi-stage builds with a non-root user and a health check. `docker compose` starts the dev and test profiles with every container healthy and its logs readable.
- A push runs the suite in CI. A passing push to `main` deploys to production with no manual step, and the deployed app reports healthy at its public hostname.
- The Lighthouse audit, a security review of the API, containers and dependencies, and API timings against C4's 300 ms p95 are documented under `docs/quality/`, with every finding fixed or accepted. The README tells a new developer how to run, deploy and extend the app.

## Boundaries

- Belongs to epic-manage-todos: editing, completing, reactivating and deleting todos, the update and delete endpoints, the empty, loading and error list states, and the final whole-app audits and reports.
- Owns, in its share of shared ids: create and list (R10), persistence of created todos (R11), create validation, atomic create and the failed-add message (R12), and optimistic add (R7).
- Owns the first implementation of AD-1–AD-20, including the AD-20 test harness, set up in the tracer story; the single `Problem` schema and all five problem type URIs in `packages/contract` (AD-9), even those only epic 2's endpoints return; and AD-13's mutation helper and AD-14's announcer, built for add and reused by epic 2; and the DESIGN.md tokens for light and dark modes, set up with its first UI.
- Touch point: GitHub, which hosts the repository and runs the one CI workflow. Its secrets and variables are the only source of production configuration, including `TUNNEL_TOKEN` (AD-18, AD-19); owner: epic-todo-foundation (hitl setup).
- Touch point: Hetzner host, needing only a one-time bootstrap: a deploy user whose SSH key is in GitHub secrets, and Docker. Each deploy copies `compose.yml` and regenerates the host `.env` (AD-1, AD-3, AD-18, AD-19); owner: epic-todo-foundation (hitl setup).
- Touch point: GHCR, where CI pushes and the host pulls the images, both through the deploy job's own `GITHUB_TOKEN`, with no long-lived registry token (AD-18); owner: epic-todo-foundation.
- Touch point: Cloudflare, the ingress only: a Cloudflare Tunnel, the public hostname's DNS record and the tunnel token (AD-3); owner: epic-todo-foundation (hitl setup).

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R1–R3, R7, R8, R10–R12, R14–R22), Constraints (C1–C12) and Boundaries (touch points)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 1 (the split of each shared id and scenario)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-1–AD-20, Stack, Structural Seed, Consistency Conventions
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U1, U2, U4, I1–I3, I6, I7, I10, K1, E1, the create/list part of I8, I9, I11, K6, E6, E7, E8, and U5's create-ordering and failed-create half)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md and EXPERIENCE.md (the add form, list, announcer, design tokens for both colour modes and focus rules this epic builds first)

## Notes

- Decision: 2026-11-23, user: The architecture spine settles the Cloudflare fit (C12 rewritten: Hetzner host, Cloudflare Tunnel ingress) and the stack (Stack table, AD-5). Both open questions on this epic are closed.
- Decision: 2026-11-23, user: The `bmad-ux` pass (DESIGN.md and EXPERIENCE.md) is a prerequisite of this epic's first UI story, and planning records it on that entry. The tracer path runs through the browser, so that is likely the tracer story itself.
- Decision: 2026-11-23, po: Risk is lowered from high to medium with the initiative's. Hosting, storage and the stack are settled. The first deploy onto a shared host and a fresh toolchain remain.
- Decision: 2026-11-24, user: The UX spine (DESIGN.md, EXPERIENCE.md) is final, so the prerequisite of this epic's first UI story is met.
- Decision: 2026-11-24, user: Light and dark modes are in v1, following the system setting (initiative Notes). This epic's UI ships in both from its first story, with AA contrast in both (R14).
- Decision: 2026-11-24, po: This epic's share of the test-strategy updates: U1's control-character case table against the schema and the client check, I11's control-character rejection on create, K1's paste, counter and "add landed after all" cases, and U5's dropped follow-ups after a failed create, because the helper is built here and its unit test can queue any follow-up (spine AD-8, AD-13).
- Decision: 2026-11-24, po: E6 is split by action like E7 and E8. This epic owns its add part (a failed add reverts with a message, an invalid description is refused with its message), and K1 covers the failed add's restored text, so its Done when line "a failed save reverts with a message" has a component and an e2e check, not only U4.
