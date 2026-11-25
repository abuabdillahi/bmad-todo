---
title: 'The security headers are tested on assets, a missing asset and the unavailable response'
type: chore
ticket: '2'
created: '2026-11-25'
status: built
baseline_revision: 'ab75e890531ffed47b2a04d321ba6e5612f67a83'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `apps/api/test/profile/headers.profile.test.ts` checks the AD-19 headers on `/` and `/api/health` only, so an `add_header` inside nginx's `/assets/` location (or the 503 location) would silently drop the CSP and the other headers there, and report P1's cache headers were checked by hand only (retrospective R3, action A4).

**Approach:** Move the AD-19 header table into a small shared test helper, `apps/api/test/security-headers.ts` (new file; `stack.ts` is left untouched for ticket #35). In the profile header test, add: a hashed asset linked from the served `index.html` is `200`, carries every AD-19 header with exactly the values `/` carries, and has `Cache-Control: max-age=31536000`; `/` has `Cache-Control: no-cache`; a missing `/assets/` path is `404`, carries every AD-19 header, and its body is not `index.html`. In `apps/api/test/unavailable/api-down.contract.test.ts`, add a test that `GET /api/todos`'s `503` (AD-4's literal body) carries every AD-19 header. Each new title starts with `I8`: the scenario catalogue has no header id (coverage report: the header tests carry none), and I8 is the one R20 scenario AD-19 binds. nginx's configuration, the order of `pnpm test:all`'s steps and AD-4's body do not change; for the next AD-20 amendment, note that the contract-unavailable step now also checks the AD-19 headers on the `503`.

</intent-contract>

## Implementation Notes

Oneshot: about 80 lines across three test files and no source change. Requirements 1-6 of the ticket are the acceptance; requirement 5 is proved by hand once (temporary `add_header` in `location /assets/`, rebuild `web-test`, run the header test, revert) and its failure is recorded here.

- Files: new `apps/api/test/security-headers.ts` (`SECURITY_HEADERS`, the table moved verbatim from the header test, and `expectSecurityHeaders`); `apps/api/test/profile/headers.profile.test.ts` (existing two tests unchanged in behaviour, three new `I8` tests); `apps/api/test/unavailable/api-down.contract.test.ts` (one new `I8` test). `stack.ts` and `apps/web/nginx.conf` are unchanged.
- The asset is taken from the served `index.html` (first `src`/`href` under `/assets/`), so the test follows each build's hash. The missing asset is `/assets/missing-<uuid>.js`; its body must differ from the served `index.html` and hold no `<div id="root">`.
- No defect found: nginx already sends every AD-19 header on the asset, the 404 and the 503, `Cache-Control: max-age=31536000` on the asset and `no-cache` on `/`.
- For the next AD-20 amendment: the contract-unavailable step now also checks the AD-19 headers on nginx's `503` (`GET /api/todos`); its rule that every `/api` route answers AD-4's literal `503` problem is unchanged and still asserted.
- `pnpm test:all` (local, 2026-11-25, on this change): every step passed; `coverage/scenarios.md` lists I8 as pass with 8 tests across integration, profile and contract-unavailable, the four new titles among them.
- Requirement 5, proved by hand (2026-11-25): with `add_header X-Probe "1";` added inside `location /assets/` and `todo-test` rebuilt (`docker compose -p todo-test --profile test up -d --build --wait`), `vitest run --project profile apps/api/test/profile/headers.profile.test.ts` failed 2 of 5: "I8 a hashed asset index.html links to carries the AD-19 headers that / carries, and a year's cache" and "I8 a missing asset under /assets/ is a 404 with the AD-19 headers, never index.html", both with `AssertionError: content-security-policy: expected null not to be null`. The stack was taken down and the edit reverted (`git diff -- apps/web/nginx.conf` empty).

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 1, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` The new tests' `I8` prefix files header and cache checks under I8 (inert injection payloads, `test-strategy.md:39`), so `coverage/scenarios.md`'s I8 row grows from 4 integration tests to 8 across three suites, and `GET /`'s no-cache test is P1, not AD-19. — Partly real: the row does grow. But the architecture binds AD-19, whose rules include the nginx CSP that keeps injected script from executing, to I8 (`architecture-todo-app.md:214`). Requirement 6 requires an id, and the catalogue has none for headers (coverage report line 52). The `/` test also asserts every AD-19 header. `scenarios.md` lists each title, and epic-manage-todos tracks the update/delete part of I8 by name (`epic-manage-todos.md:45`), so a higher count does not hide it. The only better fix is a new catalogue id, which is a catalogue amendment, not a direct correction. It is recorded as a residual risk.
  - `[false]` `[reject]` Requirement 6's "in CI" has no evidence, because the change is uncommitted and CI has not run. — Not a defect in the change: CI runs only on a branch push (`.github/workflows/ci.yml`), and the push follows this workflow's finalize commit. The run is checked after the push and reported with it.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: passes
- `pnpm test` -- expected: passes (in-process layers unaffected)
- `pnpm test:all` (holding the todo-test stack lock) -- expected: every step passes, and `coverage/scenarios.md` lists the new `I8` titles under `profile` and `contract-unavailable`

**Manual checks (if no CLI):**
- With `add_header X-Probe "1";` temporarily inside `location /assets/` in `apps/web/nginx.conf`, `todo-test` rebuilt, the profile header test fails on the asset and/or missing-asset test; the edit is then reverted and `git diff -- apps/web/nginx.conf` is empty.

## Auto Run Result

Status: built

- **Summary:** The AD-19 header table moved into a shared test helper. The profile header test now also checks that a hashed asset linked from the served `index.html` (200, every AD-19 header with the values `/` carries, `Cache-Control: max-age=31536000`) is covered, that `/` sends `Cache-Control: no-cache`, and that a missing `/assets/` file is a 404 with the AD-19 headers and is not `index.html`. The contract-unavailable suite checks the AD-19 headers on nginx's `503` for `GET /api/todos`. No source and no nginx change.
- **Files changed:**
  - `apps/api/test/security-headers.ts` -- new: `SECURITY_HEADERS` and `expectSecurityHeaders`, shared by both suites.
  - `apps/api/test/profile/headers.profile.test.ts` -- uses the shared helper; three new `I8` tests (asset, `/` no-cache, missing asset).
  - `apps/api/test/unavailable/api-down.contract.test.ts` -- one new `I8` test: the `503` problem carries the AD-19 headers.
- **Review (quick):** 2 findings. No patches, nothing deferred. Rejected: the `I8` labelling (low; AD-19 binds I8, the catalogue has no header id, and the fix would be a catalogue amendment), and the missing CI evidence (false; CI runs on the push after this commit).
- **Follow-up review recommended:** false (no patches; patched high 0, medium 0, low 0).
- **Verification:** `pnpm typecheck` passed. `pnpm test` passed (269 tests). `pnpm test:all` passed every step locally, and `coverage/scenarios.md` lists the four new titles under I8. Requirement 5 was proved by hand: with an `add_header` in `location /assets/`, the asset and missing-asset tests failed with `content-security-policy: expected null not to be null`, and the edit was reverted (see Implementation Notes).
- **Residual risks:** The scenario catalogue still has no id for nginx's security and cache headers. These tests are counted under I8, so the next catalogue or AD-20 amendment could give them their own id. AD-20 should also note the header check in the contract-unavailable step.
