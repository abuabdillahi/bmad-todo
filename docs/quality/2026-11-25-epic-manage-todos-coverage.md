# Coverage report: epic-manage-todos

- **Date:** 2026-11-25
- **Epic:** epic-manage-todos (R18). This is the whole app's coverage at the close of its second and last epic.
- **Commit measured:** `d0884e2` (main after PR #86), updated on 2026-11-26 (#72). Every figure, test count and line number below is of `d0884e2`: the per-project figures and counts from `pnpm test:all` in main CI run 45738427453 (its `coverage` artifact and test job log), the whole-app figure from the one Vitest run given under it. First written on `32c3365` plus story 2.9's changes. Since then, app source changed only in PR #86 (`apps/web/src/todos/mutations.ts`, `apps/web/src/components/AddForm.tsx`, #70); PRs #67, #68, #69 and #87 changed the workflow, its tests and `vitest.config.ts`.
- **Tools:** Node 26.13.1, pnpm 12.23.0, Vitest 5.1.1 with `@vitest/coverage-v8` 5.1.1, Playwright 1.65.1 (Chromium 159.0.8154.6), Docker 29.9.3 with Compose v5.7.1
- **Reproduce:** the whole-app figure: `npx vitest run --project unit --project component --project integration --coverage --coverage.reportsDirectory=<a temporary directory>` (no stack needed). The rest: `pnpm test:all`. It writes `coverage/{unit,component,integration}/` (`coverage-summary.json`, `lcov.info`, HTML), `coverage/scenarios.md` and `coverage/e2e-report.json`. Nothing here gates the build on a percentage.

## Result

`pnpm test:all` exited 0 on `d0884e2` (main CI run 45738427453), every step passed: unit 309 tests, component 173, integration 127, contract 16, e2e 129 (43 tests in 10 specs × desktop, phone, desktop-dark), axe coverage (129 passed tests scanned, 0 without a scan), profile 20, contract-unavailable 10, scenario coverage. The same run's `pnpm typecheck` passed.

Against story 2.9's run (unit 270, component 169, e2e 117), PR #86 added 9 unit, 4 component and 4 e2e tests (12 across the three projects). The other 30 new unit tests are `scripts/ci-workflow-steps.test.ts`, which tests the workflow, not the app: PR #67 made the unit project also run `scripts/**/*.test.ts`. Most of the rise in unit is those, not PR #86.

### Whole app against the 70% goal

The user's goal for the epic is at least 70% test coverage (relayed on 2026-11-26; R18 states no percentage, and nothing gates the build on one). One Vitest run of the unit, component and integration projects (609 tests, all passed), merged over `apps/api/src`, `apps/web/src` and `packages/contract/src` (`vitest.config.ts`'s coverage include), on `d0884e2`:

| Lines | Statements | Branches | Functions |
|---|---|---|---|
| 95.9% (1006/1049) | 94.99% (1195/1258) | 92.65% (694/749) | 94.6% (351/371) |

**The goal is met** on all four measures. Reproduce with `npx vitest run --project unit --project component --project integration --coverage --coverage.reportsDirectory=<a temporary directory>`; run again on `d0884e2`, it gave the same figures. Of the 43 lines it misses, 23 are the two entry points (`server.ts` and `main.tsx`, C1 and C2), which only the container and e2e suites run, and the rest are gaps C7, C9, C10, C20 and C21 below. Contract, e2e and profile tests are not in this figure: they run against the containers, where v8 coverage in the test process cannot see the code.

### Line and branch coverage per project

Each project counts only the sources that its layer is meant to exercise (`scripts/test-all.mjs`), as AD-20 asks; the whole-app figure above merges them:

| Project | Sources counted | Lines | Branches | Functions | Statements |
|---|---|---|---|---|---|
| unit | `apps/api/src`, `apps/web/src`, `packages/contract/src` | 35.08% (368/1049) | 33.11% (248/749) | 35.57% (132/371) | 34.49% (434/1258) |
| component | `apps/web/src` | 94.95% (829/873) | 86.48% (563/651) | 93.37% (296/317) | 93.48% (990/1059) |
| integration | `apps/api/src`, `packages/contract/src` | 72.72% (128/176) | 65.3% (64/98) | 83.33% (45/54) | 72.86% (145/199) |

