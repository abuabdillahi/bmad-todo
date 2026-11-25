# Performance report: epic-manage-todos

- **Date:** 2026-11-25
- **Epic:** epic-manage-todos (R19, C4). This covers the whole app: every action and every endpoint.
- **Commit measured:** `32c3365` plus story 2.9's changes, which touch only the measurement scripts, `package.json` scripts, the README and the reports. No app source changed, so these are `32c3365`'s app and images. Every number below comes from one sequence of runs on a freshly built `todo-test` with a new volume, taken after the review's fixes to the scripts (the painted-frame timing and the description `PATCH`).
- **Environment:** `todo-test` (`docker compose -p todo-test --profile test up -d --build --wait`) at `http://127.0.0.1:8081`, on an Apple Silicon Mac (Apple M5 Pro, 48 GB, Docker 29.9.3, Compose v5.7.1). Production was not measured.
- **Tools:** Node 26.13.1 (`fetch`, `performance.now()`), Playwright 1.65.1 driving Chromium 159.0.8154.6 with the Chrome DevTools Protocol (`Performance.getMetrics`), `PerformanceObserver` for paint and LCP, `MutationObserver` and `requestAnimationFrame` for the actions, Lighthouse 13.6.0 (`pnpm dlx`, pinned in `e2e/perf/lighthouse.mjs`), Vite 8.3.8 for the compressed bundle sizes
- **Reproduce** (in this order, on a fresh stack, then `docker compose -p todo-test --profile test down -v`):
  - `pnpm --filter @todo/e2e exec playwright install chromium`
  - `pnpm perf:first-load`: `e2e/perf/first-load.mjs`, seeds the list to 50 and runs 5 cold-cache loads
  - `pnpm perf:actions`: `e2e/perf/actions.mjs`, the five actions, 5 runs each at desktop and on Pixel 7
  - `pnpm perf:api`: `scripts/perf-api.mjs`, the API p95 of all five endpoints (`PATCH` timed for both kinds of change)
  - `pnpm perf:lighthouse`: `e2e/perf/lighthouse.mjs`, Lighthouse in mobile and desktop, light and dark
  - `pnpm a11y:pass` follows, for the accessibility report.

As in epic 1, Playwright plus CDP stands in for the Chrome DevTools MCP that the test strategy names (AD-20): the same Chromium, the same navigation, paint and runtime numbers, from committed scripts anyone can rerun. Every script refuses any host other than `127.0.0.1`, `localhost` or `[::1]` before its first request, because each creates todos. Each was checked with `BASE_URL=https://example.com` and exited 1 without sending a request, and the profile test `measurement-guards.profile.test.ts` now checks that for all five scripts in every `pnpm test:all`.

## API: p95 under 300 ms with one user (C4)

Requests run one at a time, as one user would send them. Each endpoint gets 20 warm-up requests, then 200 timed ones, through nginx (`web-test`) to the API, the path the browser uses. Each time runs from the request until the whole response body has been read. `GET /api/todos` ran on a list of 57 todos. `PATCH` is timed twice, on two todos the script created: once toggling `completed` true and false in turn (the complete and reactivate path), once setting a new description each time (the edit path, with AD-8's description checks). Each `DELETE` removes a todo the script created, untimed, just before it, so every delete is a real `204`. Percentiles use the nearest-rank method.

| Endpoint | n | p50 ms | p95 ms | p99 ms | max ms | p95 < 300 ms |
|---|---|---|---|---|---|---|
| `GET /api/health` | 200 | 0.5 | 0.6 | 0.7 | 1.6 | pass |
| `GET /api/todos` (list of 57) | 200 | 0.6 | 0.8 | 1.3 | 1.7 | pass |
| `POST /api/todos` | 200 | 0.5 | 0.7 | 0.9 | 1.3 | pass |
| `PATCH /api/todos/{id}` (`completed`) | 200 | 0.5 | 0.6 | 0.6 | 0.9 | pass |
| `PATCH /api/todos/{id}` (`description`) | 200 | 0.5 | 0.7 | 1.5 | 1.9 | pass |
| `DELETE /api/todos/{id}` | 200 | 0.5 | 0.6 | 0.8 | 1.3 | pass |

`pnpm perf:api` exited 0. Every endpoint's p95 is under 1 ms, more than 300 times inside C4.

## Actions: each shows within 100 ms (C4)

`pnpm perf:actions` times each action from the `timeStamp` of the input event that triggers it to the change in the DOM, and to the painted frame after that change. EXPERIENCE Motion counts an action as shown at the first painted frame of its change, so the painted time is the one gated. It is taken in a message posted from the next `requestAnimationFrame` callback: rAF runs before that frame's style, layout and paint, and the posted message runs after them. The setup is untimed: the todos are seeded through the API before the page loads, and Edit and the Delete confirm are opened before the timed input.

| Action | Input (timed from) | Change |
|---|---|---|
| add | Enter keydown in "New todo" | a new card with the text |
| edit | Enter keydown in the edit field, new text already typed | the card's text shows the new text |
| complete | pointerdown on the Completion check | checked, and the Done chip shows |
| reactivate | pointerdown on the Completion check | unchecked, and the Done chip is gone |
| delete | pointerdown on Confirm delete | the row turns into its Leaving copy |

Desktop is Chromium at 1280×720, clicking. Pixel 7 is Playwright's device (412×839, touch, the phone's user agent), tapping. **Neither profile throttles the CPU:** both run at this Mac's speed, so the Pixel 7 rows show the phone layout and touch path, not a phone's processor (P10). Motion is on, as a user has it by default. Between actions the script waits until no request has been in flight for 250 ms, so one action's settle-time refetch never lands inside the next one's timing. It fails if any API request it causes answers 4xx or 5xx or fails. The list held 55 todos before seeding.

