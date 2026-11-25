---
title: 'Fix epic 1 retro F1/A1: an axe scan in every e2e test, with a guard'
type: bugfix
ticket: ''
created: '2026-11-25'
status: built
baseline_revision: '66315b3ecb178afa36e2590ebfcfdda41f50d82d'
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
deferred:
  - summary: >-
      The README does not describe the new axe coverage guard, and still asks for an axe scan in each state of an e2e test.
    evidence: |-
      README.md:70 lists the steps of `pnpm test:all` without the new `axe coverage` step.
      README.md:158 tells contributors to add "an axe scan in each state". The guard only enforces at least one scan in every passed test, and the report now says scans cover key states only.
      The user's scope for this fix excluded the README ("e2e/, the guard and that one report"), so the README was not changed.
    location: >-
      README.md:70, README.md:158
    severity: low
---

<intent-contract>

## Intent

**Problem:** The epic-todo-foundation retrospective (F1, A1) found that 5 of the 12 e2e tests never call `expectNoAxeViolations` (`e2e/axe.ts`). These are `e2e/validation.spec.ts:82`, `:99`, `:118` and `:155`, and `e2e/motion.spec.ts:9`. The epic's Done when line asks for "axe-core in every e2e test in both colour schemes". The accessibility report (`docs/quality/2026-11-25-epic-todo-foundation-accessibility.md:29`) claims that "every state is audited", which is not true. Nothing stops epic 2 from adding more tests without a scan. This is a fix, not a board story: no ticket entry, and the epic's Done when line stays as it is.

**Approach:**
1. Add one scan to each of the five tests, after the assertion that proves the test reached its key state. Each scan gets a new label:
   - `two-line paste joined`, after the counter check at `:91`
   - `mid-text paste`, after the caret check at `:112`
   - `keyCode 229 Enter added`, after the create assertions at `:151`
   - `composed word added`, after the create assertions at `:175`
   - `added with motion`, in motion.spec. This one goes after the card's opacity is 1 and the Added status shows, and after a poll that proves `document.getAnimations()` has no running animation. That puts the scan after the motion has finished, not during it. Update the spec's header comment, which says it has no axe.
2. Add the guard. `expectNoAxeViolations` records a runtime annotation `{ type: 'axe', description: state }` through `test.info()`. A new script, `scripts/axe-coverage.mjs`, reads `coverage/e2e-report.json`, the JSON report that Playwright already writes and that `scenario-coverage.mjs` already reads.
   - It exits non-zero if the report is missing, if it has no passed test, or if any passed test result in any project has no `axe` annotation.
   - It lists skipped tests in its output, but they do not fail it: a skipped test ran nothing.
   - `scripts/test-all.mjs` runs the script as step `axe coverage` right after `e2e`. When todo-test did not start, the step is skipped with that reason, the same way e2e is.
   - This is the simplest mechanism that also covers new specs. They import `test` straight from `@playwright/test`, so a custom fixture would not see them. The check needs no extra harness, since it rides on the report and on the step pattern test-all already uses.
