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
| Data path | Components read and write only through the todos hooks (AD-11), and every write goes through the one optimistic-mutation helper (AD-13). Outcome wording comes from `apps/web/src/todos/messages.ts` (AD-14). |
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
| 5 | List area (one of the Todo list, Empty panel, skeleton list, or List error panel) | `<ul role="list" aria-label="Todos">` / `<p>` / `<ul aria-busy="true">` / panel | per card: Completion check, Edit button, Delete button. In edit mode: Completion check, Text field (edit), Save button, Cancel button. In the Delete confirm: Completion check, Confirm delete button, Cancel button. List error panel: Try again button. |

**List area exceptions.** Before the first successful load, pending added cards render in a Todo list **above** the skeleton list or List error panel (flag 4). The Empty panel waits until the last leaving row has unmounted.

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

Plain and specific, with no exclamation marks, no blame, and no jargon. A failure says what didn't happen and what the list shows now. All runtime strings live in one `messages.ts` (AD-14), keyed by action and problem type (AD-9): the leads and reasons below, the not-found override, the status messages (`added`, `deleted`), the List error panel line, and the inline field strings. `conflict` has no key of its own and maps to the generic reason.

**Composition.** `message = lead[action] + " " + reason[type]`, except where a full-message override applies.

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

**Reasons, per problem type** (AD-9).