**Input → painted frame (ms), gated: every run under 100 ms**

| Profile | Action | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Max |
|---|---|---|---|---|---|---|---|---|
| desktop | add | 21.1 | 34.3 | 31.8 | 31.7 | 29.9 | 31.7 | 34.3 |
| desktop | edit | 29.5 | 35.1 | 37.1 | 34.6 | 29.1 | 34.6 | 37.1 |
| desktop | complete | 31.5 | 34.0 | 33.6 | 32.2 | 34.8 | 33.6 | 34.8 |
| desktop | reactivate | 32.4 | 33.8 | 35.1 | 33.3 | 32.7 | 33.3 | 35.1 |
| desktop | delete | 18.2 | 16.5 | 18.1 | 17.4 | 16.9 | 17.4 | 18.2 |
| Pixel 7 | add | 28.8 | 32.4 | 32.5 | 31.7 | 29.6 | 31.7 | 32.5 |
| Pixel 7 | edit | 23.9 | 30.9 | 35.5 | 27.3 | 28.8 | 28.8 | 35.5 |
| Pixel 7 | complete | 52.2 | 50.2 | 53.1 | 52.8 | 51.2 | 52.2 | 53.1 |
| Pixel 7 | reactivate | 48.5 | 49.0 | 49.7 | 49.8 | 47.2 | 49.0 | 49.8 |
| Pixel 7 | delete | 35.1 | 36.0 | 35.1 | 35.8 | 34.3 | 35.1 | 36.0 |

**Input → change in the DOM (ms)**

| Profile | Action | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Max |
|---|---|---|---|---|---|---|---|---|
| desktop | add | 7.3 | 18.4 | 14.2 | 15.8 | 13.8 | 14.2 | 18.4 |
| desktop | edit | 14.9 | 20.3 | 21.0 | 20.1 | 13.4 | 20.1 | 21.0 |
| desktop | complete | 13.8 | 15.5 | 17.3 | 16.5 | 18.1 | 16.5 | 18.1 |
| desktop | reactivate | 17.7 | 14.5 | 16.0 | 17.0 | 14.5 | 16.0 | 17.7 |
| desktop | delete | 3.8 | 3.5 | 3.3 | 3.0 | 3.3 | 3.3 | 3.8 |
| Pixel 7 | add | 8.4 | 16.8 | 17.8 | 15.7 | 15.1 | 15.7 | 17.8 |
| Pixel 7 | edit | 11.1 | 17.5 | 19.0 | 13.2 | 15.5 | 15.5 | 19.0 |
| Pixel 7 | complete | 37.1 | 32.5 | 36.2 | 34.2 | 34.0 | 34.2 | 37.1 |
| Pixel 7 | reactivate | 33.8 | 32.8 | 33.3 | 32.6 | 29.2 | 32.8 | 33.8 |
| Pixel 7 | delete | 19.2 | 20.5 | 20.0 | 19.5 | 19.9 | 19.9 | 20.5 |

`pnpm perf:actions` exited 0: every one of the 50 runs was painted within 100 ms, the slowest at 53.1 ms (complete, Pixel 7). Every action is optimistic (AD-13), so none waits for the server.

