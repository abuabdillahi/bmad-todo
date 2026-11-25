---
title: 'The e2e drop tests can drop mid-text when a long description wraps'
type: bugfix
ticket: '14'
created: '2026-11-25'
status: built
baseline_revision: '03981186b2e33b9910267b00173790fda7a23ea2'
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

**Problem:** `dropText` in `e2e/helpers.ts` drops at `box.x + box.width - 8, box.y + 12`, the end of the field's first line, so when the description wraps (phone width, a long random suffix) the drop lands at the wrap point, mid-text, and the E4 K3 edit drop test fails by chance (main run 45677224517). The app is right; the test aims wrong.

**Approach:** `dropText` aims at the end of the field's last line instead (right edge of the content box, middle of the last line, from the field's computed padding, border and line height) and checks in the page with `document.caretPositionFromPoint` that this point resolves to the field at `value.length`, throwing otherwise, so a mis-aimed drop fails loudly instead of landing mid-text. The E4 K3 edit drop test gets a description long enough to wrap in every project (and asserts the field shows two or more lines), so a first-line helper fails it every time. Only e2e test code changes; the tests' assertions on joining, caret and undo stay as they are.

</intent-contract>

## Implementation Notes

Oneshot: two e2e files, well under 100 lines; no app code (ticket AC3).

- `e2e/helpers.ts` `dropText`: the point is now computed in the page from the textarea's `getBoundingClientRect` and computed style: `x` = right edge of the content box minus 2 px, `y` = bottom of the content box minus half a line height (the field grows with its content, overflow hidden, so its last line sits at its bottom). Before dropping, `document.caretPositionFromPoint` at that point must give the field itself at `value.length`, or the helper throws with the offset it got. The CDP drag events, the data and the settle frame are unchanged.
- `e2e/edit.spec.ts` E4 K3 drop test: the description is `uniqueDescription('E4 drop', project)` plus a fixed 96-character tail (about 132 characters, 141 with the drop, under the 200 limit), and a new local `lineCount(field)` asserts the open field shows 2 or more lines before the drop. The joining, caret, axe, undo and no-PATCH assertions are untouched. The add-field drop test (`validation.spec.ts`) is unchanged: it holds `Buy `, one line, and now drops through the same helper.
- Verification (stack lock taken once, todo-test built from this tree, then `down -v --remove-orphans`, lock released): `pnpm typecheck` clean. Both drop tests with `--repeat-each=10` in desktop, phone and desktop-dark: 60/60 passed. With the old first-line aim temporarily restored in `dropText` (then put back, checked with `diff`), the E4 K3 drop test with `--repeat-each=3`: 9/9 failed in all three projects, the drop landing mid-text (e.g. phone `... mwwhf6tr-sw2e4u  oat milkwith a note ...`), so the wrap case is pinned. Whole `edit.spec.ts` + `validation.spec.ts`: 48/48 passed.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` AC1's wrap case is shown only for the edit field: the add-field drop test (`e2e/validation.spec.ts` "E6 K1 dropping two lines ...") still holds `Buy `, one line — real as a coverage gap, but no defect reaches users or developers: the add and edit fields are the same `TextField` textarea and both drop through the one `dropText`, whose `caretPositionFromPoint` check throws rather than dropping anywhere but the end of the text, and AC2 asks for at least one wrapping drop test, which the edit test is. The fix is a new test (or new literals in the add test's joining, caret and counter checks, which the ticket's Boundaries keep as they are), more than a direct correction.
  - `[low]` `[reject]` The Implementation Notes give the edit test's fixed tail as 96 characters, the description as about 132 and 141 with the drop; it is 97 characters, about 133 and 142 in desktop-dark — real, harmless (well under the 200 limit), and its fix edits this build's plan; the Auto Run Result below gives the right figures.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors.
- With the stack lock held and todo-test up (`docker compose -p todo-test --profile test up -d --build --wait`): `E2E_BASE_URL=http://127.0.0.1:8081 pnpm --filter @todo/e2e exec playwright test edit.spec.ts validation.spec.ts --grep "dropping" --repeat-each=10` -- expected: all pass in desktop, phone and desktop-dark.
- Same stack, with the old first-line aim temporarily restored in `dropText` (then reverted): the E4 K3 edit drop test -- expected: fails in all three projects (the wrap case is pinned).
- Same stack: `E2E_BASE_URL=http://127.0.0.1:8081 pnpm --filter @todo/e2e exec playwright test edit.spec.ts validation.spec.ts` -- expected: all pass. Then `docker compose -p todo-test --profile test down -v --remove-orphans` and release the lock.

## Auto Run Result

- **Summary:** `dropText` (`e2e/helpers.ts`) no longer drops at the end of the field's first line, which is the wrap point when the text wraps. It aims at the end of the last line (right edge of the textarea's content box, middle of its last line, from its computed style) and first checks with `document.caretPositionFromPoint` that this point is the field at `value.length`, throwing otherwise. The E4 K3 edit drop test now uses a description that wraps in every project (the unique prefix plus a fixed 97-character tail, about 133 characters, 142 after the drop) and asserts the open field shows 2 or more lines, so a first-line drop fails it every time. No app code changed.
- **Files changed:**
  - `e2e/helpers.ts` -- `dropText` aims at the end of the last line and checks the point before dropping.
  - `e2e/edit.spec.ts` -- E4 K3 drop test: long, wrapping description and a `lineCount` check (new local helper); its assertions are unchanged.
- **Review findings:** quick lens, 2 findings, both low and rejected: the add-field drop test does not wrap (a coverage gap only; the shared, self-checking helper serves both fields and AC2 needs one wrapping test); the plan's tail length was off by one (plan-only fix, corrected here). 0 patches, 0 deferred.
- **Follow-up review recommendation:** false (first pass; patched: high 0, medium 0, low 0).
- **Verification:** `pnpm typecheck` clean. On todo-test built from this tree (stack lock taken once, then todo-test `down -v --remove-orphans` and the lock released): both drop tests `--repeat-each=10` in desktop, phone and desktop-dark, 60/60 passed; with the old first-line aim restored in `dropText`, the E4 K3 drop test failed 9/9 (`--repeat-each=3`, all three projects), dropping mid-text; whole `edit.spec.ts` + `validation.spec.ts`, 48/48 passed. `pnpm test:all` not run locally (CI runs it).
- **Residual risks:** the point assumes a textarea whose last line sits at the bottom of its content box (true for the shared `TextField`: it grows with its content, overflow hidden); for any other field shape the check throws instead of dropping mid-text. The add-field drop test still drops into a one-line field.
