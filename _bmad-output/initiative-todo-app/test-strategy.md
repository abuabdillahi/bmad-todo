# Test strategy: Todo App

Companion to `initiative-todo-app.md`. It spells out R14 and R17–R20 and constraints C8–C10. Sources: `prd-todo-app.md` and `notes-quality-infra.md`. Each story refines the scenarios it touches into acceptance criteria. This file lists the scenarios the suites must cover, not how to write them. Frameworks, the contract format and where each layer runs are fixed in the architecture spine (`architecture-todo-app/architecture-todo-app.md`), AD-20, with the contract in AD-5. The UI behaviour the component and end-to-end scenarios check is fixed in `ux-todo-app/EXPERIENCE.md`.

## Layers

| Layer | What it proves | Runs against | Tooling | Owner |
|---|---|---|---|---|
| Unit | Rules in isolation: validation, ordering, state changes | Code only | Vitest `unit` project (AD-20) | Every story |
| Integration | Each API endpoint with real storage, including error responses and atomic writes | The API in-process through `buildApp`, on a temp SQLite file per test file with the committed migrations; I6 runs against the test profile (AD-20) | Vitest `integration` project (AD-20) | The story that builds the endpoint (C8) |
| Contract | The running API matches the machine-readable contract | API in the test profile | AD-20's contract suite: every response validated against the committed `openapi.json` with Ajv2020 and ajv-formats, C9's equivalent of Postman MCP (AD-5, AD-20) | The story that builds the endpoint |
| Component | Each UI component's states and events, rendered alone | UI only, API stubbed | Vitest `component` project with Testing Library, MSW as the only HTTP stub (AD-20); Chrome DevTools MCP to debug (C10) | The story that builds the component |
| End-to-end | User journeys through browser, API and storage | The full stack in the test profile | Playwright (`@playwright/test`), `workers: 1`, failures injected with `page.route` only (AD-20) | The story that delivers the journey |
| Accessibility | WCAG 2.2 AA on every page state | Inside each e2e test (axe-core), rerun in the dark colour scheme (AD-20), plus a full Lighthouse audit at each epic's close | `@axe-core/playwright` with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags, and Lighthouse against the test profile (AD-20, C10) | Every UI story; epic close |

Epic 1's tracer story sets up every layer, the coverage report and the test profile, before any other feature (C8). Per-endpoint scenarios (I8, I9, I11, I12, I13) and per-journey scenarios (K6, E6, E7, E8) are delivered by whichever story builds that endpoint or journey. The whole suite runs with one command, `pnpm test:all` (R17).

## Scenario catalogue

Ids are permanent. A story's `covers` and criteria cite them.

### Unit

- U1 (R1, R13; AD-8): One case table runs against both the schema and the client check in `packages/contract/src/description.ts` (spine AD-8; architecture memlog, AD-8 gate fix). A description that is empty after trimming, or longer than 200 Unicode code points after trimming, is rejected. One of 1 or 200 code points is accepted, including one of 200 single-code-point emoji, which a UTF-16 length would count as 400. A trimmed description that contains a control character (any `\p{Cc}`, including `\n`, `\r` and `\t`) or U+2028 or U+2029 is rejected. One that contains the letters `p`, `c` and `C` and the braces `{` and `}` is accepted, which proves the class is a `u`-flag RegExp and not a plain string where `\p{Cc}` collapses to those characters.
- U2 (Notes, ordering): Todos sort newest first by creation time.
- U3 (R4): Completing an active todo makes it completed, and reactivating it makes it active again.
- U4 (R7): An optimistic change is applied at once and rolled back exactly when its save fails.
- U5 (R7; AD-13): An edit, completion or delete of a todo whose create is still pending is sent only after that create settles. A delete answered 404 counts as success and is not rolled back. When the create fails, its queued follow-ups are dropped: none is sent, announced or reverted, each call's promise resolves `dropped`, each leaves the pending count, and only the add failure is announced (spine AD-13; architecture memlog, flag 7).

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
- I11 (R12; AD-8): A create or update carrying an unknown field, a null, or a wrongly typed value (e.g. `completed: "true"`), or an update with an empty body, is refused with a validation problem and changes nothing. This proves Fastify's Ajv defaults are overridden. A create or update whose trimmed description still contains a control character or U+2028 or U+2029 is refused with a validation problem whose `errors` names `description`, is never normalised, and changes nothing (spine AD-8; architecture memlog, flag 2).
- I12 (R20; AD-19): Every response that `web-test` serves carries the strict Content-Security-Policy and the standard security headers, in every nginx location: the page, a content-hashed asset, a missing asset (a 404, never `index.html`), every `/api` answer, and nginx's own `503` unavailable problem when the API is down (AD-4).
- I13 (R15, R20; AD-17, AD-19): No log line holds a todo's description, at `info` level or below, on any route: not for a successful request, and not for one refused or failed (validation, conflict, not found, or a storage failure). The API's log lines are JSON with a request id.

### Component

