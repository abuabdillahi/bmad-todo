---
title: 'Shift+Enter over an IME submits the add form'
type: bugfix
ticket: '11'
created: '2026-11-25'
status: built
baseline_revision: '1df561367a3f54372b06e339a0325690087d7d8f'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** On a composing keyboard (keydown reported with keyCode 229), the shared text field's keydown handler stands aside, so Chromium raises a trusted `beforeinput` `insertLineBreak`, which `TextField.tsx` cancels and turns into a submit. That event carries no Shift, and no key state is kept, so Shift+Enter submits the add form and saves the edit, where it must do nothing (EXPERIENCE Keyboard map: "Shift+Enter, Text field: Nothing. No newline."; R13, R14).

**Approach:** The shared field (`useTextField` in `TextField.tsx`, used by AddForm and EditForm) remembers whether Shift was held at the latest keydown or keyup on the textarea. A `beforeinput` line break is always cancelled, but it submits only when Shift is not held. Trusted-key e2e tests in Chromium (CDP, as `validation.spec.ts` drives keyCode 229 today) prove it for both fields, written to fail on the current code first.

## Boundaries & Constraints

**Always:**
- One fix, in the shared field, covering the add and edit fields alike.
- A `beforeinput` `insertLineBreak` or `insertParagraph` is always cancelled (no line break, no space), with or without Shift.
- Every new e2e test runs at least one `expectNoAxeViolations` scan (`scripts/axe-coverage.mjs` fails a passed e2e test without one) and starts with scenario ids like its neighbours.
- e2e runs only against todo-test (`http://127.0.0.1:8081`), never production.

**Never:**
- No change to Enter submitting or saving (plain keyboard, keyCode 229 through `beforeinput`, and composing Enter during an open composition as `validation.spec.ts` asserts today), paste and drop cleaning, the counter, the Field status, Tab, or Escape in the Edit form.
- Do not touch `TodoCard.tsx`, `TodoList.tsx` or their tests (another build is changing them), AddForm/EditForm production code, messages, API, or CI/deploy files.
- No fix for #29 (multi-line drop undo).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Composing Shift+Enter, add field | text in field; Shift keydown and Enter keydown with keyCode 229 and Shift held; trusted `beforeinput` `insertLineBreak` | cancelled; value unchanged; no POST; focus stays | none |
| Composing Shift+Enter, edit field | Edit form open with text; same keys | cancelled; value unchanged; no PATCH; form stays open, focus in field | none |
| Composing Enter after a Shift+Enter | Shift released (keyup without Shift), then Enter keyCode 229 | add submits once / edit saves once, as today | as today |
| Composing Enter, no Shift | keyCode 229 Enter | submits / saves as today (existing tests unchanged) | empty: Inline error as today |
| Plain Shift+Enter | non-composing keydown | keydown cancels it, nothing else, as today | none |
| `beforeinput` line break with no keydown before it | e.g. Android with no prior key event | flag is false: submits as today | none |

</intent-contract>

## Code Map

- `apps/web/src/components/TextField.tsx` -- `useTextField`. The native-listener `useEffect` (paste + `handleBeforeInput`) is where the fix goes: add native `keydown` and `keyup` listeners on the same element setting a local `shiftHeld = event.shiftKey`, and in `handleBeforeInput` keep `preventDefault()` but return before `requestSubmit()` when `shiftHeld`. Remove all listeners in the cleanup. Leave `handleKeyDown` (React, plain-keyboard Enter/Shift+Enter) as it is. Update the `handleBeforeInput` comment.
- `e2e/validation.spec.ts` -- holds `pressComposingEnter(cdp)` (CDP `Input.dispatchKeyEvent`, keyCode 229) and the two keyCode-229 tests ("a trusted Enter with keyCode 229 submits through beforeinput", "during an open composition"). Reuse its line-break recorder pattern and `recordCreates`.
- `e2e/helpers.ts` -- shared e2e helpers; move `pressComposingEnter` here (exported), adding an optional Shift: when set, a Shift keyDown (key `Shift`, code `ShiftLeft`, keyCode 229, `modifiers: 8`) before, Enter keyDown/keyUp with `modifiers: 8`, and a Shift keyUp with `modifiers: 0` after. Default behaviour identical to today's.
- `e2e/edit.spec.ts` -- edit e2e; has `recordPatches`, `tabToOnlyEdit`, `editField`, `patchAndRefetch`, `TODO_PATH`. Todos set up with `createTodo`.
- `apps/web/src/components/AddForm.component.test.tsx` -- K1 tests incl. "a beforeinput line break is cancelled and submits the form" (~line 310), `acceptCreates`, `renderAddForm`.
- `apps/web/src/components/EditForm.component.test.tsx` -- K3 tests incl. "a beforeinput line break in the edit field is cancelled and saves" (~line 505), `serve`, `renderLoaded`, `editButton`, `editField`.
- Test stack: `docker compose -p todo-test --profile test up -d --build --wait` builds web-test from source on 127.0.0.1:8081; e2e: `pnpm --filter @todo/e2e exec playwright test <spec> --grep <pattern>` with `E2E_BASE_URL=http://127.0.0.1:8081`. Shared lock `/tmp/todo-test-stack.lock` (mkdir to take, owner file `#30 bug-30-ime-shift-enter`, `rm -rf` to release once `docker compose -p todo-test --profile test down -v --remove-orphans` is done; if held, wait). Never use project `todo`.
- Environment rules -- every shell command starts with `cd /Users/idris/me/todo-wt/bug-30-ime-shift-enter && export PATH=$HOME/.nvm/versions/node/v26.13.1/bin:$PATH && `. Never read or write `/Users/idris/me/todo` or any other worktree, never touch branch `main`, and do not commit (the orchestrator commits). Hold the stack lock only while a stack run is in progress, and note in Implementation Notes how many times you took it and that todo-test is down and the lock released.

