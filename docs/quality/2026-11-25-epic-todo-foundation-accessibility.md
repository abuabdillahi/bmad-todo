# Accessibility report: epic-todo-foundation

- **Date:** 2026-11-25
- **Epic:** epic-todo-foundation (R14, WCAG 2.2 AA)
- **Commit measured:** `b410ca9` plus story 1.9's changes (`apps/web/nginx.conf` cache headers and HSTS only, no UI change)
- **Environment:** `todo-test` at `http://127.0.0.1:8081`, freshly built, list of 55 todos for Lighthouse
- **Tools:** Lighthouse 13.6.0 (`pnpm dlx lighthouse@13.6.0`) on Playwright's Chromium 159.0.8154.6 (`CHROME_PATH`). The e2e suite runs `@axe-core/playwright` 4.14.0 (axe-core 4.14.1) on Playwright 1.65.1.
- **Reproduce:** `docker compose -p todo-test --profile test up -d --build --wait && pnpm perf:lighthouse`, then `docker compose -p todo-test --profile test down -v`. For axe: `pnpm test:all`, which runs the e2e step.

## Scope

This report covers the **automated part only**. The manual pass of every core action by keyboard and with a screen reader belongs to epic-manage-todos (test strategy, Reports › Accessibility; story 1.9's ticket references). That epic delivers the edit, complete and delete actions that pass needs. Automated tools catch only part of WCAG, so this report is not a claim of full AA conformance.

## Lighthouse

`e2e/perf/lighthouse.mjs` forces the colour scheme with `--blink-settings=preferredColorScheme=<1 light | 0 dark>`. Before each run, the same Chromium binary and flags load a probe page, which must report the expected `prefers-color-scheme` or the script fails. This matters on this machine: macOS is in dark mode, and a first run with no flag came out dark even though it was meant to be light. The final screenshots of the mobile runs were also checked by eye, one light and one dark.

| Run | Scheme confirmed | Accessibility | Passed | Failed | Not applicable | Manual (not scored) | Best practices |
|---|---|---|---|---|---|---|---|
| mobile, light | light | 100 | 22 | 0 | 44 | 10 | 100 (13 passed, 0 failed) |
| mobile, dark | dark | 100 | 22 | 0 | 44 | 10 | 100 (13 passed, 0 failed) |
| desktop, light | light | 100 | 22 | 0 | 44 | 10 | 100 |
| desktop, dark | dark | 100 | 22 | 0 | 44 | 10 | 100 |

Lighthouse found no failing accessibility audit in either scheme. The 10 "manual" items (focus order, logical tab order, focus trapping, custom controls and similar) are the ones the manual pass covers in epic-manage-todos.

## axe-core in the e2e suite

Every e2e spec scans with axe using the AD-20 tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, and fails on any violation (`e2e/axe.ts`). The suite runs in three Playwright projects. `desktop` and `phone` (Pixel 7) run in light, and `desktop-dark` runs in dark, so every state is audited in both schemes. Each project emulates reduced motion, so no scan lands mid-transition.

States scanned in each project: loaded, added, reloaded, new session (`todos.spec.ts`); empty submit, over the limit (`validation.spec.ts`); add failed (`add-failure.spec.ts`); refresh failed, refresh failed while offline (`refresh.spec.ts`); offline (`offline.spec.ts`).

Result from `pnpm test:all` on 2026-11-25: 39 e2e tests passed (13 per project), **0 axe violations** in any state in any project. E8 is covered by 21 passing tests across the three projects (`coverage/scenarios.md`).

## Findings

Lighthouse found no failing accessibility audit in light or dark, on mobile or desktop, and axe found no violation in any e2e state in either scheme. So there is nothing to fix there, and the table lists only the findings below.


| # | Finding | Status | Change or reason |
|---|---|---|---|
| A1 | Lighthouse, by default, follows the OS colour scheme. On a host in dark mode, the "light" run audited the dark theme. | fixed | `e2e/perf/lighthouse.mjs` forces each scheme with a Blink setting and checks it with a probe before each run, so the light and dark runs always audit what they claim. |
| A2 | The keyboard and screen-reader pass of every core action has not been done. | accepted | Out of this epic's scope by the test strategy and story 1.9's ticket. It is owned by epic-manage-todos's accessibility report, once edit, complete and delete exist. |
