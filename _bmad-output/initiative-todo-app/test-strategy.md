# Test strategy: Todo App

Companion to `initiative-todo-app.md`. It spells out R14 and R17–R20 and constraints C8–C10. Sources: `prd-todo-app.md` and `notes-quality-infra.md`. Each story refines the scenarios it touches into acceptance criteria. This file lists the scenarios the suites must cover, not how to write them. Frameworks, the contract format and where each layer runs are fixed in the architecture spine (`architecture-todo-app/architecture-todo-app.md`), AD-20, with the contract in AD-5.

## Layers

| Layer | What it proves | Runs against | Tooling | Owner |
|---|---|---|---|---|
| Unit | Rules in isolation: validation, ordering, state changes | Code only | Vitest `unit` project (AD-20) | Every story |
| Integration | Each API endpoint with real storage, including error responses and atomic writes | The API in-process through `buildApp`, on a temp SQLite file per test file with the committed migrations; I6 runs against the test profile (AD-20) | Vitest `integration` project (AD-20) | The story that builds the endpoint (C8) |
| Contract | The running API matches the machine-readable contract | API in the test profile | AD-20's contract suite: every response validated against the committed `openapi.json` with Ajv2020 and ajv-formats, C9's equivalent of Postman MCP (AD-5, AD-20) | The story that builds the endpoint |
| Component | Each UI component's states and events, rendered alone | UI only, API stubbed | Vitest `component` project with Testing Library, MSW as the only HTTP stub (AD-20); Chrome DevTools MCP to debug (C10) | The story that builds the component |
| End-to-end | User journeys through browser, API and storage | The full stack in the test profile | Playwright (`@playwright/test`), `workers: 1`, failures injected with `page.route` only (AD-20) | The story that delivers the journey |
| Accessibility | WCAG 2.2 AA on every page state | Inside each e2e test (axe-core), plus a full Lighthouse audit at each epic's close | `@axe-core/playwright` with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags, and Lighthouse against the test profile (AD-20, C10) | Every UI story; epic close |

Epic 1's tracer story sets up every layer, the coverage report and the test profile, before any other feature (C8). Per-endpoint scenarios (I8, I9, I11) and per-journey scenarios (K6, E7, E8) are delivered by whichever story builds that endpoint or journey. The whole suite runs with one command, `pnpm test:all` (R17).

## Scenario catalogue

Ids are permanent. A story's `covers` and criteria cite them.

### Unit

- U1 (R1, R13; AD-8): A description that is empty after trimming, or longer than 200 Unicode code points after trimming, is rejected. One of 1 or 200 code points is accepted, including one of 200 single-code-point emoji, which a UTF-16 length would count as 400.
- U2 (Notes, ordering): Todos sort newest first by creation time.
- U3 (R4): Completing an active todo makes it completed, and reactivating it makes it active again.
- U4 (R7): An optimistic change is applied at once and rolled back exactly when its save fails.
- U5 (R7; AD-13): An edit, completion or delete of a todo whose create is still pending is sent only after that create settles. A delete answered 404 counts as success and is not rolled back.

### Integration and contract (per endpoint)

- I1 (R1, R10): Creating a valid todo returns it with an id, the description, completion status and creation time, and stores it.
- I2 (R12): Creating an invalid todo returns a clear validation error and stores nothing.
- I3 (R3, R10): Listing returns every stored todo, newest first, and an empty list when there are none.
- I4 (R4, R13, R10): Updating the completion status or the description persists it. An invalid description is refused and the stored todo is unchanged.
- I5 (R5, R10): Deleting a todo removes it. Deleting an unknown id returns a not-found error.
- I6 (R11): Stored todos survive a restart of the API container.
- I7 (R15): The health endpoint reports healthy when storage is reachable and unhealthy when it is not.
- I8 (R20): Input carrying script or query-injection payloads is stored and returned as inert text and never executed.
- I9 (C9): Every endpoint's requests and responses, errors included, validate against the contract.
- I10 (R12; AD-6): Repeating a create with the same id and the same trimmed description returns 200 with the stored todo and stores no duplicate. The same id with a different description returns a 409 conflict problem, and the stored todo is unchanged.
- I11 (R12; AD-8): A create or update carrying an unknown field, a null, or a wrongly typed value (e.g. `completed: "true"`), or an update with an empty body, is refused with a validation problem and changes nothing.

### Component

- K1 (R1, R12): The add form submits a valid description, clears itself, and shows the validation message for an invalid one.
- K2 (R4, R6): A todo item shows its completion state distinctly and switches it on activation.
- K3 (R13): A todo item enters edit mode, saves a valid change, cancels without saving, and shows the validation message.
- K4 (R5): A todo item's delete control removes it from the list.
- K5 (R9): The list renders its empty, loading and error states, each in its own condition.
- K6 (R14): Every control has an accessible name and is reachable and operable by keyboard.

### End-to-end (qi T5, AD-20)

- E1 (R1, R11): Create a todo. It appears at once and is still there after a reload.
- E2 (R4, R6): Complete a todo. It looks completed, stays completed after a reload, and can be reactivated.
- E3 (R5): Delete a todo. It disappears and stays gone after a reload.
- E4 (R13): Edit a todo's text. The new text shows and persists after a reload.
- E5 (R9, R3): Empty state. With no todos, the empty state shows. Adding one replaces it.
- E6 (R7, R12, R9): Error handling. With the API failing or unreachable, each action reverts, a message explains the failure, the list stays usable, and an invalid description is refused with its message.
- E7 (R8): Each of E1–E4 passes at a phone width and at a desktop width.
- E8 (R14): Each of E1–E6 passes by keyboard alone, and axe-core reports no AA violations in any state it reaches.

## Reports

Each report is committed under `docs/quality/`, dated, and names the epic it closes.

- Coverage (R18): line and branch coverage for the unit, component and integration projects, and coverage by scenario id for the contract and end-to-end suites (AD-20), the gaps listed, and each gap closed or accepted with a reason. No percentage threshold gates the build.
- Performance (R19): Chrome DevTools MCP profiles of first load and of each action, measured against C4: an action shows within 100 ms, and the API answers within 300 ms at p95 with one user, from at least 100 requests per endpoint against the test profile (AD-20). Each issue is fixed or accepted.
- Accessibility (R14): the Lighthouse audit and axe-core results, with each violation fixed, plus a manual pass of every core action by keyboard and with a screen reader. Automated tools catch only part of WCAG, so the manual pass covers the rest: whether controls and each todo's status are announced, focus order, and status messages.
- Security (R20): a review of the code for XSS, injection, unsafe configuration (container user, secrets in images or compose files, CORS) and dependency vulnerabilities, with each finding fixed or accepted with a reason.

## Out

- Load and stress testing, and any external penetration test.
- Cross-browser testing beyond the browsers Playwright runs by default.
