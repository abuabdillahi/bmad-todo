---
title: "Dropping multi-line text into the add field loses Chrome's undo step"
type: bugfix
ticket: '12'
created: '2026-11-25'
status: built
baseline_revision: 'ea86627b1a1286c7facf6e92e56f2eeb5f40aaab'
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
deferred:
  - summary: >-
      Outside Chromium and WebKit, a multi-line drop may still lose its one undo step.
    evidence: |-
      The drop is intercepted only when the field has focus and its selection already sits collapsed at the point `document.caretPositionFromPoint` gives for the drop; otherwise the engine inserts it and it is cleaned on `input`, as before this change, which keeps the placement right but rewrites the value and loses the undo entry. Chromium and WebKit were observed to move focus and the selection to the drop point before `beforeinput`, so they take the one-step path. Gecko could not be observed: Playwright's Firefox exits with "Could not find profile folder" in this environment, even with TMPDIR and HOME pointed at writable folders inside the worktree. Settle by dropping two lines mid-text into the add field in Firefox with the caret elsewhere, then pressing Ctrl+Z once.
    location: >-
      apps/web/src/components/TextField.tsx:236
    severity: low
---

<intent-contract>

## Intent

**Problem:** A drop of multi-line text into the add or edit field is inserted natively, then cleaned on `input` by rewriting the value, which wipes Chrome's undo entry: Ctrl+Z (Cmd+Z) after the drop does nothing (R13, R14; EXPERIENCE Component Patterns › Text field says paste and drop are cleaned in `beforeinput`, inserted through the editing API, caret after, one undo removes it).

**Approach:** The shared field (`useTextField` in `TextField.tsx`) handles a `beforeinput` of type `insertFromDrop` whose text holds a forbidden character: it cancels it and inserts the cleaned text with `execCommand('insertText')` at the drop caret, exactly as the paste handler does. Trusted CDP drops in Chromium e2e tests prove the joined text, the caret and the one undo for both fields, written to fail on the current code first.

## Boundaries & Constraints

**Always:**
- One fix, in the shared field, covering the add and edit fields alike.
- The dropped text comes from `event.data` (Chrome fills it for a textarea and leaves `dataTransfer` null), falling back to `event.dataTransfer?.getData('text/plain')`. No text, or text that is already clean: return and let the native drop happen.
- Same insertion as paste: `execCommand('insertText', false, cleaned)`, and where it is missing or refuses, `setRangeText(cleaned, selectionStart, selectionEnd, 'end')` plus a bubbling `input` event.
- Every new e2e test runs at least one `expectNoAxeViolations` scan and starts with scenario ids like its neighbours (E6 K1 add, E4 K3 edit).
- e2e runs only against todo-test (`http://127.0.0.1:8081`), never production.

**Never:**
- No change to paste handling, cleaning on `input`, the selection restore, the counter, IME composition handling, the Shift tracking, or the line-break submit path (ticket Boundaries).
- Do not touch `AddForm.tsx`, `EditForm.tsx`, `TodoCard.tsx`, `TodoList.tsx`, messages, the API, or CI/deploy files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Multi-line drop, add field | field holds `Buy `; drop `oat\nand\r\nmore` at its end | value `Buy oat and  more`, caret collapsed after it, counter counts the trimmed text; one undo → `Buy ` | none |
| Multi-line drop, edit field | Edit open with the todo's text; drop two lines at its end | joined with spaces, caret after; one undo → the text before the drop; nothing saved | none |
| Drop into an unfocused field | focus elsewhere | Chrome focuses the field and sets the drop caret before `beforeinput`: same result | none |
| Clean single-line drop | no forbidden character | not intercepted: native drop as today | none |
| Drop with no text | `data` and `dataTransfer` empty | not intercepted, cleaned on `input` as today | none |

</intent-contract>

## Code Map

