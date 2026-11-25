---
title: 'The add form cleans and checks a description before sending it'
type: feature
ticket: '4'
created: '2026-11-25'
status: built
baseline_revision: '26c038480e83d0285dfc899f4e83b00c93087101'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md'
warnings: [oversized]
deferred:
  - summary: >-
      A successful add started from the beforeinput line-break path may clear the controlled value while an IME composition is still open.
    evidence: |-
      submit() success runs setValue(current === value ? '' : current) with no isComposing check, which breaks the plan's "never rewrite during composition" rule if a composition is still open when the add resolves. Usually Enter commits the composition first, and if the user typed after that, `current !== value` and the value is not cleared. Settle it by submitting with Gboard on a real Android device and checking that the committed word does not come back after the field clears.
    location: >-
      apps/web/src/components/AddForm.tsx submit() success path with handleBeforeInput
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The add field only trims and silently ignores a blank submit. It sends forbidden characters (line breaks, tabs, U+2028/9) the API now rejects, counts the raw value, never refuses an over-limit text, and has no inline message, Field status or `messages.ts`. On keyboards that keep every word composing, Enter can insert a newline, because `handleKeyDown` returns before `preventDefault()` when composing and no `beforeinput` submit path exists (deferred from story 1).

**Approach:** Clean every forbidden character to a space as it arrives (paste with caret and one undo intact, everything else on input), count code points of the cleaned, trimmed value, and on submit run AD-8's `checkDescription` from `@todo/contract/description`: send exactly that value, or refuse inline (Inline error / counter over state, `aria-invalid`, the hidden Field status). Submit also from a cancelled `beforeinput` `insertLineBreak`/`insertParagraph`. Create `apps/web/src/todos/messages.ts` with the inline strings.

## Boundaries & Constraints

**Always:** AD-8 (replace each `[\p{Cc}  ]` with one space, then `String.prototype.trim`, then `checkDescription`; the body carries that exact value; the class comes from `FORBIDDEN_CHARACTER` in `packages/contract/src/description.ts`, the one runtime contract import). AD-14 (one visually hidden `role="status"` Field status, always mounted, empty at first; validation never goes through an announcer). EXPERIENCE.md Voice and Tone › Inline strings verbatim; Component Patterns › Add form, Text field, Character counter, Inline error, Field status; Add form states; Focus management (Add invalid: focus stays in / returns to the add field). DESIGN.md Text field invalid edge (2.5px inward via 1px inset shadow, real border under `forced-colors`), Character counter over state (bold, `danger`, 14px aria-hidden SVG warning triangle, 4px gap), Inline error (18px round aria-hidden "!" icon, 8px gap, 8px under the field), all from existing tokens in `tokens.css`. Icons are inline SVG/text in JSX, never CSS `url()`. Add button never disabled. Tab never intercepted. Value never rewritten while an IME composition is open. Test titles start with their scenario id.

**Never:** The optimistic add, AD-13 helper, restoring failed text, "landed after all" (story 6). The announcer, `FailureKind`, failure leads/reasons in `messages.ts` (story 5). The edit field (epic 2). Any API, contract-package or nginx change. Hand-written API types. Test-only code paths in app code. Mocking the hooks in component tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Valid | `  Buy milk ` + Enter or Add | sends `"Buy milk"`; clears to `0/200`; focus in field | — |
| Empty submit | `""` or `"   "` + Enter/Add | nothing sent; "Enter a description." under the field; `aria-invalid="true"`; error id in `aria-describedby`; Field status cleared then set to "Enter a description." next frame; focus in field | repeat submit speaks again |
| Error clears | after empty submit, type `a` | error and `aria-invalid` gone; status not spoken | — |
| Paste line break | paste `"One\nTwo"` into empty field | shows `One Two`; counter `7/200` | — |
| Mid-text paste | `Buy  milk`, caret between the spaces, paste `"oat\r\n"` | `"Buy oat  milk"`-style: each char replaced 1:1, caret right after the pasted text; one undo restores `Buy  milk` | — |
| Input path | a tab/newline arriving by autofill/dictation/`input` | replaced by a space, selection restored | not while composing; cleaned on `compositionend` |
| Over limit | 201 code points (e.g. 201 emoji) | counter `201/200` in over state with hidden ", over the character limit"; `aria-invalid`; Field status says "over the character limit" once on crossing | Add/Enter sends nothing and re-speaks the status |
| Back under | delete to 200 | over state and `aria-invalid` clear silently | — |
| Composing Enter | `beforeinput` `insertLineBreak` or `insertParagraph` (e.g. Gboard, keyCode 229) | default cancelled, no newline; form submits (valid or refused as above) | — |
| Shift+Enter | | nothing inserted, nothing submitted | — |

