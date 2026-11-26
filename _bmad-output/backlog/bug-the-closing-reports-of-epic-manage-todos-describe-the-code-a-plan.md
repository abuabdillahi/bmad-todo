---
title: 'The closing reports of epic-manage-todos describe the code as it ends up'
type: bugfix
ticket: '26'
created: '2026-11-26'
status: built
baseline_revision: '7acb2f4355b314c442aec097ee54e9a86ed29b4f'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: ['/Users/idris/me/todo-wt/bug-72-closing-reports/_bmad-output/backlog/bug-the-closing-reports-of-epic-manage-todos-describe-the-code-a.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The four reports closing epic-manage-todos (`docs/quality/2026-11-25-epic-manage-todos-{security,coverage,accessibility,performance}.md`) describe the code before PRs #67, #68, #69, #87 and #86 and before #65's secret move: the security report calls the edge unchecked, keeps S10 open and describes the catch-up as to be built; the coverage report has no whole-app figure against the user's 70% goal and pre-#86 figures and line numbers; the accessibility and performance reports do not say whether the later merges touch what they measured.

**Approach:** Docs-only edits to those four files, per the ticket's criteria 1 to 7, using measured facts: a whole-app merged Vitest run on `d0884e2` (lines 95.9% 1006/1049, statements 94.99% 1195/1258, branches 92.65% 694/749, functions 94.6% 351/371, 609 tests); per-project figures, test counts and lcov from main CI run 45738427453's `coverage` artifact and test job log (`pnpm test:all` on `d0884e2`); story 2.8's Notes Result: line for the edge; #65's ticket Result: line; `ci.yml` read at `d0884e2`; a Vite build of `d0884e2` for the bundle size.

</intent-contract>

## Tasks & Acceptance

- Security: S2, S3 and the #28 line record the 2026-11-25 edge checks from 2.8's Notes (PR #85's wording); S10 fixed (only `deploy` reads the five secrets, `environment: production`, main only, secrets moved 2026-11-26, #65); #26 line built (PR #67), removed (PR #87), closed not planned 2026-11-26, README remedy; #27 line built (PR #68), verified in run 45725697794; a dated 2026-11-26 addendum naming `d0884e2`, `ci.yml` as PR #87 left it and the rows and lines changed.
- Coverage: whole-app figure section with the command and the 70% goal met; per-project table, counts, scenario counts and untagged count of `d0884e2`; the unit count's rise explained (30 `scripts/ci-workflow-steps.test.ts` tests from PRs #67-#69/#87's `vitest.config.ts` include, 9 from PR #86); gap rows C6, C7, C18, C19, C20 renumbered to `d0884e2`; PR #86's uncovered branches (`mutations.ts` 203, 319) accepted with a reason; Commit measured names `d0884e2`.
- Accessibility and performance: dated 2026-11-26 addenda naming PRs #67, #68, #69, #87, #86, what each touches, and what was re-run (axe in CI's `pnpm test:all` on `d0884e2`; the Vite bundle build).

## Implementation Notes

Oneshot: four Markdown files, well under 100 changed lines, no code. Facts were gathered during planning: merged run `npx vitest run --project unit --project component --project integration --coverage --coverage.reportsDirectory=<tmp>`; CI artifact lcov for `mutations.ts` (unit misses lines 293-294, branches 203, 220, 319; component also 125, 180, 186, 208, 328, 333, 340, 344 and line 126) and `AddForm.tsx` (component misses branch 63); old line map 108→126, 168→186, 178→220, 242-243→293-294, 268→328, 280→340, 284→344, AddForm 57→63, 54→59.

Files touched: the four `docs/quality/2026-11-25-epic-manage-todos-*.md` reports only. Decisions: the whole-app command is written in the coverage report (no script, per criterion 7); its figures differ from the ticket's orchestrator assumption (statements 94.91%, branches 92.52%, 805 tests), so the report carries the builder's re-measured figures (statements 94.99%, branches 92.65%, 609 tests: the three in-process projects; 805 is not reproducible from test:all's counts, which sum to 784 with contract, e2e, profile and contract-unavailable). The unit count's rise (270 to 309) is explained as 30 workflow tests plus 9 of PR #86's (the ticket's Open question). PR #86 added no uncovered line; its two uncovered branch sides (`mutations.ts` 203, 319) are accepted in C19 and C7. The performance addendum re-measured the bundle with a Vite build of `d0884e2` and of the pre-#86 source (temporarily checked out, then restored): +472 bytes, 89.69 to 89.82 kB gzipped. The accessibility addendum cites CI run 45738427453's axe results (129 tests, 168 scans, 0 without a scan). Re-run of the whole-app command gave identical figures.

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` Criterion 7: the diff adds this plan file besides the four reports — the plan is build bookkeeping under `_bmad-output/`, which the build workflow and the run's instructions commit on the branch; criterion 7's point (no code, README, workflow, scripts, tests or settings) holds, and no report other than the four changes.
  - `[low]` `[patch]` Security addendum says the report now describes `d0884e2`, while Results › Dependencies still says no `.github` change since `e96a258` — patched: the addendum now says the Results still describe `58796f0` plus story 2.8's changes, that `ci.yml` changed in PRs #67, #68, #69 and #87, and that no dependency, lockfile, Dockerfile, `.dockerignore`, `compose.yml` or `nginx.conf` changed after story 2.8 (`git diff --stat 16cdf23 d0884e2`).
  - `[low]` `[patch]` S2's Finding still says plain HTTP "is not redirected" while its status and reason say the redirect holds — patched: the Finding is now past tense, "was not redirected to HTTPS, as epic 1 found it".

## Verification

**Commands:**
- `npx vitest run --project unit --project component --project integration --coverage --coverage.reportsDirectory=/tmp/bug72-cov-rerun` -- expected: 609 tests pass and the summary equals the figures written in the coverage report
- `git diff --name-only origin/main...HEAD` -- expected: only the four reports and this plan file

**Manual checks (if no CLI):**
- `grep -n -i "not re-checked\|not verified\|catch-up" docs/quality/2026-11-25-epic-manage-todos-security.md` -- no sentence calls the edge unchecked or says a `catch-up` job exists or reads the secrets

## Auto Run Result

- Summary: the four epic-manage-todos closing reports now describe `main` at `d0884e2`. Security: S2, S3 and the #28 line record the 2026-11-25 edge checks (2.8's Notes); S10 fixed (#65, only `deploy` reads the secrets, `production`, main only); #26 built then removed (PRs #67, #87, closed not planned), #27 built and verified (PR #68, run 45725697794); dated addendum. Coverage: whole-app figure lines 95.9% (1006/1049), statements 94.99% (1195/1258), branches 92.65% (694/749), functions 94.6% (351/371), 609 tests, 70% goal met; per-project figures, counts and gap rows of `d0884e2`. Accessibility and performance: dated addenda on PRs #67, #68, #69, #87 and #86.
- Files: `docs/quality/2026-11-25-epic-manage-todos-security.md` (edge checks, S10, #26/#27, addendum); `...-coverage.md` (whole-app figure, `d0884e2` figures, counts, gap rows); `...-accessibility.md` (addendum, axe re-run in CI, spike #79 pointer); `...-performance.md` (addendum, bundle re-measured); this plan.
- Review (quick): 3 findings; 2 low patched (security addendum scope clause; S2 finding past tense); 1 rejected as false (the plan file in the diff is build bookkeeping the workflow commits). Nothing deferred.
- Follow-up review recommended: false (patched: high 0, medium 0, low 2).
- Verification: the whole-app command re-run on the tree (app code identical to `d0884e2`) gave 609 passed and the same four figures; the branch diff holds only the four reports and this plan; no "not re-checked"/"not verified" edge sentence remains in the security report.
- Residual risk: the per-project figures and e2e/axe counts come from main CI run 45738427453, not re-run locally (no stack used).
