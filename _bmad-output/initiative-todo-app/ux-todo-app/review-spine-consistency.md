---
review: spine-consistency
subject: EXPERIENCE.md (update for the amended architecture spine)
date: 2026-11-24
---
# Spine consistency review

## Verdict

Every item in review-reconcile-ux-update.md now reads correctly in EXPERIENCE.md. No sentence contradicts a binding AD, and the announce callers and kinds, list-state conditions, Try again timing, failure kinds, per-call promise, and the "Landed after all" row all match the spine. Three medium gaps remain. Each is a place where EXPERIENCE relies on something the spine or EXPERIENCE itself leaves unstated: the failure kind behind the List error panel's text, a failed add that removes a card the user is editing or focused in, and the after-delete focus rule applied to removals no user started. One of them needs a small spine addition.

## Reconcile items

| Item | Status | EXPERIENCE.md location | Note |
|---|---|---|---|
| Flag 1: stale `[ASSUMPTION]`, flag 1 tag on `validation` | resolved | L90; Open Items | Cites AD-8 and AD-14. The Open Items row is removed. |
| Flag 2 (1): Text field covers only line breaks | resolved | L159 | Covers `\p{Cc}` plus U+2028/U+2029, replaced on input. |
| Flag 2 (2): Add form omits the replace step | resolved | L157 | "Replaces … with a space, trims, then checks … `description.ts` (AD-8)". |
| Flag 2 (3): Stored line break row | resolved | Row states | Removed. |
| Flag 2 (4): flag 2 UX need | resolved | L451 | "None remains. The API is the only writer (AD-2)…" |
| Flag 2 (5): Open Items rows | resolved | L523 | Only the Enter-submits assumption remains. |
| Flag 2 (6): counter counts after trim only | resolved | L110–111 | "after control characters become spaces and the text is trimmed". |
| Flag 3: per-call `mutate` callbacks; (b) as a callback | resolved | L157, L177, L234, L456–466 | Per-call promise `ok`/`failed`/`dropped`. The helper announces Added and Deleted. |
| Flag 4 (1): separate pending list | resolved | L468–471 | Replaced by the resolution. |
| Flag 4 (2): Error condition | resolved | L209 | "Not loaded, the last fetch failed, and no Try again is pending". |
| Flag 4 (3): Loading condition | resolved | L206 | Matches AD-11 "loading state otherwise". |
| Flag 4 (4): Refresh failed condition | resolved | L212 | "Loaded, and a background fetch failed". |
| Flag 4 (5): "pending added cards" | resolved | L39 | "optimistic adds in the cache". |
| Flag 5 | resolved | L192, L337 | Cites AD-14. |
| Flag 6 (1): `storage-unavailable` key | resolved | L88 | Renamed `unavailable`. |
| Flag 6 (2): "AD-9 doesn't name yet" | resolved | L87 | Removed. |
| Flag 6 (3): flag 6 proposal | resolved | L481 | Replaced by the resolution. |
| Flag 6 (4): "rejected or aborted" | resolved | L87 | "a fetch the app cancelled is not a failure, AD-11". |
| Flag 7 | resolved | L234 | Adds `dropped`. |
| Flag 8: Try again "at once"; "pending flag 8" | resolved | L196, L211 | Matches AD-11's deferred fetch. The stale citation is gone. |
| Flag 9: "scans wait for motion" | resolved | L349 | Reduced-motion projects plus a dark project (AD-20). |
| Flag 10: kind names | resolved | L151–152, L499–501 | `failure` / `refresh` / `status`. |
| Gap 1: cancelled fetch unclassified | resolved | L87, L202, L214 | |
| Gap 2: Error-state fetch timing, automatic replacement, focus | resolved | L194, L196, L210–211, L291, L298, L422 | See Findings 3 and 4 for residual focus detail. |
| Gap 3: deleted-elsewhere owner and kind | resolved | L98, L151, L235 | List area, kind `failure`, key `deletedElsewhere`. |
| Gap 4: failed write may have landed | resolved | L63, L238, L249, L436, L512 | |
| Gap 5: Field status vs "No other live region" | resolved | L165 | Cites AD-14's per-field allowance, now in the spine. |
| Low: failed-draft storage | resolved | L177 | A per-todo map owned by the list area. |
| Low: stale cross-references | resolved | — | No "pending flag", "proposed in flag", or flag-tagged Open Items remain. See Stale references for the residual "as proposed". |
| Low: capability map R5 wording | n/a | — | Spine-side and cosmetic. Nothing in EXPERIENCE depends on it. |

## Findings

