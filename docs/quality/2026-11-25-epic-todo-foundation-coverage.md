# Coverage report: epic-todo-foundation

- **Date:** 2026-11-25
- **Epic:** epic-todo-foundation (R18)
- **Commit measured:** `b410ca9` plus story 1.9's changes (`apps/web/nginx.conf`, one added header assertion in `apps/api/test/profile/headers.profile.test.ts`; no source under `apps/*/src` or `packages/*/src` changed, so the line and branch numbers are those of `b410ca9`)
- **Tools:** Node 26.13.1, pnpm 12.23.0, Vitest 5.1.1 with `@vitest/coverage-v8` 5.1.1, Playwright 1.65.1 (Chromium 159.0.8154.6), Docker 29.9.3 with Compose v5.7.1
- **Reproduce:** `pnpm test:all`. It writes `coverage/{unit,component,integration}/` (`coverage-summary.json`, `lcov.info`, HTML) and `coverage/scenarios.md`. Nothing here gates the build on a percentage.

## Result

`pnpm test:all` exited 0: unit 178 tests, component 44, integration 47, contract 6, e2e 39 (13 specs × desktop, phone, desktop-dark), profile 4, contract-unavailable 3.

### Line and branch coverage per project

Each project counts only the sources that its layer is meant to exercise (`scripts/test-all.mjs`):

| Project | Sources counted | Lines | Branches | Functions | Statements |
|---|---|---|---|---|---|
| unit | `apps/api/src`, `apps/web/src`, `packages/contract/src` | 39.6% (242/611) | 39.94% (147/368) | 42.57% (86/202) | 39.49% (280/709) |
| component | `apps/web/src` | 87.2% (402/461) | 73.23% (208/284) | 83.12% (133/160) | 84.37% (459/544) |
| integration | `apps/api/src`, `packages/contract/src` | 68.66% (103/150) | 60.71% (51/84) | 78.57% (33/42) | 67.87% (112/165) |

The unit figure is low by design. Unit tests cover the rules (validation, ordering, the store, the mutation helper, the announcer, the client), and the components, routes and repository count against unit because unit's include spans every source tree. The components are covered by the component project and the routes and repository by integration. Read each file against the layer that owns it, as the gaps below do.

### Coverage by scenario id

The epic's scenario list against `coverage/scenarios.md`. Every scenario has at least one passing test in the layer the test strategy assigns it.

| Scenario | Epic scope | Passed | Suites |
|---|---|---|---|
| U1 | description rule, schema and client | 20 | unit |
| U2 | newest first | 4 | unit |
| U4 | optimistic apply and rollback | 12 | unit |
| U5 | create half (follow-ups dropped when a create fails) | 3 | unit |
| I1 | create | 1 | integration |
| I2 | invalid create | 11 | integration |
| I3 | list | 3 | integration |
| I6 | survives an api restart | 1 | profile |
| I7 | health, healthy and unhealthy | 2 | integration |
| I8 | create and list of injection payloads | 4 | integration |
| I9 | contract for create, list, health, unavailable | 16 | integration, contract, contract-unavailable |
| I10 | idempotent replay and conflict | 2 | integration |
| I11 | strict create validation | 13 | integration |
| K1 | add form | 51 | unit, component, e2e (all three projects) |
| K6 | names and keyboard | 8 | component |
| K7 | refresh failure, announcer | 117 | unit, component |
| E1 | create and reload | 6 | e2e (all three projects) |
| E6 | error handling for add and list | 33 | e2e (all three projects) |
| E7 | phone and desktop widths | 6 | e2e (desktop, phone, desktop-dark) |
| E8 | keyboard and axe in light and dark | 21 | e2e (all three projects) |

26 tests carry no scenario id: 19 unit tests of `loadConfig`, 4 integration tests of the API's startup exit on invalid config, and 3 profile tests (security headers on `/` and `/api/health`, log format with no todo text). They prove R15, R16 and AD-19 rules that the catalogue gives no id. They are listed here, not counted as a gap.

## Gaps and findings

A gap is a scenario in the epic's list with no test (none), or uncovered lines or branches in the layer that owns a file. Line numbers are from `coverage/<project>/lcov.info`.