The click and tap actions are timed from pointerdown, so their numbers include the press itself: the handler runs on the `click` that follows pointerup. Confirm delete turns its row into the Leaving copy synchronously in that handler (`flushSync`), within 4 ms on desktop. Complete and reactivate reach the DOM later: in the code, the mutation helper writes the cache only once `cancelQueries` for the list has resolved (`apps/web/src/todos/mutations.ts`, `cancelQueries(...).then(() => applyToCache(entry))`), and the render follows that write. Their DOM times sit near one frame (16–18 ms) on desktop and two (29–37 ms) on Pixel 7, which suggests the write waits on a frame-aligned tick, but no trace was taken to confirm where the time goes. That is accepted (P11): the slowest run is painted at about half of C4's budget.

## First load (no pass bar, epic decision 2026-11-24)

Chromium, desktop 1280×720, no network or CPU throttling, a fresh browser context per run (cold cache), list of 50–54 todos. Times are ms from navigation start. "List rendered" is when every stored todo is in the DOM. Bytes are transfer sizes over the local origin, which is uncompressed (P3). The last two columns are the add action measured on the loaded page with epic 1's method (to the next `requestAnimationFrame`, before that frame paints), kept so the two epics compare; `perf:actions` above is the gated measurement.

| Run | List | TTFB | DCL | Load | FCP | LCP (element) | List rendered | HTML KB | JS KB | CSS KB | CDP Script | CDP Layout | CDP Style | CDP Task | JS heap KB | Add → DOM | Add → frame |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 5.3 | 67.9 | 67.9 | 96.0 | 96.0 (H1) | 96.1 | 0.7 | 281.3 | 37.1 | 30.5 | 4.6 | 9.1 | 74.5 | 3210 | 11.0 | 30.0 |
| 2 | 51 | 2.7 | 47.3 | 47.3 | 60.0 | 60.0 (H1) | 66.5 | 0.7 | 281.3 | 37.1 | 18.2 | 2.6 | 4.0 | 37.0 | 3228 | 19.1 | 35.7 |
| 3 | 52 | 2.9 | 48.5 | 48.5 | 60.0 | 60.0 (H1) | 67.9 | 0.7 | 281.3 | 37.1 | 18.4 | 2.7 | 4.0 | 36.6 | 3248 | 17.7 | 34.6 |
| 4 | 53 | 2.2 | 54.4 | 54.5 | 80.0 | 80.0 (H1) | 66.7 | 0.7 | 281.3 | 37.1 | 18.8 | 2.6 | 4.0 | 37.0 | 3265 | 4.9 | 19.7 |
| 5 | 54 | 2.6 | 47.8 | 47.9 | 60.0 | 60.0 (H1) | 68.5 | 0.7 | 281.3 | 37.1 | 18.8 | 2.8 | 4.0 | 37.5 | 3301 | 4.9 | 24.7 |

Medians: TTFB 2.7, DOMContentLoaded 48.5, load 48.5, FCP 60.0, LCP 60.0, list rendered 67.9, add → DOM 11.0, add → frame 30.0 ms.

Against epic 1 (medians FCP 64.0, list rendered 60.5 ms), the first paint is no slower and the list renders about 7 ms later, in line with the larger bundle and stylesheet (P2, P9). Run 1 is the first load on a freshly started stack and the slowest. The list still renders within a frame or two of the first paint, and the largest paint is still the heading.

Lighthouse, simulated throttling, on the same stack. By then `perf:api` had grown the list to 280 todos (277 active, 3 done); the list size comes from the run order, not from a fixed target:

| Run | Performance | FCP | LCP | TBT | CLS | Speed Index | TTI | Total weight |
|---|---|---|---|---|---|---|---|---|
| mobile, light | 100 | 0.9 s | 0.9 s | 0 ms | 0 | 0.9 s | 0.9 s | 359 KiB |
| mobile, dark | 100 | 0.9 s | 0.9 s | 0 ms | 0 | 0.9 s | 0.9 s | 359 KiB |
| desktop, light | 100 | 0.2 s | 0.2 s | 0 ms | 0.003 | 0.2 s | 0.2 s | 359 KiB |
| desktop, dark | 100 | 0.2 s | 0.2 s | 0 ms | 0.003 | 0.2 s | 0.2 s | 359 KiB |

The failing scored performance audits, the same in all four runs: `network-dependency-tree-insight` (P5), `render-blocking-insight` (300 ms estimated on mobile, 80 ms on desktop, P4), `unused-css-rules` (15–17 KiB, P9), `unused-javascript` (138 KiB, P2) and `bf-cache` (P7). `cache-insight` is not reported (P1 still holds).

### Bundle (P2 re-measured)