Epic 1 closed at component 87.2% lines and 73.23% branches, and integration 68.66% and 60.71%. The component project rose most, because the edit, complete, delete and list-state components and their tests landed in this epic.

The unit figure is low by design, as in epic 1. Unit tests cover the rules (validation, ordering, the store, the mutation helper, the announcer, the loading status, the leaving rows, the client, the messages). The components, routes and repository count against unit because unit's include spans every source tree, and they are covered by the component and integration projects. Read each file against the layer that owns it, as the gaps below do.

### Coverage by scenario id

The whole test strategy catalogue against `coverage/scenarios.md`. Every scenario id has passing tests, none failed, and each has a test in the layer the strategy assigns it.

| Scenario | Scope | Passed | Suites |
|---|---|---|---|
| U1 | description rule, schema and client check agree | 20 | unit |
| U2 | newest first | 4 | unit |
| U3 | complete and reactivate | 8 | unit |
| U4 | optimistic apply and rollback | 53 | unit |
| U5 | follow-ups on a pending create, 404 delete as success, dropped follow-ups | 22 | unit |
| I1 | create | 1 | integration |
| I2 | invalid create | 13 | integration |
| I3 | list | 3 | integration |
| I4 | update completion and description, invalid update | 20 | unit, integration |
| I5 | delete, unknown id | 7 | unit, integration |
| I6 | survives an api restart | 1 | profile |
| I7 | health, healthy and unhealthy | 3 | integration |
| I8 | injection payloads stored as inert text | 10 | integration |
| I9 | every endpoint against the contract | 41 | integration, contract, profile, contract-unavailable |
| I10 | idempotent replay and conflict | 3 | integration, profile |
| I11 | strict create and update validation | 36 | integration |
| I12 | security headers in every nginx location | 18 | contract, profile, contract-unavailable |
| I13 | no todo text in logs, JSON lines with a request id | 10 | integration, profile |
| K1 | add form | 70 | unit, component, e2e (all three projects) |
| K2 | completion state and toggle | 3 | component |
| K3 | edit mode | 38 | component, e2e (all three projects) |
| K4 | inline Delete confirm | 18 | component |
| K5 | empty, loading and error states, Try again, recovery | 61 | unit, component |
| K6 | names and keyboard | 34 | component |
| K7 | refresh failure, announcer | 128 | unit, component |
| E1 | create and reload | 6 | e2e (all three projects) |
| E2 | complete, reload, reactivate | 6 | e2e (all three projects) |
| E3 | delete with the inline confirm | 6 | e2e (all three projects) |
| E4 | edit and reload | 12 | e2e (all three projects) |
| E5 | empty state | 4 | component, e2e (all three projects) |
| E6 | error handling for every action | 96 | e2e (all three projects) |
| E7 | phone and desktop widths | 24 | e2e (desktop, phone, desktop-dark) |
| E8 | keyboard and axe in light and dark | 78 | e2e (all three projects) |

67 tests carry no scenario id: 30 unit tests of the workflow (`scripts/ci-workflow-steps.test.ts`: its jobs, triggers, secrets and deploy guard), 19 unit tests of `loadConfig`, 4 integration tests of the API's startup exit on invalid config, 1 integration test that keeps the submitted text out of the unavailable error and its cause, 5 integration tests that each measurement script refuses a non-local host, and 8 profile tests of the compose project guard (a command with no `-p` is refused, and each `-p` uses exactly its project). They prove the workflow's rules, R15, R16, R20, the project-name rule and the scripts' local-only rule, which the catalogue gives no id. They are listed here, not counted as a gap. Epic 1's 3 untagged profile tests (headers, log format) now carry I12 and I13.

## Gaps and findings