| # | Gap | Layer | Status | Change or reason |
|---|---|---|---|---|
| C1 | `apps/api/src/server.ts` 0% in every project | integration | accepted | The process bootstrap. `apps/api/test/integration/startup.test.ts` spawns it as a child process, which v8 coverage in the test process cannot see. I6 (profile) and every container suite run it. |
| C2 | `apps/web/src/main.tsx` 0% | component | accepted | The browser entry point (`createRoot`). Every e2e test runs it. Component tests render `App` through the test harness instead. |
| C3 | `apps/api/src/config.ts` 0% in integration | integration | accepted | Owned by unit, where it is fully covered (19 tests). Integration builds the app from a ready `Config`. |
| C4 | `packages/contract/src/description.ts` 44% lines in integration | integration | accepted | Owned by unit, fully covered there (U1). Integration reaches it only through the schema pattern. |
| C5 | `apps/web/src/todos/hooks.ts` lines 31–35 (`useRetryFetch`) | component | accepted | The list's Try again (K5), which epic-manage-todos delivers with the error panel. No epic-1 component calls it yet. |
| C6 | `apps/web/src/todos/mutations.ts` lines 94–95, 123–126, 150–152 and branches for follow-ups, insert at an index and the revert of later pending calls | component | accepted | Edit, complete and delete paths of the one mutation helper. The unit project covers them (95% lines) through U4/U5. The component suite reaches only create because epic 1 has only the add form. The follow-up halves of U5 belong to epic-manage-todos. |
| C7 | `apps/web/src/todos/mutations.ts` lines 195–196 | unit | accepted | Defensive catch for an exception thrown by the helper's own chain, which `execute` never throws. It keeps the per-call promise non-rejecting (AD-13). |
| C8 | `apps/web/src/todos/messages.ts` lines 14, 45–48, 60, 95–101 in component (unit misses line 85) | component | accepted | Edit, complete and delete wording and the edit hint, used from epic-manage-todos. Unit covers the keys that exist. |
| C9 | `apps/web/src/components/AddForm.tsx` lines 33–48 | component | accepted | Auto-grow fallback for browsers without CSS `field-sizing: content`. The component tests don't reach the resize, and Chromium (e2e) supports `field-sizing`, so it takes the CSS path. Testing beyond Playwright's default browser is out of scope (test strategy Out). |
| C10 | `apps/web/src/components/Announcer.tsx` lines 18, 37–39, 75–76 | component | accepted | The motion-length parse fallback, the `ResizeObserver` absence branch (jsdom has none), and a leave cancelled by a new message during the fade-out. The e2e motion spec covers the default motion path. |
| C11 | `apps/web/src/api/client.ts` branches at lines 85, 101 | unit | accepted | The "caller aborted" side of the two cancellation checks. `query.test.ts` covers the cancellation on the query side (AD-11). |
| C12 | `apps/web/src/todos/query.ts` branch at line 33 | unit | accepted | Wraps a non-`RequestFailure` error as `generic`. The client only throws `RequestFailure` or an abort, so this is defensive. |
| C13 | `apps/web/src/todos/announcer.ts` lines 31–32 | unit | accepted | The production `requestAnimationFrame` scheduler. Tests inject a fake frame to control timing, and e2e runs the real one. |
| C14 | `apps/api/src/problems.ts` branches at lines 71, 74 | integration | accepted | `validation ?? []` and the `'is not valid'` fallback for an Ajv keyword with no message. No epic-1 schema uses another keyword, and Fastify always sets `validation` on a schema error. Epic 2's PATCH (`minProperties`) will reach line 74. |
| C15 | `apps/api/src/todos/service.ts` branch at line 10 | integration | accepted | The `0` of the id tie-break, for two todos with the same `createdAt` and the same id. The primary key makes that impossible. |
| C16 | `apps/api/src/todos/service.ts` lines 37–42 in unit | integration | accepted | Owned by integration (100% lines there). The unit tests cover `sortNewestFirst` (U2). |
| C17 | `apps/web/src/todos/TodosProvider.tsx` branches at 57, 75, 85, `store.ts` line 59 | component | accepted | The missing-provider guard and the cached per-client value, plus `requestRetry` (K5, epic 2). The provider guard is a programming-error throw. |

No scenario in the epic's list is missing, and no gap hides an untested epic-1 rule. Every gap is accepted with the reason above. No test was added in this story.
