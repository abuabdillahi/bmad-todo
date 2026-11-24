# Validation Report — BMad Todos (Todo App v1)

- **DESIGN.md:** `_bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md` (unchanged in this update)
- **EXPERIENCE.md:** `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md`
- **Run at:** 2026-11-24 (Update: amended architecture spine)

## Overall verdict
Every item in review-reconcile-ux-update.md now reads correctly in EXPERIENCE.md. No sentence contradicts a binding AD, and the announce callers and kinds, list-state conditions, Try again timing, failure kinds, per-call promise, and the "Landed after all" row all match the spine. Three medium gaps remain. Each is a place where EXPERIENCE relies on something the spine or EXPERIENCE itself leaves unstated: the failure kind behind the List error panel's text, a failed add that removes a card the user is editing or focused in, and the after-delete focus rule applied to removals no user started. One of them needs a small spine addition (candidate Flag 11).

On accessibility, the update holds up. The reviewer found no AA failure in the spec as written, and every fix from the earlier review still stands: live regions are mounted empty, repeats are cleared and set again, focus is handed off first, and no timers are used. The remaining risk sits in what happens **without** a user action: focus moved by a refetch, list changes nobody announces, and the replace-as-you-type rule. Any of these could ship as a lost-focus bug or a misleading screen-reader experience if built literally. All of them can be fixed inside AD-11, AD-13 and AD-14, or documented as accepted.

## Category verdicts
- Flow coverage — not run (rubric walker not selected)
- Token completeness — not run (rubric walker not selected)
- Component coverage — not run (rubric walker not selected)
- State coverage — not run (rubric walker not selected)
- Visual reference coverage — not run (rubric walker not selected)
- Bloat & overspecification — not run (rubric walker not selected)
- Inheritance discipline — not run (rubric walker not selected)
- Shape fit — not run (rubric walker not selected)

## Findings by severity

### Critical (0)

None.

### High (0)

None.

### Medium (10)

**[Spine consistency]** — The List error panel's reason needs a failure kind that the store does not hold (§ State Patterns › List states, Error and Add during Error, L209, L215; Voice and Tone, L104; Component Patterns › Loading status, L192, List error panel, L194)
AD-11's todos store holds loaded, last fetch failed, retry requested, the pending-mutation count and the revert records, but no failure kind, while the panel text is `lead.load + " " + reason[type]`. In "Add during Error" the helper's optimistic `setQueryData` resets the query's `error` to `null`, so a builder reading the reason from the query loses it. L194 also leaves open whether a failed automatic refetch with a different kind (`network` → `unavailable`) updates the reason; if it does, the change is silent.
Fix: In L104, state that the reason comes from the kind of the last recorded fetch failure, held in the todos store, and add candidate Flag 11. In L194, add: "A failed automatic refetch updates the reason in place without speaking."

**[Spine consistency]** — A failed add that removes a card the user is editing or focused in has no rule (§ State Patterns › Row states, L234–235; Add form states › Add failed, L249; Focus management, L286, L288; Hand-off order, L298)
AD-14 lets the list area announce "deleted elsewhere" only when a refetch removes a row in edit mode, and AD-11 unmounts non-user-confirmed removals at once; nothing covers the helper removing a card when its add fails while its Edit form is open or it holds focus. A list area that detects "my editing row left the cache" also fires on this revert, replacing "Couldn't add “{t}”. …" with a false "“{t}” was deleted elsewhere.", and focus drops to `<body>`. The Motion table doesn't say whether the removed card animates.
Fix: Add a Row states row: "Edit open or focus inside, its add fails | The card unmounts at once with no motion, the edit draft is discarded, and only the helper's `add` failure is announced; the list area does not announce `deletedElsewhere`. Focus: see Focus management." Widen L288 and L298 to "by not-found, a refetch, or a failed add". In L235, a row whose `revertedAt(id)` was set in the same update is a helper revert, not a refetch removal (AD-13 records a revert time for every failed todo, creates included). No spine change needed.

**[Spine consistency]** — The after-delete rule falls back to "the add field or heading" for removals that no user started (§ Focus management, L282, L288)
L288 applies the after-delete rule to refetch and not-found removals; on a now-empty list it ends at "the add field or heading", chosen by activation type (L271), but an automatic removal has no activation. L291 settles the same question for the panel with the Page heading. The target is undefined, so the component test L298 promises can't assert one.
Fix: In L288, write "The after-delete rule, except that an empty list sends focus to the Page heading (no activation decides, as for the List error panel)."

**[Accessibility]** — Automatic recovery lands focus on an actionable checkbox, and the user still doesn't hear what loaded (WCAG 2.4.3, 3.2.2) (§ Interaction Primitives › Focus management, line 291)
When a reconnect refetch succeeds, focus jumps to "Pay rent, checkbox, not checked": the user hears one todo, not that the list loaded or its size, and Space/Enter expecting Try again (NVDA browse mode clicks on Enter) toggles a todo they never chose. On an empty list the heading target reads "BMad Todos, heading level 1", not "No todos yet."
Fix: Target the list area element that just rendered: the Todo list `<ul role="list" aria-label="Todos" tabindex="-1">` ("Todos, list, 3 items") or the Empty panel `<p tabindex="-1">`. Neither is a tab stop, actionable, or opens the phone keyboard; Tab then reaches the first Completion check. Add both to the focus-ring rule.

