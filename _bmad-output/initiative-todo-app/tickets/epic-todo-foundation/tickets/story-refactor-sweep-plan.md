---
title: 'Refactor sweep: settle epic 1 deferred work'
type: chore
ticket: '8'
created: '2026-11-25'
status: built
baseline_revision: '8ead029997f8ad6755fde4271f8a7f07d00ecc46'
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

**Problem:** `deferred-work.md` holds one entry from story 1.1: the add field had no `beforeinput` `insertLineBreak`/`insertParagraph` submit path, so on keyboards that keep every word composing (keydown keyCode 229) Enter may insert a newline instead of submitting. Story 1.4 built that path (`AddForm.tsx` `handleBeforeInput`), but proved it only with a synthetic, untrusted `InputEvent` in jsdom, so the entry is still open. The sweep's scope is that one entry (the run's instruction); story 1.4's plan also lists one deferred finding (the clear in `submit()` while an IME composition may be open), which this story must name as fixed or moved too.

**Approach:** Prove the path in a real engine: an e2e test in `e2e/validation.spec.ts` sends a trusted Enter keydown with keyCode 229 through the Chrome DevTools Protocol (`Input.dispatchKeyEvent`, `windowsVirtualKeyCode: 229`, `text: '\r'`), so the keydown handler stands aside and Chromium's own default action raises a trusted `beforeinput` `insertLineBreak`. Assert no newline lands, the todo is added and the field clears; and that an empty field gets the inline refusal. If it passes, close the deferred-work entry as fixed, citing the test. The story 1.4 finding is settled the same way if a real composition test in Chromium can reach it; otherwise it moves to a named new story recorded in this plan. `pnpm test:all` must pass.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [x] `e2e/validation.spec.ts` -- add `K1 E6 a trusted Enter with keyCode 229 submits through beforeinput, no newline` (valid text: added once, field empty, no `\n` sent; and empty field: inline error, nothing sent), skipping on non-Chromium (CDP) -- real-engine proof of the path
- [x] `apps/web/src/components/AddForm.tsx` -- change only if the e2e test exposes a defect
- [x] `_bmad-output/initiative-todo-app/deferred-work.md` -- remove the settled entry; record the outcome in this plan's Implementation Notes

**Acceptance Criteria:**
- Given the add field holds a valid description, when a trusted Enter keydown with keyCode 229 reaches it in Chromium, then the todo is added once with no line break in its text, and the field is empty.
- Given the add field is empty, when the same keydown reaches it, then "Enter a description." shows and no create request goes out.
- Given the sweep is done, when this plan is read, then each epic 1 deferred finding is listed as fixed or moved to a named new story, and `pnpm test:all` passes.

## Implementation Notes

Oneshot: the fix exists; the work is one e2e test and the bookkeeping, well under 100 lines.

- `e2e/validation.spec.ts`: `pressComposingEnter(cdp)` sends a trusted Enter keydown with keyCode 229 and `text: '\r'` through CDP `Input.dispatchKeyEvent`. Two tests use it. (1) It is refused inline on an empty field, then added once with no line break, and a recording listener sees exactly one trusted `insertLineBreak` per press, so Chromium's own default action, not a synthetic event, went down the `beforeinput` path. (2) An open IME composition (`Input.imeSetComposition`, "milk") followed by the same Enter adds the text with the composed word, the field stays empty, and the next key gives just `a`. Both pass on desktop, phone (Pixel 7) and desktop-dark.
- Negative control: with the `beforeinput` listener disabled and the web image rebuilt, test (1) failed (no inline error: the newline landed and nothing submitted). The listener was then restored, so `AddForm.tsx` is unchanged.
- Probe finding: in Chromium, a 229 Enter during an open composition raises `insertLineBreak` with `isComposing: false` and no `compositionend`. The submit's `setValue('')` runs, and the composed word never comes back, even after a later empty commit.
- `AddForm.tsx` not changed: no defect found.