</intent-contract>

## Code Map

- `apps/web/src/components/AddForm.tsx` -- the whole add form: controlled `<textarea>` (`value` state), `useAutoGrow`, `pending` ref guard against duplicate in-flight submits, `submit()` (trim, blank-return, `useAddTodo`, clear only if unchanged, focus field), `handleKeyDown` (Enter → `requestSubmit`, returns early when composing / keyCode 229), local `MAX_LENGTH` and `countCodePoints` to be replaced by the contract module. `aria-describedby` = counter id + hint id. Keep `useAutoGrow`, the pending guard, the success behaviour and `noValidate`.
- `apps/web/src/components/AddForm.module.css` -- `.field` box (border from `--text-field-border-*`, `:focus-within` outline ring), `.counter`, `.footer`. Add invalid edge, counter-over, inline-error styles here.
- `apps/web/src/components/AddForm.component.test.tsx` -- K1/K6 tests with MSW (`acceptCreates()`, `renderAddForm()`). "K1 sends nothing for a blank submit" must now also assert the message; the K6 describedby test asserts `'0/200 Press Enter to add.'` at rest — keep that true.
- `apps/web/src/styles/tokens.css` -- already has `--text-field-border-width-invalid`, `--text-field-border-color-invalid`, `--character-counter-{foreground-over,icon-size,icon-glyph,icon-stroke,gap}`, `--inline-error-*`, `--font-counter-over-*`, `--font-inline-error-*`, light and dark. No new tokens needed.
- `apps/web/src/styles/global.css` -- `.visually-hidden` utility.
- `packages/contract/src/description.ts` -- `FORBIDDEN_CHARACTER` (non-global `u` RegExp), `DESCRIPTION_MAX_LENGTH`, `checkDescription(trimmed)` → `'empty' | 'too-long' | 'forbidden-character' | null`. Import via `@todo/contract/description` (exported). Read-only.
- `e2e/todos.spec.ts`, `e2e/axe.ts` -- Playwright against todo-test; projects desktop, phone (Pixel 7), desktop-dark; `expectNoAxeViolations(page, state)`; `uniqueDescription()`.
- `vitest.config.ts` -- `unit` project picks up `apps/*/src/**/*.test.ts` (node env); `component` picks up `*.component.test.tsx` (jsdom).
- Unchanged: `apps/web/src/todos/hooks.ts`, `apps/web/src/api/**`, `apps/api/**`, `packages/**`, `nginx.conf`, `compose.yml`, scripts.
- Toolchain: prefix commands with `export PATH=~/.nvm/versions/node/v26.13.1/bin:$PATH`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/todos/messages.ts` -- create with an `inline` group: `empty: 'Enter a description.'`, `counter(n)` → `` `${n}/200` `` (limit from `DESCRIPTION_MAX_LENGTH`), `overLimitSuffix: ', over the character limit'`, `overLimit: 'over the character limit'`, `hintAdd: 'Press Enter to add.'`, `hintEdit: 'Press Enter to save.'`. Leave room (a comment) for story 5's leads, reasons and status messages -- AD-14, EXPERIENCE Voice and Tone › Inline
- [x] `apps/web/src/components/description-input.ts` -- pure helpers: `replaceForbidden(text)` (global copy of `FORBIDDEN_CHARACTER`'s source with `gu`, each match → one space), `prepareDescription(raw)` = `replaceForbidden(raw).trim()`, `countCodePoints(s)` -- AD-8
- [x] `apps/web/src/components/description-input.test.ts` -- unit: `\n`, `\r\n` (two spaces), `\t`, `\u0000`, `\u007f`, `\u0085`, U+2028, U+2029 each become one space; length preserved in UTF-16 units; letters `p c C { }` untouched; emoji counted as one -- AD-8, K1
- [x] `apps/web/src/components/AddForm.tsx` -- per the I/O matrix: counter shows `countCodePoints(prepareDescription(value))`; submit runs `checkDescription(prepareDescription(value))` and sends that exact value or refuses; state for the shown empty error; derived over state; `aria-invalid` when either; `aria-describedby` = error id (only while shown) + counter id + hint id; Inline error element with aria-hidden "!" icon; counter over state with aria-hidden SVG triangle and `.visually-hidden` suffix; one always-mounted `.visually-hidden` `role="status"` Field status (crossing above 200 speaks once, cleared 5 s later or on dropping back; each blocked submit clears it then sets it on the next animation frame); native listeners via `ref` + `useEffect`: `paste` (cancel only when cleaning changes the clipboard text, insert via `document.execCommand('insertText', false, cleaned)`, falling back to `setRangeText(…, 'end')` plus a bubbling `input` event when it returns false) and `beforeinput` (`insertLineBreak`/`insertParagraph` → `preventDefault()` + `form.requestSubmit()`); `onChange` cleans unless `nativeEvent.isComposing`, restoring `selectionStart/End` in a layout effect; `onCompositionEnd` cleans; keep `handleKeyDown` (Shift+Enter blocked, composing returns early); invalid submit focuses the field; strings from `messages.ts` -- AD-8, AD-14, EXPERIENCE Text field (closes the deferred `beforeinput` item)
- [x] `apps/web/src/components/AddForm.module.css` -- `.fieldInvalid` (border color invalid + `box-shadow: inset 0 0 0 1px` invalid color; under `@media (forced-colors: active)` a real 2.5px border), `.counterOver` (danger, `--font-counter-over-*`), `.counterIcon` (14px), `.inlineError` (flex, gap, margin-top, danger, `--font-inline-error-*`), `.inlineErrorIcon` (18px circle, `--inline-error-icon-*`, 12px/800 glyph) -- DESIGN.md Components
- [x] `apps/web/src/components/AddForm.component.test.tsx` -- K1 cases: empty and whitespace submit by Enter and by Add show "Enter a description.", set `aria-invalid`, link the error in `aria-describedby`, send nothing, keep focus in the field, and the Field status ends up with the message; a second blocked submit sets it again; typing clears the error; pasting `"One\nTwo"` (`user.paste`) shows `One Two` and `7/200`; a value with a tab via `fireEvent.change`/typing is cleaned; 201 emoji shows `201/200`, the over suffix, `aria-invalid`, status "over the character limit", and Add/Enter sends nothing; deleting back to 200 clears it; a dispatched `beforeinput` `insertLineBreak` (cancelable `InputEvent`) is default-prevented and submits; the sent body is the cleaned, trimmed value. Update the existing blank-submit test -- K1, K6
- [x] `e2e/validation.spec.ts` -- E6 add part, E7, E8, K1 paste in a real browser, all by keyboard: empty Enter shows "Enter a description." and adds nothing (axe scan "empty submit"); paste two lines via the clipboard (`context.grantPermissions(['clipboard-read','clipboard-write'])` on Chromium, `navigator.clipboard.writeText`, then `ControlOrMeta+V`) shows them joined by one space with the matching counter; mid-text paste of a text with a line break leaves the caret after it (`selectionStart`) and one `ControlOrMeta+Z` restores the prior text; 201 characters show the over state, `aria-invalid`, Enter adds nothing (axe scan "over limit"); each test uses a unique description and asserts only its own todos -- E6, E7, E8, K1

**Acceptance Criteria:**
- Given the test profile, when the user presses Enter on an empty add field using only the keyboard, then "Enter a description." shows under the field, the field is marked invalid, focus stays in the field and no todo is added, in light and dark with no axe AA violations.
- Given two lines on the clipboard, when the user pastes them into the add field, then the field shows them joined by a space and the counter shows that text's code-point count after trimming.
- Given more than 200 characters in the field, when the user presses Enter or Add, then the counter shows its over state, nothing is added, and dropping back to 200 clears the over state.
- Given a keyboard that sends Enter as a `beforeinput` `insertLineBreak` during composition, when it fires in the add field, then no newline is inserted and the form submits.
- Given `pnpm test:all`, when it runs, then it exits 0 and `coverage/scenarios.md` lists K1 and E6 tests as passing.

## Implementation Notes

- jsdom has no `document.execCommand`, so the paste handler feature-checks it before calling; the component tests exercise the `setRangeText` + `input` fallback, and the e2e mid-text paste test exercises `execCommand` (caret and one undo) in Chromium.
- Chromium's accessible-description computation puts a space before the absolutely positioned `.visually-hidden` suffix ("201/200 , over the character limit"); the e2e assertion allows it.
- The story 1 test "keeps the text and shows no message when the add fails" now asserts the always-mounted Field status is empty instead of absent.
- Step-03 matrix audit: the Input path row's "not while composing; cleaned on `compositionend`" had no test; added the component test "K1 never rewrites the value while an IME composition is open, and cleans it when it ends".

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `medium` `patch` `clean()` in `AddForm.tsx` stores a selection even when the cleaned text equals `value`, so `setValue` bails out, the `[value]` layout effect never consumes it, the caret is left at the end, and the stale offsets jump the caret on the next change — confirmed: the ref is only read and reset in that effect. Fix: when the cleaned text equals `value`, restore the selection in a microtask after React's controlled write-back instead of storing it.
  - `low` `patch` The over-limit component test passes even if a blocked submit stops re-speaking, because the crossing message is already in the status — confirmed: the 5 s timer keeps it set across the Add/Enter. Fix: a MutationObserver now asserts the status goes to '' and back on the blocked submits.
  - `low` `reject` The e2e over-limit test has the same blind spot — real, but the behaviour is now pinned by the patched component test, and observing live-region mutations in Playwright adds harness code for no user-facing gain.
  - `low` `reject` Paste is handled on `paste` and drop on the input path, departing from EXPERIENCE.md's `beforeinput` wording; a drop of multi-line text loses its native undo step in Chrome — real for drop only (paste keeps caret and one undo, proven in e2e). Dropping multi-line text into the add field and then undoing is rare, and handling `insertFromDrop` needs a new engine-dependent branch (drop position, `dataTransfer` availability), more than a direct correction. Recorded as a residual risk.

### 2026-11-25 — Review pass (follow-up, CI e2e strict-mode fix)
- context: CI run 45529158868 failed `E6 E8 an empty Enter…` in desktop and desktop-dark. The blocked submit shows the Inline error at once but sets the hidden Field status (same words) one animation frame later (`sayAgain`), so on a slower runner the bare `getByText('Enter a description.')` matched both and broke strict mode. The app behaves as specified (AD-14), so only the test changed: the visible check now uses `inlineError(page)`, which excludes `[role="status"]`.
- verdicts: 7 findings — high 0, medium 0, low 6, false 0, maybe-false 1
- findings:
  - `maybe-false` `defer` The success clear in `submit()` can rewrite the value while an IME composition is open, reachable now through the `beforeinput` submit path. If true it would be medium. Enter normally commits the composition before `insertLineBreak`, and later typing makes `current !== value`. Only a real Android keyboard test can settle it, so it is deferred as medium (unverified).
  - `low` `reject` Shift+Enter arriving as `beforeinput` `insertLineBreak` after a composing/229 keydown submits instead of doing nothing. It is real, because the handler never sees Shift, but it needs a hardware Shift+Enter over an IME or an Android keyboard sending Shift+Enter, which is rare. The fix needs new keydown-state tracking, more than a direct correction.
  - `low` `reject` The `beforeinput` component tests never model an open composition. That is a coverage gap: jsdom has no IME, and the handler does not branch on composition, so a synthetic `compositionstart` would prove little. It is already recorded as a residual risk (real keyboard untested).
  - `low` `reject` The Inline error clears on non-empty input, not on valid input as EXPERIENCE.md says. The behaviour is real and was chosen deliberately in Design Notes: the counter's over state takes over with `aria-invalid`, so the user still sees an error. Resolving it means editing a planning document, not the code.
  - `low` `reject` carried Paste is handled on `paste` and drop on the input path, departing from EXPERIENCE.md's `beforeinput` wording, and a multi-line drop loses Chrome's undo step. Same claim as the previous pass, and the code is unchanged.
  - `low` `reject` carried The e2e over-limit test doesn't prove that a blocked Enter speaks again. Same claim as the previous pass; the component MutationObserver test pins it.
  - `low` `reject` The microtask selection restore in `clean()` has no test. It is real and already listed as a residual risk. It only runs on a no-op clean, which users rarely hit, and testing it needs controlled write-back timing that jsdom does not reproduce faithfully.

## Design Notes

- Paste is intercepted at `paste` rather than `beforeinput` `insertFromPaste`: a textarea's `beforeinput` may carry neither `data` nor `dataTransfer` in some engines, while `ClipboardEvent.clipboardData` always holds the text. `execCommand('insertText')` keeps the native undo stack and fires `input`, so React's `onChange` sees it and the caret lands after the text. Paste that needs no cleaning is left alone. Drop is cleaned on the input path (one-for-one, selection restored); its undo granularity is not a K1 clause.
- Setting a controlled value programmatically resets Chrome's undo stack, so the input path only rewrites when cleaning changed something.
- The empty-submit error clears on the first input that makes the text non-empty; over-limit is then shown by the counter, so the two never show together.
- `beforeinput` and React: React's `onBeforeInput` is the legacy `textInput` polyfill without `inputType`, so attach a native listener. The keydown handler already cancels a normal Enter, which suppresses its `beforeinput`, so there is no double submit; the `pending` guard covers the rest.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm exec vitest run --project unit --project component` -- expected: all pass, including the new K1 cases
- `pnpm test:all` -- expected: exit 0; `coverage/scenarios.md` lists K1, E6, E7, E8 passing in every Playwright project

