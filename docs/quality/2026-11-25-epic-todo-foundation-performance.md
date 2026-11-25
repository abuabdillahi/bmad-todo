# Performance report: epic-todo-foundation

- **Date:** 2026-11-25
- **Epic:** epic-todo-foundation (R19, C4)
- **Commit measured:** `b410ca9` plus story 1.9's changes (`apps/web/nginx.conf` cache headers and HSTS, fix P1 below). Every number below was taken after that fix, on a freshly built `todo-test` with a new volume.
- **Environment:** `todo-test` (`docker compose -p todo-test --profile test up -d --build --wait`) at `http://127.0.0.1:8081`, on an Apple Silicon Mac (Docker 29.9.3, Compose v5.7.1). Production was not measured. It got only `GET` requests, to compare asset sizes.
- **Tools:** Node 26.13.1 (`fetch`, `performance.now()`), Playwright 1.65.1 driving Chromium 159.0.8154.6 with the Chrome DevTools Protocol (`Performance.getMetrics`), `PerformanceObserver` for paint and LCP, Lighthouse 13.6.0 (`pnpm dlx`, pinned in `e2e/perf/lighthouse.mjs`)
- **Reproduce** (in this order, on a fresh stack, then `docker compose -p todo-test --profile test down -v`):
  - `pnpm perf:first-load`: `e2e/perf/first-load.mjs`, seeds the list to 50 and runs 5 cold-cache loads
  - `pnpm perf:api`: `scripts/perf-api.mjs`, the API p95
  - `pnpm perf:lighthouse`: `e2e/perf/lighthouse.mjs`, Lighthouse in mobile and desktop, light and dark

The test strategy names Chrome DevTools MCP for the profile. That MCP is an agent-side tool (AD-20). Playwright plus CDP in the same Chromium gives the same navigation, paint and runtime numbers from a committed script, so epic-manage-todos's close can rerun it. All three scripts refuse any host other than `127.0.0.1` or `localhost` before sending a request, because they create todos.

## API: p95 under 300 ms with one user (C4)

Requests run one at a time, as one user would send them. Each endpoint gets 20 warm-up requests, then 200 timed ones. Each time runs from the request until the whole response body has been read, through nginx (`web-test`) to the API, the same path the browser uses. `GET /api/todos` ran on a list of 55 todos: 50 seeded, plus the 5 that the first-load runs added. Percentiles use the nearest-rank method.

| Endpoint | n | p50 ms | p95 ms | p99 ms | max ms | p95 < 300 ms |
|---|---|---|---|---|---|---|
| `GET /api/health` | 200 | 0.5 | 0.6 | 0.7 | 1.3 | pass |
| `GET /api/todos` (list of 55) | 200 | 0.6 | 0.7 | 1.0 | 1.1 | pass |
| `POST /api/todos` | 200 | 0.5 | 0.7 | 0.8 | 1.0 | pass |

`pnpm perf:api` exited 0. An earlier run on the same stack with a list of 286 todos gave `GET /api/todos` a p95 of 1.1 ms, so list size is not a concern at this scale. Against an unreachable origin the script exits 1 and names the endpoint. With `BASE_URL=https://bmad-todo.abuabdillahi.com` it exits 1 before sending any request.

## First load (no pass bar, epic decision 2026-11-24)

Chromium, desktop 1280×720, no network or CPU throttling, a fresh browser context per run (cold cache), list of 50–54 todos. Times are ms from navigation start. "List rendered" is when every stored todo is in the DOM. Bytes are transfer sizes over the local origin, which is uncompressed (see P3).

| Run | List | TTFB | DCL | Load | FCP | LCP (element) | List rendered | HTML KB | JS KB | CSS KB | CDP Script | CDP Layout | CDP Style | CDP Task | JS heap KB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 3.9 | 55.8 | 55.8 | 88.0 | 88.0 (H1) | 71.1 | 0.7 | 264.9 | 24.9 | 17.6 | 2.8 | 5.0 | 47.7 | 2689 |
| 2 | 51 | 2.0 | 45.2 | 45.2 | 64.0 | 64.0 (H1) | 60.5 | 0.7 | 264.9 | 24.9 | 11.3 | 2.2 | 3.1 | 29.2 | 2693 |
| 3 | 52 | 2.0 | 52.2 | 52.2 | 76.0 | 76.0 (H1) | 62.4 | 0.7 | 264.9 | 24.9 | 11.8 | 2.1 | 3.2 | 27.2 | 2693 |
| 4 | 53 | 2.6 | 45.9 | 45.9 | 60.0 | 60.0 (H1) | 59.3 | 0.7 | 264.9 | 24.9 | 11.7 | 2.2 | 3.0 | 26.7 | 2697 |
| 5 | 54 | 2.8 | 47.3 | 47.4 | 64.0 | 64.0 (H1) | 60.5 | 0.7 | 264.9 | 24.9 | 11.6 | 2.2 | 3.0 | 26.9 | 2699 |

