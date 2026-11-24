---
name: 'BMad Todos'
status: final
created: '2026-11-24'
updated: '2026-11-24'
sources: ['../initiative-todo-app.md', '../architecture-todo-app/architecture-todo-app.md']
---

# BMad Todos — Experience Spine

## Foundation

| Concern | Decision |
|---|---|
| Form factor | Single-surface responsive web SPA, used at phone and desktop widths (R8). There is no native app. |
| UI system | None. React with **CSS Modules plus CSS custom-property tokens** (architecture spine, Conventions › Styling). There is no CSS framework, component library, CSS-in-JS, or animation library. |
| Visual reference | `DESIGN.md` (tokens, contrast, component visuals). This file owns behaviour, wording, focus, and flows. Both win over any mock. |
| Data path | Components read and write only through the todos hooks (AD-11), and every write goes through the one optimistic-mutation helper (AD-13). List state comes from one selector over the todos store and the cache (AD-11). Outcome wording comes from `apps/web/src/todos/messages.ts` (AD-14). |
| Colour mode | Light and dark, following `prefers-color-scheme`. There is no toggle. |
| Quality bar | WCAG 2.2 AA (R14), and unguided first use (the ticket's Done when section). The stakes are an internal or team project with a public URL. **[ASSUMPTION]** |
| Glossary | **done** = `completed: true`; **open** or **active** = `completed: false`; **reopen** = R4's return to active (the architecture's "reactivate"); **decision log** = the UX decision log (`.memlog.md`), cited after an **[ASSUMPTION]** that it records. |

## Information Architecture

→ Composition reference: [mockups/key-list.html](mockups/key-list.html).

There is one surface, the list page, with no routes, modal dialogs, menus, or settings. **[ASSUMPTION]** (decision log) The Announcer is an overlay pinned to the bottom of the viewport, and Delete confirms inline in its card.

**Regions, in DOM and tab order** (all inside `<main>`):

| # | Region | Element | Tab stops |
|---|---|---|---|
| 1 | Announcer | the one app-level live region (AD-14); first in DOM by user decision, drawn at the bottom. | Dismiss button, while a message shows |
| 2 | Page heading | `<h1 tabindex="-1">` "BMad Todos" (a programmatic focus target, not a tab stop) | none |
| 3 | Add form | `<form>`: visible label "New todo", Text field (add), Add button, Inline error, Field status | Text field, Add button |
| 4 | Loading status | visually hidden `role="status"` | none |
| 5 | List area (one of the Todo list, Empty panel, skeleton list, or List error panel) | `<ul role="list" aria-label="Todos" tabindex="-1">` / `<p tabindex="-1">` / `<ul aria-busy="true">` / panel (the `tabindex="-1"` makes the list and the Empty panel programmatic focus targets, not tab stops) | per card: Completion check, Edit button, Delete button. In edit mode: Completion check, Text field (edit), Save button, Cancel button. In the Delete confirm: Completion check, Confirm delete button, Cancel button. List error panel: Try again button. |

**List area exceptions.** While the list is not loaded (no `['todos']` fetch has succeeded yet), optimistic adds in the cache render in a Todo list **above** the skeleton list or List error panel (AD-11). It is the same `<ul>`, with the same row keys (the todo id), that renders once the list is loaded, so focus, an open Edit form, and an open Delete confirm on an early card survive the first successful load. The Empty panel waits until the last leaving row has unmounted.

**Surface closure.** Every need has a home and a flow that lands there.

| Need | Home | Flow |
|---|---|---|
| R1 create | Add form → new Todo card at the top, "Added “{t}”." | 1, 2 |
| R2 fields | The Todo card shows the description and completion status. `createdAt` is not displayed and only orders the list (AD-6), as in [mockups/key-list.html](mockups/key-list.html). | 1, 3 |
| R3 list on open, no onboarding | List area on load: Skeleton card → Todo list or Empty panel | 1, 3 |
| R4 complete and reopen | Completion check | 1, 2, 4 |
| R5 delete | Delete button → Delete confirm → Confirm delete button → leaving card | 1, 2, 4 |
| R6 done looks different | Todo card, done state (DESIGN.md) | 1 |
| R7 instant, with revert and a message | optimistic Todo card states, revert flag, Announcer | 4 |
| R8 phone and desktop | Responsive & Platform | 1 (phone), 2 and 3 (desktop) |
| R9 empty, loading, and error states | Empty panel; Skeleton card plus Loading status; List error panel | 1, 3, 4 |
| R11 persistence | List area on load, from the server | 3 |
| R12 failures without losing the list | Inline error, Field status, Announcer, List error panel | 1, 2, 4 |
| R13 edit | Edit button → Edit form | 1, 2, 4 |
| R14 WCAG 2.2 AA | Accessibility Floor, across all regions | 2 |

## Voice and Tone

Plain and specific, with no exclamation marks, no blame, and no jargon. A failure says what didn't happen and what the list shows now. All runtime strings live in one `messages.ts` (AD-14), keyed by action and by `FailureKind` (AD-9): a problem type name, `network`, or `generic`. It holds the leads and reasons below, the `deletedElsewhere` override, the status messages (`added`, `deleted`), the List error panel line, and the inline field strings. `conflict` has no key of its own and maps to the generic reason.

**When a failure may not be final.** A write that fails with `network`, `unavailable`, or a generic error may still have been applied on the server (architecture spine, Deferred). The leads still state the failure plainly, because they describe what the list shows now, and that case is rare. The next successful refetch shows what the server holds (State Patterns › Row states › Landed after all).

**Composition.** `message = lead[action] + " " + reason[kind]`, where `kind` is the failure's `FailureKind` (AD-9), except where a full-message override applies.

