---
title: 'The README overstates where the deploy secrets live and what the catch-up guarantees'
type: bugfix
ticket: '21'
created: '2026-11-26'
status: built
baseline_revision: '7ffb26d7af040b0e6672cdc3a23cba4053c8b1f4'
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
      The catch-up script's messages and ci.yml's header comment still contradict the corrected README (re-run advice, "never replaced or undone", secrets "in production").
    evidence: |-
      scripts/deploy-catch-up.mjs:194 warns "not deploying it again. A person re-runs it (README, Deploy)", while README now says never to re-run a scheduled run; the gate's notice (deploy-catch-up.mjs:478-479) says "so a rollback is never replaced or undone"; ci.yml:12-16 says the same and that the secrets are in production. Pre-existing; the ticket's Boundaries forbid changing scripts and the workflow. Fits alongside A7 / D3 (#75).
    location: >-
      scripts/deploy-catch-up.mjs:194, scripts/deploy-catch-up.mjs:478, .github/workflows/ci.yml:12
    severity: low
---

<intent-contract>

## Intent

**Problem:** `README.md` says the five deploy secrets live in the `production` environment, limited to `main` (only true after the user's #65), says a scheduled deploy "never" replaces or undoes a rollback (a seconds-wide window between `catch-up-gate`'s check and `deploy` joining `deploy-prod` remains, and a re-run of a scheduled run is a second way), and advises re-running failed runs without excluding scheduled ones; the security report's S2, S3 and #28 note still call the Cloudflare edge unchecked, though 2.8's Notes (Result: line, 2026-11-25) record the production checks.

**Approach:** Docs-only edits to `README.md` (deploy description, Scheduled catch-up incl. the warning's "re-run it as below", "Re-run failed jobs", Required GitHub settings and its table, the bootstrap `TUNNEL_TOKEN` line, Roll back) and to `docs/quality/2026-11-25-epic-manage-todos-security.md` (S2, S3, Backlog decisions #28), stating only what the workflow (`ci.yml`, `scripts/deploy-catch-up.mjs`, read only) and the cited sources hold: secrets are repository secrets until #65 moves them and limits `production` to `main`; `deploy` and `catch-up` already name the environment; S10 stays open; the gate makes a replaced or undone rollback unlikely, not impossible; never re-run a scheduled run (wait for the next schedule, or follow the Deploy steps: deploy by hand from GHCR or merge a commit); edge results 301 (S2 holds at the edge), oversized `POST` → `400 application/problem+json` (S3), `%zz` → Cloudflare's HTML `400` (accepted S9 gap). Commands and steps other than the re-run warning, other report rows, S3's status, code, workflow, scripts, secrets and settings stay unchanged; no request to production.

</intent-contract>

## Implementation Notes

Oneshot: two Markdown files, about 20 lines changed, no code. Evidence read: `ci.yml` (catch-up, catch-up-gate, deploy guard lines 279-303), `scripts/deploy-catch-up.mjs` (`gate` uses the current attempt's start; a failed deploy is a warning and is not redeployed by the next schedule), 2.15's plan (residual window of seconds), 2.18's Notes (`production` exists since main run 45727428285 with no rules or secrets; deploys read the repository secrets), 2.8's Notes Result: line, retrospective D1, D2, D3, F6, A3.

Implemented (2026-11-26): `README.md` -- deploy step 2 and `catch-up`'s description no longer say the secrets come from `production`; Required GitHub settings' paragraph and table say repository secrets until #65, S10 open, jobs already name the environment, which exists with no rules or secrets; bootstrap `TUNNEL_TOKEN` line likewise; Scheduled catch-up and Roll back replace "never" with the gate making it unlikely plus the seconds-wide window and the re-run; the catch-up warning's "re-run it as below" now points to the Deploy advice and excludes scheduled runs; a new paragraph after the "Re-run failed jobs" bullets says never re-run a scheduled run, why (D3 a and b, verified against `ci.yml` guard and `deploy-catch-up.mjs` `gate`), and what to do instead. `docs/quality/2026-11-25-epic-manage-todos-security.md` -- S2 (status now "accepted; the redirect holds at the edge"), S3 (status unchanged, `fixed`) and the #28 note record the 2026-11-25 edge checks, citing 2.8's Notes, Result: line. Step 4 of "Moving the secrets" left unchanged: it re-runs a push run, not a scheduled one, and the ticket forbids changing other steps. Surprise: the next schedule does not redeploy a failed deploy (it warns), so "wait for the next schedule" alone would not recover one; the README says so and points to the Deploy steps.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` README "Never re-run a scheduled run": waiting for the next schedule gives an all-clear when the failed attempt already started the tip (decide() row 1, "production already runs main's tip"), so the "warns that the deploy failed" follow-up never fires and an unhealthy production goes unnoticed — verified in deploy-catch-up.mjs decide(); patched: the paragraph now says to check what production runs and its health first, and if the tip is live but unhealthy, roll back by hand or merge a fix.
  - `[low]` `[patch]` Same paragraph: "catch-up-gate looks for runs by hand only from the re-run's start" is wrong when only `deploy` failed, since "Re-run failed jobs" does not re-run the successful gate and its first `clear=true` stands — verified (ci.yml:189, :214: gate is upstream of deploy); patched: the sentence now gives both cases, with the same conclusion.
  - `[low]` `[defer]` deploy-catch-up.mjs:194 and :478 and ci.yml:12-16 still say "re-runs it", "never replaced or undone" and secrets in production — pre-existing, outside the ticket's Boundaries (no script or workflow change); deferred.

## Verification

**Commands:**
- `git diff --name-only <baseline_revision>` -- expected: only `README.md`, `docs/quality/2026-11-25-epic-manage-todos-security.md`, and this plan file
- `grep -n -E "never replaces|never lets a scheduled|never undoes|production. environment's secrets|live in the GitHub environment" README.md` -- expected: no match
- `grep -n -E "Not re-checked|not verified" docs/quality/2026-11-25-epic-manage-todos-security.md` -- expected: no match

**Manual checks (if no CLI):**
- Every README sentence that names the deploy secrets says they are repository secrets until #65; every re-run advice excludes scheduled runs; S2, S3 and the #28 note each cite 2.8's Notes, Result: line; S3's status is still `fixed`.

## Auto Run Result

- **Summary:** Docs-only fix of #72. README now says the five deploy secrets are repository secrets until #65 moves them into `production` and limits it to `main` (S10 open; `deploy` and `catch-up` already name the environment, which exists with no rules or secrets); replaces "never" about scheduled deploys and rollbacks with what the gate holds (unlikely, a window of seconds remains, a re-run is a second way); says never re-run a scheduled run, why, and what to do instead. The security report's S2, S3 and #28 note record the 2026-11-25 production edge checks from 2.8's Notes, Result: line.
- **Files:** `README.md` -- deploy description, Scheduled catch-up, "Re-run failed jobs", Required GitHub settings and table, bootstrap `TUNNEL_TOKEN`, Roll back; `docs/quality/2026-11-25-epic-manage-todos-security.md` -- S2 (status "accepted; the redirect holds at the edge"), S3 (status unchanged), #28 note; this plan.
- **Review (quick):** 3 findings: 2 patched (1 medium, 1 low), 1 deferred (low, script and workflow messages outside the Boundaries), 0 rejected.
- **Follow-up review recommended:** false (first pass patched no high and only one medium).
- **Verification:** `git diff --name-only` baseline: only README.md, the security report and this plan. The forbidden-phrase greps on README and the report: no match (exit 1), before and after the patches. Manual check of every criterion against the diff. No tests run: no code changed and no test reads these files; CI runs the suite on push.
- **Residual risks:** the script's warning (deploy-catch-up.mjs:194) still tells a person to re-run a failed deploy, contradicting README until the deferred item is fixed; README's secrets text and S10 must be put back into the present tense once #65 is done (2.18's Notes).