**[medium] The List error panel's reason needs a failure kind that the store does not hold** (State Patterns › List states, Error and Add during Error, L209, L215; Voice and Tone, L104; Component Patterns › Loading status, L192, and List error panel, L194).
- **Spine:** AD-11 lists the todos store's contents as "**loaded**, **last fetch failed**, **retry requested**, the pending-mutation count … and the revert records". No failure kind is among them. The memlog notes that `setQueryData` seeds the query as success, so the query's own state can't be trusted while not loaded.
- **UX:** the panel text is "`lead.load + " " + reason[type]`", and the Loading status "says the List error panel's message".
- **Consequence:** in "Add during Error" the helper's optimistic `setQueryData` resets the query's `error` to `null` (TanStack's success reducer). A builder who reads the reason from the query loses it at that point, so the panel has no reason to show. Separately, L194 says the panel "changes only when it succeeds". That leaves open whether a failed automatic refetch with a different kind (`network` → `unavailable`) updates the reason. If it does, the change is silent, because the Loading status speaks only on *entering* error.

*Fix:* in L104, state that the reason comes from the kind of the last recorded fetch failure, held in the todos store, and add the candidate flag below. In L194, add: "A failed automatic refetch updates the reason in place without speaking."

**[medium] A failed add that removes a card the user is editing or focused in has no rule** (State Patterns › Row states, L235 and L234; Add form states › Add failed, L249; Focus management, L286 and L288; Hand-off order, L298).
- **Spine:** AD-14 lets the list area announce "deleted elsewhere" only "when a **refetch** removes a todo whose row is in edit mode". AD-11 keeps a component copy only for a user-confirmed delete, so any other removal unmounts at once.
- **UX:** L235 and L298 cover removals by "not-found or a refetch". Nothing covers the helper removing a card when its add fails while the card has an open Edit form (not yet saved) or holds focus, for example on its Completion check after a toggle. L286 ("Add failed | Not moved") assumes focus is in the add field.
- **Consequence:** a list area that detects "my editing row left the cache" also fires on this revert. Its `failure` message then replaces the helper's "Couldn't add “{t}”. …" with a false "“{t}” was deleted elsewhere." Focus inside the removed card drops to `<body>`, because no handler runs first and L298 doesn't cover helper removals. The Motion table doesn't say whether the removed card animates, and AD-11 requires it to unmount at once.

*Fix:* add a row under Row states: "Edit open or focus inside, its add fails | The card unmounts at once with no motion, the edit draft is discarded, and only the helper's `add` failure is announced; the list area does not announce `deletedElsewhere`. Focus: see Focus management." Widen L288 and L298 from "by not-found or refetch" to "by not-found, a refetch, or a failed add". In L235, say how the list area tells the two apart: a row whose `revertedAt(id)` was set in the same update is a helper revert, not a refetch removal (AD-13 records a revert time for every failed todo, creates included). No spine change is needed.

**[medium] The after-delete rule falls back to "the add field or heading" for removals that no user started** (Focus management, L282 and L288).
- **Spine:** AD-11 says a row that a refetch removes unmounts at once. Focus for that case is left to UX.
- **UX:** L288 applies "the after-delete rule" to rows removed by not-found or a refetch. When the list is then empty, that rule ends at "the add field or heading". L271 decides field or heading by the *activation* type, and an automatic removal has no activation. L291 recognises exactly this for the panel case ("no activation decides between field and heading") and picks the Page heading.
- **Consequence:** the target for the commonest refetch-removal case on a now-empty list is undefined, so the component test L298 promises can't assert one target.

*Fix:* in L288, write "The after-delete rule, except that an empty list sends focus to the Page heading (no activation decides, as for the List error panel)."

**[low] Detecting that focus was inside an element a refetch removed is not specified** (Hand-off order, L298).
- **UX:** "The list area then moves focus to its target in a layout effect of the commit that removes it."
- **Consequence:** by the time the list area's layout effect runs, the removed node is detached and `document.activeElement` is already `<body>`. The effect alone can't tell "focus was inside the removed row or panel" from "focus was already on the body". This is buildable inside AD-11's layering, because the list area is a component.

*Fix:* add one clause: "the list area tracks the row or panel that holds focus (a `focusin` listener on the list area, or a check in the removed row's layout-effect cleanup, which runs before its DOM is removed)".

**[low] "While `revertedAt(id)` is recent" has no window** (State Patterns › Row states › Reverted, L228).
- **Spine:** AD-13 provides only a time.
- **UX:** the flag lasts `{motion.duration-revert}` (Motion, L311 and L326), but L228 doesn't tie "recent" to that length. A card restored after a failed delete mounts later than the revert time.

*Fix:* write "while less than `{motion.duration-revert}` has passed since `revertedAt(id)`; a card that mounts inside that window shows the flag for the time that remains".

## Candidate new flags for the architect

**Flag 11 — Failure kind of the last fetch**
- **UX need:** the List error panel and the Loading status say "Couldn't load your todos." plus the reason for the last fetch's failure kind (`network`, `unavailable`, or generic). The panel must keep that reason while optimistic adds go into the cache (Add during Error), and must update it when a later fetch fails with a different kind.
- **AD touched:** AD-11 (the todos store's contents), AD-9 (failure kinds).
- **Proposal:** the query function records the failure kind with **last fetch failed**, for example `lastFetchFailure: FailureKind | null` in place of a boolean. It is cleared on success, left unchanged on a cancellation, and never touched by cache writes. The list area reads it from the store, not from the query's `error`.

## Stale references

- **"As proposed" now refers to text that is gone.** Flag 1 (L448: "accepted as proposed"), Flag 3 (c) and (d) (L465–466: "as proposed"), Flag 7 (L486), and Flag 9 (L496: "first option of each alternative") all point at proposals and alternatives this update deleted. Each resolution states its content anyway. Drop "as proposed" and "first option of each alternative", or change each to "accepted".
- **Flag 4's resolution (L471) omits retry requested.** It names only **loaded** and **last fetch failed**, while L202 and AD-11 also use **retry requested**. Add it.
- **Open Items is missing three body `[ASSUMPTION]`s** (all three already existed before this update):
  - Character counter, "spoken **only on crossing**" (L161);
  - Inline error, clearing on the next valid input (L163);
  - focus after "Row removed by not-found or refetch while focus is inside it" (L288).

  The Focus row in Open Items (L542) lists the List error panel case but not this one. Add the three to the "Introduced in distillation…" table.
- No "pending flag N" wording, no `storage-unavailable`, no "or aborted", and no flag-tagged Open Items rows remain. DESIGN.md has no stale flag references.