## Tasks & Acceptance

**Execution:**
- [x] `e2e/helpers.ts`, `e2e/validation.spec.ts` -- move `pressComposingEnter` to helpers with the optional Shift; add an e2e test "E6 K1 a trusted Shift+Enter with keyCode 229 neither adds nor inserts a line break, and Enter then adds" (Chromium only, like its neighbours): text in the field, composing Shift+Enter, assert the trusted `insertLineBreak` was raised, value unchanged, no create, focus kept, axe scan; then composing Enter adds it once -- AC2, add field.
- [x] `e2e/edit.spec.ts` -- add "E4 K3 a trusted Shift+Enter with keyCode 229 in the edit field neither saves nor inserts a line break, and Enter then saves" (Chromium only): open Edit, type added text, composing Shift+Enter, assert the trusted line break ran, value unchanged, no PATCH, field still focused, axe scan; then composing Enter saves one PATCH with the text -- AC2, edit field.
- [x] Run both new e2e tests against todo-test on the unfixed code and record that they fail on the defect (Implementation Notes).
- [x] `apps/web/src/components/TextField.tsx` -- the fix described in the Code Map.
- [x] `apps/web/src/components/AddForm.component.test.tsx`, `EditForm.component.test.tsx` -- one test each: keyDown Enter keyCode 229 with `shiftKey: true`, then a `beforeinput` `insertLineBreak` → `defaultPrevented` true, nothing sent; then keyUp without Shift and a composing Enter + `beforeinput` → sent once.
- [x] Rebuild todo-test, rerun the new and the existing keyCode-229 e2e tests: all pass.

**Acceptance Criteria:**
- Given text in the add field or the edit field on a keyboard reporting keyCode 229, when the user presses Shift+Enter, then nothing is submitted or saved and the value is unchanged (no line break, no space).
- Given the same keyboard, when the user then presses Enter alone, then the add form submits once or the edit saves once; Enter during an open composition behaves as today.
- Given the suite, when it runs, then the new trusted-key Chromium tests fail on the baseline code and pass with the fix, and every existing test passes.

## Implementation Notes

- `e2e/helpers.ts`: `pressComposingEnter(cdp, { shift })` moved here from `validation.spec.ts` and exported. Without `shift` it sends the same CDP events as before. With `shift` it sends Shift keyDown (`modifiers: 8`), Enter keyDown/keyUp with `modifiers: 8`, then Shift keyUp (`modifiers: 0`), all with keyCode 229.
- New e2e tests: `validation.spec.ts` "E6 K1 a trusted Shift+Enter with keyCode 229 neither adds nor inserts a line break, and Enter then adds" and `edit.spec.ts` "E4 K3 a trusted Shift+Enter with keyCode 229 in the edit field neither saves nor inserts a line break, and Enter then saves". Both skip outside Chromium and run one axe scan. Each waits 300 ms (`page.waitForTimeout`) after the Shift+Enter before checking that nothing was sent, so a wrong submit has time to show. This is the only fixed wait in the e2e suite.
- Red on baseline (todo-test built from `1df5613` plus the new tests only): both new tests failed in all three Chromium projects (desktop, phone, desktop-dark), 6 failed and 6 passed. In the add field the value was `""` (the form submitted and cleared). In the edit field the field was gone (the edit saved and closed). The two existing keyCode-229 tests passed.
- Fix in `TextField.tsx` `useTextField`: native `keydown` and `keyup` listeners set a local `shiftHeld = event.shiftKey`. `handleBeforeInput` still cancels every `insertLineBreak` or `insertParagraph`, but returns before `requestSubmit()` while Shift is held. All listeners are removed in the cleanup. `handleKeyDown` is unchanged.
- Component tests: one each in `AddForm.component.test.tsx` (K1) and `EditForm.component.test.tsx` (K3). With the baseline `TextField.tsx` swapped in, both failed. With the fix, both pass.
- Green: `pnpm typecheck` clean. `pnpm test`: 21 files, 435 tests passed. With todo-test rebuilt on the fix, `--grep "229"` over validation and edit specs gave 12 of 12 passed, and the full `validation.spec.ts` and `edit.spec.ts` gave 42 of 42 passed. `pnpm test:all` was not run; that is for the orchestrator.
- Stack lock: taken twice, for the baseline run and the post-fix run. Each time todo-test was taken down with `down -v --remove-orphans` and the lock released. todo-test is down and `/tmp/todo-test-stack.lock` is gone.
- Nothing committed.