A gap is a scenario with no test (none), or uncovered lines or branches in the layer that owns a file. Line numbers are from `coverage/<project>/lcov.info` at `d0884e2` (main CI run 45738427453); rows C6, C7, C18, C19 and C20 were renumbered on 2026-11-26 after PR #86, and only `mutations.ts` and `AddForm.tsx` changed. C1 to C17 are epic 1's gaps with today's status. Epic 1's line numbers moved where the file changed, and the row says so.

| # | Gap | Layer | Status | Change or reason |
|---|---|---|---|---|
| C1 | `apps/api/src/server.ts` 0% in every project | integration | accepted | The process bootstrap. `apps/api/test/integration/startup.test.ts` spawns it as a child process, which v8 coverage in the test process cannot see. I6 (profile) and every container suite run it. |
| C2 | `apps/web/src/main.tsx` 0% | component | accepted | The browser entry point (`createRoot`). Every e2e test runs it. Component tests render `App` through the test harness instead. |
| C3 | `apps/api/src/config.ts` 0% in integration | integration | accepted | Owned by unit, where it is fully covered (19 tests). Integration builds the app from a ready `Config`. |
| C4 | `packages/contract/src/description.ts` 4/9 lines in integration (29–33) | integration | accepted | Owned by unit, fully covered there (U1). Integration reaches it only through the schema pattern. |
| C5 | `apps/web/src/todos/hooks.ts` `useRetryFetch` | component | fixed | Closed by this epic's list states (story 2.6): the K5 Try again tests call it, and `hooks.ts` is now 100% lines and branches in component. |
| C6 | `apps/web/src/todos/mutations.ts` edit, complete and delete paths in component | component | fixed | Closed by this epic's edit, complete and delete components: component now runs 113 of the helper's 116 lines. The three left are C7 and C18. The helper's branches left are C19. |
| C7 | `apps/web/src/todos/mutations.ts` lines 293–294 (epic 1: 195–196; story 2.9: 242–243), and the `entry.latest === undefined` side of line 319's branch (PR #86) | unit | accepted | Defensive catch for an exception thrown by the helper's own chain, which `execute` never throws. It keeps the per-call promise non-rejecting (AD-13). Line 319's side gives a failed add the sent text when no latest text was recorded, which happens only for a failure outside the send step, that is only through this catch. |
| C8 | `apps/web/src/todos/messages.ts` keys for edit, complete and delete | component | fixed | Every key now exists and runs. Component misses lines 17–22 and 24 (the 40-code-point cut), 57 (the reopen lead) and 70 (the validation reason), and unit runs all three. Unit misses only line 95 (the counter), which component runs. Every line of the file runs in a layer that owns it. |
| C9 | Auto-grow fallback, now `apps/web/src/components/TextField.tsx` lines 40–41, 47–52, 54–55 (epic 1: `AddForm.tsx` 33–48) | component | accepted | Moved into the shared Text field (add and edit). The script fallback for browsers without CSS `field-sizing: content`. Component tests don't reach the resize, and Chromium (e2e) supports `field-sizing`, so it takes the CSS path. Testing beyond Playwright's default browser is out of scope (test strategy Out). |
| C10 | `apps/web/src/components/Announcer.tsx` lines 18, 37–39, branches 14, 17, 18, 36, 93 | component | accepted | The motion-length parse fallback, the `ResizeObserver` path (jsdom has none), and the motion side of Dismiss's fade-out (component tests run under reduced motion). The e2e motion spec covers the default motion path. Epic 1's lines 75–76 are now covered. |
| C11 | `apps/web/src/api/client.ts` branches at lines 118, 131, 137 (epic 1: 85, 101) | unit | accepted | The cancelled side of the unreadable-body check, the default `GET` method that no caller relies on (every call passes one), and a write that carries a caller's signal, combined with the timeout (no write passes one: only the list fetch is cancellable). `query.test.ts` and `client.test.ts` cover cancellation and the write timeout (AD-11). |
| C12 | `apps/web/src/todos/query.ts` branch at line 33 | unit | accepted | Wraps a non-`RequestFailure` error as `generic`. The client only throws `RequestFailure` or an abort, so this is defensive. |
| C13 | `apps/web/src/todos/announcer.ts` lines 31–32 | unit | accepted | The production `requestAnimationFrame` scheduler. Tests inject a fake frame to control timing, and e2e runs the real one. |
| C14 | `apps/api/src/problems.ts` branches at lines 71, 74 | integration | accepted | `validation ?? []` and the `'is not valid'` fallback for an Ajv keyword with no message. Epic 1 expected PATCH's `minProperties` to reach line 74. It doesn't: an empty PATCH body's `minProperties` error names no property, so line 73 skips it, and I11 proves the 400 for it. Every keyword that names a field has a message. Fastify always sets `validation` on a schema error. |
| C15 | `apps/api/src/todos/service.ts` branch at line 10 | integration | accepted | The `0` of the id tie-break, for two todos with the same `createdAt` and the same id. The primary key makes that impossible. |
| C16 | `apps/api/src/todos/service.ts` lines 41–44, 46 in unit | integration | accepted | `create`, owned by integration (100% lines there). The unit tests cover `sortNewestFirst` (U2) and the update rules. |
| C17 | `apps/web/src/todos/TodosProvider.tsx` branches at 57, 75, 85 | component | accepted | `store.ts` line 59 (`requestRetry`) is now covered by K5. What is left is the missing-provider guard (a programming-error throw) and the cached per-client value. |
| C18 | Unit-owned files' lines that component does not run: `api/client.ts` 58, 60, 74–75, 118–119, 142; `todos/mutations.ts` 126; `components/leaving-rows.ts` 73; `components/loading-status.ts` 91–94; `todos/announcer.ts` branch 80; `todos/query.ts` branch 27 | unit | accepted | Each file has its own unit test file, and unit runs every one of these lines (client 100% lines, the leaving rows and the loading status 100%). Component reaches them only through the real UI, where those cases (an unreadable body, a non-`RequestFailure` error, two Leaving rows shifting, a repeated Loading status line) don't come up. |
| C19 | `apps/web/src/todos/mutations.ts` branches at 203 (new in PR #86) and 220 (story 2.9: 178) in unit and component; component also misses 125, 180, 186, 208, 328, 333, 340 and 344, which unit runs | unit | accepted | Defensive sides: a create's `apply` returning nothing (line 203, PR #86's `latestAfter`: a create's `apply` always returns its todo), and a pending entry already removed (220). Since PR #86 and its tests, unit runs the other sides story 2.9 listed here, at 168, 268, 280 and 284 (now 186, 328, 340 and 344: an `apply` on a todo already gone, the description fallback), so they are no longer gaps. PR #86 added no line that the tests miss; its other uncovered branch side, line 319's, is C7. U4 and U5 cover the paths a call takes. |
| C20 | Guard branches in components: `AddForm.tsx` 63 (story 2.9: 57), `EditForm.tsx` 27, `TextField.tsx` 190, 202, 211, 229, 321, `TodoCard.tsx` lines 62, 97 and branches 32, 37, `TodoList.tsx` line 206 and branches 34, 45, 96, 127, 147, 150, 174, 205, 272, 282, 319, 329, 337, 339 | component | accepted | Null-ref and stale-state guards (a ref not yet set, a functional state update that finds another row now open), engine fallbacks (no `execCommand`, no `caretPositionFromPoint`), an empty paste, the `forbidden-character` result that cannot happen after the replace (AD-8), the newer-typing side of a restore that line 59 already checked in the same task (K1 "a failed add never overwrites newer typing" tests the rule), a revert-flag timer that fires early, the default no-op props of a card rendered without a list area, and focus outside any tracked element. Each rule they guard has its own tests (K1, K3–K6). |
| C21 | `apps/api/src/todos/repository.ts` line 62, branch 59 | integration | accepted | Re-throws an error that is neither a SQLite error nor a closed handle. Storage failures are one of those two, and I7 and I13 test both as `503 unavailable`. Anything else is a programming error, which reaches the `500` handler. |

No scenario in the catalogue is missing, and no gap hides an untested rule of either epic. C5, C6 and C8, which waited on this epic, are closed by its tests. Every other gap is accepted with the reason above. The only test this story added is the measurement scripts' host-guard check, which covers no app source.