**[Accessibility]** — Recovery and a successful Try again are silent for anyone whose focus is outside the panel (WCAG 4.1.3, 1.3.1) (§ Component Patterns › Loading status, line 192; § State Patterns › List states "Error, recovered without Try again", line 210; Flow 3 failure path, line 422)
The Loading status voiced the load error, then the reconnect refetch replaces the panel silently, so a screen-reader user's last spoken state is still the error and they may keep adding into what they think is a broken app; Try again says "Loading your todos" then nothing. Strictly not a 4.1.3 failure, but visual and spoken states disagree, and AD-14 has no live route for a load success.
Fix: Record as an accepted gap: an Open Items **[ASSUMPTION]** "Recovery from the List error panel, by Try again or by an automatic refetch, is not spoken (AD-14 has no route); focus moves only if it was in the panel", also in the Accessibility Floor's manual-pass expectations. If the user won't accept it, raise a new flag for Winston: a one-time Loading status utterance at the not-loaded → loaded transition.

**[Accessibility]** — "Landed after all" leaves a false failure message on screen, and screen-reader users are the ones who will resubmit (WCAG 4.1.3, 3.3.4) (§ State Patterns › Row states "Landed after all", line 238; Flow 4 step 7, line 436)
If the add landed, the banner keeps "Couldn't add “Call landlord”. …", the field holds the restored text, and the refetch silently adds the card; a screen-reader user hears nothing, presses Enter and creates a duplicate. The completion case contradicts itself: "so it's still open" while the checkbox is checked.
Fix: Inside AD-13 via the per-call promise: if the failed call's id later appears in the `['todos']` cache and the field still holds exactly the restored text, clear the field back to "0/200" without moving focus. Extend the Open Items "Landed after all" row: "the failure message is not retracted, and no screen-reader cue marks the reconcile".

**[Accessibility]** — Refetch-driven focus moves are underspecified in four ways that can lose or steal focus (WCAG 2.4.3) (§ Focus management, lines 288, 291; § Hand-off order, line 298)
Detection: after the commit the panel is detached and `activeElement` is `<body>`, so a literal `contains` check never fires, and an "activeElement is body" check fires falsely after a touch tap on blank page. Inert rows: the "first/next todo" can be an `inert` Leaving row. No activation: line 288's "add field or heading" has no activation to choose, and line 291 picks the heading. Order: unspecified whether focus moves before or after the "deleted elsewhere" announcement.
Fix: Add to Hand-off order: record focus-inside before the removing commit (a `focusin`/`focusout`-tracked flag on the row and the List error panel), moving focus only if it was set and `activeElement` is now `<body>`; focus targets skip Leaving rows; with no user activation, an empty list sends focus to the Page heading; focus moves before `announce` is called. Extend the component test to both sides (focus elsewhere stays put; focus inside lands on the target).

**[Accessibility]** — Optimistic rows must keep their identity when the list becomes loaded (WCAG 2.4.3, 3.3.7) (§ Information Architecture › List area exceptions, line 39; § List states "Add during Loading" and "Error, recovered without Try again", lines 210, 214)
Before load, optimistic adds render in a Todo list above the skeletons or List error panel; after load the list area renders the cache. If those are different subtrees, or rows change `key` or parent, a user focused in a new card or its Edit form has the row remounted: focus drops to `<body>` and the edit draft is lost.
Fix: Add to Component Patterns › Todo list: "The same `<ul>` and the same row `key` (the todo id) are used before and after the first successful load, so focus, an open Edit form, and an open Delete confirm survive the transition." Add a component test keeping focus in an optimistic card's edit Text field across the first successful load.

**[Accessibility]** — Replacing characters "as it enters the field, typed or pasted" can break caret position and undo, and "typed" invites a Tab trap (WCAG 2.1.2, 3.3.2) (§ Component Patterns › Text field, line 159; Character counter, line 161)
Reading "typed tabs" as an instruction to intercept Tab creates a keyboard trap. Rewriting the controlled value on `input` jumps the caret to the end after a mid-text paste, Chrome drops undo history, and rewriting during composition breaks IME. "Exactly what will be saved" is also inexact, since the field shows leading/trailing spaces the counter excludes.
Fix: Reword: Tab is never intercepted; forbidden characters from paste, drop, autofill or dictation are replaced in `beforeinput` for `insertFromPaste`/`insertFromDrop` by cancelling and inserting cleaned text through the editing API (undo stays one step), otherwise on `input` restoring `selectionStart`/`selectionEnd`; never rewrite while `isComposing`. Change "exactly what will be saved" to "what will be saved, apart from leading and trailing spaces, which the counter already excludes". Add a K1 case for a mid-text paste checking caret and Ctrl+Z.