- Review patch (quick pass): `TextField.tsx` also resets `shiftHeld` on the textarea's native `blur` (a Shift released after Shift+Tab or a window switch never reaches the field's keyup), with the AddForm component test "K1 a Shift held when the field loses focus does not block a later beforeinput line break" (fails with the listener removed).
- Orchestrator verification: after the first pass and again after the review patch, `pnpm typecheck` clean, `pnpm test` all passed (435, then 436), and `pnpm test:all` exit 0 with every step passed (e2e, axe coverage, profile, contract, contract-unavailable, scenario coverage) and todo-test down.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `TextField.tsx` `shiftHeld` is set only by key events on the textarea, so after Shift+Tab out of the add field (Shift keyup lands on the next element) or a window switch with Shift down it stays true, and a later `beforeinput` line break with no keydown of its own is cancelled without submitting, against the matrix row "flag is false: submits as today" — fixed: native `blur` listener resets `shiftHeld`, with a K1 AddForm component test (blur, then a keydown-less line break submits once).
  - `[low]` `[reject]` Implementation Notes say the new 300 ms waits are "the only fixed wait in the e2e suite", but there are two new ones and `e2e/perf/first-load.mjs:91` already waits 500 ms — real but the fix is to edit this build's plan, which triage rejects.

## Design Notes

The `beforeinput` event has no modifier state, so Shift must come from the key events around it. Keyup updates the flag too, so a Shift released before a later line break with no keydown of its own does not block it. The listeners are native, beside the existing native `beforeinput`, so the order is guaranteed by the platform (keydown, beforeinput, keyup).

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors.
- `pnpm test` -- expected: all unit, component and integration tests pass, including the two new component tests.
- With the lock held and todo-test up: `E2E_BASE_URL=http://127.0.0.1:8081 pnpm --filter @todo/e2e exec playwright test validation.spec.ts edit.spec.ts --grep "229"` -- expected: fails on baseline for the two new tests; all pass after the fix.
- With the lock held: `pnpm test:all` (run by the orchestrator at Verify, not by the implementer) -- expected: every step passed, todo-test down at the end.

## Auto Run Result

- **Summary:** On a composing keyboard (keyCode 229), Shift+Enter reached the shared field's `beforeinput` line-break path and submitted the add form or saved the edit. The shared `useTextField` now tracks Shift from native keydown/keyup on the textarea (reset on blur); a `beforeinput` `insertLineBreak`/`insertParagraph` is still always cancelled but submits only without Shift. One fix covers the add and edit fields.
- **Files changed:**
  - `apps/web/src/components/TextField.tsx` -- Shift tracking (keydown, keyup, blur) and the Shift guard in `handleBeforeInput`.
  - `e2e/helpers.ts` -- `pressComposingEnter(cdp, { shift })` moved here from `validation.spec.ts`, with an optional trusted Shift.
  - `e2e/validation.spec.ts` -- new E6 K1 trusted keyCode-229 Shift+Enter test (add field); uses the shared helper.
  - `e2e/edit.spec.ts` -- new E4 K3 trusted keyCode-229 Shift+Enter test (edit field).
  - `apps/web/src/components/AddForm.component.test.tsx` -- K1 Shift+Enter (229) test and K1 blur test.
  - `apps/web/src/components/EditForm.component.test.tsx` -- K3 Shift+Enter (229) test.
- **Review findings:** 1 patch applied (low: reset Shift on blur); 0 deferred; 1 rejected (low: a wrong "only fixed wait" claim in Implementation Notes; its fix would edit this build's plan).
- **Follow-up review recommendation:** false (patched: high 0, medium 0, low 1).
- **Verification:** both new e2e tests failed on the baseline in desktop, phone and desktop-dark (6 failures) and pass with the fix; the component tests fail against the baseline `TextField.tsx`. `pnpm typecheck` clean; `pnpm test` 436 passed; `pnpm test:all` exit 0 with every step passed, after the review patch.
- **Residual risks:** proven with CDP-driven trusted keys in Chromium only; real IMEs and Android keyboards are left to spike 13 (#31). A line break with no key event before it still submits, as before. The two new e2e tests each use a fixed 300 ms wait before asserting nothing was sent.
