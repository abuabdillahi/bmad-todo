---
tracker_id: "2"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/2"
type: epic
title: "A todo is saved and comes back, deployed and tested"
parent: initiative-todo-app
covers: [R1, R2, R3, R7, R8, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# A todo is saved and comes back, deployed and tested

## Description

This is the platform baseline and the tracer path for the Todo App initiative, and the first implementation of every decision in the architecture spine (AD-1–AD-20). The app runs in Docker from one `compose.yml` with dev, test and prod profiles (AD-16, AD-17), and its first story sets up every test layer behind one command (AD-20). One GitHub Actions workflow tests every push, and a passing `main` deploys the images it tested to the Hetzner host, reached through a Cloudflare Tunnel (AD-1, AD-3, AD-18). On this base, a user opens the app, sees the list and adds a todo. The todo shows at once, is validated against the API contract and stored, and survives a refresh, a new session and a restart. Epic 2 builds on its API and contract, data model, mutation helper and announcer, todos store, Docker and test setup, pipeline and list UI.

## Outcome

A user can add a todo on the live app and find it there later, and every developer change after this is tested and deployed automatically.

## Requirements

Each line keeps its parent's number. A shared id is narrowed to this epic's share, as the initiative's breakdown splits it.

- R1 (parent R1): A user creates a todo by entering a short text description, and it appears in the list.
- R2 (parent R2): Every todo has a description, a completion status and its creation time.
- R3 (parent R3): Opening the app shows the user's todo list straight away, with no onboarding or explanation. The empty, loading and error states are epic-manage-todos' (parent R9).
- R7 (parent R7; breakdown epic 1): An add shows in the list at once, within C4's UI target, whether or not the save has finished. If the save fails, the add reverts and a message says so.
- R8 (parent R8): Every action this epic builds works on desktop and mobile screen widths.
- R10 (parent R10; breakdown epic 1): A backend API creates and lists todos and reports its health.
- R11 (parent R11; breakdown epic 1): Created todos survive a page refresh, a new browser session and a server restart.
- R12 (parent R12; breakdown epic 1): The API rejects an invalid create with a clear error and never leaves a todo half-written. The client refuses an invalid description with its message, and shows a failed add or a failed refresh without losing the list or blocking further use.
- R14 (parent R14; initiative decision 2026-11-24): What this epic builds meets WCAG 2.2 AA in light and dark modes: axe-core reports no AA violations in any state its e2e tests reach, and the Lighthouse audit at its close finds none.
- R15 (parent R15): Each service exposes a health check, each container reports healthy or unhealthy, and every container's logs can be read in one place.
- R16 (parent R16): The app runs as a development, a test and a production environment, chosen by configuration with no code change.
- R17 (parent R17; breakdown epic 1): Automated unit, integration, contract, component and end-to-end tests cover this epic's scenarios (U1, U2, U4, U5's create half, I1–I3, I6, I7, I10, K1, K7, E1, and the create/list part of I8, I9, I11, K6, E6, E7, E8), and the whole suite runs with one command in the test environment.
- R18 (parent R18): A coverage report is produced from the suites. Epic 1's report names its gaps, and each is closed or accepted with a reason.
- R19 (parent R19; breakdown epic 1): First load is profiled and documented, and the API is measured against C4's 300 ms p95 from at least 100 requests per endpoint. Every issue found is documented and fixed or accepted.
- R20 (parent R20; breakdown epic 1): The API (injection), the container configuration and the dependencies are reviewed. The review is documented, and every finding is fixed or accepted with a reason.
- R21 (parent R21): Every push runs the full automated suite in CI, and its result shows on the commit.
- R22 (parent R22): A push to the main branch whose suite passes deploys to production with no manual step. A failing suite deploys nothing.

## Constraints