- K1 (R1, R12): The add form submits a valid description, clears itself, and shows the validation message for an invalid one. A pasted line break or tab shows as a space, and the counter counts what remains after that replace and the trim (AD-8). A paste mid-text that contains a line break leaves the caret after the pasted text, and one undo removes it. A failed add removes its card and restores the todo's latest text (the sent text, or the last edit saved on its card while the add was pending; nothing if its delete was confirmed) (2026-11-26, #70) into the field only if the field is still empty, never overwriting newer typing (EXPERIENCE, Add form states, Add failed). When a failed add's id later appears in the list and the field still holds exactly the restored text, the field clears to "0/200" without moving focus or speaking. Text the user has changed is left alone (EXPERIENCE, Component Patterns, Text field; Add form states, Add landed after all).
- K2 (R4, R6): A todo item shows its completion state distinctly and switches it on activation.
- K3 (R13): A todo item enters edit mode, saves a valid change, cancels without saving, and shows the validation message. A pasted line break or tab shows as a space, and the counter counts what remains after that replace and the trim (AD-8; EXPERIENCE, Component Patterns, Text field).
- K4 (R5, R14): A todo item's Delete button opens the inline confirm ("Delete this todo?" with Delete and Cancel) and sends nothing. Cancel, or Escape with focus in the confirm, closes it with nothing sent. The confirm's Delete removes the todo from the list (decision 2026-11-24, WCAG 3.3.4; EXPERIENCE, Component Patterns, Delete confirm).
- K5 (R9, R14; AD-11, AD-14): The list renders its empty, loading and error states, each in its own condition (EXPERIENCE, State Patterns; Component Patterns, Loading status; Interaction Primitives, Focus management). It also covers:
  - Try again while a save is pending shows the skeletons at once and loads after the save settles. A failed Try again speaks the error line again.
  - A focus or reconnect refetch replaces the List error panel without Try again. If focus was on Try again, it moves to the Todo list, or to the Empty panel when the list is empty. Focus elsewhere stays put.
  - An add during Loading keeps the skeletons, because the cancelled first-load fetch is not a failure.
  - An early card keeps focus and an open Edit form or Delete confirm across the first successful load.
  - The first successful load never renders the Empty panel when the server returned todos.
  - "Your todos are loaded." is spoken when a slow first load or a Try again succeeds, and when an automatic refetch replaces the List error panel while focus is elsewhere. It is not spoken when focus moved to the list. A load under 500 ms says nothing when it finishes. A recovery more than 5 s after the error line, once the status has emptied, still speaks it. A new failure kind while in Error changes the panel's reason without speaking.
- K6 (R14): Every control has an accessible name and is reachable and operable by keyboard.
- K7 (R12, R14; AD-11, AD-14): Once the list is loaded, a failed background fetch keeps the list and announces a refresh failure with its reason. A `refresh` message never replaces an undismissed `failure` message and is dropped, and an identical `refresh` message still showing is not set again. Dismiss clears the message (EXPERIENCE, Component Patterns, Announcer; State Patterns, List states, Refresh failed).

### End-to-end (qi T5, AD-20)

- E1 (R1, R11): Create a todo. It appears at once and is still there after a reload.
- E2 (R4, R6): Complete a todo. It looks completed, stays completed after a reload, and can be reactivated.
- E3 (R5, R14): Delete a todo. Delete opens the inline confirm and sends nothing. Cancel and Escape each close it, and the todo stays. The confirm's Delete removes the todo, and it stays gone after a reload (decision 2026-11-24).
- E4 (R13): Edit a todo's text. The new text shows and persists after a reload.
- E5 (R9, R3): Empty state. With no todos, the empty state shows. Adding one replaces it.
- E6 (R7, R12, R9): Error handling. With the API failing or unreachable, each action reverts, a message explains the failure, the list stays usable, and an invalid description is refused with its message.
- E7 (R8): Each of E1–E4 passes at a phone width and at a desktop width.
- E8 (R14): Each of E1–E6 passes by keyboard alone, and axe-core reports no AA violations in any state it reaches, in both the light and dark colour schemes (AD-20; decision 2026-11-24).

## Reports

Each report is committed under `docs/quality/`, dated, and names the epic it closes.

- Coverage (R18): line and branch coverage for the unit, component and integration projects, and coverage by scenario id for the contract and end-to-end suites (AD-20), the gaps listed, and each gap closed or accepted with a reason. No percentage threshold gates the build.
- Performance (R19): Chrome DevTools MCP profiles of first load and of each action, measured against C4: an action shows within 100 ms, and the API answers within 300 ms at p95 with one user, from at least 100 requests per endpoint against the test profile (AD-20). Each issue is fixed or accepted.
- Accessibility (R14): the Lighthouse audit and axe-core results, with each violation fixed, plus a manual pass of every core action by keyboard and with a screen reader. Automated tools catch only part of WCAG, so the manual pass covers the rest: whether controls and each todo's status are announced, focus order, and status messages.
- Security (R20): a review of the code for XSS, injection, unsafe configuration (container user, secrets in images or compose files, CORS) and dependency vulnerabilities, with each finding fixed or accepted with a reason.

## Out

- Load and stress testing, and any external penetration test.
- Cross-browser testing beyond the browsers Playwright runs by default.