**Deferred findings, settled:**
- deferred-work.md, story 1.1, "no `beforeinput` line-break submit path": **fixed** (story 1.4 built the path; this story proves it with trusted key input in a real engine, test (1)). The entry is removed from `deferred-work.md`.
- Story 1.4 plan `deferred`, "success clear may rewrite the value during an open IME composition": **fixed** as not reproducible in Chromium, with regression test (2) guarding it. The story 1.4 plan is left untouched because its `deferred` list is append-only.
- Left over: no real Android keyboard (Gboard) was tested. Chromium on Android uses the same editing engine that CDP drives here, but the key sequence Gboard actually sends is still unobserved.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 6 findings — high 0, medium 1, low 2, false 1, maybe-false 0 (2 rejected as plan edits, counted low)
- findings:
  - `false` `reject` Both items are marked fixed even though no real Gboard device was tested, so an open item is tracked nowhere. — The intent sets the settlement rule: close the 1.1 entry as fixed if the trusted-key e2e passes, and settle the 1.4 finding the same way if a real Chromium composition reaches it. Both conditions were met, and AC3 is met. The device gap is recorded as a residual risk below.
  - `low` `reject` "Fixed" overstates the 1.4 finding: nothing changed and the clear does run during an open composition. — The clear runs, but the bad outcome the finding feared (the committed word coming back) does not happen, and test (2) now guards it with the response awaited. Rewording is a plan edit, so it is rejected under that rule. The Auto Run Result below uses the wording "settled".
  - `low` `patch` The new tests do not skip on non-Chromium as the task says. — Added `test.skip(browserName !== 'chromium', …)` to both.
  - `medium` `patch` Test (2) checks the field before the add resolves, because the card is optimistic. — The test now awaits the POST response (`ok`) before the checks and the next key.
  - `low` `patch` Test (2) checks neither the exact sent description nor the request count, and `toHaveText` normalises whitespace. — Added `recordCreates`, a length-1 check and an exact `description` match on the body.
  - `low` `reject` The Execution checkboxes are unticked while the status says in-review. — This is a plan edit, so it is rejected as a finding. The boxes are ticked at finalize as normal bookkeeping.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0
- `pnpm test:all` -- expected: every layer passed, including the new e2e test on desktop, phone and desktop-dark

## Auto Run Result

**Summary:** The epic 1 deferred work is settled. Story 1.4's `beforeinput` line-break submit path is now proven in a real engine. Two e2e tests send a trusted Enter with keyCode 229 through CDP, which is what a keyboard that keeps every word composing sends. An empty field is refused inline. A valid one is added once with no line break, and there is exactly one trusted `insertLineBreak` per press. During an open IME composition the composed word is sent, and the field stays empty after the create response. A negative control, with the listener disabled, made test (1) fail. No app code changed.

**Deferred findings:**
- deferred-work.md (story 1.1), no `beforeinput` submit path: **fixed**. The path exists (story 1.4) and is now proven with trusted input. The entry is removed from `deferred-work.md`.
- Story 1.4 plan `deferred`, a clear during an open composition: **settled (fixed)**. The clear runs, but the composed word never returns in Chromium, and test (2) guards it.

**Files changed:**
- `e2e/validation.spec.ts` -- `pressComposingEnter` helper and two keyCode-229 tests (Chromium only)
- `_bmad-output/initiative-todo-app/deferred-work.md` -- its one settled entry removed

**Review findings:** 3 patches applied (1 medium, 2 low). 0 deferred. 3 rejected: 1 false (the intent's settlement rule was met) and 2 plan-only edits (wording, checkboxes).

**Follow-up review recommended:** false. One medium was patched, and none was high.

**Verification:** `pnpm typecheck` exit 0. `pnpm test:all` exit 0, with every layer passing and the new tests passing on desktop, phone and desktop-dark, both before and after the patches.

**Residual risk:** No real Android keyboard (Gboard) was tested. The CDP key input matches what the deferred notes describe (a keyCode-229 Enter, then the engine's own line break), but the sequence Gboard actually sends is still unobserved.