- `apps/web/src/components/TextField.tsx` -- `useTextField`'s native-listener `useEffect` (~line 179). `handlePaste` holds the clean-and-insert code: factor its insert half (execCommand, else `setRangeText` + `input`) into a local `insertCleaned(text)` returning whether it handled it, used by paste and by the drop branch, so paste behaves exactly as before. Add the `insertFromDrop` branch to `handleBeforeInput` before the line-break check (or a separate `beforeinput` listener). Update the listener comment. Leave `clean`, `handleChange`, `handleKeyDown`, Shift tracking unchanged.
- `apps/web/src/components/description-input.ts` -- `replaceForbidden` (reuse; do not change).
- `e2e/helpers.ts` -- shared e2e helpers (holds `pressComposingEnter`). Add an exported `dropText(page, cdp, field, text)` that sends CDP `Input.dispatchDragEvent` `dragEnter`, `dragOver`, `drop` with `data: { items: [{ mimeType: 'text/plain', data: text }], dragOperationsMask: 1 }` at a point inside the field past the end of its first-line text (e.g. the field's box, `x = right - 8`, `y = top + 12`; verify the caret lands at the end), so the drop caret is the end of the value.
- `e2e/validation.spec.ts` -- add-field e2e; its "E6 K1 a mid-text paste leaves the caret after the text and one undo restores the field" test is the pattern (value, `selectionStart/End`, axe, `ControlOrMeta+Z`).
- `e2e/edit.spec.ts` -- edit e2e; `tabToOnlyEdit`, `editField`, `recordPatches`, `createTodo`, `uniqueDescription`.
- `apps/web/src/components/AddForm.component.test.tsx` -- K1 tests (`renderAddForm`, `acceptCreates`; beforeinput line-break tests ~line 309 build `new InputEvent('beforeinput', {...})` and `fireEvent`).
- `apps/web/src/components/EditForm.component.test.tsx` -- K3 tests (`serve`, `renderLoaded`, `editButton`, `editField`; ~line 503).
- Probe evidence (Chromium 1255, Playwright 1.65.1, CDP drop of `oat\nand\r\nmore` at offset 4 of `Buy milk`): `beforeinput` `insertFromDrop` has `data` = the raw text, `dataTransfer` null, cancelable, selection already at the drop caret (4,4) and the field focused, even when focus was elsewhere. Baseline: value rewritten, one undo changes nothing (bug reproduced). With the fix: value `Buy oat and  moremilk`, caret 17, one undo → `Buy milk`.
- Test stack: `docker compose -p todo-test --profile test up -d --build --wait` builds web-test from source on 127.0.0.1:8081; run e2e with `E2E_BASE_URL=http://127.0.0.1:8081 pnpm --filter @todo/e2e exec playwright test <spec> --grep <pattern>`; tear down with `docker compose -p todo-test --profile test down -v --remove-orphans`. Shared lock: `mkdir /tmp/todo-test-stack.lock` to take (if it exists, wait, polling every 60 s), then `echo "#29 bug-29-drop-undo" > /tmp/todo-test-stack.lock/owner`; `rm -rf /tmp/todo-test-stack.lock` once the stack is down. Never use compose project `todo`.
- Environment rules -- every shell command starts with `cd /Users/idris/me/todo-wt/bug-29-drop-undo && export PATH=$HOME/.nvm/versions/node/v26.13.1/bin:$PATH && `. Never read or write `/Users/idris/me/todo` or another worktree, never touch branch `main`, do not commit. Hold the stack lock only during a stack run; note in Implementation Notes how many times you took it and that todo-test is down and the lock released.

## Tasks & Acceptance

**Execution:**
- [x] `e2e/helpers.ts` -- add `dropText` (see Code Map) -- a trusted drop through Chromium's real drag path.
- [x] `e2e/validation.spec.ts` -- add "E6 K1 dropping two lines joins them with spaces, leaves the caret after them, and one undo restores the field" (Chromium only, `test.skip` like the keyCode-229 tests): type `Buy `, press Tab so focus leaves the field (matrix row: unfocused field), drop `oat\nand\r\nmore`, assert the field is focused, assert value `Buy oat and  more`, selection `[17, 17]`, counter `17/200`, axe scan, then `ControlOrMeta+Z` once → value `Buy `.
- [x] `e2e/edit.spec.ts` -- add "E4 K3 dropping two lines into the edit field joins them, leaves the caret after them, and one undo restores the field" (Chromium only): open Edit (field holds the description, caret at its end), drop `\noat\tmilk`, assert value `${description} oat milk`, selection at its length, axe scan, then one undo → value `description`, field still open and focused, no PATCH sent.
- [x] Take the lock, bring todo-test up on the unfixed code, run the two new e2e tests, and record in Implementation Notes that they fail on the defect (the undo step); tear down, release.
- [x] `apps/web/src/components/TextField.tsx` -- the fix described in the Code Map.
- [x] `AddForm.component.test.tsx`, `EditForm.component.test.tsx` -- one test each: a `beforeinput` `InputEvent` `insertFromDrop` with `data: 'One\nTwo'` at a set caret is `defaultPrevented`, the value shows `One Two` inserted there with the caret after it, and nothing is sent; plus, in AddForm, a clean drop (`data: 'oat'`) and a drop with no text (`data` null, no `dataTransfer`) are not prevented and leave the value unchanged (matrix rows: clean drop, no text). Confirm the two multi-line drop tests fail with the baseline `TextField.tsx`.
- [x] Take the lock, rebuild todo-test on the fix, rerun the new e2e tests and the whole `validation.spec.ts` and `edit.spec.ts`: all pass; tear down, release.

**Acceptance Criteria:**
- Given the add field or the edit field holds text in Chrome, when two or more lines are dropped into it and Ctrl+Z (Cmd+Z) is pressed once, then the dropped text showed joined with spaces with the caret after it, and the one undo restores the field exactly as before the drop.
- Given the suite, when it runs, then the new drop tests fail on the baseline code and pass with the fix, and every existing test, the paste tests included, passes.

## Implementation Notes

- `TextField.tsx`: the paste handler's clean-and-insert half is now a local `insertCleaned(event, text)`: it returns at once for clean text, else cancels `event` and inserts with `execCommand('insertText')` (fallback `setRangeText` + bubbling `input`), in the same order as before, so paste behaves exactly as it did. `handleBeforeInput` handles `insertFromDrop` first: text from `event.data`, else `event.dataTransfer?.getData('text/plain')`; no text or clean text leaves the native drop alone. Line-break path, Shift tracking, `clean`, `handleChange`, `handleKeyDown` untouched.
- `e2e/helpers.ts`: `dropText(page, cdp, field, text)` sends CDP `dragEnter`, `dragOver`, `drop` at `right - 8, top + 12` of the field's box, then waits a frame. The caret lands at the end of the value in both fields (asserted by the selection checks).
- Baseline e2e run (stack lock taken once, todo-test built from the unfixed code), all three Chromium projects: both new tests fail. Add field: the native drop normalises `\r\n` to `\n` before the `input` clean, so the value is `Buy oat and more` (one space), not `Buy oat and  more`. Edit field: the caret check after the drop fails: Chrome leaves the dropped text selected (31..40) and the selection restore keeps it, so the caret is not collapsed after it. A diagnostic rerun on the desktop project with those value/selection checks removed (then reverted) reached the undo step and failed there in both fields: one Ctrl+Z left `Buy oat and more` and `<description> oat milk` in place. The undo defect is reproduced.
- Component tests: the two multi-line drop tests fail with the baseline `TextField.tsx` (`defaultPrevented` false) and pass with the fix; the clean / no-text drop test passes on both, as it should.
- Fixed run (stack lock taken a second time, todo-test rebuilt on the fix): the 6 new drop tests pass, and the whole `validation.spec.ts` + `edit.spec.ts` pass (48/48). `pnpm typecheck` clean; `pnpm test` 439/439.
- Stack lock taken twice in total; todo-test is down (`down -v --remove-orphans`) and `/tmp/todo-test-stack.lock` removed after each run. `pnpm test:all` not run here (left to the orchestrator at Verify).

- Follow-up (2026-11-25, coordinator, after the first review deferred "Firefox may put a multi-line drop at the old caret"): engines observed with Playwright 1.65.1 on a local page (textarea holding `Buy milk`, caret set to 0, focus on another control, a draggable source whose `dragstart` sets `oat\nand\r\nmore`, `page.dragAndDrop` to offset 4):
  - Chromium 1255: at `drop` the selection is still 0,0 and `caretPositionFromPoint` gives the textarea, offset 4; at `beforeinput` `insertFromDrop` the selection is 4,4, the field is focused, `data` holds the text, `dataTransfer` is null. With the intercept: `Buy oat and  moremilk`, caret 17, one undo → `Buy milk`.
  - WebKit 27.2 (Playwright webkit 2388): the same, except `data` arrives with `\r\n` already turned into `\n`. With the intercept: `Buy oat and moremilk`, caret 16, one undo → `Buy milk`.
  - Firefox 159 (Playwright firefox 1572): not observed. The browser exits at launch with "Could not find profile folder", with the default temp dir, with TMPDIR inside the worktree, with HOME inside the worktree as well, and when started directly with `-profile` on an existing folder. No sandbox was disabled.
- Hence the intercept is now safe by construction (`TextField.tsx`): a native `drop` listener records the drop point as an offset with `document.caretPositionFromPoint` (null when unsupported or not this field), and `beforeinput` `insertFromDrop` cancels and reinserts only when the text needs cleaning and the selection is collapsed exactly at that recorded point. In every other case (selection elsewhere, point unknown, no `drop` seen) the engine inserts the drop and it is cleaned on `input`, as before this change. The recorded point is cleared at each `beforeinput` drop.
- Tests: `apps/web/test/drop.ts` `dropOnto` simulates the drop sequence in jsdom (stubbed `caretPositionFromPoint`, optional caret move, then `beforeinput`). The two multi-line component tests now start with the caret at 0 and let the simulated engine move it to 4. New AddForm test "K1 a dropped line break is left to the engine when the selection is not at the drop point, or the drop point is unknown, and is cleaned on input" covers the fallback (stale selection, unknown point, no drop event) and the clean-on-input that follows; it fails against the previous `TextField.tsx`. The add-field e2e test now presses Home before Tab, so real Chromium must move the caret to the drop point.
- Verification: `pnpm typecheck` clean; `pnpm test` 440 passed; `pnpm test:all` exit 0, every step passed, the six drop e2e runs included. Stack lock taken once more for it (four times in this run), released with todo-test down. The temporary engine-probe folder (`coverage/tmp-engines`, git-ignored) was deleted.
- Follow-up review patch: the intercept also requires `document.activeElement === el`, since `execCommand('insertText')` writes into the focused element; an engine that focuses the field only after `beforeinput`, with a stale caret matching the drop point by chance, now falls back to the native drop. `dropOnto` focuses the field when it simulates Chrome and Safari moving the caret. The fallback test gains an unfocused case, which fails with the focus check removed. `pnpm typecheck` clean; `pnpm test` 440 passed; `pnpm test:all` exit 0 with every step passed. Stack lock taken a fifth time for it, released with todo-test down.

## Plan Change Log

- E4 K3 e2e test: the Edit form opens with all its text selected (EditForm selects on mount), not with the caret at the end as the plan assumed. The test presses End after opening, asserts the caret is at the end, then drops, so the drop caret and expectations match the plan.
- Component tests use `Buy  milk` with the caret at 4 (both fields) so `One\nTwo` lands as `Buy One Two milk`, caret 11.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 0, false 1, maybe-false 1
- findings:
  - `[maybe-false]` `[defer]` The drop branch in `TextField.tsx` assumes the engine has already put the selection at the drop caret; in Firefox (Gecko collapses the selection to the drop point only after `beforeinput`, from memory) a multi-line drop would land at the old caret, and the `setRangeText` fallback would add no undo entry — could not be settled: Playwright's Firefox fails to launch here and the suite is Chromium only; settle by a mid-text two-line drop in Firefox and Safari with the caret elsewhere. Deferred as medium (unverified).
  - `[false]` `[reject]` No kept test fails on the undo defect alone, since on the baseline the new e2e tests fail at the value and caret checks first — refuted: both e2e tests assert, after one `ControlOrMeta+Z`, that the field is back to its pre-drop value (`validation.spec.ts` "E6 K1 dropping two lines…", `edit.spec.ts` "E4 K3 dropping two lines…"), so a change that kept the joined value and caret but lost the undo entry fails them; the diagnostic baseline run also failed at that undo step.

### 2026-11-25 — Review pass (follow-up)
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` The drop intercept checks only the field's selection, not focus, but `execCommand('insertText')` writes into the focused element: in an engine that focuses the field after `beforeinput`, a stale caret that matches the drop point by chance would cancel the drop and write the cleaned text into whatever has focus (e.g. an open edit field) — fixed: the intercept also requires `document.activeElement === el` (`TextField.tsx`), with an unfocused case in the AddForm fallback test that fails without the check.
  - `[low]` `[reject]` The plan contradicts itself after the follow-up change (stale Auto Run Result, lock counts, the earlier triage row's medium against the deferred item's low, the first Implementation Notes bullet superseded) — real, but its fix edits this build's plan; the Auto Run Result is rewritten at this pass's Finalize anyway, and the earlier rows are append-only history superseded by the follow-up notes.

## Design Notes

Chrome and Safari set the selection to the drop point (and focus the field) before they fire `beforeinput` `insertFromDrop` for a drop from outside the field, so `insertText` at the current selection lands where the user dropped. Other engines may set it only afterwards. So the field records the drop point from the `drop` event (`document.caretPositionFromPoint`) and reinserts only when the selection is already collapsed there; anything else is left to the engine and cleaned on `input`, which keeps the placement right at the cost of the undo step. A drag that moves text within the page deletes the source first; its text, dragged out of the app's own fields, is already clean and never intercepted.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors.
- `pnpm test` -- expected: all pass, including the new component tests.
- With the lock held and todo-test up: `E2E_BASE_URL=http://127.0.0.1:8081 pnpm --filter @todo/e2e exec playwright test validation.spec.ts edit.spec.ts --grep "dropping"` -- expected: fails on baseline; passes after the fix.
- With the lock held: `pnpm test:all` (orchestrator, at Verify) -- expected: every step passed, todo-test down at the end.

## Auto Run Result

- **Summary:** A drop of multi-line text into the add or edit field was inserted natively, then cleaned on `input` by rewriting the value, which wiped Chrome's undo entry. The shared `useTextField` now records each drop's point on the field (`document.caretPositionFromPoint` in the `drop` event). On `beforeinput` `insertFromDrop`, when the text (from `event.data`, else `dataTransfer`) holds a forbidden character, the field has focus and its selection is collapsed exactly at that point, it cancels the drop and inserts the cleaned text with `execCommand('insertText')` through the `insertCleaned` helper it now shares with paste: the text shows joined with spaces, the caret sits after it, and one undo restores the field. In every other case the engine inserts the drop and it is cleaned on `input` as before, so placement is always the engine's. Chromium and WebKit were observed to take the one-step path; Firefox could not be launched here.
- **Files changed:**
  - `apps/web/src/components/TextField.tsx` -- `insertCleaned` shared by paste and drop; drop-point recording; the guarded `insertFromDrop` branch.
  - `apps/web/test/drop.ts` -- `dropOnto`: the engine's drop sequence simulated in jsdom.
  - `e2e/helpers.ts` -- `dropText`: a trusted drop through Chromium's drag path (CDP `Input.dispatchDragEvent`).
  - `e2e/validation.spec.ts` -- E6 K1 two-line drop into the unfocused add field, caret away from the drop point: focus, value, caret, counter, axe, one undo.
  - `e2e/edit.spec.ts` -- E4 K3 two-line drop into the edit field: value, caret, axe, one undo, still open and focused, no PATCH.
  - `apps/web/src/components/AddForm.component.test.tsx` -- K1 multi-line drop; drop left to the engine (unfocused, stale caret, unknown point, no drop event) and cleaned on input; clean and empty drops left alone.
  - `apps/web/src/components/EditForm.component.test.tsx` -- K3 multi-line drop.
- **Review findings:**
  - First pass: 0 patches; 1 deferred (maybe-false, medium if true: outside Chromium the drop may land at the old caret), since resolved by the guarded intercept and replaced by the low item on Chrome-style undo in unobserved engines; 1 rejected (false: "no kept test fails on the undo defect alone" -- both e2e tests assert the one undo).
  - Follow-up pass: 1 patch (medium: the intercept now also requires the field to have focus); 0 deferred; 1 rejected (low: plan inconsistencies; its fix edits this build's plan, and this Auto Run Result is rewritten).
- **Follow-up review recommendation:** false (follow-up pass; patched: high 0, medium 1, low 0).
- **Verification:** the new e2e tests failed on the baseline in desktop, phone and desktop-dark, a diagnostic baseline run failed at the undo step, and the multi-line component tests fail against the baseline `TextField.tsx`; the fallback test fails against the unguarded version and without the focus check. Final tree: `pnpm typecheck` clean; `pnpm test` 440 passed; `pnpm test:all` exit 0 with every step passed (e2e, axe coverage, profile, contract, contract-unavailable, scenario coverage), todo-test down. Engine probes: Chromium 1255 and WebKit 27.2 move focus and the selection to the drop point before `beforeinput` (the one-step path, one undo restores); Firefox 159 exits at launch here ("Could not find profile folder"). Stack lock taken five times in this run, released each time with todo-test down.
- **Residual risks:** in Firefox (unobserved) a multi-line drop is placed by the engine and cleaned on `input`, so it may still lose its undo step (deferred, low). In Chromium, a drop whose point `caretPositionFromPoint` resolves differently from the engine's own drop caret also falls back. A drag that moves text within the page is never intercepted (its text is already clean). The edit e2e test waits a fixed 300 ms before asserting no PATCH.
