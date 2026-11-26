---
id: 26
type: bug
title: "The closing reports of epic-manage-todos describe the code as it ends up"
parent: backlog
covers: [R14, R18, R19, R20]
after: []
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "72"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/72"
tracker_status: in-progress
---

# The closing reports of epic-manage-todos describe the code as it ends up

## Description

The four reports that close epic-manage-todos under `docs/quality/` describe the code as it was on 2026-11-25, before the last merges, so a reader would believe things that no longer hold. The security report says the Cloudflare edge was never checked, though it was checked on production on 2026-11-25; it keeps S10 open, though #65 moved the five deploy secrets into the `production` environment on 2026-11-26; and it describes the scheduled catch-up (#26) as being built, though PR #87 removed it. The coverage report gives figures per project only, so it never says whether the user's goal for the epic, at least 70% test coverage, is met, and its figures, test counts and gap rows predate PR #86. The accessibility and performance reports name a measured commit older than PR #86 and PR #87 without saying whether those changes touch what they measured. Docs only, under `docs/quality/`. Found by the retrospective (F6, action A3) and re-scoped on 2026-11-26 (Notes).

## Reproduction

1. On `main` at `d0884e2`, read `docs/quality/2026-11-25-epic-manage-todos-security.md`: rows S2, S3 and S10, and the Backlog decisions lines for #26, #27 and #28.
2. Actual: S2 says "Not re-checked: this review sends no request to production"; S3 and the #28 line say what Cloudflare's edge sends "is not verified"; S10 is "to be fixed" by #64 and #65 and says `deploy` and `catch-up` read the secrets; the #26 line describes the catch-up as to be built; the #27 line does not say it was built. Expected: what holds at `d0884e2`, per the References.
3. Read `docs/quality/2026-11-25-epic-manage-todos-coverage.md`.
4. Actual: lines, branches, functions and statements per project (unit, component, integration) only, measured on `32c3365` plus story 2.9's changes; no whole-app figure, no word on the 70% goal; gap rows C6, C7, C18, C19 and C20 cite `mutations.ts` and `AddForm.tsx` lines from before PR #86. Expected: a whole-app figure measured on `d0884e2`, the goal stated as met or not, and figures and gap rows of that commit.
5. Read `docs/quality/2026-11-25-epic-manage-todos-accessibility.md` and `docs/quality/2026-11-25-epic-manage-todos-performance.md`, their Commit measured lines.
6. Actual: both measured `32c3365` plus story 2.9's changes; neither says whether the merges since then change what they measured. Expected: a dated addendum that says so.

## Cause Hypothesis

The reports were written by story 2.8 (security) and story 2.9 (coverage, accessibility, performance) before the epic's last merges. The edge checks were made by the orchestrator after story 2.8 merged (2.8's Notes, Result: line) and never copied into the report. #65 (secrets), PR #86 (#70) and PR #87 (#26 removed) landed after the reports, and no ticket brought them up to date. Coverage was reported per project as the test strategy asks (AD-20), and nobody added a figure for the whole app.

## Acceptance Criteria