3. Rewrite the report's axe section.
   - Line 29 must say exactly what is true now: every e2e test scans at its key state or states in all three projects. The guard enforces this. Light is covered in desktop and phone, dark in desktop-dark only (there is no phone-dark project, retro F7).
   - Drop "every state is audited".
   - Update the list of scanned states on line 31, the result line on line 33 (with this run's counts and commit), and line 37's "any e2e state" so it says scanned states.

**Dark mode:** every spec runs in desktop, phone and desktop-dark. All three projects are Chromium (`Desktop Chrome`, `Pixel 7`), so the `browserName !== 'chromium'` skips at `:119` and `:156` never fire. Each new scan therefore runs in dark. No scan is limited by project.

**Rules:**
- If axe reports a real violation, fix the UI. Never weaken, skip or narrow the scan or `WCAG_TAGS`.
- Scope is `e2e/`, `scripts/axe-coverage.mjs`, `scripts/test-all.mjs` and that one report. Nothing under `_bmad-output/` changes apart from this plan.
- Branch: `fix-epic1-axe-coverage`, off `66315b3` (up to date with `origin/main`).

</intent-contract>

## Implementation Notes

Oneshot route: the change is about 85 lines across 6 files, and it is mechanical apart from the small guard script.

- Files touched:
  - `e2e/axe.ts` gets the `axe` annotation.
  - `e2e/validation.spec.ts` gets four scans.
  - `e2e/motion.spec.ts` gets one scan, the whole-page animation poll and a new header comment.
  - `scripts/axe-coverage.mjs` is new.
  - `scripts/test-all.mjs` gets the `axe coverage` step, plus its skip when todo-test did not start.
  - The accessibility report's axe section is rewritten.
- The annotation is pushed before the scan runs. A scan that finds violations fails its test anyway, so the guard never counts it as a passed, scanned test.
- The guard takes an optional report path (`argv[2]`) so it can be tested against an edited report.
- Surprise: `node` and `pnpm` are not on this shell's PATH. They come from nvm (`~/.nvm/versions/node/v26.13.1/bin`, matching `.nvmrc`).
- Results:
  - `pnpm test:all` exited 0 with every step passing. In e2e, 39 tests passed with 48 scans (16 per project, the same states in desktop, phone and desktop-dark) and 0 axe violations. No real violation came up, so the UI did not change.
  - Nothing was skipped: all three projects are Chromium, so the two `browserName` skips never fire.
- Proof that the guard fails:
  - It exits 1 on the report from before the fix, listing all 39 results.
  - It exits 1 on this run's report with the `axe` annotations removed from motion.spec in desktop-dark, naming only that test.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 5, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` `e2e/playwright.config.ts:4-7`: the header still says no axe scan lands mid-transition because every project reduces motion, and motion.spec now scans with motion on. — Rewrote the comment: motion.spec turns motion back on and scans only once no animation is running.
  - `[low]` `[patch]` `scripts/axe-coverage.mjs:31`: the `?? test.annotations` fallback can never run, because `JSONReportTestResult.annotations` is a required array in Playwright 1.65.1. — Removed the fallback, so the script reads `result.annotations`.
  - `[low]` `[patch]` Report :5 and :8: the "Commit measured" and "Reproduce" header lines did not match the re-measured axe result or mention the new step. — Line 5 now says the axe result was measured again at `66315b3` plus this fix, with no UI change. Line 8 now names the `axe coverage` step.
  - `[low]` `[patch]` Report, scanned-states list: older entries paraphrased their labels ("over the limit", "refresh failed while offline"), so the list could not be matched against the guard's output. — Changed them to the exact labels `over limit` and `refresh failed offline`.
  - `[low]` `[defer]` README:70 and :158 do not describe the guard, and still ask for a scan "in each state". — The user's scope for this fix excludes the README (e2e/, the guard and the one report). Recorded in `deferred`.
  - `[false]` `[reject]` The plan's "5 of the 12 e2e tests" is wrong, because there are 13 per project. — The source declares 12 `test()` calls, and the loop in `add-failure.spec.ts` turns one of them into 2 results per project, which gives 13. Both counts hold. The fix would also edit this plan.

## Verification

**Commands:**
- `pnpm --filter @todo/e2e typecheck` -- expected: exit 0
- `pnpm test:all` -- expected: exit 0. Every step passes, including the new `axe coverage` step. It reports 39 passed results (13 tests × 3 projects), each with an axe annotation, and 0 axe violations.
- `node scripts/axe-coverage.mjs` run against a copy of the report with one test's `axe` annotations removed -- expected: exit 1, naming that test and its project. This proves the guard fails.
- After pushing: CI on the PR -- expected: green.

## Auto Run Result

**Summary:** Each of the five e2e tests with no axe scan now has one at its key state. The labels are `two-line paste joined`, `mid-text paste`, `keyCode 229 Enter added`, `composed word added` and `added with motion`. The motion scan runs only after no animation is running on the page. A guard now fails `pnpm test:all` when a passed e2e test, in any project, ran no scan. The accessibility report's axe section states what is true now. No axe violation came up, so the UI did not change.

**Dark scheme:** all five new scans ran in desktop, phone and desktop-dark. All three projects are Chromium, so the `browserName` skips in two of the tests never fire. No scan is limited by project. Dark runs on desktop only, because there is no phone-dark project (retro F7, accepted).

**Files changed:**
- `e2e/axe.ts`: each scan records an `axe` annotation in the test's result.
- `e2e/validation.spec.ts`: four new scans.
- `e2e/motion.spec.ts`: one scan after the animation has finished, a page-wide check that no animation is running, and a new header comment.
- `e2e/playwright.config.ts`: the header comment is corrected for motion.spec.
- `scripts/axe-coverage.mjs`: the new guard, which reads `coverage/e2e-report.json`.
- `scripts/test-all.mjs`: a new `axe coverage` step after `e2e`, skipped when todo-test did not start.
- `docs/quality/2026-11-25-epic-todo-foundation-accessibility.md`: the axe section is rewritten. It no longer says "every state is audited", and its header, scanned states, result and findings lines are updated.

**Review:** one quick lens.
- 4 low patches applied: the config comment, the guard's fallback that could never run, the report header, and the exact state labels.
- 1 deferred: the README does not mention the guard, and the user's scope excluded the README.
- 1 rejected as false: the 12 vs 13 test count. Both are correct (12 declared tests, 13 results per project), and the fix would edit the plan.
- Patched counts by verdict: high 0, medium 0, low 4. `followup_review_recommended: false`.

**Verification:**
- `pnpm --filter @todo/e2e typecheck` exited 0.
- `pnpm test:all` exited 0 twice, before and after the patches. Every step passed, including `axe coverage`: 39 passed e2e tests with 48 scans (16 per project), 0 without a scan, none skipped, and 0 axe violations.
- The guard exits 1 on the report from before the fix, which lists all 39 results. It also exits 1 on this run's report with motion.spec's desktop-dark annotation removed, and names only that test.
- CI has not run yet: the build does not push.

**Residual risks:**
- The guard only checks that each passed test ran at least one scan, not that it scanned every state.
- A test that is skipped in every project is listed but does not fail the guard.

