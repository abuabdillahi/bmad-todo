---
title: 'A shortened todo in an announcement can split a character'
type: bugfix
ticket: '10'
created: '2026-11-25'
status: built
baseline_revision: 'e8b4cade8b38c6ae28d4f35302da7875af417d3d'
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

**Problem:** `quote()` in `apps/web/src/todos/messages.ts` (the `{t}` of every Announcer message: failed add, edit, complete, reopen, delete, "Added", "Deleted", deleted elsewhere) cuts a todo over 40 code points at exactly 40 code points, so when the 40th code point falls inside a grapheme cluster (a ZWJ family emoji, a regional-indicator flag, an emoji with a skin-tone modifier, a letter with combining marks) the quote ends on part of a user-perceived character before "…".

**Approach:** Keep the 40-code-point limit and the existing rules (40 or fewer code points quoted whole; longer cut, trailing whitespace trimmed, "…" inside the closing quote), but cut on a grapheme boundary: segment the text with `Intl.Segmenter` (granularity `grapheme`) and keep whole graphemes while their running code-point total stays at or under 40. A cut may keep fewer than 40 code points, never more (ticket Notes, 2026-11-25). No message wording, limit or "…" placement changes. Unit tests in `apps/web/src/todos/messages.test.ts` cover each character kind (ZWJ family, flag, skin-tone modifier, combining marks), each failing on the old code and passing on the fix; the existing K7 quote cases stay green unchanged.

</intent-contract>

## Implementation Notes

Route oneshot: one function (about 10 lines) in `apps/web/src/todos/messages.ts` plus a handful of unit tests in `apps/web/src/todos/messages.test.ts`, well under 100 lines. `Intl.Segmenter` is in the `es2024` lib the web tsconfig already uses, and in every browser the app targets and Node 26. Edge case decided by the "never more" rule: a single grapheme of more than 40 code points at the start leaves an empty cut, quoted as `“…”`.

- Files touched: `apps/web/src/todos/messages.ts` (`quote()` now walks `Intl.Segmenter` grapheme segments, one module-level segmenter with the default locale, and keeps each whole grapheme while the running code-point total is at most 40), `apps/web/src/todos/messages.test.ts` (new K7 cases: ZWJ family at code points 40 and 38-40, flag, skin-tone modifier, one and two combining marks, a fitting family and flag kept whole, whitespace before a dropped character trimmed, a lone over-40 grapheme giving `“…”`, and the added, deleted, deleted-elsewhere and complete-failure messages quoting a cut family). The existing K7 cases are unchanged.
- Verified: `pnpm test` 287 passed; `pnpm typecheck` clean; with `messages.ts` stashed, 9 of the new cases fail on the old code (the fitting-character case is a regression guard that passes on both).
- EXPERIENCE.md is not edited: its `{t}` rule still counts code points and cuts at 40; the whole-character cut only keeps fewer, as the ticket's Notes allow.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` `messages.ts` `quote()`: `kept.trimEnd()` runs on the joined string, so a last kept grapheme made of a Prepend character (e.g. U+0600) plus a space would lose its space and leave the Prepend character alone before "…" — real under UAX #29 GB9b, but users will practically never type a Prepend character followed by a space at the cut, the whitespace trim predates this change, and the fix adds per-grapheme trimming logic, so it is not worth the complexity.
  - `[low]` `[patch]` `messages.ts` doc comment said "cut at 40" and then "may keep fewer", contradicting itself — reworded to "cut to at most 40, on a whole user-perceived character … may keep fewer than 40 but never more"; `pnpm test` (287 passed) and `pnpm typecheck` re-run clean. EXPERIENCE.md is left as is: the ticket's Notes keep "40 characters" as EXPERIENCE says, and its rule still holds.

## Verification

**Commands:**
- `pnpm test` -- expected: all unit, component and integration tests pass, including the new grapheme cases in `apps/web/src/todos/messages.test.ts`
- `pnpm typecheck` -- expected: no type errors
- `git stash` the `messages.ts` change only and run `pnpm vitest run --project unit apps/web/src/todos/messages.test.ts` -- expected: each new grapheme case fails on the old code (then restore the change)

## Auto Run Result

- **Summary:** `quote()` now cuts a todo over 40 code points on a grapheme-cluster boundary (`Intl.Segmenter`), keeping at most 40 code points, so no Announcer message ends on part of an emoji sequence, flag, skin-tone emoji or combined letter. Wording, the 40 limit, whitespace trim and "…" placement are unchanged.
- **Files changed:**
  - `apps/web/src/todos/messages.ts` -- grapheme-aware cut in `quote()`, doc comment updated.
  - `apps/web/src/todos/messages.test.ts` -- new K7 cases for each character kind, a whole-character guard, whitespace trim, a lone over-40 grapheme, and the quoting messages.
- **Review (quick):** 2 findings. Patched 1 (low: contradictory doc comment). Deferred 0. Rejected 1 (low: Prepend-plus-space grapheme losing its space to `trimEnd()`; practically unreachable, pre-existing trim, fix adds complexity).
- **Follow-up review:** false — patched counts: high 0, medium 0, low 1.
- **Verification:** `pnpm test` 287 passed; `pnpm typecheck` clean; with the old `messages.ts`, 9 new cases fail (all straddling cases), existing K7 cases pass on both.
- **Residual risks:** the rejected Prepend corner case above; grapheme rules follow the runtime's ICU data, so very new emoji sequences may segment differently on old browsers (still never more than 40 code points).