1. **The security report records the edge checks**
   **Given** the security report's S2 and S3 rows and its #28 Backlog decisions line
   **When** they are read
   **Then** each records the 2026-11-25 production check and cites 2.8's Notes (Result: line) as its source: plain HTTP answers `301` to HTTPS (S2 holds at the edge); an oversized `POST /api/todos` passes Cloudflare and gets nginx's validation problem, `400 application/problem+json` (S3, #28); a `%zz` id gets Cloudflare's own HTML `400` before nginx, the accepted S9 gap (S9's row itself stays unchanged); no "not re-checked" or "not verified" sentence about the edge remains; S3's status stays fixed, and S2's may say the redirect holds at the edge
2. **The security report closes S10 and says what became of #26 and #27**
   **Given** the security report's S10 row and its #26 and #27 Backlog decisions lines
   **When** they are read
   **Then** S10 is fixed: only the `deploy` job reads the five secrets, it runs in the `production` environment, deployable from `main` only, and the secrets moved there on 2026-11-26 (#65); no sentence says a `catch-up` job exists or reads them. The #26 line says the catch-up was built (PR #67), then removed (PR #87), that #26 was closed as not planned on 2026-11-26, and that README gives the remedy (re-run a cancelled tip deploy). The #27 line says it was built (PR #68) and verified in run 45725697794
3. **The security report says which code it now describes**
   **Given** the security report
   **When** it is read
   **Then** a dated 2026-11-26 addendum says it now describes `main` at `d0884e2`, with `.github/workflows/ci.yml` as PR #87 left it, and names the rows and lines the addendum changed; the original Commit measured line and the other findings stay as written
4. **The coverage report states a whole-app figure against the 70% goal**
   **Given** the coverage report
   **When** it is read
   **Then** it gives lines, statements, branches and functions for the whole app, measured on `d0884e2` in one Vitest run of the unit, component and integration tests over `apps/api/src`, `apps/web/src` and `packages/contract/src` merged, with the number of tests run; says whether the user's goal of at least 70% test coverage is met, or not met with the gap; and gives the command that reproduces the figure, which re-run on `d0884e2` gives the same figures
5. **The coverage report's other figures are those of `d0884e2`**
   **Given** the coverage report's per-project table, its test counts and its gaps and findings
   **When** they are read
   **Then** the per-project figures and test counts are measured on `d0884e2`; every gap row that names a line or branch of `apps/web/src/todos/mutations.ts` or `apps/web/src/components/AddForm.tsx` gives its number at that commit; any line PR #86 added that the tests miss is a gap closed or accepted with a reason (R18); and the Commit measured line names `d0884e2`
6. **The accessibility and performance reports say what later changes touch**
   **Given** the accessibility and performance reports
   **When** they are read
   **Then** each carries a dated 2026-11-26 addendum that names every merge on `main` after PR #66 (the reports' own merge) up to `d0884e2` and says, with the reason, whether it changes anything that report measured (PR #86 changes the client's add-failure path; PR #87 and the other workflow merges touch no app code), and states any measurement re-run because of it; the accessibility report's user screen-reader check stays pending and optional, pointing at spike #79
7. **Only docs change**
   **Given** the diff
   **When** it is reviewed
   **Then** it touches only the four `docs/quality/2026-11-25-epic-manage-todos-*.md` reports, and every statement it adds is backed by a cited source, a run, or reading the workflow at `d0884e2`
8. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current reports
   **Then** they already say what criteria 1 to 6 require, with the evidence recorded in Notes — this supersedes 1 to 7

## Boundaries

- Must not change: `README.md` (PR #87 already made it accurate), `.github/workflows/ci.yml`, scripts, app source, tests, secrets or settings; epic-todo-foundation's reports; the findings of a report other than those the criteria name.
- No request is sent to production: the edge checks are recorded from 2.8's Notes.

## References

- parent — none (standalone ticket in `_bmad-output/backlog/`)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md, Aggregate view: spec-to-implementation reconciliation, finding F6; Behavior verification (run 45725697794); Action items A3
- epic — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md, Requirements R14, R18, R19, R20; Done when
- story — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/tickets/story-the-whole-app-s-security-review-is-written-with-every-findin.md, Notes, the Result: line of 2026-11-25 (the production edge checks, after main run 45713067680)
- story — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/tickets/story-the-user-moves-the-deploy-secrets-into-the-production-enviro.md (18, #65): secrets moved 2026-11-26, run 45727428285 attempt 3 passed its health check
- pull request — https://github.com/abuabdillahi/bmad-todo/pull/87, removes the scheduled catch-up (#26)
- pull request — https://github.com/abuabdillahi/bmad-todo/pull/86, fixes #70 (`apps/web/src/todos/mutations.ts`, `apps/web/src/components/AddForm.tsx`)
- pull request — https://github.com/abuabdillahi/bmad-todo/pull/85, closed unmerged: draft wording for S2, S3 and the #28 line to reuse
- report — docs/quality/2026-11-25-epic-manage-todos-security.md, S2, S3, S9, S10; Backlog decisions
- report — docs/quality/2026-11-25-epic-manage-todos-coverage.md, Result; Gaps and findings
- report — docs/quality/2026-11-25-epic-manage-todos-accessibility.md, Scope (the pending screen-reader line)
- report — docs/quality/2026-11-25-epic-manage-todos-performance.md, header
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (AD-20's coverage per project)

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): from the retrospective's action item A3, fixed in this epic on a fix branch through the full gate.
- Decision: 2026-11-26, user: all non-essential work stops and closing epic-manage-todos comes first; this ticket moves out of the epic to the backlog (po's call on what is non-essential: it is test- or docs-only and the epic's criteria do not need it). Partial work: /Users/idris/me/todo-wt/patches/ (and, for #72, branch bug-72-readme-deploy-accuracy, PR #85 closed unmerged).
- Decision: 2026-11-26, user (relayed by the orchestrator): reuse existing tickets, create no new ones. This ticket becomes the one ticket for making epic-manage-todos' closing reports accurate, and stays a standalone fix in the backlog. Re-scoped and retitled from "The README overstates where the deploy secrets live and what the catch-up guarantees": its README and catch-up parts are moot, since #65 is done (the README's "secrets live in production" now holds) and PR #87 removed the catch-up and rewrote the README (#26 closed as not planned). Added: S10 and the #26 and #27 lines, the coverage report's whole-app figure against the 70% goal, and addenda to the accessibility and performance reports. The earlier Open question (who brings the README and S10 back to the present tense after #65) is settled by this ticket.
- Assumption: the goal of at least 70% test coverage is the user's, relayed on 2026-11-26; neither the initiative's R18 nor the epic's states a percentage, and the initiative's Notes assume no percentage gates a build. The report states the goal as met or not; it adds no gate.
- Assumption: an orchestrator measurement on the same app code gave lines 95.9%, statements 94.91%, branches 92.52%, functions 94.6% over 805 tests; the builder re-measures on `d0884e2` and the report carries the builder's figures.
- Assumption: the builder chooses the reproducing command for criterion 4 (a script or a documented one-line Vitest call); adding a script would break criterion 7, so the command is written in the report.
- Open question: PRs #67 and #68 made `vitest.config.ts` run `scripts/**/*.test.ts` in the unit project, so unit test counts rise without app code changing; the coverage report should say so rather than read the jump as PR #86's.
- Decision: 2026-11-26, po (hands-off run): marked refined on the orchestrator's instruction with the two Assumptions above unconfirmed; they do not change what the criteria require, and the builder settles both in the report.