**[Accessibility]** — "Deleted elsewhere" after a 404 can be cut off by the focus move one round trip later, and can be spoken twice (WCAG 4.1.3) (§ Row states "Not found", line 230; Focus management, line 288; Overrides, line 98; Completion check, line 173)
Cut off: the helper announces "“Buy milk” was deleted elsewhere.", then the refetch removes the focused row a round trip later and the focus move makes NVDA/JAWS cut the message mid-sentence. Spoken twice: a 404 on complete while the row is in edit mode makes the helper announce, then the refetch removal of an edit-mode row makes the list area announce the identical text again.
Fix: Let the row react to its call's promise (AD-13 permits local reactions): on `failed` with kind `not-found`, if focus is inside the row, apply the after-delete rule then, in the same task as the helper's announcement. Add to the "Edit open, todo vanishes on refetch" row: "skipped if the current undismissed message is already “{t}” was deleted elsewhere for this todo."

### Low (4)

**[Spine consistency]** — Detecting that focus was inside an element a refetch removed is not specified (§ Hand-off order, L298)
By the time the list area's layout effect runs, the removed node is detached and `document.activeElement` is already `<body>`, so the effect can't tell "focus was inside" from "focus was already on the body". Buildable inside AD-11's layering.
Fix: Add: "the list area tracks the row or panel that holds focus (a `focusin` listener on the list area, or a check in the removed row's layout-effect cleanup, which runs before its DOM is removed)".

**[Spine consistency]** — "While `revertedAt(id)` is recent" has no window (§ State Patterns › Row states › Reverted, L228)
AD-13 provides only a time. The flag lasts `{motion.duration-revert}` (Motion, L311, L326), but L228 doesn't tie "recent" to it, and a card restored after a failed delete mounts later than the revert time.
Fix: Write "while less than `{motion.duration-revert}` has passed since `revertedAt(id)`; a card that mounts inside that window shows the flag for the time that remains".

**[Accessibility]** — The Loading status's timers need to be reset on each state entry (WCAG 4.1.3) (§ Component Patterns › Loading status, line 192)
Speaking on every entry allows overlapping timers: an old 5 s clear can empty a new error before it is spoken (error at t=0, Try again at 4.9 s, fast failure). Nothing clears the previous error text on entering loading, so a stale "Couldn't load…" sits under the skeletons in browse mode.
Fix: Add "Each entry into loading or error empties the status and cancels any pending 500 ms or 5 s timer before starting its own."

**[Accessibility]** — Announcer repeats and replacements (WCAG 4.1.3) (§ Component Patterns › Announcer › Replacement, line 152)
Offline with the list loaded, every window focus and reconnect clears and re-sets the identical refresh message, so it is heard on every return. A `status` replacing a failure (AD-mandated) can drop the failure before a polite screen reader speaks it, and sighted users lose it too.
Fix: For kind `refresh` only, leave an identical message that is still showing as it is, with no clear-and-set. Note the status-over-failure case as accepted in the Accessibility Floor's manual-pass expectations.

## Candidate new flag (Flag 11, from spine consistency)
**Flag 11 — Failure kind of the last fetch**
- **UX need:** the List error panel and the Loading status say "Couldn't load your todos." plus the reason for the last fetch's failure kind (`network`, `unavailable`, or generic). The panel must keep that reason while optimistic adds go into the cache (Add during Error), and update it when a later fetch fails with a different kind.
- **AD touched:** AD-11 (the todos store's contents), AD-9 (failure kinds).
- **Proposal:** the query function records the failure kind with **last fetch failed**, e.g. `lastFetchFailure: FailureKind | null` in place of a boolean. Cleared on success, left unchanged on a cancellation, never touched by cache writes. The list area reads it from the store, not from the query's `error`.

## Stale references
- **"As proposed" now refers to text that is gone:** Flag 1 (L448), Flag 3 (c) and (d) (L465–466), Flag 7 (L486), and Flag 9 (L496, "first option of each alternative"). Drop the phrases or change each to "accepted".
- **Flag 4's resolution (L471) omits retry requested.** It names only loaded and last fetch failed, while L202 and AD-11 also use retry requested. Add it.
- **Open Items is missing three body `[ASSUMPTION]`s** (all pre-existing): the character counter "spoken only on crossing" (L161); the inline error clearing on the next valid input (L163); focus after "Row removed by not-found or refetch while focus is inside it" (L288). The Focus row in Open Items (L542) lists only the List error panel case. Add the three to the "Introduced in distillation…" table.
- No "pending flag N" wording, no `storage-unavailable`, no "or aborted", and no flag-tagged Open Items rows remain. DESIGN.md has no stale flag references.

## Reviewer files
- `review-spine-consistency.md`
- `review-accessibility.md`