| Type | Reason |
|---|---|
| network (the fetch was rejected or aborted; a client-side key AD-9 doesn't name yet, flag 6) | Check your connection and try again. |
| `storage-unavailable` | The server isn't available right now. Try again in a moment. |
| `internal`, `conflict`, and the generic fallback (non-2xx without a problem body, or an unknown type) | Something went wrong on our side. Try again. |
| `validation` (`add` and `edit` only, and only when the problem's `errors[].field` is `description`; otherwise the generic reason. **[ASSUMPTION]**, flag 1) | Keep it to 1–200 characters. |

**Overrides and status messages.**

| Case | Message |
|---|---|
| `not-found` on `edit`, `complete`, or `reopen` (replaces lead plus reason) | “{t}” was deleted elsewhere. |
| `not-found` on `delete`, treated as success (AD-13) | Deleted “{t}”. |
| Delete succeeded (status) | Deleted “{t}”. |
| Add succeeded (`201`, or a `200` idempotent replay) (status) | Added “{t}”. |
| Edit, complete, or reopen succeeded | No message. The list shows it. |

**List error panel text:** `lead.load + " " + reason[type]`, then the button "Try again".

**Inline (never in the Announcer, AD-8).**

| Case | Text |
|---|---|
| Empty submit (trimmed length 0), shown as the Inline error and spoken by the Field status | Enter a description. |
| Counter, always shown, where n is the trimmed code-point count (AD-8); "0/200" when empty | `{n}/200` |
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
| Loading status | none | status, "Loading your todos" |
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
- **Messages:** failures every time, and two status messages, "Added “{t}”." and "Deleted “{t}”.", each on server confirmation. **[ASSUMPTION]** (timing) The failure variant is for failures and the status variant for Added and Deleted. It never carries field validation.
- **Replacement:** a new message replaces the current one, with one exception: a `refresh` failure never replaces a showing mutation-failure message, and is dropped. **[ASSUMPTION]** (dropped, not queued) An identical repeated message is cleared and set again on the next frame, so it is spoken again; the banner itself doesn't move.
- **Lifetime:** a message stays until it is replaced or dismissed, with no timer (WCAG 2.2.1). Focus: see Focus management.

**Dismiss button.** Clears the Announcer message, and the overlay fades out. Focus: see Focus management.

**Add form.** Submit by Add or by Enter in the field. Trims, then checks 1–200 code points (AD-8). Valid: the client mints the id (AD-7), the card appears on top at once (AD-11) with the trimmed text, and the field clears to "0/200". On server confirmation the Announcer says "Added “{t}”." The request body and the optimistic card carry the same trimmed value, so nothing shifts when the refetch arrives. Invalid: nothing is sent, the field gets `aria-invalid="true"`, the Inline error or the counter is linked via `aria-describedby`, and the Field status is cleared and set again with the reason. Focus: see Focus management. The Add form stays enabled in every list state. **[ASSUMPTION]** (decision log)

**Text field.** `<textarea>` with `enterkeyhint="done"`. Auto-grows with no inner scroll (a script fallback where `field-sizing` is unsupported, see DESIGN.md). Enter submits and never inserts a newline, and pasted line breaks become spaces before submit, so the user sees the spaces. **[ASSUMPTION]** (decision log; flag 2) Shift+Enter inserts no newline either. Enter doesn't submit while an IME composition is open. Submit is also triggered from a `beforeinput` of type `insertLineBreak` or `insertParagraph` (cancelled), so Android keyboards that keep every word composing still submit on Enter. **[ASSUMPTION]** `aria-describedby` always points at the Character counter and the hidden field hint, plus the Inline error while it shows.

**Character counter.** Updates on every input. Over 200 it shows the over state at once, while typing, and the field becomes `aria-invalid`. It never blocks typing. The crossing above 200 is spoken **only on crossing**, through the Field status, never per keystroke. **[ASSUMPTION]** Dropping back to 200 or fewer clears the invalid state silently.

**Inline error.** "Enter a description." appears only after an empty submit. Its "!" icon is `aria-hidden`. It is spoken through the Field status, and stays linked by `aria-describedby` for when focus returns. It clears, with `aria-invalid`, on the next input that makes the text valid. **[ASSUMPTION]**

**Field status.** One per Text field (add and edit). A visually hidden `role="status"` (polite) region, always mounted and empty at first. It is a field-local live region, which AD-14 exempts as field validation (AD-8), not a second outcome announcer. It says "over the character limit" once when the text crosses above 200, then is cleared. On **every** blocked submit it is cleared and set again on the next frame with "Enter a description." or "over the character limit", so a repeat is spoken again. It never carries outcome messages.

**Add button.** `type="submit"`. Never disabled.

**Todo list.** `<ul role="list">`. Renders the server order (`createdAt` desc, then `id` desc, AD-6), with an optimistic add on top (AD-11). Completing doesn't re-sort. Two quick adds may swap places when the refetch lands, because their requests can reach the server in either order (AD-13 orders per todo only); this is accepted and not animated. **[ASSUMPTION]**

**Todo card.** One per todo. Text renders only through React escaping (AD-19). Clicking the text does nothing, because only the circle's 44×44 hit area is clickable. At most one card is in edit mode or Delete confirm at a time. Opening an edit or a confirm on another card cancels the open one silently. **[ASSUMPTION]** (a confirm cancelling an open edit)

**Completion check.** A native checkbox (construction: DESIGN.md Components › Completion check). Space or a click toggles `completed` at once (R4, R7). Focus: see Focus management. It stays operable during edit mode and the Delete confirm, which it doesn't close. **[ASSUMPTION]** In edit mode, where the text element is replaced, it drops `aria-labelledby` and takes `aria-label` with the saved text.

**Done chip.** Appears and disappears with the checked state. Not focusable. Rendered outside the span that names the checkbox.

**Edit form.** Opened by the Edit button: the row swaps in place, and the field is pre-filled with all text selected. If the last save on this row failed, it is pre-filled with that failed draft instead (kept per todo until the page reloads, and used by the next Edit only); Cancel then returns to the saved text. Blur doesn't save or close it. Save or Enter commits, and Cancel or Escape discards. Opening another row's edit or confirm cancels this one silently, and its draft is lost. Saving unchanged text closes it and sends nothing: the trimmed draft is compared with the todo's current cached description. **[ASSUMPTION]** Saving valid changed text closes it at once with the new text shown (R13, R7).

**Delete confirm.** Replaces the row's Edit and Delete with "Delete this todo?", the Confirm delete button, and the Cancel button, in place. There is no modal, and other cards stay usable. Cancel, or Escape with focus anywhere in the group, closes it. Focus: see Focus management. Only one card can be in confirm at a time. There is no undo (the ticket's Boundaries section).

**Card buttons.**
- **Edit button:** enters edit mode for its row.
- **Delete button:** opens the Delete confirm for its row, in place. Nothing is sent yet.
- **Confirm delete button:** runs the delete (R5): the row leaves at once (see Motion), and the Announcer says "Deleted “{t}”." on server confirmation. Focus: see Focus management.
- **Save button:** same validation and invalid handling as Add (AD-8); an invalid save leaves the Edit form open.
- **Cancel button:** in the Edit form, discards the draft and restores the text view. In the Delete confirm, closes it with nothing sent.

**Empty panel.** Shown per List states. Static text, no action.

**Skeleton card.** Shown per List states. Each is hidden from assistive tech. Breathing: see Motion.

**Loading status.** Mounted empty. If the first load is still in flight after about 500 ms, it says "Loading your todos", so fast loads stay silent and the text is never present at mount. It is emptied when the list or Empty panel renders. On a failed first load it says the List error panel's message, then empties again 5 s later so browse mode doesn't read the message twice. **[ASSUMPTION]** It is a second live region beside the Announcer: see flag 5.

**List error panel.** Shown per List states. It holds the load message and the Try again button. Focus: see Focus management.

**Try again button.** Refetches `['todos']`. The panel is replaced by skeletons at once. No automatic retry (AD-11, pending flag 8). Focus: see Focus management.

## State Patterns

→ Visual reference: [mockups/key-list-states.html](mockups/key-list-states.html) (Empty, Loading, List error, add during first load) and [mockups/key-row-interactions.html](mockups/key-row-interactions.html) (edit over-limit, empty submit, Delete confirm, Reverted, Delete succeeded).

**List states** (one at a time in the list area, with the exceptions under the IA table).

| State | Condition | Treatment |
|---|---|---|
| Loading | First load in flight, no cached data (AD-11, flag 4) | 3 Skeleton cards, `aria-busy="true"`, Loading status after 500 ms. No visible text. Add form usable. |
| Populated | Query succeeded with at least one todo | Todo list in server order. |
| Empty | Query succeeded with zero todos (also after the last delete, once its leaving row has unmounted) | Empty panel "No todos yet." No onboarding (R3). |
| Error | Query errored **and** no cached data (AD-11), where "cached" means data from a successful fetch (proposed in flag 4) | List error panel with load message, reason, and Try again. Add form stays usable. Focus: see Focus management. |
| Refresh failed | Background refetch errored **with** cached data (AD-11) | The list stays as it was. The Announcer shows the `refresh` lead plus the reason, subject to the replacement rule (Component Patterns › Announcer). |
| Refetching | Background refetch with data | No indicator, and the list stays usable. **[ASSUMPTION]** |
| Add during Loading | The user adds while skeletons show | The pending card renders in a Todo list above the skeleton list. The skeletons and Loading status stay until the first load settles. (flag 4) |
| Add during Error | The user adds while the List error panel shows | The pending card renders above the List error panel, which stays. (flag 4) |
| Add fails before a first successful load | The add fails during Loading or Error | The pending card is removed, and the skeletons or List error panel are still there. The list never shows "No todos yet." unless a fetch has succeeded with zero todos. The Announcer shows the `add` failure. (flag 4) |

**Row states.**

| State | Trigger | Treatment |
|---|---|---|
| Active / Done | `completed` false / true | DESIGN.md Todo card states. |
| Saving | Any mutation pending | No indicator. The optimistic result is the display (R7, C4). **[ASSUMPTION]** |
| Edit | Edit button | Edit form in place, holding the kept failed draft if there is one. Focus: see Focus management. |
| Edit, invalid | Empty Save | Red edge, "Enter a description.", and the Field status speaks. Focus: see Focus management. |
| Edit, over-limit | More than 200 code points | Over-limit counter. Save sends nothing, and the Field status speaks. |
| Delete confirm | Delete button | Edit and Delete are replaced by "Delete this todo?", Confirm delete, and Cancel. Focus: see Focus management. |
| Reverted | Edit, complete, reopen, or delete failed | The helper restores only that todo (AD-13). The card returns to its previous state and position, the revert flag shows, and the Announcer shows lead plus reason. Focus: see Focus management. A row restored after a failed delete is mounted fresh, without `inert` or `aria-hidden`, and fully operable. |
| Edit failed | Save failed | Reverted as above. The failed draft is kept for that todo until the page reloads, and the next Edit on the row opens with it (WCAG 3.3.7). |
| Not found | 404 on edit, complete, or reopen | Reverted like any failure (AD-13): the card returns to its previous state and the Announcer says “{t}” was deleted elsewhere. The row then unmounts at once, with no leave motion, on the refetch that AD-13 runs once no todo mutation is pending. Focus: see Focus management. |
| Leaving | Confirm delete pressed | `inert` and `aria-hidden="true"` at once, out of the tab order. It stays rendered for `{motion.duration-base}` after leaving the `['todos']` cache, by a timer that is 0 under reduced motion (never by waiting for `animationend`), then unmounts (flag 3). Only a user-confirmed delete leaves this way; rows removed by a refetch unmount at once. |
| Delete succeeded, 204 or 404 (AD-13) | The server confirms the delete (204) or says the todo is already gone (404) | Announcer status variant "Deleted “{t}”.", announced on server confirmation, not on press. **[ASSUMPTION]** |
| Add succeeded | 201, or 200 replay | Announcer status variant "Added “{t}”.", on server confirmation. **[ASSUMPTION]** (timing) |
| Follow-ups on a failed add | The user edited, completed, or deleted the new card while its add was pending, and the add failed | The queued follow-ups are dropped silently. Only "Couldn't add “{t}”. …" is announced. (flag 7) |
| Edit open, todo vanishes on refetch | Deleted elsewhere while this row is in edit mode | The edit form closes, the draft is discarded, the row unmounts at once, and the Announcer says “{t}” was deleted elsewhere (so the draft is not lost silently). **[ASSUMPTION]** Focus: see Focus management. |
| Confirm open, todo vanishes on refetch | Deleted elsewhere while this row is in Delete confirm | The row unmounts at once with no message. **[ASSUMPTION]** Focus: see Focus management. |
| Edit open, todo text changes on refetch | Edited elsewhere while this row is in edit mode | The draft is kept, and Save overwrites. **[ASSUMPTION]** |
| Stored line break | A description stored with `\n` by another client | Renders as a space under `white-space: normal`. In the edit field it shows as a space, so saving normalises it. **[ASSUMPTION]** (flag 2) |

**Add form states.**

| State | Treatment |
|---|---|
| Rest | The "New todo" label above an empty field, "0/200". |
| Typing | Counter live. The field grows with its content. |
| Over-limit | Over-limit counter and red edge while over. Add sends nothing, and the Field status speaks. |
| Empty submit | Red edge, "Enter a description.", and the Field status speaks. Focus: see Focus management. |
| Submitted | The field clears at once, and the card is on top. "Added “{t}”." follows on server confirmation. |
| Add failed | The optimistic card is removed (no revert flag, because no card remains). The Announcer shows `add` plus the reason, quoting the text. The text is restored into the field **only if the field is still empty**, and newer typing is never overwritten. Focus: see Focus management. |

**Announcer states.** Empty (live element mounted and empty, no chrome) → failure (failure variant) or status (status variant) → replaced by the next message (per Component Patterns › Announcer › Replacement), or empty again after Dismiss.

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
| Confirm delete pressed (the after-delete rule) | The next todo's Completion check (the row now in the deleted row's place). If there is none, the previous todo's. If the list is now empty, the add field or heading. Focus moves at once. |
| Completion check toggled | Stays on the Completion check. |
| Add (valid) | Stays in the Text field (add), which is now cleared. **[ASSUMPTION]** |
| Add (invalid) | Stays in the Text field (add). |
| Add failed | Not moved. **[ASSUMPTION]** If focus is still in the add field, the cursor goes to the end of the restored text. |
| Any revert (edit, complete, reopen, delete) | Not moved. **[ASSUMPTION]** |
| Row removed by not-found or refetch while focus is inside it | The after-delete rule. **[ASSUMPTION]** |
| Dismiss | The add field or heading. The Page heading is focused with `preventScroll`, so the page doesn't jump to the top from the bottom overlay. **[ASSUMPTION]** |
| Try again | The add field or heading. **[ASSUMPTION]** |
| Announcer message appears | Not moved. **[ASSUMPTION]** |
| List error panel appears | Not moved. |
| Page load | Browser default. No autofocus. **[ASSUMPTION]** |

