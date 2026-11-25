---
id: 14
type: bug
title: "The e2e drop tests can drop mid-text when a long description wraps"
parent: epic-manage-todos
covers: [R13]
after: [12]
refined: true
hitl: false
risk: low
tracker_id: "60"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/60"
tracker_status: in-progress
---

# The e2e drop tests can drop mid-text when a long description wraps

## Description

The merge of story 2.6 (PR #59, merge 98b0f86) failed main run 45677224517 on its first attempt: the phone project's `E4 K3 dropping two lines into the edit field ...` test (`e2e/edit.spec.ts:237`) expected `"E4 drop phone mwwgzdmc-mcnprh oat milk"` and got `"E4 drop phone mwwgzdmc- oat milkmcnprh"`. The same tree had passed on the branch (run 45676454760), and the rerun passed, so the test is flaky, not the app. The tests come from bug 12 (#29, PR #58).

## Reproduction

1. Run the e2e drop tests in the phone project with a test description long enough to wrap onto a second line in the field (the random suffix from `uniqueDescription` makes the length vary run to run).
2. Actual: the drop lands at the wrap point, inside the text. Expected: it lands at the end of the text, as the tests assert.

## Cause Hypothesis

`dropText` in `e2e/helpers.ts` drops at `box.x + box.width - 8, box.y + 12`, the end of the field's first line. When the text wraps, that point is the end of line one, not the end of the text, and Chromium moves the caret there before the drop (the field's guarded intercept then correctly inserts at the drop point).

## Acceptance Criteria

1. **A drop meant for the end of the text lands there however the text wraps** (R13)
   **Given** an add or edit field holding a description that wraps onto two or more lines at phone width
   **When** a drop test drops text at the end of the text
   **Then** the dropped text is joined at the end, the caret sits after it, and one undo restores the field, in desktop, phone and desktop-dark
2. **The wrap case is pinned**
   **Given** the e2e suite
   **When** it runs
   **Then** at least one drop test uses a description long enough to wrap at phone width, so a helper that drops on the first line fails it every time, not by chance
3. **The app is unchanged**
   **Given** the diff
   **When** it is reviewed
   **Then** only e2e test code changes; `TextField.tsx` and the rest of `apps/` are untouched

## Boundaries

- Must not change: app code, the drop tests' assertions about joining, caret and undo, or failure injection (AD-20 allows only `page.route`; CDP drag input stays as it is).

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — main run 45677224517, attempt 1, job test (the failure above); bug 12's plan, `bug-dropping-multi-line-text-into-the-add-field-loses-chrome-s-u-plan.md`
- code — `e2e/helpers.ts` (`dropText`), `e2e/edit.spec.ts`, `e2e/validation.spec.ts`

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): Filed after main's test job failed on the 2.6 merge, per the user's rule to fix a failed main run forward on a fix branch through the same gate. It is built before the refactor sweep (story 7), which now waits on it, because both may touch `e2e/helpers.ts`.