- C1 (parent C1): No authentication or multi-user support in v1, but the data model and API must allow adding an owner to todos, and auth, later without a rewrite.
- C2 (parent C2): Full-stack: a frontend client backed by a server API with durable server-side storage. Browser-only storage does not meet R11.
- C3 (parent C3): Favour simplicity and maintainability: the fewest moving parts, and easy for a new developer to understand, run, deploy and extend.
- C4 (parent C4): An action shows within 100 ms, and the API answers within 300 ms at p95 with one user. The API target is checked here; the UI target is met by R7's add and measured in epic-manage-todos.
- C5 (parent C5): v1 scope is the core loop plus the quality and delivery work in R14–R22. No feature beyond R1–R22 without a dated decision.
- C6 (parent C6): The frontend and the backend each have a Dockerfile with a multi-stage build, a non-root runtime user and a container health check.
- C7 (parent C7): One `compose.yml` orchestrates every container on its own network, with a named volume for persistent data, configuration from environment variables, and dev, test and prod profiles, each run under its own project name (spine AD-16).
- C8 (parent C8): The tracer story sets up the test infrastructure for every layer, before any other feature, and each story ships its own tests. Each API endpoint gets integration and contract tests as it is built.
- C9 (parent C9): The API contract is written in a machine-readable form, and the running API is validated against it (spine AD-20's contract suite).
- C10 (parent C10): The browser tests run on Playwright (`@playwright/test`) in CI. Playwright MCP and Chrome DevTools MCP are agent-side only, never a CI dependency (spine AD-20). axe-core, run through Playwright, and Lighthouse perform the accessibility audits.
- C11 (parent C11): The code is hosted on GitHub at `git@github.com:abuabdillahi/bmad-todo.git`, and CI and deployment run from it.
- C12 (parent C12): Production runs the CI-tested Docker images on our existing Hetzner host under the compose `prod` profile (spine AD-1). Cloudflare is the ingress only, through a Cloudflare Tunnel, and runs no part of the app (spine AD-3).

## Done when

- On the deployed app, a user adds a todo. It shows at once and is still there after a refresh, a new browser session and a server restart. An invalid description is refused with a clear message, and a failed add reverts with a message.
- One command runs the unit, integration, contract, component and e2e suites in the test profile, with axe-core in every e2e test in both colour schemes, and they pass. The coverage report lists epic 1's gaps, each closed or accepted.
- The frontend and backend images are multi-stage builds with a non-root user and a health check. `docker compose` starts the dev and test profiles with every container healthy and its logs readable.
- A push runs the suite in CI. A passing push to `main` deploys to production with no manual step, and the deployed app reports healthy at its public hostname. A push whose suite fails deploys nothing, and production runs the images CI tested for that SHA (R22, AD-1).
- The Lighthouse audit, a security review of the API, containers and dependencies, a profile of first load, and API timings against C4's 300 ms p95 are documented under `docs/quality/`, with every finding fixed or accepted. The README tells a new developer how to run, deploy and extend the app.

## Boundaries

- Belongs to epic-manage-todos: editing, completing, reactivating and deleting todos, the update and delete endpoints, the empty, loading and error list states, and the final whole-app audits and reports, including the manual keyboard and screen-reader pass.
- Owns, in its share of shared ids: create and list (R10), persistence of created todos (R11), create validation, atomic create and the failed-add message (R12), and optimistic add (R7).
- Owns the first implementation of AD-1–AD-20, including the AD-20 test harness, set up in the tracer story; the single `Problem` schema and all five problem type URIs in `packages/contract` (AD-9), even those only epic 2's endpoints return; and AD-13's mutation helper and AD-14's announcer, built for add and reused by epic 2; and the DESIGN.md tokens for light and dark modes, set up with its first UI.
- Owns AD-11's todos store, query function, list-state selector and query policy, built whole, including the refresh-failure announcement once the list is loaded. Epic-manage-todos renders the empty, loading and error states and the Loading status from them (K5).
- The todo card shows its text only here. Its completion check, Edit and Delete controls are epic-manage-todos'.
- Touch point: GitHub, which hosts the repository and runs the one CI workflow. Its secrets and variables are the only source of production configuration, including `TUNNEL_TOKEN` (AD-18, AD-19); owner: epic-todo-foundation (hitl setup).
- Touch point: Hetzner host, needing only a one-time bootstrap: a deploy user whose SSH key is in GitHub secrets, and Docker. Each deploy copies `compose.yml` and regenerates the host `.env` (AD-1, AD-3, AD-18, AD-19); owner: epic-todo-foundation (hitl setup).
- Touch point: GHCR, where CI pushes and the host pulls the images, both through the deploy job's own `GITHUB_TOKEN`, with no long-lived registry token (AD-18); owner: epic-todo-foundation.
- Touch point: Cloudflare, the ingress only: a Cloudflare Tunnel, the public hostname's DNS record and the tunnel token (AD-3); owner: epic-todo-foundation (hitl setup).

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R1–R3, R7, R8, R10–R12, R14–R22), Constraints (C1–C12) and Boundaries (touch points)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 1 (the split of each shared id and scenario)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-1–AD-20, Stack, Structural Seed, Consistency Conventions
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U1, U2, U4, I1–I3, I6, I7, I10, K1, K7, E1, the create/list part of I8, I9, I11, K6, E6, E7, E8, and U5's create-ordering and failed-create half)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md and EXPERIENCE.md (the add form, list, announcer, design tokens for both colour modes and focus rules this epic builds first)

## Notes