**Hand-off order.** Whenever the focused element is about to be removed, hidden, or made `inert` (delete, entering or leaving edit, opening or closing the Delete confirm, Dismiss, and Try again), focus moves to its target first, in the same task: in the event handler, using `flushSync` where the target must render first. Only then is the old element unmounted or made `inert`/`aria-hidden`. `document.activeElement` is never `<body>` in between, and a component test asserts it across those transitions.

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
| Outcome messages go through the one Announcer (polite) without moving focus. Its live element is always mounted and holds only the message text, and repeats are cleared and set again. Field validation is spoken by each field's Field status (AD-8's inline exception). The loading status is a separate hidden status (flag 5). | 4.1.3 |
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
| axe-core in every e2e test with AD-20 tags; scans wait for motion to settle; one dark-scheme pass (flag 9). | — |
| A manual keyboard and screen-reader pass covers every core action (R14). Expected, not bugs: NVDA and JAWS may need a second Escape to leave forms mode before Escape cancels; JAWS may voice the curly quotes in names at its default punctuation level; on Android, Enter submits even while a word is composing. | — |

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
3. The list renders in the same order as yesterday. The todo they added, edited, and completed shows its edited text and is still done.
4. **Climax:** nothing to re-enter, nothing to restore. The list is simply theirs again.