## Auto Run Result

**Summary:** The add field now cleans and checks a description before sending it (AD-8). Every control character and U+2028/U+2029 becomes a space as it arrives. A paste goes in through `execCommand('insertText')`, so the caret lands after it and one undo removes it, and anything else is cleaned on input with the selection kept, never while an IME composition is open. The counter counts code points of the cleaned, trimmed value. Submit runs the contract's `checkDescription` and sends exactly that value, or refuses inline: "Enter a description." with its icon, or the counter's over state with its triangle and hidden suffix, plus `aria-invalid`, the error linked in `aria-describedby`, and the one hidden Field status (AD-14), which is cleared and set again on every blocked submit. A cancelled `beforeinput` `insertLineBreak`/`insertParagraph` also submits, which closes the deferred story 1 item about keyboards that keep every word composing. `apps/web/src/todos/messages.ts` holds the inline strings for story 5 to extend.

**Files changed:**
- `apps/web/src/components/AddForm.tsx` -- cleaning, the AD-8 check, inline error, counter over state, Field status, native `paste`/`beforeinput` listeners
- `apps/web/src/components/AddForm.module.css` -- invalid edge (inset shadow; real border under forced colours), counter over state and icon, inline error and icon
- `apps/web/src/components/description-input.ts` -- `replaceForbidden`, `prepareDescription`, `countCodePoints`
- `apps/web/src/components/description-input.test.ts` -- unit cases for the replace, trim and count
- `apps/web/src/todos/messages.ts` -- inline field strings (AD-14)
- `apps/web/src/components/AddForm.component.test.tsx` -- K1 validation, paste, input-path, composition, over-limit and `beforeinput` cases
- `e2e/validation.spec.ts` -- E6/E7/E8/K1: empty Enter, clipboard paste, mid-text paste with caret and undo, over-limit, with axe scans in light and dark

