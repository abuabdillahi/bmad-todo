---
id: 21
type: bug
title: "The README overstates where the deploy secrets live and what the catch-up guarantees"
parent: epic-manage-todos
covers: [R20]
after: []
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "72"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/72"
tracker_status: backlog
---

# The README overstates where the deploy secrets live and what the catch-up guarantees

## Description

A reader of the README would believe things that do not hold. It says the five deploy secrets live in the `production` environment, limited to `main`, and that the deploy reads them from there; both hold only once the user's story 18 (#65) moves them, so a reader would take security report S10 as closed. It says a scheduled deploy "never" replaces or undoes a rollback, though a window of seconds remains between the gate's check and the deploy, and re-running a scheduled run by hand is a second way. And it tells the reader to re-run a failed deploy without warning that a scheduled run must not be re-run. Separately, the security report's S2 and S3 still say the Cloudflare edge was "not re-checked" and "not verified", though the edge was checked on production on 2026-11-25. Docs only. Found by the retrospective (D1, D2, D3, F6; action A3).

## Reproduction

1. Read `README.md` at `b167cfe`: the deploy description, Scheduled catch-up (its warning "re-run it as below"), the Deploy section's "Re-run failed jobs" advice, Required GitHub settings, Roll back, and the bootstrap section's `TUNNEL_TOKEN` line.
2. Actual: the secrets are said to be in `production` and limited to `main`; "never replaces a rollback … and never undoes one" and "never lets a scheduled deploy replace or undo a rollback"; a failed deploy is to be re-run, with no word on scheduled runs. Expected: what holds today, per the evidence below.
3. Read `docs/quality/2026-11-25-epic-manage-todos-security.md`, rows S2 and S3.
4. Actual: "Not re-checked: this review sends no request to production" (S2); "What Cloudflare's edge sends … is not verified" (S3). Expected: the 2026-11-25 checks recorded.

## Cause Hypothesis

Story 17 (#64) wrote the README for the state after #65, in the present tense; story 15 (#26) described the gate's intent as a guarantee; the edge checks were made by the orchestrator after story 8 merged (2.8's Notes, Result: line) and never copied into the report.

## Acceptance Criteria

1. **README says where the secrets are today**
   **Given** README, every section that names the deploy secrets (deploy description, Required GitHub settings, the bootstrap section's `TUNNEL_TOKEN` line)
   **When** it is read before #65 is done
   **Then** it says the five secrets are repository secrets until #65 moves them into `production` and limits it to `main`, that the `deploy` and `catch-up` jobs already name the environment, and that S10 stays open until then; no sentence says the secrets are read from, or limited by, `production` today
2. **README claims only what the catch-up holds**
   **Given** README's Scheduled catch-up, Deploy ("Re-run failed jobs") and Roll back sections
   **When** they are read
   **Then** no sentence says a scheduled deploy "never" replaces or undoes a rollback; they say the gate makes that unlikely and that a window of seconds remains between the gate's check and the deploy; and wherever README advises re-running a failed run (the catch-up warning's "re-run it as below" included), it says a scheduled run must not be re-run by hand: wait for the next schedule or push a commit instead
3. **The security report records the edge checks**
   **Given** the security report's S2 and S3 rows
   **When** they are read
   **Then** each records the 2026-11-25 production check, citing 2.8's Notes (Result: line) as its source: plain HTTP answers `301` to HTTPS (S2 holds at the edge); an oversized `POST /api/todos` passes Cloudflare and gets nginx's validation problem, `400 application/problem+json` (S3); a `%zz` id gets Cloudflare's own HTML `400` before nginx, the accepted S9 gap; and the report's note on #28 drops its "not verified" sentence the same way; S3's status is unchanged, and S2's may say the redirect holds at the edge
4. **Only docs change**
   **Given** the diff
   **When** it is reviewed
   **Then** it touches only `README.md` and `docs/quality/2026-11-25-epic-manage-todos-security.md`, and every statement it adds is backed by a cited source or by reading the workflow
5. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current docs
   **Then** the docs already say what criteria 1 to 3 require, with the evidence recorded in Notes — this supersedes 1 to 4

## Boundaries

- Must not change: `.github/workflows/ci.yml`, scripts, secrets or settings; the README's commands and steps other than the re-run warning; other rows of the security report. No request is sent to production: the checks are recorded from 2.8's Notes.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md, R20
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md, Diff-scope review, findings D1, D2, D3; Aggregate view, finding F6; Action items A3
- story — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/tickets/story-the-whole-app-s-security-review-is-written-with-every-findin.md, Notes, the Result: line of 2026-11-25 (the production edge checks, after main run 45713067680)
- report — docs/quality/2026-11-25-epic-manage-todos-security.md, S2, S3, S9, S10
- story — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/tickets/story-the-user-moves-the-deploy-secrets-into-the-production-enviro.md (18, #65)

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): from the retrospective's action item A3, fixed in this epic on a fix branch through the full gate.
- Open question (for the user): after #65 moves the secrets, who updates the README and S10 back to the present tense? 2.18's description has no such step, and 2.18 is the user's own hitl task. This ticket does not wait on it.
