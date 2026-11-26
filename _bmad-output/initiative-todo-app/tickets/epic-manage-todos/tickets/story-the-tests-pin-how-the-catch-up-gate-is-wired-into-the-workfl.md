---
id: 20
type: story
title: "The tests pin how the catch-up gate is wired into the workflow"
parent: epic-manage-todos
covers: []
after: []
refined: true
hitl: false
risk: low
tracker_id: "71"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/71"
tracker_status: in-progress
---

# The tests pin how the catch-up gate is wired into the workflow

## Description

The scheduled catch-up deploys only when `catch-up-gate` reports `clear` (2.15, #26). The job-graph test evaluates `needs.catch-up-gate.outputs.clear`, but nothing checks that the gate step's `id` is `gate`, that the job's `clear` output is read from that step, or that the step runs the script's `gate` mode, so a rename in any of the three would silently stop every scheduled deploy, the failure #26 exists to prevent (retrospective D4, action A2). This story adds those checks. Test only: `.github/workflows/ci.yml` does not change.

## Requirements

1. **The gate's wiring is pinned**
   **Given** `scripts/ci-workflow-steps.test.ts` reading `.github/workflows/ci.yml`
   **When** it runs
   **Then** it fails if the `catch-up-gate` job has no step with `id: gate`, if the job's output `clear` is not `${{ steps.gate.outputs.clear }}`, or if that step does not run `node scripts/deploy-catch-up.mjs gate`
2. **The gate mode writes the output the job reads**
   **Given** the script's `gate` mode spawned once against the local HTTP server the script's CLI tests already use, for one clear case and one not-clear case
   **When** it runs
   **Then** it writes `clear=true` and `clear=false` respectively to the file `GITHUB_OUTPUT` names
3. **Each check can fail**
   **Given** `.github/workflows/ci.yml` edited in the working tree with the step id, the output's source, or the script argument renamed, and restored after each run
   **When** the new checks run against it, once per rename
   **Then** each fails; the plan records the three runs
4. **The suite passes on the unchanged workflow**
   **Given** the branch
   **When** `pnpm test:all` runs
   **Then** it passes, and the diff touches only test files

## Boundaries

- Must not change: `.github/workflows/ci.yml`, `scripts/deploy-catch-up.mjs`, or any deploy, catch-up or gate behaviour; the job-graph scenarios already in `ci-workflow-steps.test.ts`.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md, Diff-scope review, finding D4; Action items A2
- bug — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/tickets/bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed.md (2.15, #26: the catch-up and its gate)

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): from the retrospective's action item A2, fixed in this epic on a fix branch through the full gate.
- Risk low: test only, and a wrong test fails loudly on the branch.