| Asset | Epic 1 (local, uncompressed) | Now (local, uncompressed) | Now, gzip (Vite build report) |
|---|---|---|---|
| JS | 264.9 KB | 281.3 KB (+16.4 KB, +6%) | 89.69 kB |
| CSS | 24.9 KB | 37.1 KB (+12.2 KB) | 6.80 kB |

The JS and CSS columns are `perf:first-load`'s transfer sizes. The gzip figures are from `pnpm --filter @todo/web exec vite build` on the same source (same CSS hash, `index-BNmcs4D8.css`). Production compresses with brotli at Cloudflare's edge and was not measured in this story.

## Findings

P1 to P7 are epic 1's findings with today's status.

| # | Finding | Status | Change or reason |
|---|---|---|---|
| P1 | No `Cache-Control` on the hashed assets, and none on `index.html`. | fixed | Fixed in epic 1 (`apps/web/nginx.conf`). Still holds: Lighthouse reports no `cache-insight` in any of the four runs. |
| P2 | Lighthouse `unused-javascript`: 138 KiB of the 281 KB bundle unused on first load (epic 1: 144 KiB of 265 KB). | accepted | Re-measured as epic 1 asked: the bundle grew 6% (16.4 KB) for edit, complete, delete and the list states, which is not marked growth. It is still one bundle of React, React DOM, TanStack Query and the app, 89.7 kB gzipped. This is a one-screen app, so splitting the code would save little and add a loading state. |
| P3 | The `todo-test` origin does not compress text (nginx's default `gzip off`). | accepted | Production compresses at Cloudflare's edge. Adding gzip at the origin would only change local numbers, and the uncompressed local figures are the pessimistic case. |
| P4 | Lighthouse `render-blocking-insight`: the one stylesheet (37 KB) blocks render, an estimated 300 ms on simulated mobile and 80 ms on desktop. | accepted | One CSS file, needed for the first paint. Inlining it would conflict with the CSP's `default-src 'self'` (no inline styles). The real FCP is 60 ms median, and Lighthouse scores performance 100. |
| P5 | Lighthouse `network-dependency-tree-insight`: chain HTML → JS → `GET /api/todos`. | accepted | Inherent to a client-rendered list. The chain is three requests on one origin. |
| P6 | Desktop CLS 0.003. | accepted | Well under the 0.1 "good" bound, and Lighthouse does not flag it. |
| P7 | `bf-cache` fails in all four runs with `CacheLimitPrunedOnCriticalMemoryPressure`. In epic 1 it came once and not in the final runs. | accepted | Lighthouse marks the reason "Not actionable": Chromium pruned its back-forward cache under memory pressure on this host. It is the only reason given, so the page itself is eligible. TBT is 0 ms in all four runs. |
| P8 | `pnpm perf:first-load` no longer finished: its add check compared a card's whole `textContent` with the description, and every card now also holds its Edit and Delete buttons, so the wait timed out after 15 s. | fixed | `e2e/perf/first-load.mjs` now matches the card's text span, as `perf:actions` does. The numbers above were taken after the fix. |
| P9 | Lighthouse `unused-css-rules`: 15–17 KiB of the 37 KB stylesheet unused on first load (new in this epic). | accepted | The unused rules style edit mode, the Delete confirm, the List error panel, the skeletons, the Announcer's variants and the other colour scheme, all needed only after an interaction or in another state. It is one stylesheet, 6.8 kB gzipped, and splitting it would add requests or a flash of unstyled state. |
| P10 | The Pixel 7 profile emulates the phone's viewport, touch and user agent but not its CPU, so no number here is from a phone-class processor. | accepted | C4 names a target, not a device, and the test strategy profiles in the browser Playwright runs. The slowest run is painted at 53.1 ms, so a CPU about twice as slow would still fit for every action. No run on phone hardware was made; if one ever shows an action at or over 100 ms, that becomes a new bug. |
| P11 | Complete and reactivate reach the DOM a frame later than the other actions (16–18 ms desktop, 29–37 ms Pixel 7), and the cause is not traced. | accepted | The code applies the change after `cancelQueries` resolves (AD-13); a frame-aligned wait after that is likely but unconfirmed. Every run is still painted within 53.1 ms, about half of C4's 100 ms, so tracing it changes no outcome. Revisit if a later change pushes either action toward the budget. |

Every endpoint meets C4 (p95 under 300 ms, n = 200, `PATCH` for both kinds of change), and every run of every action is painted within C4's 100 ms at desktop and on the Pixel 7 profile. First load has no pass bar. Its only new issue (P8) was in the measurement script and is fixed.