Medians: TTFB 2.6, DOMContentLoaded 47.3, load 47.4, FCP 64.0, LCP 64.0, list rendered 60.5 ms.

The list renders in the same frame as the first paint. The page has no loading flash on a local origin, and its largest paint is the heading.

Lighthouse, simulated throttling, on the same stack:

| Run | Performance | FCP | LCP | TBT | CLS | Speed Index | TTI | Total weight |
|---|---|---|---|---|---|---|---|---|
| mobile, light | 100 | 0.9 s | 0.9 s | 0 ms | 0 | 0.9 s | 0.9 s | 330 KiB |
| mobile, dark | 100 | 0.9 s | 0.9 s | 0 ms | 0 | 0.9 s | 0.9 s | 330 KiB |
| desktop, light | 100 | 0.2 s | 0.2 s | 0 ms | 0.003 | 0.2 s | 0.2 s | 330 KiB |
| desktop, dark | 100 | 0.2 s | 0.2 s | 0 ms | 0.003 | 0.2 s | 0.2 s | 330 KiB |

Production serves the same bundle (`index-CRC22-jF.js`) brotli-compressed by Cloudflare: 84.5 KB of JS and 5.4 KB of CSS on the wire (`GET` with `Accept-Encoding: br`), against 265 KB and 25 KB uncompressed locally.

## Actions: add (C4's 100 ms is recorded here; epic-manage-todos measures it formally)

The add action is the only action in this epic. The script types a description, presses Enter, and times from the `keydown` to the new card in the DOM and to the next animation frame after that, while the `POST` is still in flight.

| Run | 1 | 2 | 3 | 4 | 5 | Median |
|---|---|---|---|---|---|---|
| Enter → card in DOM (ms) | 5.2 | 12.3 | 6.1 | 6.4 | 6.6 | 6.4 |
| Enter → next frame (ms) | 18.6 | 28.2 | 23.5 | 22.9 | 21.4 | 22.9 |

The card appears in under 30 ms in every run, well inside C4's 100 ms, because the add is optimistic (AD-13) and does not wait for the server.

## Findings

| # | Finding | Status | Change or reason |
|---|---|---|---|
| P1 | No `Cache-Control` on the hashed assets (Lighthouse `cache-insight`: 290 KiB, cache lifetime 0). `index.html` had no `Cache-Control` either, so a browser could cache it heuristically after a deploy and ask for asset hashes that no longer exist. The fallback then answered those with `index.html` as `200 text/html`, which a script tag rejects. | fixed | `apps/web/nginx.conf`: `location /assets/` sends `expires 1y` (`Cache-Control: max-age=31536000`) with `try_files $uri =404`, so a stale hash gets a 404, not HTML. `location /` sends `expires epoch` (`Cache-Control: no-cache`), so `index.html` is revalidated on every load. `expires` is not `add_header`, so the AD-19 headers still apply (checked with `curl -D -` on `/`, an asset, a missing asset, a SPA route and `/api/health`). Re-measured: Lighthouse no longer reports `cache-insight` in any of the four runs, and `pnpm test:all` passed. |
| P2 | Lighthouse `unused-javascript`: 144 KiB of the 265 KiB bundle unused on first load. | accepted | One bundle of React, React DOM, TanStack Query and the app, 84.5 KB brotli in production. This is a one-screen app, so splitting the code would save little and add a loading state. Revisit if epic-manage-todos grows the bundle markedly. |
| P3 | The `todo-test` origin does not compress text (nginx's default `gzip off`). | accepted | Production compresses at Cloudflare's edge (brotli, measured above). Adding gzip at the origin would only change local numbers, and the uncompressed local figures are the pessimistic case. |
| P4 | Lighthouse `render-blocking-insight`: the one stylesheet (25 KB) blocks render, with an estimated 300 ms on simulated mobile and 80 ms on desktop. | accepted | One CSS file, needed for the first paint. Inlining it would conflict with the CSP's `default-src 'self'` (no inline styles). The real FCP is 64 ms median and Lighthouse scores performance 100. |
| P5 | Lighthouse `network-dependency-tree-insight`: chain HTML → JS → `GET /api/todos`. | accepted | Inherent to a client-rendered list. The chain is three requests on one origin, and the list renders with the first paint. |
| P6 | Desktop CLS 0.003. | accepted | Well under the 0.1 "good" bound, and Lighthouse does not flag it. |
| P7 | An earlier, first-ever Lighthouse run showed mobile TBT 350 ms, and one later desktop run failed `bf-cache` with `CacheLimitPrunedOnCriticalMemoryPressure`. | accepted | Neither came back in the final runs (TBT 0 ms in all four). Lighthouse marks the bf-cache reason "Not actionable": the host was short of memory. |

Every API endpoint meets C4 (p95 under 300 ms). The add action shows within C4's 100 ms. First load has no pass bar, and its one issue (P1) is fixed.