**`{t}`, the quoted todo text.** It is the todo's description, wrapped in curly double quotes `“` (U+201C) and `”` (U+201D). If it is longer than 40 characters, it is cut at 40 and gets "…" (U+2026) inside the closing quote. **[ASSUMPTION]** Characters are counted as Unicode code points, the AD-8 unit, and trailing whitespace is trimmed before "…". Apostrophes are the ASCII `'`, as approved.

**Leads, per action (failures).**

| Key | Lead |
|---|---|
| `add` | Couldn't add “{t}”. |
| `edit` | Couldn't save your edit, so “{t}” is back as it was. |
| `complete` | Couldn't mark “{t}” done, so it's still open. |
| `reopen` | Couldn't reopen “{t}”, so it's still done. |
| `delete` | Couldn't delete “{t}”, so it's back in the list. |
| `refresh` | Couldn't refresh the list. You're seeing what was last loaded. |
| `load` (List error panel only) | Couldn't load your todos. |

For `edit`, `{t}` is the restored, pre-edit text. **[ASSUMPTION]**

**Reasons, per `FailureKind`** (AD-9, AD-14).

| Kind | Reason |
|---|---|
| `network` (the fetch was rejected and no response arrived; a fetch the app cancelled is not a failure, AD-11) | Check your connection and try again. |
| `unavailable` (nginx when the API can't be reached, AD-4; `/api/health` when storage fails) | The server isn't available right now. Try again in a moment. |
| `internal`, `conflict`, and generic (non-2xx without a problem body, or an unknown type, such as a Cloudflare HTML error page) | Something went wrong on our side. Try again. |
| `validation` (`add` and `edit` only, and only when the problem's `errors` names `description`; otherwise the generic reason, AD-8, AD-14) | Keep it to 1–200 characters. |

`validation` is the only reason a description error gets. A control-character rejection can't reach the user, because the client replaces those characters before it checks or sends (AD-8), so it has no copy of its own.

**Overrides and status messages.**

| Case | Message |
|---|---|
| `deletedElsewhere`: `not-found` on `edit`, `complete`, or `reopen` (replaces lead plus reason; the helper, kind `failure`), and a refetch removing a row in edit mode (the list area, kind `failure`, AD-14) | “{t}” was deleted elsewhere. |
| `not-found` on `delete`, treated as success (AD-13) | Deleted “{t}”. |
| Delete succeeded (status) | Deleted “{t}”. |
| Add succeeded (`201`, or a `200` idempotent replay) (status) | Added “{t}”. |
| Edit, complete, or reopen succeeded | No message. The list shows it. |

**List error panel text:** `lead.load + " " + reason[kind]`, then the button "Try again". `kind` is the todos store's **last fetch failure** (AD-11), never the query's `error`, which an optimistic add resets. A later failed fetch with a different kind updates the reason in place. It is not an entry into Error, so the Loading status doesn't speak it (AD-14).

**Loading status text:** "Loading your todos" while loading, the List error panel text on error, and the recovery line "Your todos are loaded." at most once, when the list becomes loaded (Component Patterns › Loading status says when). **[ASSUMPTION]** (the loaded wording)

**Inline (never in the Announcer, AD-8).**

| Case | Text |
|---|---|
| Empty submit (length 0 after the replace and trim, AD-8), shown as the Inline error and spoken by the Field status | Enter a description. |
| Counter, always shown, where n is the code-point count after control characters become spaces and the text is trimmed (AD-8); "0/200" when empty | `{n}/200` |
| Over-limit, screen-reader text appended to the counter | , over the character limit |
| Over-limit, spoken by the Field status on crossing over 200 and on every blocked submit while over | over the character limit |
| Field hint, hidden, in the field's description, for add / edit **[ASSUMPTION]** | Press Enter to add. / Press Enter to save. |

**Static strings and accessible names.**

| Element | Visible text | Accessible name / role |
|---|---|---|
| Document `<title>` and `<h1>` | BMad Todos | the same |
| Text field (add) | label "New todo", above the field | "New todo" (the visible `<label>`). No placeholder. |
| Add button | Add | "Add" |
| Todo list | none | list (`role="list"`), "Todos" |
| Completion check | none (circle) | checkbox, labelled via `aria-labelledby` by a span holding only the todo text (the Done chip is a sibling, outside it), with checked state |
| Done chip | Done | hidden from assistive tech (the checkbox state carries done) |
| Edit button | Edit | Edit “{full text}” |
| Delete button | Delete | Delete “{full text}” |
| Delete confirm | Delete this todo? | `role="group"`, labelled by the prompt and the todo text |
| Confirm delete button | Delete | Delete “{full text}” |
| Text field (edit) | none | label "Edit description" (visually hidden) |
| Save button / Cancel button | Save / Cancel | "Save" / "Cancel" |
| Empty panel | No todos yet. | text |
| Loading status | none | status, empty until it speaks (Loading status text above) |
| Field status | none | status, empty until it speaks |
| Dismiss button | Dismiss | "Dismiss" |
| Try again button | Try again | "Try again" |

Edit, Delete, and Confirm delete names start with their visible label (WCAG 2.5.3) and quote the **full** text, never cut, so every name is unique on the page.

## Component Patterns

Behaviour only. Visual specs are under the same names, in the same order, in `DESIGN.md` Components. Every focus target is in Interaction Primitives › Focus management.

**Focus ring.** Shown on `:focus-visible` only, for every control in every state. Never suppressed.

**Page heading.** Static "BMad Todos". It is the only heading. Focus: see Focus management.

**Announcer.** One instance (AD-14).
- **Placement:** an overlay pinned to the bottom of the viewport, on every width, while it holds a message. It never shifts layout, and it never covers the focused control (2.4.11). Mechanism (position, safe-area inset, bottom padding, and `scroll-padding-bottom`): DESIGN.md Components › Announcer. On phones with the soft keyboard open, it may sit behind the keyboard; it is still spoken, and this is accepted. **[ASSUMPTION]** (exact behaviour varies by browser; no `visualViewport` logic)
- **Live element:** `role="status"` with `aria-live="polite"` (kept explicitly, because AD-14 says the region is marked `aria-live`; it matches the role's implicit value). It is always mounted and empty on load. Neither it nor any ancestor is ever `display: none`, `visibility: hidden`, or `hidden`. It wraps **only** the message text; the icon (`aria-hidden`) and Dismiss sit outside it.
- **Messages:** every call is `announce(kind, text)` (AD-14), from one of three callers. The helper announces every mutation failure (kind `failure`) and the two status messages, "Added “{t}”." and "Deleted “{t}”.", each on server confirmation (kind `status`, AD-13). The query function announces a refresh failure (kind `refresh`, AD-11). The list area announces “{t}” was deleted elsewhere when a refetch removes a row in edit mode (kind `failure`), unless that exact message for that todo is already showing. Kinds `failure` and `refresh` use the failure variant, and `status` the status variant. It never carries field validation or a load failure.
- **Replacement:** a new message replaces the current one, with one exception: a `refresh` message never replaces an undismissed `failure` message, and is dropped, not queued (AD-14). A `status` message does replace a failure. An identical repeated message is cleared and set again on the next frame, so it is spoken again; the banner itself doesn't move. The exception is an identical `refresh` message that is still showing: it is left as it is, so a user switching windows while offline isn't told the same thing on every return. **[ASSUMPTION]** A `status` that arrives right after a failure can replace it before a screen reader has finished it; this is accepted (Accessibility Floor, manual pass).
- **Lifetime:** a message stays until it is replaced or dismissed, with no timer (WCAG 2.2.1). Focus: see Focus management.

**Dismiss button.** Clears the Announcer message, and the overlay fades out. Focus: see Focus management.

**Add form.** Submit by Add or by Enter in the field. Replaces every control character and line or paragraph separator with a space, trims, then checks 1–200 code points, with the shared check in `packages/contract/src/description.ts` (AD-8). Valid: the client mints the id (AD-7), the card appears on top at once (AD-11) with that value, and the field clears to "0/200". On server confirmation the helper announces "Added “{t}”." (AD-13). The request body and the optimistic card carry the same value, so nothing shifts when the refetch arrives. The form reacts to its own call's promise (AD-13): `failed` restores the text (Add form states › Add failed), and `ok` needs nothing. If a failed add later appears in the list after all, the field may clear (Add form states › Add landed after all). Invalid: nothing is sent, the field gets `aria-invalid="true"`, the Inline error or the counter is linked via `aria-describedby`, and the Field status is cleared and set again with the reason. Focus: see Focus management. The Add form stays enabled in every list state. **[ASSUMPTION]** (decision log)

**Text field.** `<textarea>` with `enterkeyhint="done"`. Auto-grows with no inner scroll (a script fallback where `field-sizing` is unsupported, see DESIGN.md). Enter submits and never inserts a newline. **[ASSUMPTION]** (decision log) Every character the API rejects, that is any control character (`\p{Cc}`, including line breaks and tabs) and U+2028/U+2029 (AD-8), becomes a space as it arrives by paste, drop, autofill, or dictation, so the field shows what will be saved, apart from leading and trailing spaces, which the counter already leaves out. The Tab key is never intercepted and always moves focus. Paste and drop are handled in `beforeinput` (`insertFromPaste`, `insertFromDrop`): the event is cancelled and the cleaned text is inserted through the editing API, so the caret lands after it and one undo removes it. Anything else is cleaned on `input`, and the selection is restored afterwards, which is safe because each replacement is one character for one. The value is never rewritten while an IME composition is open. Shift+Enter inserts no newline either. Enter doesn't submit while an IME composition is open. Submit is also triggered from a `beforeinput` of type `insertLineBreak` or `insertParagraph` (cancelled), so Android keyboards that keep every word composing still submit on Enter. **[ASSUMPTION]** `aria-describedby` always points at the Character counter and the hidden field hint, plus the Inline error while it shows.

**Character counter.** Updates on every input. Over 200 it shows the over state at once, while typing, and the field becomes `aria-invalid`. It never blocks typing. The crossing above 200 is spoken **only on crossing**, through the Field status, never per keystroke. **[ASSUMPTION]** Dropping back to 200 or fewer clears the invalid state silently.

**Inline error.** "Enter a description." appears only after an empty submit. Its "!" icon is `aria-hidden`. It is spoken through the Field status, and stays linked by `aria-describedby` for when focus returns. It clears, with `aria-invalid`, on the next input that makes the text valid. **[ASSUMPTION]**

**Field status.** One per Text field (add and edit). A visually hidden `role="status"` (polite) region, always mounted and empty at first. It is the one hidden field status per text field that AD-14 allows for field validation (AD-8), not a second outcome announcer. It says "over the character limit" once when the text crosses above 200, then is cleared. On **every** blocked submit it is cleared and set again on the next frame with "Enter a description." or "over the character limit", so a repeat is spoken again. It never carries outcome messages.

**Add button.** `type="submit"`. Never disabled.

**Todo list.** `<ul role="list" tabindex="-1">`, a programmatic focus target only (Focus management). The same element and the same row keys (the todo id) are used before and after the first successful load (IA › List area exceptions). Renders the server order (`createdAt` desc, then `id` desc, AD-6), with an optimistic add on top (AD-11). Completing doesn't re-sort. Two quick adds may swap places when the refetch lands, because their requests can reach the server in either order (AD-13 orders per todo only); this is accepted and not animated. **[ASSUMPTION]**

**Todo card.** One per todo. Text renders only through React escaping (AD-19). Clicking the text does nothing, because only the circle's 44×44 hit area is clickable. At most one card is in edit mode or Delete confirm at a time. Opening an edit or a confirm on another card cancels the open one silently. **[ASSUMPTION]** (a confirm cancelling an open edit)

**Completion check.** A native checkbox (construction: DESIGN.md Components › Completion check). Space or a click toggles `completed` at once (R4, R7). Focus: see Focus management. It stays operable during edit mode and the Delete confirm, which it doesn't close. **[ASSUMPTION]** In edit mode, where the text element is replaced, it drops `aria-labelledby` and takes `aria-label` with the saved text.

**Done chip.** Appears and disappears with the checked state. Not focusable. Rendered outside the span that names the checkbox.

**Edit form.** Opened by the Edit button: the row swaps in place, and the field is pre-filled with all text selected. If the last save on this row failed, it is pre-filled with that failed draft instead (kept per todo until the page reloads, and used by the next Edit only); Cancel then returns to the saved text. The draft is stored when the Save call's promise resolves `failed` (AD-13), in a per-todo draft map owned by the list area, not by the card, so it survives the card unmounting while the save is pending. Blur doesn't save or close it. Save or Enter commits, and Cancel or Escape discards. Opening another row's edit or confirm cancels this one silently, and its draft is lost. Saving unchanged text closes it and sends nothing: the trimmed draft is compared with the todo's current cached description. **[ASSUMPTION]** Saving valid changed text closes it at once with the new text shown (R13, R7).

**Delete confirm.** Replaces the row's Edit and Delete with "Delete this todo?", the Confirm delete button, and the Cancel button, in place. There is no modal, and other cards stay usable. Cancel, or Escape with focus anywhere in the group, closes it. Focus: see Focus management. Only one card can be in confirm at a time. There is no undo (the ticket's Boundaries section).

**Card buttons.**
- **Edit button:** enters edit mode for its row.
- **Delete button:** opens the Delete confirm for its row, in place. Nothing is sent yet.
- **Confirm delete button:** runs the delete (R5): the row leaves at once (see Motion), and the helper announces "Deleted “{t}”." on server confirmation (AD-13). Focus: see Focus management.
- **Save button:** same validation and invalid handling as Add (AD-8); an invalid save leaves the Edit form open.
- **Cancel button:** in the Edit form, discards the draft and restores the text view. In the Delete confirm, closes it with nothing sent.

**Empty panel.** Shown per List states. Static text, no action. `tabindex="-1"`, a programmatic focus target only (Focus management).

**Skeleton card.** Shown per List states. Each is hidden from assistive tech. Breathing: see Motion.

**Loading status.** The list's one hidden loading status, the only live region beside the Announcer and the Field statuses (AD-14). The list area renders it, always mounted, visually hidden, and empty at first, outside the part that swaps between list states and outside the `aria-busy` skeleton list (AD-14). It reads the list state from the one list-state selector (AD-11). It speaks whenever the list **enters** its loading or error state while not loaded, so a Try again and a failed Try again are spoken too. A new failure kind while the list is already in Error is not an entry: the panel's reason changes and the status says nothing (AD-14). Each entry empties it and cancels any pending 500 ms or 5 s timer before starting its own, so an old timer never clears a newer line. On entering loading, if the list is still loading after about 500 ms, it says "Loading your todos", so fast loads stay silent and the text is never present at mount. On entering error, it says the List error panel's message, then empties again 5 s later so browse mode doesn't read the message twice. **[ASSUMPTION]** (the 500 ms delay and the 5 s clear) A repeat of the same text is cleared and set again on the next frame.

**Recovery line.** Becoming loaded cancels any pending 500 ms or 5 s timer (AD-14). Then, in the same commit as any focus move and after it (Interaction Primitives › Hand-off order), the list area picks the status's line. It says "Your todos are loaded." once, then empties 5 s later, only if both of these hold:
- **It has spoken this page session** (AD-14): it has set a non-empty line, even one emptied since. A 500 ms timer that never fired doesn't count.
- **Focus was not moved to the list.** The list area did not move focus to the Todo list or the Empty panel in that commit; focus there already says what loaded.

Otherwise it is emptied when the list or Empty panel renders. Either way, it is then silent for the rest of the page session. So a load under 500 ms with nothing said before stays silent, a slow first load ends with the line, and a Try again or automatic refetch that succeeds after an error ends with it too, however long ago the error line was emptied.

The line is spoken even when an Announcer message from the same action was set a moment before, such as "Added “{t}”." when an add made during a slow first load settles and the refetch that follows loads the list. VoiceOver may drop one of the two polite updates. This is accepted: skipping the line would make its loss certain, and the Announcer message stays on screen and in the DOM. **[ASSUMPTION]** (decision log)

**List error panel.** Shown per List states. It holds the load message and the Try again button. A focus, reconnect, or settle-time refetch can replace it with the list or the Empty panel without Try again (AD-11). The panel stays, with no skeletons, while such a fetch runs, and is replaced only when it succeeds. If it fails with a different kind, only the reason changes, silently (Voice and Tone › List error panel text). Focus: see Focus management.

**Try again button.** Calls the hooks' Try again function (AD-11). The panel is replaced by skeletons at once, and the Loading status speaks as above. Its fetch starts at once when no todo mutation is pending. Otherwise it waits until the pending mutations settle, and the refetch that runs then is its fetch (AD-11, AD-13), so the skeletons may show for as long as a save takes. There is no automatic retry (AD-11). Focus: see Focus management.

## State Patterns

→ Visual reference: [mockups/key-list-states.html](mockups/key-list-states.html) (Empty, Loading, List error, add during first load) and [mockups/key-row-interactions.html](mockups/key-row-interactions.html) (edit over-limit, empty submit, Delete confirm, Reverted, Delete succeeded).

**List states** (one at a time in the list area, with the exceptions under the IA table). One selector in the todos hooks derives the state from the todos store and the cache, and every reader uses it: the list area, the List error panel, and the Loading status (AD-11). Whether the list is loaded, loading, or in error comes from the store, never from the cache:
- **loaded** means a `['todos']` fetch has succeeded this page session;
- **last fetch failure** is the `FailureKind` (AD-9) of the most recent recorded fetch failure, or none, and "the last fetch failed" means it is not none;
- **retry requested** is set by Try again.

All three are recorded from fetch outcomes and Try again, never from cache writes. Once loaded, the cache decides between Populated and Empty. A successful fetch writes the list into the cache before it sets loaded, so the first successful load never flashes the Empty panel when the server returned todos (AD-11). A fetch the helper cancels before a mutation is neither a success nor a failure, so it changes no state and announces nothing.

| State | Condition | Treatment |
|---|---|---|
| Loading | Not loaded, and the last fetch didn't fail or a Try again is pending (AD-11) | 3 Skeleton cards, `aria-busy="true"`, Loading status after 500 ms. No visible text. Add form usable. When the load succeeds, the Loading status says "Your todos are loaded." only if it has spoken this page session: after a load slow enough to say "Loading your todos", or after a Try again that follows an error line (Component Patterns › Loading status › Recovery line). A load under 500 ms with nothing said before stays silent. |
| Populated | Loaded, and the cache holds at least one todo | Todo list in server order. |
| Empty | Loaded, and the cache holds zero todos (also after the last delete, once its leaving row has unmounted) | Empty panel "No todos yet." No onboarding (R3). |
| Error | Not loaded, the last fetch failed, and no Try again is pending (AD-11) | List error panel with load message, reason, and Try again. The Loading status speaks the same line. Add form stays usable. Focus: see Focus management. |
| Error, recovered without Try again | A focus, reconnect, or settle-time refetch succeeds while the List error panel shows (AD-11) | The panel is replaced by the Todo list or Empty panel, with no skeletons in between and no Announcer message. The Loading status, which spoke the error line on entering Error, says "Your todos are loaded." unless focus moved to the list. Focus: see Focus management. |
| Try again while a save is pending | Try again is pressed while a todo mutation is pending | Skeletons at once. The fetch waits until the pending mutations settle, then runs as the settle-time refetch (AD-11, AD-13). |
| Refresh failed | Loaded, and a background fetch failed (AD-11) | The list stays as it was. The query function announces the `refresh` lead plus the reason with kind `refresh`, which never replaces an undismissed failure (AD-14). |
| Refetching | Loaded, and a background fetch is running | No indicator, and the list stays usable. **[ASSUMPTION]** |
| Add during Loading | The user adds while skeletons show | The optimistic add goes into the cache (AD-13), and while not loaded it renders in a Todo list above the skeleton list (AD-11). The helper cancels the first load's fetch, which is not a failure, so the skeletons and Loading status stay until the refetch that runs when the add settles. |
| Add during Error | The user adds while the List error panel shows | The optimistic add renders above the List error panel, which stays (AD-11). |
| Add fails before a first successful load | The add fails during Loading or Error | The helper removes the card from the cache, and the skeletons or List error panel are still there. The list never shows "No todos yet." unless a fetch has succeeded with zero todos (AD-11). The Announcer shows the `add` failure. |

**Row states.**

| State | Trigger | Treatment |
|---|---|---|
| Active / Done | `completed` false / true | DESIGN.md Todo card states. |
| Saving | Any mutation pending | No indicator. The optimistic result is the display (R7, C4). **[ASSUMPTION]** |
| Edit | Edit button | Edit form in place, holding the kept failed draft if there is one. Focus: see Focus management. |
| Edit, invalid | Empty Save | Red edge, "Enter a description.", and the Field status speaks. Focus: see Focus management. |
| Edit, over-limit | More than 200 code points | Over-limit counter. Save sends nothing, and the Field status speaks. |
| Delete confirm | Delete button | Edit and Delete are replaced by "Delete this todo?", Confirm delete, and Cancel. Focus: see Focus management. |
| Reverted | Edit, complete, reopen, or delete failed | The helper restores only that todo and records its revert time (AD-13). The card returns to its previous state and position, the revert flag shows until `{motion.duration-revert}` has passed since `revertedAt(id)` (a card that mounts inside that window shows it for the time that remains), and the helper announces lead plus reason. Focus: see Focus management. After a failed delete, the leaving copy unmounts at once and the restored row mounts fresh (AD-11), without `inert` or `aria-hidden`, fully operable, and still flagged, because `revertedAt(id)` lives outside the card. |
| Edit failed | Save failed | Reverted as above. The failed draft is kept for that todo until the page reloads (Component Patterns › Edit form), and the next Edit on the row opens with it (WCAG 3.3.7). |
| Not found | 404 on edit, complete, or reopen | Reverted like any failure (AD-13): the card returns to its previous state and the helper announces “{t}” was deleted elsewhere. The row then unmounts at once, with no leave motion, on the refetch that AD-13 runs once no todo mutation is pending. If focus is inside the row, it moves when the call's promise resolves `failed` with `not-found`, not a round trip later, so the message isn't cut off by a later focus move. Focus: see Focus management. |
| Leaving | Confirm delete pressed | `inert` and `aria-hidden="true"` at once, out of the tab order. It stays rendered for `{motion.duration-base}` after leaving the `['todos']` cache, by a timer that is 0 under reduced motion (never by waiting for `animationend`), then unmounts (AD-11). Only a user-confirmed delete leaves this way; rows removed by a refetch unmount at once. |
| Delete succeeded, 204 or 404 (AD-13) | The server confirms the delete (204) or says the todo is already gone (404) | The helper announces "Deleted “{t}”." in the status variant, on server confirmation, not on press (AD-13). |
| Add succeeded | 201, or 200 replay | The helper announces "Added “{t}”." in the status variant, on server confirmation (AD-13). |
| Follow-ups on a failed add | The user edited, completed, or deleted the new card while its add was pending, and the add failed | The helper drops the queued follow-ups: not sent, not announced, not reverted (AD-13). Their promises resolve `dropped`, which components ignore. Only "Couldn't add “{t}”. …" is announced. |
| Edit open, todo vanishes on refetch | Deleted elsewhere while this row is in edit mode | The edit form closes, the draft is discarded, the row unmounts at once (AD-11), and the list area announces “{t}” was deleted elsewhere with kind `failure` (AD-14), so the lost draft is never silent and a later refresh failure can't replace the message. It is skipped if that exact message for that todo is already showing (a `not-found` on a toggle in edit mode). Focus: see Focus management. |
| Failed add removes a card in use | The card's add fails while its Edit form or Delete confirm is open, or while focus is inside it | The card unmounts at once with no leave motion (AD-11), and an open edit draft is discarded. Only the helper's `add` failure is announced. The list area does not announce `deletedElsewhere`: a row whose `revertedAt(id)` was set in the same update is a helper revert, not a refetch removal (AD-13). Focus: see Focus management. |
| Confirm open, todo vanishes on refetch | Deleted elsewhere while this row is in Delete confirm | The row unmounts at once with no message. **[ASSUMPTION]** Focus: see Focus management. |
| Edit open, todo text changes on refetch | Edited elsewhere while this row is in edit mode | The draft is kept, and Save overwrites. **[ASSUMPTION]** |
| Landed after all | A write failed with `network`, `unavailable`, or a generic error, but the server applied it (architecture spine, Deferred) | The next successful refetch shows what the server holds, with no message: a reverted card shows the saved change, a restored row leaves at once, and a failed add appears in the list (and its restored text may clear, Add form states). The failure message stays until it is replaced or dismissed, and nothing tells a screen-reader user that the list now contradicts it. **[ASSUMPTION]** (no message) Accepted in v1. |

**Add form states.**

| State | Treatment |
|---|---|
| Rest | The "New todo" label above an empty field, "0/200". |
| Typing | Counter live. The field grows with its content. |
| Over-limit | Over-limit counter and red edge while over. Add sends nothing, and the Field status speaks. |
| Empty submit | Red edge, "Enter a description.", and the Field status speaks. Focus: see Focus management. |
| Submitted | The field clears at once, and the card is on top. "Added “{t}”." follows on server confirmation. |
| Add failed | The optimistic card is removed (no revert flag, because no card remains). The helper announces `add` plus the reason, quoting the text. When the call's promise resolves `failed` (AD-13), the sent text is restored into the field **only if the field is still empty**, and newer typing is never overwritten. Focus: see Focus management. |
| Add landed after all | The failed add's id later appears in the list (it reached the server after all), and the field still holds exactly the restored text. The list area, the one observer of `['todos']` (AD-11), tells the add form, which clears the field to "0/200" without moving focus or speaking, so the text can't be resubmitted as a duplicate. If the user has changed the text, it is left alone, and a resubmit can still create a second todo: an accepted v1 risk (architecture spine, Deferred). **[ASSUMPTION]** |

**Announcer states.** Empty (live element mounted and empty, no chrome) → `failure` or `refresh` (failure variant) or `status` (status variant) → replaced by the next message (per Component Patterns › Announcer › Replacement), or empty again after Dismiss.

## Interaction Primitives

**Keyboard map.** There are no app-specific shortcuts. **[ASSUMPTION]** (decision log)

| Key | Where | Effect |
|---|---|---|
| Tab / Shift+Tab | everywhere | Moves through the tab stops in DOM order (IA table). |
| Space | Completion check | Toggles done or open. |
| Enter / Space | any button | Activates it. |
| Enter | Text field (add) | Submits Add. No newline. |
| Enter | Text field (edit) | Saves. No newline. |
| Shift+Enter | Text field | Nothing. No newline. **[ASSUMPTION]** |
| Escape | focus anywhere inside the Edit form | Cancels the edit. |
| Escape | focus anywhere inside the Delete confirm | Closes the confirm. Focus: see Focus management. |
| Escape | Text field (add) | Nothing. The text is kept. **[ASSUMPTION]** |

**Pointer and touch.** Tap or click to act. There is no swipe, long-press, or drag. Hit targets: DESIGN.md Layout & Spacing (above the WCAG 2.5.8 minimum). Hover tints apply only to `@media (hover: hover)` pointers. Every action is always visible. A touch activation never moves focus into a text field unless the user tapped that field or asked to edit, so the phone keyboard opens only when the user means to type. "Touch activation" means the last `pointerdown` on the control had `pointerType` "touch" or "pen". **[ASSUMPTION]**

**Focus management.** This table is the only home for focus targets. Where a row says **the add field or heading**, focus goes to the Text field (add) after a keyboard or mouse activation, and to the Page heading after a touch activation (see Pointer and touch), so the phone keyboard doesn't open.

| Event | Focus goes to |
|---|---|
| Edit button pressed | That row's Text field (edit), with all text selected. Focus moves at once, with no waiting on motion. |
| Save (valid) or Enter | That row's Edit button. |
| Save or Enter (invalid) | Stays in the Text field (edit). |
| Cancel or Escape (Edit form) | That row's Edit button. |
| Edit or Delete button on another row while an edit or confirm is open | The open one cancels, and focus goes to the new row's Text field (edit) or Cancel button. |
| Delete button pressed | That row's Cancel button, in the Delete confirm. |
| Cancel or Escape (Delete confirm) | That row's Delete button. |
| Confirm delete pressed (the after-delete rule) | The next todo's Completion check (the row now in the deleted row's place), skipping Leaving rows. If there is none, the previous todo's. If the list is now empty, the add field or heading. Focus moves at once. |
| Completion check toggled | Stays on the Completion check. |
| Add (valid) | Stays in the Text field (add), which is now cleared. **[ASSUMPTION]** |
| Add (invalid) | Stays in the Text field (add). |
| Add failed | Not moved. **[ASSUMPTION]** If focus is still in the add field, the cursor goes to the end of the restored text. |
| Any revert (edit, complete, reopen, delete) | Not moved. **[ASSUMPTION]** |
| Row removed by not-found, a refetch, or a failed add while focus is inside it | The after-delete rule, except that an empty list sends focus to the Empty panel, because no activation decides between field and heading. For not-found, focus moves when the promise resolves (State Patterns › Not found). **[ASSUMPTION]** |
| Dismiss | The add field or heading. The Page heading is focused with `preventScroll`, so the page doesn't jump to the top from the bottom overlay. **[ASSUMPTION]** |
| Try again | The add field or heading. **[ASSUMPTION]** |
| List error panel replaced by a focus, reconnect, or settle-time refetch while focus is inside it | The Todo list itself (heard as "Todos, list, 3 items"), or the Empty panel ("No todos yet.") if the list is empty. Neither is a tab stop or actionable, so a stray key press toggles nothing, and neither opens the phone keyboard. Tab then reaches the first Completion check. If focus is elsewhere, it is not moved. |
| Announcer message appears | Not moved. **[ASSUMPTION]** |
| List error panel appears | Not moved. |
| Page load | Browser default. No autofocus. **[ASSUMPTION]** |

**Hand-off order.** Whenever the focused element is about to be removed, hidden, or made `inert` (delete, entering or leaving edit, opening or closing the Delete confirm, Dismiss, and Try again), focus moves to its target first, in the same task: in the event handler, using `flushSync` where the target must render first. Only then is the old element unmounted or made `inert`/`aria-hidden`. `document.activeElement` is never `<body>` in between, and a component test asserts it across those transitions.

When a refetch or a failed add, not the user, removes the focused element (a row, or the List error panel when it is replaced), no handler runs first. The list area tracks which row, or the panel, holds focus, with `focusin` and `focusout` on the list area, because once the element is detached `document.activeElement` is already `<body>`. In a layout effect of the commit that removes it, before the next paint, it moves focus to the target only if that tracked element was removed. Focus targets skip Leaving rows. Focus moves before any `announce` call in the same update. In the same commit, after the focus move, the list area picks the Loading status line, so the recovery line knows whether focus went to the list (AD-14; Component Patterns › Loading status › Recovery line). A component test covers both sides: focus inside lands on the target, and focus elsewhere stays put.

## Motion

→ Visual reference: [mockups/key-motion-and-buttons.html](mockups/key-motion-and-buttons.html), which loops each approved motion and the reduced-motion steps. Its server-response delays are illustrative only.

Values are in `DESIGN.md` `motion`. The approach is CSS only, with height animated through a `grid-template-rows: 0fr ↔ 1fr` wrapper. **[ASSUMPTION]** (decision log)

| Trigger | Motion | Tokens |
|---|---|---|
| Add | The new card fades in, slides from `{motion.enter-offset}` to 0, and its height opens. The cards below shift down. | `{motion.duration-base}`, `{motion.ease-out}` |
| Complete | The circle fills, the tick draws (dash offset 14 → 0), the card eases from filled to hollow dashed, the text and buttons quieten, and the Done chip fades in. Reopen is the reverse. A border can't animate from solid to dashed, and `box-shadow` is not animated: the dashed outline and the card shadow each live on their own layer, and only those layers' opacity transitions. | `{motion.duration-base}`, `{motion.ease-out}` |
| Delete (confirmed) | The card fades out, and its height and gap collapse. The cards below close up. | `{motion.duration-base}`, `{motion.ease-out}` |
| Revert | The card eases back to its previous state while, in parallel, the revert flag pulses twice. A card restored after a failed delete re-enters with the Add motion, in parallel with the flag. **[ASSUMPTION]** | `{motion.duration-base}`; flag `{motion.duration-revert}`, `{motion.ease-in-out}` |
| Announcer in | It fades in at the bottom of the viewport: it starts 8px below its resting place (the magnitude of `{motion.enter-offset}`) and slides up. It floats, so nothing moves (no layout shift). | `{motion.duration-fast}`, `{motion.ease-out}` |
| Announcer replaced | The text swaps in place without re-entering. **[ASSUMPTION]** | none |
| Dismiss | The Announcer fades out. Nothing moves. | `{motion.duration-fast}`, `{motion.ease-out}` |
| Enter or leave edit | An instant swap with a fade-in: the content and card height snap at once, and only the incoming content fades 0 → 1 (the field plus Save/Cancel going in, the text plus Edit/Delete coming back). Nothing slides. The focus ring on the incoming field is fully visible from the first frame; it never fades with the field. | `{motion.duration-swap}`, `{motion.ease-out}` |
| Open or close the Delete confirm | The same instant swap with a fade-in: the prompt and buttons going in, Edit/Delete coming back. **[ASSUMPTION]** | `{motion.duration-swap}`, `{motion.ease-out}` |
| Button press | The fill steps a shade (instant), and the button scales to `{motion.press-scale}`. The completion check is not a button and never scales; it changes only its fill or edge. | `{motion.duration-press}`, `{motion.ease-out}` |
| Loading | The skeletons breathe, opacity 1 → `{motion.skeleton-opacity-min}` → 1, `{motion.skeleton-iterations}` times (4.8 s), then hold at opacity 1. | `{motion.duration-skeleton}`, `{motion.ease-in-out}` |

**Rules.**
- Motion never delays state. The cache, the DOM, ARIA state, and focus change at once (C4). The animation only decorates the change. **[ASSUMPTION]** (decision log) Exception: a user-confirmed leaving row stays rendered per State Patterns › Leaving.
- New input during an animation is never blocked or queued.
- Each motion plays once, and motions run in parallel, never chained. Nothing loops; the skeleton breathes three times and stops.
- Only opacity, transform, colour, `stroke-dashoffset`, and grid-row height transition (DESIGN.md Do's and Don'ts). Shadows and dashed edges change through the opacity of their own layers.
- For C4 and the R19 report, an action "shows" at the first painted frame of its change, not at the end of its animation.
- **`prefers-reduced-motion: reduce`:** every transition is instant, the skeleton is static, and press keeps the colour step but drops the scale. The revert flag is a static `{colors.danger}` outline held for `{motion.duration-revert}`, then removed. **[ASSUMPTION]** (decision log)

## Accessibility Floor

Behavioural. Contrast is in `DESIGN.md` Colors.

| Rule | WCAG |
|---|---|
| Native elements first: a checkbox for completion, buttons for actions, forms for add and edit, `<main>`, `<h1>`, and `<ul role="list">`/`<li>` (architecture spine, Conventions). | 1.3.1, 4.1.2 |
| Every action is keyboard-operable with no traps. Tab order follows the IA table. | 2.1.1, 2.1.2, 2.4.3 |
| The focus ring is visible on every control. Focus moves as the focus table says and never drops to `<body>`. The Announcer never covers the focused control (2.4.11). | 2.4.7, 2.4.11 |
| Outcome messages go through the one Announcer (polite) without moving focus, by kind, and a refresh failure never replaces an undismissed failure (AD-14). Its live element is always mounted and holds only the message text, and repeats are cleared and set again. Field validation is spoken by each field's Field status (AD-8's inline exception). First-load progress, failure, and recovery are spoken by the one hidden Loading status (AD-14). | 4.1.3 |
| No timers: messages stay until replaced or dismissed. | 2.2.1 |
| The skeleton breathes three times (4.8 s) and stops. | 2.2.2 |
| Field errors are inline, with `aria-invalid` and `aria-describedby`, and spoken on every blocked submit. The text and counter say what is wrong. Nothing is disabled. | 3.3.1, 3.3.2 |
| Delete asks for confirmation inline before anything is sent. | 3.3.4 |
| A failed edit keeps its draft for the next Edit, and a failed add restores its text into an empty field. | 3.3.7 |
| The add field's visible label "New todo" is its accessible name. Edit, Delete, and Confirm delete names start with their visible label. The checkbox is named by the todo text only. | 2.5.3, 4.1.2 |
| Never colour alone (done, over-limit, errors, and revert). | 1.4.1 |
| Targets are at least 24×24px, and in practice 40–44px. | 2.5.8 |
| Reflows at 320px. 200% zoom works, with the layout switching to the phone layout. Text-spacing overrides don't clip, because cards and fields grow. | 1.4.10, 1.4.4, 1.4.12 |
| Reduced motion is honoured. | 2.3.3 (best practice) |
| `lang="en"` on `<html>`. **[ASSUMPTION]** | 3.1.1 |
| axe-core in every e2e test with AD-20 tags. Every e2e project emulates reduced motion, so no scan lands mid-transition, and one motion-on spec runs without axe. A second project reruns every axe-bearing spec in the dark scheme (AD-20). | — |
| A manual keyboard and screen-reader pass covers every core action (R14). Expected, not bugs: NVDA and JAWS may need a second Escape to leave forms mode before Escape cancels; JAWS may voice the curly quotes in names at its default punctuation level; on Android, Enter submits even while a word is composing; a `status` message such as "Added" can replace a failure before a polite screen reader has finished it (AD-14); when a failed write turns out to have landed, the list changes silently and the failure message stays (Row states › Landed after all); VoiceOver may drop either "Your todos are loaded." or an Announcer message set a moment before it, such as "Added" during a slow first load (Component Patterns › Loading status › Recovery line). Revisit that last one if this pass loses either line. | — |

## Responsive & Platform

Layout per width (breakpoint, card action placement, target heights, and Announcer placement) is in `DESIGN.md` Layout & Spacing, and its breakpoint value is **[ASSUMPTION]**. Behaviour is identical at every width: no action exists at only one width (R8). The Announcer respects `env(safe-area-inset-bottom)` on phones with a home indicator. Supported browsers are the ones Playwright runs by default (the ticket's Boundaries section). There is no offline mode, PWA, or install prompt.

## Inspiration & Anti-patterns

Only directions rejected during the UX discovery sessions:

- **Per-item toasts and alerts.** Rejected for the one Announcer (AD-14).
- **Modal confirm dialogs and undo for delete.** Delete confirms inline in its card instead (user decision, 2026-11-24, for WCAG 3.3.4). Undo is out of v1.
- **Onboarding, tips, and explanations.** The list shows straight away (R3).
- **Disabled buttons.** Add and Save always respond, and invalid input is explained inline.
- **Auto-dismiss timers on messages.** Rejected under WCAG 2.2.1.
- **Hover-only actions.** Every action is always visible.
- **The verbose limit sentence.** Replaced by the n/200 counter.
- **A visible "Loading your todos…" line.** Replaced by breathing skeletons.
- **A placeholder as the add field's only label.** Replaced by the visible label "New todo".
- **Directions not taken:** quiet paper (warm paper, serif, hairlines), ledger mono (monospace ledger, square tags), and bold block (heavy heading, navy add panel). Soft cards won.
- **Bright or accent done cards in dark mode.** An early dark rendering made done cards pop, and the user rejected it. Done must recede in both modes.
- **Motion not taken:** a cross-fade edit transition (janky, read as a slide-up), an edit that morphs in place, a swap with no fade, and a colour-only button press.

## Key Flows

The protagonists are drafted from the ticket's Done when section. Names, devices, and moments are all **[ASSUMPTION]** for the user to correct.

### Flow 1: First visit on a phone

Amara, on a bus, phone in one hand.

**Covers:** R3, R1, R13, R4, R6, R5, R8. E1–E5, E7.

1. Amara opens the URL. For a moment, three skeleton cards breathe under the add form.
2. The Empty panel says "No todos yet." There is no tour and no tip.
3. They tap the field labelled "New todo", type "Buy stamps", and see "10/200".
4. They tap Add. The card appears at the top at once, the field clears to "0/200", and focus stays in the field. "Added “Buy stamps”." appears in a banner pinned to the bottom of the screen. Nothing on the page moves.
5. They tap Edit. The row swaps to a field with "Buy stamps" selected. They type "Buy stamps and envelopes" and tap Save. The text updates in place.
6. They tap the circle. It fills grey, the tick draws, the card goes hollow and dashed, and "Done" appears.
7. **Climax:** Amara glances at the list and the finished task has stepped back. It is still there, but clearly done, without anyone telling them how the app works.
8. They tap the circle again and the card is active once more.
9. They tap Delete. In place of Edit and Delete the card asks "Delete this todo?" with Delete and Cancel. They tap the confirm's Delete. The card fades and collapses, the banner now reads "Deleted “Buy stamps and envelopes”.", and the Empty panel returns once the card has gone. Focus goes to the heading, so the keyboard stays closed.

**Failure path:** at step 4 Amara taps Add with an empty field. The field edge turns red, "Enter a description." appears under it, and nothing is added. They type, the error clears, and they add.

### Flow 2: Every core action by keyboard and screen reader

Tomás, at a desktop with a screen reader on, mid-morning.

**Covers:** R14, R8. E8.

1. Tomás loads the page and hears the heading "BMad Todos". Tab lands on the "New todo" field, and the description reads "0/200, Press Enter to add."
2. They type "Send invoice" and press Enter. The card is on top, focus stays in the field, and they hear "Added “Send invoice”."
3. Tab, then Tab: the checkbox, which is announced as "Send invoice, checkbox, not checked". Space: checked. Space again: not checked. Space once more: checked.
4. Tab: "Edit “Send invoice”, button". Enter: focus lands in the "Edit description" field with the text selected. They type "Send March invoice" and press Enter. Focus returns to "Edit “Send March invoice”".
5. They press Enter on Edit again, then Escape. The edit is cancelled and focus is back on Edit.
6. Tab: "Delete “Send March invoice”". Enter: they hear "Delete this todo? Send March invoice, group, Cancel, button". They press Escape, and focus is back on Delete. Enter reopens the confirm with focus on Cancel. Shift+Tab moves to the Confirm delete button: "Delete “Send March invoice”, button". Enter: the row leaves and focus jumps to the next todo's checkbox, or to the add field if the list is now empty. "Deleted “Send March invoice”." is announced.
7. **Climax:** Tomás has done everything with no visual check, and has never lost track of where focus went.

**Failure path:** in the edit field they paste 230 characters and hear "over the character limit" once. Enter saves nothing, focus stays put, and they hear "over the character limit" again. They trim the text, the warning clears, and Enter saves.

### Flow 3: Coming back

Priya, on a laptop the next morning, after an overnight deploy restarted the server.

**Covers:** R11, R9 (loading). E1, E6.

1. Priya opens a new browser session at the same URL.
2. Skeleton cards breathe, three times at most, then hold still. If loading takes more than about half a second, screen readers hear "Loading your todos".
3. The list renders in the same order as yesterday. The todo they added, edited, and completed shows its edited text and is still done. Screen readers that heard "Loading your todos" now hear "Your todos are loaded."; after a fast load they heard nothing, and hear nothing now.
4. **Climax:** nothing to re-enter, nothing to restore. The list is simply theirs again.

**Failure path:** the laptop's Wi-Fi has dropped, so the first load's fetch fails at once as `network` (AD-11). The skeletons are replaced by the List error panel: "Couldn't load your todos. Check your connection and try again." with Try again. Focus stays where it was, and screen readers hear the same line through the Loading status. The add form still works. Priya presses Try again before the Wi-Fi is back: focus moves to the add field, the skeletons return, the fetch fails again, and the panel and its spoken line come back. When the Wi-Fi returns, the reconnect refetch loads the list on its own, with no second Try again. Focus stays in the add field, and screen readers hear "Your todos are loaded.", even though the error line was emptied long ago. (If instead the API were still restarting, nginx would answer `503` `unavailable` (AD-4), and the panel would read "Couldn't load your todos. The server isn't available right now. Try again in a moment.")

### Flow 4: A flaky connection

Jun, on a phone on a train between tunnels.

**Covers:** R7, R12, R13, R9. E6.

1. Jun ticks "Pay rent". It turns done at once.
2. The save fails. The card eases back to open, its outline pulses red twice, and the banner pinned to the bottom of the screen reads "Couldn't mark “Pay rent” done, so it's still open. Check your connection and try again."
3. Jun edits "Buy milk" to "Buy oat milk" and taps Save. The save fails, the card shows "Buy milk" again with the flag, and the banner now reads "Couldn't save your edit, so “Buy milk” is back as it was. Check your connection and try again."
4. Jun taps Delete on "Old note", then Delete in the confirm. It vanishes, the delete fails, and it comes back in place with the flag. The banner now reads "Couldn't delete “Old note”, so it's back in the list. Check your connection and try again."
5. Jun adds "Call landlord". The add fails, the card disappears, and since the field is empty, "Call landlord" is back in it. The banner reads "Couldn't add “Call landlord”. Check your connection and try again."
6. A background refresh fails. The list stays, and because an undismissed failure is showing, the banner keeps "Couldn't add “Call landlord”. …" rather than switching to the refresh message (AD-14).
7. **Climax:** out of the tunnel, the reconnect refetch runs, and the list quietly shows what the server holds. "Call landlord" is not in it, so the add really did fail. Jun sees that the list never disappeared and nothing was lost silently. Each failure was announced as it happened, naming its todo and why, and the latest one is still on screen. Jun taps Edit on "Buy milk" and the field already holds "Buy oat milk". They tap Save, and it sticks. They tap Add to resubmit "Call landlord", and the banner reads "Added “Call landlord”." (Had the first add reached the server after all, the refetch would have put "Call landlord" back in the list first, and resubmitting would make a second copy: an accepted v1 risk, architecture spine Deferred.)
8. They tap Dismiss and the banner fades. Focus goes to the heading, not the field, so the keyboard stays closed.

**Failure path:** Jun opens the app cold while offline. With no list ever loaded, they get the List error panel with Try again (AD-11), not an empty list. If they add a todo while the panel shows and the add fails, the panel is still there afterwards, never "No todos yet." (AD-11).

## Architecture flags for Winston

All twelve flags are resolved in the architecture spine (2026-11-24; flags 11 and 12 in commit 897a495). Each one keeps its UX need, with the spine's decision under **Resolution**. The rationale is in the architecture `.memlog.md`.

**Flag 1 — Server validation errors after an optimistic write**
- **UX need:** A server `400` after an optimistic add or edit has no open field to attach an error to. (For an add whose text is restored into an empty field, a field does exist, but the failure still arrives as an outcome, after the card has gone.)
- **AD touched:** AD-8, AD-13, AD-14
- **Resolution: accepted** (AD-8, AD-14). A client-check failure stays inline. A server `400` on a write already applied optimistically is a mutation failure that the helper announces. The `validation` reason ("Keep it to 1–200 characters.") applies only when the problem's `errors` names `description`, and otherwise the generic reason applies.

**Flag 2 — Control characters in descriptions**
- **UX need:** None remains. The API is the only writer (AD-2) and rejects these characters, so no stored description can hold a line break.
- **AD touched:** AD-8
- **Resolution: amended** (AD-8). The API rejects any character in `[\p{Cc}\u2028\u2029]` (including `\n`, `\r`, and `\t`) with `400` `validation` on `description`, and never normalises it. The client replaces each such character with a space, then trims, then runs the shared check. EXPERIENCE widens its rule from pasted line breaks to all of them (Component Patterns › Text field, Add form; Voice and Tone › Inline).

**Flag 3 — Helper signals for components**
- **UX need:** The components need four signals:
  - (a) a per-call outcome, so a failed add restores its text and a failed edit keeps its draft;
  - (b) "Added" and "Deleted" announced on server confirmation, even if the card has unmounted;
  - (c) a per-todo "just reverted" signal for the revert flag, including on a card re-mounted after a failed delete;
  - (d) knowledge that a user-deleted row has left the cache, so the component can keep it rendered `{motion.duration-base}` longer (`inert`, `aria-hidden`) and hold the Empty panel until it unmounts.
- **AD touched:** AD-13, AD-11, AD-7
- **Resolution: amended** (AD-13, AD-11).
  - (a) A **per-call promise** that never rejects and resolves with `ok`, `failed` (with its `FailureKind`, AD-9), or `dropped`. The add form and Edit form react to it. Per-call `mutate` callbacks are not used, because they fire only for the latest call and not after unmount.
  - (b) The **helper itself** announces Added, Deleted, and every mutation failure. No component callback is involved.
  - (c) `revertedAt(id)`, read from the todos store outside the cache.
  - (d) Component-level (AD-11). If the id comes back into the cache after a failed delete, the leaving copy unmounts at once and the restored row mounts fresh.

**Flag 4 — What "cached data" means**
- **UX need:** A failed add during Loading or Error must never end at a false "No todos yet."
- **AD touched:** AD-11, AD-13
- **Resolution: amended mechanism, same behaviour** (AD-11, AD-13). List state comes from **loaded** (a `['todos']` fetch has succeeded), **last fetch failed** (now **last fetch failure**, flag 11), and **retry requested** (set by Try again), all held in the one todos store and recorded from fetch outcomes, never from cache writes. Optimistic adds still go into the cache, before the first load too, and render above the skeletons or the List error panel while the list is not loaded. The separate pending list UX proposed was rejected. A fetch the helper cancels is neither a success nor a failure.

**Flag 5 — A second live region for loading**
- **UX need:** The hidden "Loading your todos" status, and the load-failure text on a failed first load, are spoken through a live region beside the Announcer.
- **AD touched:** AD-14
- **Resolution: accepted, option B** (AD-14). Exactly one hidden loading status, which speaks only while the list is not loaded: progress on entering loading, and the error panel's text on entering error. The Announcer never carries a load failure. AD-14 also allows at most one hidden Field status per text field, as field validation.

**Flag 6 — Network and down-API reasons**
- **UX need:** Network failures need their own reason, and a down API needs a reachable type.
- **AD touched:** AD-9, AD-14, AD-4
- **Resolution: amended** (AD-4, AD-9). The client classes every failure as a problem `type`, `network` (`fetch` rejected with no response, never a cancellation), or generic, and `messages.ts` keys all three. The proposed `storage-unavailable` is **renamed `unavailable`**. nginx answers every `/api` upstream failure with `503` `unavailable`, and `/api/health` uses it when storage fails, so a down API reads "The server isn't available right now. Try again in a moment." A Cloudflare HTML error stays generic.

**Flag 7 — Queued mutations after a failed add**
- **UX need:** Follow-ups queued behind a create that fails must not produce false messages.
- **AD touched:** AD-13
- **Resolution: accepted** (AD-13). The helper drops that todo's queued follow-ups: not sent, not announced, not reverted. Their promises resolve `dropped`.

**Flag 8 — Query retry policy**
- **UX need:** The List error panel and refresh failures must surface without hidden retries.
- **AD touched:** AD-11, AD-13
- **Resolution: accepted, with an addition** (AD-11). `retry: false`, and refetch on window focus and on reconnect is on. **Addition:** no `['todos']` fetch starts while a todo mutation is pending, Try again included, so Try again shows skeletons at once and its fetch waits for the settle-time refetch. A focus or reconnect refetch can also replace the List error panel without Try again (EXPERIENCE: List states, Focus management).

**Flag 9 — axe scans: motion and dark scheme**
- **UX need:** axe must never scan mid-fade, and the dark tokens must be audited.
- **AD touched:** AD-20
- **Resolution: accepted** (AD-20). Every e2e project emulates `reducedMotion: 'reduce'`, one motion-on spec runs without axe, and a second project with `colorScheme: 'dark'` reruns every axe-bearing spec.

**Flag 10 — Announcer message priority**
- **UX need:** A `refresh` failure must never replace a showing mutation-failure message.
- **AD touched:** AD-14, AD-13
- **Resolution: accepted in part** (AD-14). `announce(kind, text)` takes kind `failure`, `refresh`, or `status`. A `refresh` message never replaces an undismissed `failure` message and is dropped. The optional part, skipping the refetch after a failed mutation, was rejected: AD-13 still refetches after every settle, because that refetch is the only reconciliation when a failed write may have landed.

Flags 11 and 12 came from the reviewer gate on the first architecture update (review-spine-consistency.md, review-accessibility.md).

**Flag 11 — Failure kind of the last fetch**
- **UX need:** The List error panel and the Loading status say "Couldn't load your todos." plus the reason for the last fetch failure's kind (`network`, `unavailable`, or generic). The reason must survive optimistic adds during Error, because the helper's `setQueryData` resets the query's `error` to `null`. It must also follow a later failed fetch with a different kind.
- **AD touched:** AD-11 (the todos store's contents), AD-9 (failure kinds)
- **Proposal:** The query function records the kind with the failure, for example `lastFetchFailure: FailureKind | null` in place of the **last fetch failed** boolean. It is cleared on success, left unchanged by a cancellation, and never touched by cache writes. The list area reads it from the store, never from the query's `error`.
- **Resolution: accepted** (AD-11, AD-9). The store's **last fetch failure** (a `FailureKind`, or none) replaces the boolean, and "the last fetch failed" means it is not none. The query function sets it on failure, a later failure overwrites the kind, success clears it, and Try again doesn't. The List error panel and the Loading status read the reason from it. `FailureKind` is the one type AD-9 names: a problem type name, `network`, or `generic`. The gate added two rules EXPERIENCE now states: a success writes the cache before it sets loaded, so the first success never flashes the Empty panel, and one list-state selector feeds every reader (State Patterns › List states).

**Flag 12 — Speaking recovery from a failed or slow first load**
- **UX need:** A screen-reader user whose last spoken state was "Couldn't load your todos. …" or "Loading your todos" hears nothing when the list loads, by Try again or by a focus, reconnect, or settle-time refetch, unless focus was in the panel. A sighted user sees the panel turn into the list, so the two experiences disagree, and the user may go on believing the list is down.
- **AD touched:** AD-14 (the hidden loading status "speaks only while the list is not loaded")
- **Proposal:** The hidden loading status may also speak once at the not-loaded → loaded transition, "Your todos are loaded.", and only if it had already spoken this page session and focus was not moved to the list. Fast loads stay silent, and the Announcer still never carries load outcomes.
- **Resolution: amended** (AD-14). The loading status may say one recovery line when the list becomes loaded, only if it has spoken earlier in the page session: it has set a non-empty line, even one emptied since, and a delayed line that never fired doesn't count. Becoming loaded cancels any pending line or delay. A new failure kind while already in Error is not spoken. The list area renders the status and picks its line in the same commit as any focus move. The focus condition and the wording "Your todos are loaded." stay EXPERIENCE's (Component Patterns › Loading status › Recovery line). The spine left one risk to UX, a recovery line landing just after an Announcer message from the same action; EXPERIENCE accepts it rather than skipping the line.

**New flags from this update.** None.

## Ticket changes for Sofia

- **Delete confirmation (R5, R14).** Decision, 2026-11-24, user: Delete asks for confirmation inline in the card ("Delete this todo?" with Delete and Cancel), with no undo. This resolves WCAG 3.3.4 (Error Prevention) under R14. It replaces the ticket's Notes assumption "Delete is immediate, with no confirmation dialog and no undo". Undo stays out of v1 (Boundaries). Nothing changes in the architecture: AD-6 and AD-13 are unchanged.
- **Dark mode (C5).** The user decided, in this UX run on 2026-11-24, on light and dark modes in v1, following the system setting. C5 requires a dated decision for any feature beyond R1–R22, so this decision needs to be recorded in the ticket's Notes.
- **Test strategy, delete confirm (K4, E3).** Both scenarios still describe an immediate delete. Each needs the confirm step: Delete opens the confirm and sends nothing, Cancel and Escape close it, and Confirm delete removes the todo.
- **Test strategy, control characters (K1, K3).** Added by this update. A pasted line break or tab shows as a space in the add and edit fields, and the counter counts after the replace and trim (AD-8). This is the component side of the architect's own U1 and I11 additions, which are already logged for you in the architecture memlog.
- **Test strategy, list states (K5).** Added by this update. K5 should cover: Try again while a save is pending shows skeletons at once and loads after the save settles; a failed Try again speaks the error line again; a focus or reconnect refetch replaces the List error panel without Try again, and focus moves per Focus management; an add during Loading keeps the skeletons, because the cancelled first-load fetch is not a failure (AD-11).
- **Test strategy, review fixes (K1, K5).** Added by the reviewer gate on this update. K1 should cover a mid-text paste containing a line break: the caret lands after the pasted text, and one undo removes it. It should also cover the add field clearing when a failed add's id later appears in the list and the field still holds its restored text. K5 should cover: an automatic recovery while focus is on Try again moves focus to the Todo list, or to the Empty panel when the list is empty; focus elsewhere stays put; and an early card keeps focus and an open Edit form across the first successful load. For the "Your todos are loaded." line, K5 should cover: it is spoken when a slow first load or a Try again succeeds, and when an automatic refetch replaces the List error panel while focus is elsewhere; it is not spoken when focus moved to the list; a load under 500 ms says nothing when it finishes; a recovery more than 5 s after the error line, once the status has emptied, still speaks; and a new failure kind while in Error changes the panel's reason without speaking. K5 should also cover the first successful load never rendering the Empty panel when the server returned todos (AD-11).
- **Accepted risk under R7 (Notes).** Added by this update. A write that fails with `network`, `unavailable`, or a generic error may still have been applied (architecture spine, Deferred). R7's "a message says so" then holds at the time, but the next refetch may silently show the change, and resubmitting a failed add can create a second todo. The add field now clears its restored text when the add turns out to have landed, which closes the common duplicate path, but a resubmit of edited text can still duplicate. The ticket's Notes should record this as an accepted v1 risk, with the spine's revisit condition (a resubmit that reuses the failed id).

## Open Items

Every item below is still **[ASSUMPTION]**. "Where" names the file and section that states it inline. No architecture flags are open.

**From the decision log:**

| Assumption | Where |
|---|---|
| The stakes: internal or team, public URL. | EXPERIENCE › Foundation (Quality bar) |
| Enter submits and never inserts a newline. | EXPERIENCE › Component Patterns › Text field |
| Motion never delays state, and reduced motion is honoured. | EXPERIENCE › Motion › Rules |
| Motion is CSS only with grid-row height; the reduced-motion revert flag is static for 1.2 s. | EXPERIENCE › Motion (intro and Rules) |
| Easing curve values (`{motion.ease-out}`, `{motion.ease-in-out}`). The durations were approved. | DESIGN › frontmatter `motion` |
| No app-specific keyboard shortcuts. | EXPERIENCE › Interaction Primitives › Keyboard map |
| The add form is enabled in every list state, and no control is ever disabled. | EXPERIENCE › Component Patterns › Add form; DESIGN › Do's and Don'ts |
| The IA is one surface. | EXPERIENCE › Information Architecture |

**Introduced in distillation, the review fixes, or the architecture update:**

| Assumption | Where |
|---|---|
| The breakpoint is 768px, and the minimum width is 320px. | DESIGN › Layout & Spacing (Responsive rules) |
| The Announcer status variant styling, and its Dismiss, for Added and Deleted. | DESIGN › Components › Announcer, Dismiss button |
| The Announcer may sit behind an open phone keyboard (still spoken). | EXPERIENCE › Component Patterns › Announcer |
| The List error panel visual, and the Try again style. | DESIGN › Components › List error panel, Try again button |
| The Loading status waits about 500 ms before saying "Loading your todos", and empties 5 s after voicing a load failure. | EXPERIENCE › Component Patterns › Loading status |
| The Field status says "over the character limit" on a blocked submit while over the limit. | EXPERIENCE › Component Patterns › Field status; Voice and Tone › Inline |
| The hidden field hints "Press Enter to add." and "Press Enter to save.", `enterkeyhint="done"`, and the `beforeinput` submit path. | EXPERIENCE › Voice and Tone › Inline; Component Patterns › Text field |
| Focus after Dismiss, Try again, a successful add, a failed add, a revert, an announcer message, page load, and a row removed by not-found, a refetch, or a failed add (the Empty panel when the list empties); touch activations focus the Page heading instead of the add field. | EXPERIENCE › Interaction Primitives › Focus management, Pointer and touch |
| A Delete confirm cancels an open edit; the card keeps its active or done treatment in confirm; the confirm swap motion; a confirm open when its todo vanishes. | EXPERIENCE › Component Patterns › Todo card; DESIGN › Components › Todo card; EXPERIENCE › Motion; EXPERIENCE › State Patterns › Row states |
| Both Delete confirm buttons keep their full style on a done card. | DESIGN › Components › Delete confirm |
| Checked circle hover and press; forced-colours rules; the raised `skeleton-dark`. | DESIGN › Components › Completion check; DESIGN › Colors (Forced colours, Adjusted dark values) |
| The "New todo" label gap (8px). | DESIGN › Layout & Spacing (Gap table) |
| Edit mode uses the active card treatment, even for a done todo. | DESIGN › Components › Todo card |
| The checkbox stays operable during edit and confirm. | EXPERIENCE › Component Patterns › Completion check |
| Saving unchanged text sends nothing (compared with the cached description). A kept failed draft is used by the next Edit only. | EXPERIENCE › Component Patterns › Edit form |
| `{t}` in `edit` is the pre-edit text. | EXPERIENCE › Voice and Tone › Leads |
| The truncation counts code points and trims trailing whitespace. | EXPERIENCE › Voice and Tone › `{t}` |
| An edit open while its todo changes on refetch keeps its draft, and Save overwrites. | EXPERIENCE › State Patterns › Row states |
| A failed write that landed after all is reconciled by the next refetch with no message, and the failure message is not retracted. A failed add that landed clears its restored text from the add field. | EXPERIENCE › State Patterns › Row states (Landed after all); Voice and Tone |
| The crossing above 200 is spoken only on crossing; the Inline error clears on the next valid input. | EXPERIENCE › Component Patterns › Character counter, Inline error |
| The Todo list and Empty panel show the focus ring when focused programmatically after keyboard use (the Page heading does not). | DESIGN › Components › Todo list, Empty panel |
| "Your todos are loaded." wording. | EXPERIENCE › Voice and Tone › Loading status text |
| The recovery line is spoken even right after an Announcer message from the same action, accepting that VoiceOver may drop one of the two. | EXPERIENCE › Component Patterns › Loading status (Recovery line); Accessibility Floor |
| An identical `refresh` message still showing is not re-set. | EXPERIENCE › Component Patterns › Announcer › Replacement |
| Refetch removals unmount without motion; a failed delete re-enters with the Add motion; quick adds may reorder after a refetch. | EXPERIENCE › State Patterns › Row states; Motion; Component Patterns › Todo list |
| No saving or refetching indicators. | EXPERIENCE › State Patterns |
| A replaced announcer message doesn't re-animate. | EXPERIENCE › Motion |
| Shift+Enter, IME, and Escape in the add field. | EXPERIENCE › Interaction Primitives › Keyboard map; Component Patterns › Text field |
| `lang="en"`. | EXPERIENCE › Accessibility Floor |
| The protagonists in Key Flows. | EXPERIENCE › Key Flows |