**Failure path:** the laptop's Wi-Fi has dropped, so the first load's fetch is rejected. The skeletons are replaced by the List error panel: "Couldn't load your todos. Check your connection and try again." with Try again. Focus stays where it was, and screen readers hear the same line through the Loading status. The add form still works. Once the Wi-Fi is back they press Try again, the skeletons return, and the list loads. (If instead the API were still restarting, nginx would answer with a problem details response (AD-4), not a network error, and the reason would follow that problem's type: flag 6.)

### Flow 4: A flaky connection

Jun, on a phone on a train between tunnels.

**Covers:** R7, R12, R13, R9. E6.

1. Jun ticks "Pay rent". It turns done at once.
2. The save fails. The card eases back to open, its outline pulses red twice, and the banner pinned to the bottom of the screen reads "Couldn't mark “Pay rent” done, so it's still open. Check your connection and try again."
3. Jun edits "Buy milk" to "Buy oat milk" and taps Save. The save fails, the card shows "Buy milk" again with the flag, and the banner now reads "Couldn't save your edit, so “Buy milk” is back as it was. Check your connection and try again."
4. Jun taps Delete on "Old note", then Delete in the confirm. It vanishes, the delete fails, and it comes back in place with the flag. The banner now reads "Couldn't delete “Old note”, so it's back in the list. Check your connection and try again."
5. Jun adds "Call landlord". The add fails, the card disappears, and since the field is empty, "Call landlord" is back in it. The banner reads "Couldn't add “Call landlord”. Check your connection and try again."
6. A background refresh fails. The list stays, and because a mutation failure is showing, the banner keeps "Couldn't add “Call landlord”. …" rather than switching to the refresh message.
7. **Climax:** out of the tunnel, Jun sees that the list never disappeared and nothing was lost silently. Each failure was announced as it happened, naming its todo and why, and the latest one is still on screen. Jun taps Edit on "Buy milk" and the field already holds "Buy oat milk". They tap Save, and it sticks. They tap Add to resubmit "Call landlord", and the banner reads "Added “Call landlord”."
8. They tap Dismiss and the banner fades. Focus goes to the heading, not the field, so the keyboard stays closed.

**Failure path:** Jun opens the app cold while offline. With no list ever loaded, they get the List error panel with Try again (AD-11), not an empty list. If they add a todo while the panel shows and the add fails, the panel is still there afterwards, never "No todos yet." (flag 4).

## Architecture flags for Winston

**Flag 1 — Server validation errors after an optimistic write**
- **UX need:** A server `400` after an optimistic add or edit has no open field to attach an error to. (For an add whose text is restored into an empty field, a field does exist, but the failure still arrives as an outcome, after the card has gone.)
- **AD touched:** AD-8 (field errors never go through the announcer), AD-13 (the helper announces every failure), AD-14
- **Proposal:** Use the Announcer's `validation` reason ("Keep it to 1–200 characters.") as the fallback, only when the problem's `errors[].field` is `description`. Any other `400` (unknown field, null, or non-UUID id) gets the generic reason. The client check makes both unreachable in practice.

**Flag 2 — Line breaks in stored descriptions**
- **UX need:** Fields are auto-growing textareas. Enter submits, and pasted line breaks become spaces on the client. A description stored with `\n` by another client, the e2e `beforeEach` setup, or the contract suite still has to render and edit.
- **AD touched:** AD-8 (silent on `\n` and other control characters in `description`)
- **Proposal:** Confirm whether the API rejects, accepts, or normalises `\n`. UX never sends one. A stored `\n` renders as a space and becomes a space when that todo is edited and saved.

**Flag 3 — Helper signals for components**
- **UX need:** The helper must give the components four per-call or per-todo signals:
  - (a) a failure callback with the rejected variables, so a failed add restores its text and a failed edit keeps its draft;
  - (b) a success callback, so "Added" and "Deleted" are announced on server confirmation;
  - (c) a per-todo "just reverted" signal for the revert flag, including on a card re-mounted after a failed delete;
  - (d) knowledge that a user-deleted row has left the cache, so the component can keep it rendered `{motion.duration-base}` longer (`inert`, `aria-hidden`) and hold the Empty panel until it unmounts.
- **AD touched:** AD-13 (helper API is undefined), AD-11 (components use only the hooks; the list renders the server's order), AD-7 (the wire `Todo` shape is fixed)
- **Proposal:**
  - (a) and (b) via TanStack's per-call `mutate(vars, { onError, onSuccess })`.
  - (c) via a hook such as `revertedAt(id)`, kept outside the `Todo` objects in the cache.
  - (d) stays component-level. Rows removed by a refetch (not-found, a row vanishing in edit) unmount at once, so only user-confirmed deletes need it.

**Flag 4 — What "cached data" means**
- **UX need:** A failed add during Loading or Error can end at a false "No todos yet.": the optimistic add seeds the absent cache with `[todo]`, the add fails and reverts to `[]`, the refetch fails too, and AD-11 now forbids the error state because cached data exists.
- **AD touched:** AD-11 ("cached data"), AD-13 (cancel, then seed the cache)
- **Proposal:** Define AD-11's "cached data" as data from a successful server fetch (for example a fetch-set `dataUpdatedAt`, or a `loadedOnce` flag in the todos hooks). Until a successful fetch has happened, the helper keeps optimistic adds in a separate pending list that renders above the skeleton list or the List error panel, instead of seeding `['todos']`.

**Flag 5 — A second live region for loading**
- **UX need:** The approved hidden "Loading your todos" status, and on a failed first load the load-failure text, are spoken through a second live region beside the Announcer. AD-14 says the one region carries "save-failure, refetch-failure **and status messages**", and both are status messages. (Field status regions are not part of this flag: they are field validation, AD-14's stated exception.)
- **AD touched:** AD-14
- **Proposal:** Either (A) move the loading and load-failure speech into the Announcer, or (B) Winston signs off one hidden progress status beside it. **UX recommends B:** the Announcer stays silent during loading, the load-failure text is shown in the List error panel, which focus does **not** move to, and the hidden Loading status speaks both. Without B, A applies.

**Flag 6 — Network and down-API reasons**
- **UX need:** Network failures have their own reason ("Check your connection and try again."), but AD-9 has no `network` key: it classes a network error as a generic failure. A down API does not produce a network error either: nginx answers with a problem details response (AD-4) whose `type` AD-4 doesn't name, so `storage-unavailable` is nearly unreachable.
- **AD touched:** AD-9, AD-14 (`messages.ts` keys), AD-4
- **Proposal:** `messages.ts` should get a client-side `network` key for a rejected or aborted fetch, beside the generic fallback (AD-9 and AD-14 amended to name it; AD-20 already separates `abort` from "failing"). AD-4 should name the problem type for nginx 502/503/504; UX proposes `storage-unavailable`, so a down API reads "The server isn't available right now. Try again in a moment." A Cloudflare HTML error (tunnel down) stays generic.

**Flag 7 — Queued mutations after a failed add**
- **UX need:** The user can edit, complete, or delete a new card while its add is pending. If the add fails, sending those queued requests yields false messages (a `PATCH` 404 says "deleted elsewhere"; a `DELETE` 404 says "Deleted").
- **AD touched:** AD-13 (per-todo ordering; silent on a failed create)
- **Proposal:** When a create fails, the helper drops that todo's queued mutations silently, so only "Couldn't add" is announced.

**Flag 8 — Query retry policy**
- **UX need:** The timing of the List error panel and of refresh failures depends on the query's retry policy. TanStack retries a failed query three times with backoff by default, so failures would surface about 7 s late.
- **AD touched:** AD-11 (the query), AD-13 (retries nothing, but binds mutations only)
- **Proposal:** AD-11 should state `retry: false` for `['todos']` and whether `refetchOnWindowFocus` is on. UX assumes no retry and refetch on focus.

**Flag 9 — axe scans: motion and dark scheme**
- **UX need:** axe runs in every e2e test and reads contrast through opacity, so a scan during a fade can fail spuriously. Playwright runs in the light scheme, so the dark tokens are never audited.
- **AD touched:** AD-20
- **Proposal:** Playwright emulates `reducedMotion: 'reduce'` for axe scans (browser emulation, not an app flag; it makes every transition instant), or scans wait for `document.getAnimations()` to settle; one motion-on test runs without axe. Add a `colorScheme: 'dark'` axe pass, as a second project or one spec per E1–E6 state.

**Flag 10 — Announcer message priority**
- **UX need:** A `refresh` failure must never replace a showing mutation-failure message, so the announcer needs to know a message's kind. Under a network drop, AD-13's post-failure invalidation refetch fails at once, so this happens on almost every failed mutation.
- **AD touched:** AD-14 (the announcer API), AD-13 (invalidates after every settled mutation)
- **Proposal:** The announcer API takes a message kind (`mutation-failure`, `refresh-failure`, `status`) and applies the priority rule. Optionally, AD-13 skips the refetch after a failed mutation unless the failure was `not-found`, since the helper has already reverted that todo.

## Ticket changes for Sofia

- **Delete confirmation (R5, R14).** Decision, 2026-11-24, user: Delete asks for confirmation inline in the card ("Delete this todo?" with Delete and Cancel), with no undo. This resolves WCAG 3.3.4 (Error Prevention) under R14. It replaces the ticket's Notes assumption "Delete is immediate, with no confirmation dialog and no undo". Undo stays out of v1 (Boundaries). Nothing changes in the architecture: AD-6 and AD-13 are unchanged.
- **Dark mode (C5).** The user decided, in this UX run on 2026-11-24, on light and dark modes in v1, following the system setting. C5 requires a dated decision for any feature beyond R1–R22, so this decision needs to be recorded in the ticket's Notes.

## Open Items

Every item below is still **[ASSUMPTION]**. "Where" names the file and section that states it inline.

**From the decision log:**

| Assumption | Where | Flag |
|---|---|---|
| The stakes: internal or team, public URL. | EXPERIENCE › Foundation (Quality bar) | — |
| Enter submits, no newline, and pasted line breaks become spaces. | EXPERIENCE › Component Patterns › Text field | 2 |
| Motion never delays state, and reduced motion is honoured. | EXPERIENCE › Motion › Rules | — |
| Motion is CSS only with grid-row height; the reduced-motion revert flag is static for 1.2 s. | EXPERIENCE › Motion (intro and Rules) | — |
| Easing curve values (`{motion.ease-out}`, `{motion.ease-in-out}`). The durations were approved. | DESIGN › frontmatter `motion` | — |
| No app-specific keyboard shortcuts. | EXPERIENCE › Interaction Primitives › Keyboard map | — |
| The add form is enabled in every list state, and no control is ever disabled. | EXPERIENCE › Component Patterns › Add form; DESIGN › Do's and Don'ts | — |
| The IA is one surface. | EXPERIENCE › Information Architecture | — |

**Introduced in distillation or the review fixes:**

| Assumption | Where | Flag |
|---|---|---|
| The breakpoint is 768px, and the minimum width is 320px. | DESIGN › Layout & Spacing (Responsive rules) | — |
| The Announcer status variant styling, and its Dismiss, for Added and Deleted. | DESIGN › Components › Announcer, Dismiss button | — |
| The Announcer may sit behind an open phone keyboard (still spoken); a dropped (not queued) refresh failure; Added and Deleted announced on server confirmation. | EXPERIENCE › Component Patterns › Announcer; State Patterns › Row states | — |
| The List error panel visual, and the Try again style. | DESIGN › Components › List error panel, Try again button | — |
| The Loading status speaks after 500 ms, voices the load failure, and empties 5 s later. | EXPERIENCE › Component Patterns › Loading status | 5 |
| The Field status says "over the character limit" on a blocked submit while over the limit. | EXPERIENCE › Component Patterns › Field status; Voice and Tone › Inline | — |
| The hidden field hints "Press Enter to add." and "Press Enter to save.", `enterkeyhint="done"`, and the `beforeinput` submit path. | EXPERIENCE › Voice and Tone › Inline; Component Patterns › Text field | — |
| Focus after Dismiss, Try again, a successful add, a failed add, a revert, an announcer message, and page load; touch activations focus the Page heading instead of the add field. | EXPERIENCE › Interaction Primitives › Focus management, Pointer and touch | — |
| A Delete confirm cancels an open edit; the card keeps its active or done treatment in confirm; the confirm swap motion; a confirm open when its todo vanishes. | EXPERIENCE › Component Patterns › Todo card; DESIGN › Components › Todo card; EXPERIENCE › Motion; EXPERIENCE › State Patterns › Row states | — |
| Both Delete confirm buttons keep their full style on a done card. | DESIGN › Components › Delete confirm | — |
| Checked circle hover and press; forced-colours rules; the raised `skeleton-dark`. | DESIGN › Components › Completion check; DESIGN › Colors (Forced colours, Adjusted dark values) | — |
| The "New todo" label gap (8px). | DESIGN › Layout & Spacing (Gap table) | — |
| Edit mode uses the active card treatment, even for a done todo. | DESIGN › Components › Todo card | — |
| The checkbox stays operable during edit and confirm. | EXPERIENCE › Component Patterns › Completion check | — |
| Saving unchanged text sends nothing (compared with the cached description). A kept failed draft is used by the next Edit only. | EXPERIENCE › Component Patterns › Edit form | — |
| `{t}` in `edit` is the pre-edit text. | EXPERIENCE › Voice and Tone › Leads | — |
| The `validation` reason applies only to `description` errors, and falls back to generic outside add and edit. | EXPERIENCE › Voice and Tone › Reasons | 1 |
| The truncation counts code points and trims trailing whitespace. | EXPERIENCE › Voice and Tone › `{t}` | — |
| An edit open while its todo vanishes, or changes, on refetch; a stored `\n` renders as a space. | EXPERIENCE › State Patterns › Row states | 2 |
| Refetch removals unmount without motion; a failed delete re-enters with the Add motion; quick adds may reorder after a refetch. | EXPERIENCE › State Patterns › Row states; Motion; Component Patterns › Todo list | — |
| No saving or refetching indicators. | EXPERIENCE › State Patterns | — |
| A replaced announcer message doesn't re-animate. | EXPERIENCE › Motion | — |
| Shift+Enter, IME, and Escape in the add field. | EXPERIENCE › Interaction Primitives › Keyboard map; Component Patterns › Text field | — |
| `lang="en"`. | EXPERIENCE › Accessibility Floor | — |
| The protagonists in Key Flows. | EXPERIENCE › Key Flows | — |