**Review findings:** 2 patches applied (1 medium: a stale selection in `clean()` when the cleaned text equalled the current state; 1 low: the over-limit test now proves a blocked submit speaks again). None deferred. 2 rejected: the e2e over-limit re-speak blind spot (the patched component test covers it, so the extra harness code isn't worth it); drop handled on the input path instead of `beforeinput`, which loses the native undo step for a multi-line drop in Chrome (rare, and the fix needs a new engine-dependent branch).

**Follow-up review recommended:** false (patched: high 0, medium 1, low 1).

**Verification:** `pnpm typecheck` passes. `vitest run --project unit --project component` passes 57 of 57. `pnpm test:all` exits 0 with every step passed, and `coverage/scenarios.md` shows K1 (37), E6 (12), E7 (6) and E8 (9) passing in desktop, phone and desktop-dark.

**Residual risks:**
- The `beforeinput` submit path is proven only by a synthetic event in jsdom. No real Android keyboard (e.g. Gboard) was tested, and e2e runs Chromium only.
- A multi-line text dropped into the field is cleaned but loses Chrome's native undo step. EXPERIENCE.md › Text field still says drop is handled in `beforeinput`, so the spec and the code disagree here.
- A CR LF paste becomes two spaces (one for one, as the server would store it), not one.
- Chromium reads a space before the hidden over-limit suffix ("201/200 , over the character limit").
- The microtask selection restore in `clean()` (cleaned text equal to the current state) has no automated test.

### Follow-up pass — 2026-11-25 (CI e2e fix)

**Summary:** `e2e/validation.spec.ts` "E6 E8 an empty Enter…" failed in CI (run 45529158868, desktop and desktop-dark) with a strict-mode violation that depends on timing. The blocked submit shows the Inline error right away and sets the hidden Field status, with the same text, on the next animation frame. On a slower runner that frame had already run when the assertion ran, so a bare `getByText` matched both. The app is correct per AD-14. The test now checks the visible error through `inlineError(page)` (`getByText(…).and(':not([role="status"])')`). The "error clears" assertion still uses a bare `getByText` with count 0, which proves that both the error and the status cleared.

**Files changed:**
- `e2e/validation.spec.ts` -- `inlineError(page)` helper; the empty-submit visibility check uses it

**Review findings:** 0 patches. 1 deferred (maybe-false, medium if true: the success clear may rewrite the value during an open IME composition). 6 rejected: 4 low (Shift+Enter through `beforeinput` after a composing keydown; composition not modelled in the `beforeinput` tests; the error clears on non-empty rather than on valid input, chosen in Design Notes; no test for the microtask selection restore) and 2 carried from the previous pass (drop on the input path; e2e re-speak blind spot).

**Follow-up review recommended:** false (follow-up pass; patched: high 0, medium 0, low 0).

**Verification:** `pnpm typecheck` passes. `pnpm test:all` exits 0 with every step passed (unit, component, integration, contract, e2e, contract-unavailable, scenario coverage: 16 ids, 124 tests).

**Residual risks:** The CI failure could not be reproduced locally, since the race resolves the other way here. The fix removes the ambiguity in both orders: the locator never matches the status element, whether or not the frame has run.
