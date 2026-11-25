---
id: 8
type: story
title: "The whole app's security review is written, with every finding settled"
parent: epic-manage-todos
covers: [R20]
after: [7]
hitl: false
risk: medium
tracker_id: "49"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/49"
tracker_status: backlog
---

# The whole app's security review is written, with every finding settled

## Description

Reviews the UI for XSS in rendered and edited text, the update and delete routes for injection, and everything changed since epic 1's review (nginx config, dependencies), writes the security report under docs/quality/, fixes or accepts each finding, and decides each of backlog #26, #27 and #28: fixed here when the fix is small and touches no deploy step, secret, host or tunnel, else kept in the backlog or accepted with a dated reason.

## Requirements

Verify: docs/quality/ holds a dated security report naming epic-manage-todos, covering XSS in rendered and edited text, with each finding fixed or accepted with a reason and a line for each of #26, #27 and #28 saying what was decided; pnpm test:all passes.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: Reports (Security); I8, I12, I13
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-4, AD-8, AD-19; Consistency Conventions (Reports naming)
- report — docs/quality/2026-11-25-epic-todo-foundation-security.md (epic 1's findings S1-S5, S3 being #28)
- backlog — _bmad-output/backlog/bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed.md (#26), bug-a-manual-deploy-run-from-a-branch-other-than-main-silently-d.md (#27), bug-nginx-s-own-4xx-errors-under-api-are-html-not-problem-respon.md (#28)

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): #26, #27 and #28 stay in the backlog until this story, which decides each. The user's standing rule for this run: no change to the workflow's deploy steps, secrets, the host or the Cloudflare tunnel without asking them first. #26 and #27 live in the deploy job, so a fix for either is proposed to the user, not built here; each gets a dated line in its ticket and in the report.