- Decision: 2026-11-23, user: The architecture spine settles the Cloudflare fit (C12 rewritten: Hetzner host, Cloudflare Tunnel ingress) and the stack (Stack table, AD-5). Both open questions on this epic are closed.
- Decision: 2026-11-23, user: The `bmad-ux` pass (DESIGN.md and EXPERIENCE.md) is a prerequisite of this epic's first UI story, and planning records it on that entry. The tracer path runs through the browser, so that is likely the tracer story itself.
- Decision: 2026-11-23, po: Risk is lowered from high to medium with the initiative's. Hosting, storage and the stack are settled. The first deploy onto a shared host and a fresh toolchain remain.
- Decision: 2026-11-24, user: The UX spine (DESIGN.md, EXPERIENCE.md) is final, so the prerequisite of this epic's first UI story is met.
- Decision: 2026-11-24, user: Light and dark modes are in v1, following the system setting (initiative Notes). This epic's UI ships in both from its first story, with AA contrast in both (R14).
- Decision: 2026-11-24, po: This epic's share of the test-strategy updates: U1's control-character case table against the schema and the client check, I11's control-character rejection on create, K1's paste, counter and "add landed after all" cases, and U5's dropped follow-ups after a failed create, because the helper is built here and its unit test can queue any follow-up (spine AD-8, AD-13).
- Decision: 2026-11-24, po: E6 is split by action like E7 and E8. This epic owns its add part (a failed add reverts with a message, an invalid description is refused with its message), and K1 covers the failed add's restored text, so its Done when line "a failed save reverts with a message" has a component and an e2e check, not only U4.
- Decision: 2026-11-24, user: The epic is refined. Its Requirements are the parent lines it covers, each numbered as its parent id and narrowed to this epic's share per the initiative breakdown. Done when now names a failed add, a failing suite that deploys nothing, the tested images in production, and the first-load profile.
- Decision: 2026-11-24, user: AD-11 splits between the epics: this epic builds the todos store, query function, list-state selector and query policy whole, with the refresh-failure announcement once loaded (story 5). Epic-manage-todos renders the empty, loading and error states and the Loading status from them and owns K5. Until it ships, the deployed app shows nothing while the first load runs or after it fails; this is accepted.
- Decision: 2026-11-24, user: The tracer's add waits for the server. A failed add keeps its text in the field, adds nothing and shows no message. Story 6 moves the add onto AD-13's helper, which brings the optimistic step and the failure message.
- Decision: 2026-11-24, user: K7 is added to test-strategy.md for story 5's refresh failure and announcer replacement rule, so its tests start with a scenario id like every other test (spine Conventions, Tests). No existing id changes.
- Decision: 2026-11-24, user: First load has no pass bar, because C4 sets none. It is profiled and documented, and the API is held to 300 ms at p95 (R19).
- Decision: 2026-11-24, user: Story 1 is the tracer bullet: a todo added in the browser is stored by the API and still there after a refresh, all in the compose test profile, with every AD-20 test layer behind `pnpm test:all` and a passing e2e test (E1) proving it.
- Decision: 2026-11-24, user: Build order: story 1 (tracer), story 2 (the first deploy, the least certain path), then create's API rules (3), the add form's checks (4), failures and the announcer (5) and the optimistic add (6), with the hardened profiles (7) in parallel once stories 2 and 3 are done, then the refactor sweep (8) and the epic-close reports and README (9). The reports come after the sweep so they measure the swept code, which departs from the rule that the sweep closes the epic.
- Decision: 2026-11-24, user: Shared scenarios split across stories: I7's healthy half is story 1's and its 503 half story 3's; I9's success responses are story 1's and its error responses story 3's; K1's submit-and-clear clause is story 1's, its validation and paste clauses story 4's, its failed-add and landed-after-all clauses story 6's; E1's create-and-reload is story 1's and its "appears at once" clause story 6's; I10 and I11's create half are story 3's, which builds create's rules. Each story gives the compose services it adds their AD-17 health check and restart policy; story 7 adds the dev services, log rotation on every service and pino request ids.
- Decision: 2026-11-24, user: Story 1's hitl setup: a person confirms on the build machine that Docker with Compose v2 is running, Node 26.13.1 is installed, pnpm 12.23.0 was installed with `npm i -g pnpm@12.23.0` (spine Conventions, Toolchain), 127.0.0.1:8081 and :5173 are free, and they can push to `origin`; then they run the story's verify.
- Decision: 2026-11-24, user: Story 2's hitl setup. GitHub: Actions on, workflow permissions allowing `packages: write`; secrets for the deploy SSH private key, the host address, the SSH user, the host key and `TUNNEL_TOKEN`; a variable for the public hostname. Hetzner: a deploy user with that key in `authorized_keys`, Docker and the compose plugin, the user allowed to run docker, and no existing compose project named `todo`. Cloudflare: a token-run tunnel routing the public hostname to `http://web:8080`, its DNS record, and the token in the GitHub secret. The person picks the public hostname.
