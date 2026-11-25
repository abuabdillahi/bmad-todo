# Accessibility report: epic-manage-todos

- **Date:** 2026-11-25
- **Epic:** epic-manage-todos (R14, WCAG 2.2 AA). This covers the whole app: every core action, every list state, light and dark.
- **Commit measured:** `32c3365` plus story 2.9's changes, which touch only the measurement scripts, one integration test of their host guard, `package.json` scripts, the README and the reports. No UI changed. Lighthouse and the keyboard pass were run again after the review's fixes to the scripts, on a fresh stack.
- **Environment:** `todo-test` at `http://127.0.0.1:8081`, freshly built with a new volume. Lighthouse audited a list of 280 todos, 277 active and 3 done (the size comes from the run order: `perf:api` runs before it and grows the list).
- **Tools:** Lighthouse 13.6.0 (`pnpm dlx lighthouse@13.6.0`) on Playwright's Chromium 159.0.8154.6 (`CHROME_PATH`). The e2e suite runs `@axe-core/playwright` 4.14.0 (axe-core 4.14.1) on Playwright 1.65.1. The keyboard and accessibility-tree pass runs Playwright 1.65.1 with Chromium's accessibility tree over the Chrome DevTools Protocol (`Accessibility.getPartialAXTree`) and Playwright's `ariaSnapshot()`.
- **Reproduce:** `docker compose -p todo-test --profile test up -d --build --wait`, then `pnpm perf:lighthouse` and `pnpm a11y:pass`, then `docker compose -p todo-test --profile test down -v`. For axe: `pnpm test:all`, which runs the e2e step and then the `axe coverage` step.

## Scope

This report has three parts: Lighthouse, axe-core in every e2e test, and the pass of every core action by keyboard alone, with what a screen reader is given at each step (R14, the test strategy's manual pass).

**No agent can drive a real screen reader** (decision 2026-11-25 in the ticket's Notes). So the manual pass was run as a committed script, `pnpm a11y:pass`: a keyboard-only walk of Flow 2 and its failure path, which records after each key the focused element's role, name, description and states from Chromium's accessibility tree, every text change in a live region, and the card's aria snapshot at each state. That is what a screen reader reads from. How a given screen reader speaks it, and the EXPERIENCE Accessibility Floor's "Expected, not bugs" list (NVDA and JAWS needing a second Escape in forms mode, JAWS voicing the curly quotes, VoiceOver dropping one of two polite updates, and the rest), cannot be checked this way. They are left to the person's own check below. Automated tools and an accessibility-tree pass catch only part of WCAG, so this report is not a claim of full AA conformance.

User screen-reader check — pending (optional; may be run in spike 13's TalkBack session or on desktop; any failure becomes a new bug).

## Lighthouse

`e2e/perf/lighthouse.mjs` forces each colour scheme with a Blink setting and checks it with a probe page first (epic 1's A1). Before the runs it now seeds the list through the public API to at least 10 todos with at least 3 done, so the audit sees the done styling and every card's Edit and Delete buttons. It printed: 280 todos, 277 active and 3 done.

| Run | Scheme confirmed | Accessibility | Passed | Failed | Not applicable | Manual (not scored) | Best practices |
|---|---|---|---|---|---|---|---|
| mobile, light | light | 100 | 24 | 0 | 42 | 10 | 100 (13 passed, 0 failed) |
| mobile, dark | dark | 100 | 24 | 0 | 42 | 10 | 100 (13 passed, 0 failed) |
| desktop, light | light | 100 | 24 | 0 | 42 | 10 | 100 (13 passed, 0 failed) |
| desktop, dark | dark | 100 | 24 | 0 | 42 | 10 | 100 (13 passed, 0 failed) |

`pnpm perf:lighthouse` exited 0. No accessibility audit failed in either scheme on either form factor. Two more audits apply than in epic 1 (24 passed, against 22), on a list whose cards now carry buttons and done states. The 10 manual items are `focusable-controls`, `interactive-element-affordance`, `logical-tab-order`, `visual-order-follows-dom`, `focus-traps`, `managed-focus`, `use-landmarks`, `offscreen-content-hidden`, `custom-controls-labels` and `custom-controls-roles`. The keyboard pass below checks the focus ones (tab order, no trap, focus moved by the app). There are no custom controls: every control is a native checkbox, button or textarea, and the page has one `<main>`.

**What Lighthouse sees:** only the loaded list, the page as it opens. Edit mode, the Delete confirm, the empty, loading and error panels, and the Announcer's messages are never in front of Lighthouse. Those states are audited by axe in the e2e suite, below, with the same WCAG rules in light and dark.

## axe-core in the e2e suite

Every e2e test scans with axe at each key state it reaches, in all three Playwright projects, with the AD-20 tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, and fails on any violation (`e2e/axe.ts`). `desktop` and `phone` (Pixel 7) run in light, and `desktop-dark` in dark. Each project emulates reduced motion, except `motion.spec.ts`, which scans only once no animation is running. `scripts/axe-coverage.mjs`, the `axe coverage` step of `pnpm test:all`, fails the run when a passed e2e test ran no scan.

States scanned, in each project:

| Spec | Tests | Scans | States |
|---|---|---|---|
| `todos.spec.ts` | 1 | 4 | loaded, added, reloaded, new session |
| `validation.spec.ts` | 8 | 8 | empty submit, two-line paste joined, mid-text paste, two-line drop joined, keyCode 229 Enter added, keyCode 229 Shift+Enter, composed word added, over limit |
| `add-failure.spec.ts` | 4 | 6 | add failed (twice), response lost and text restored, lost add resubmitted, stalled add gave up, stalled add resubmitted |
| `complete.spec.ts` | 7 | 8 | done, reopened, done by pointer, complete failed (twice), reopen failed (twice), deleted elsewhere |
| `edit.spec.ts` | 8 | 9 | edit mode, edit saved, edited by pointer, edit empty, edit keyCode 229 Shift+Enter, edit two-line drop joined, edit failed (twice), deleted elsewhere while editing |
| `delete.spec.ts` | 4 | 5 | delete confirm, deleted, deleted by pointer, delete failed (twice) |
| `list-states.spec.ts` | 3 | 8 | empty, list after the first add, then list error, loading after Try again and list after Try again (twice each) |
| `refresh.spec.ts` | 2 | 2 | refresh failed, refresh failed offline |
| `offline.spec.ts` | 1 | 1 | offline |
| `motion.spec.ts` | 1 | 1 | added with motion, once no animation runs |
| **Total per project** | **39** | **52** | |

Result from `pnpm test:all` on 2026-11-25: 117 e2e tests passed (39 per project) with 156 scans (52 per project). **0 axe violations** in any scanned state in any project. The `axe coverage` step reported 117 passed tests scanned and 0 without a scan. E8 is covered by 78 passing tests across the three projects (`coverage/scenarios.md`).

## Keyboard and accessibility-tree pass (Flow 2)

`pnpm a11y:pass` (`e2e/a11y/keyboard-pass.mjs`): Chromium at 1280×720, light, reduced motion. Every input is a key press or typed text, never a click. It adds a todo of its own ("Pay rent …") before loading the page, so the delete in step 6 leaves a row below and never empties the list. Descriptions carry a run stamp (`mwwq8u0jhqz` in this run), shown below as `…`. It exited 0. The transcript, condensed (focus is given as role "name", description, states):

| Flow 2 step | Key | Focus after it | Live regions |
|---|---|---|---|
| 1 | (load) | `<body>` (no autofocus); title "BMad Todos", heading "BMad Todos" | none |
| 1 | Tab | textbox "New todo", description "0/200 Press Enter to add.", multiline | |
| 2 | type, Enter | textbox "New todo", description "0/200 Press Enter to add." (the field cleared, the card on top) | Announcer: "Added “Send invoice …”." |
| 3 | Tab | button "Add" | |
| 3 | Tab | checkbox "Send invoice …", checked=false | |
| 3 | Space | checkbox "Send invoice …", checked=true | none |
| 3 | Space | checkbox "Send invoice …", checked=false | none |
| 3 | Space | checkbox "Send invoice …", checked=true | none |
| 4 | Tab | button "Edit “Send invoice …”" | |
| 4 | Enter | textbox "Edit description", description "24/200 Press Enter to save.", the whole text selected | |
| 4 | type, Enter | button "Edit “Send March invoice …”" | none |
| 5 | Enter | textbox "Edit description", description "30/200 Press Enter to save." | |
| 5 | Escape | button "Edit “Send March invoice …”" | |
| 5 | (read back) | the server holds "Send March invoice …", completed=true | |
| 6 | Tab | button "Delete “Send March invoice …”" | |
| 6 | Enter | button "Cancel", inside group "Delete this todo? Send March invoice …" | |
| 6 | Escape | button "Delete “Send March invoice …”" | |
| 6 | Enter | button "Cancel" | |
| 6 | Shift+Tab | button "Delete “Send March invoice …”", the Confirm delete button inside the group | |
| 6 | Enter | checkbox "Pay rent …", checked=false (the next todo's check; the row is gone) | Announcer: "Deleted “Send March invoice …”." |
| Failure | Tab, Enter | textbox "Edit description" on "Pay rent …", description "20/200 Press Enter to save." | |
| Failure | paste 230 characters (ControlOrMeta+V, Meta on this Mac) | textbox "Edit description", description "230/200 , over the character limit Press Enter to save.", invalid=true | Field status (edit): "over the character limit" (once) |
| Failure | Enter | the same textbox, invalid=true; the field still holds 230 characters | Field status (edit): emptied, then "over the character limit" |
| Failure | Backspace ×30 | textbox "Edit description", description "200/200 Press Enter to save.", not invalid | Field status (edit): emptied (silent) |
| Failure | Enter | button "Edit “… long text …”", the saved 200 characters | none |
| After | 2 s of quiet, then read back | the deleted todo is gone; "Pay rent …" is stored as the 200 characters | none (no late failure or rollback) |

The card's aria snapshot at each state:

- **Active or done:** `listitem` with `checkbox "{text}"` (`[checked]` when done), the text, `button "Edit “{text}”": Edit` and `button "Delete “{text}”": Delete`. The Done chip is not in the tree, and the checkbox's name is the text alone in both states.
- **Edit mode:** the checkbox, still named by the saved text, then the hidden label "Edit description", `textbox "Edit description"`, the counter and hint as text, an empty `status` (the Field status), `button "Save"` and `button "Cancel"`.
- **Delete confirm:** the checkbox and the text, then `group "Delete this todo? {text}"` holding the prompt, `button "Delete “{text}”": Delete` and `button "Cancel"`.

Judged against EXPERIENCE Flow 2 and the Accessibility Floor:

- **Every Flow 2 step happened as written,** by keyboard alone, with the descriptions as Chromium joins them (A4): the heading and the add field's name and description (step 1), the add with focus kept in the cleared field and "Added" spoken (2), the check's name and state through three toggles (3), Edit with the text selected, the save, and focus back on the renamed Edit (4), Escape cancelling an edit (5), the confirm opened on Cancel in its named group, Escape back to Delete, Shift+Tab to Confirm delete, and focus on the next todo's check with "Deleted" spoken (6). The failure path heard "over the character limit" once on crossing and again on the blocked Enter, saved nothing, cleared silently on the trim, and saved on Enter. Every change the keys made was read back from the server (after step 5 and at the end), and no failure or rollback was announced in 2 s of quiet after the last key.
- **Focus** followed the Focus management table at every key and never fell to `<body>`. Tab order matched the IA table: the add field, Add, then per card the check, Edit and Delete. Escape left both the Edit form and the Delete confirm, so neither traps focus. The pass walks Flow 2's keys only: it never presses the forms' Save or Cancel buttons (Enter and Escape do their work), never leaves a form with Tab, and runs at desktop width in light with reduced motion. Phone width and dark are covered by the e2e suite's keyboard and axe tests in its `phone` and `desktop-dark` projects (E8), not by this pass. The motion-on delete, where the deleted row stays as an inert, `aria-hidden` Leaving copy while focus moves on, is not walked in a browser by this pass or by e2e (`motion.spec.ts` covers only the add); component tests cover it (K4 "the Leaving row is inert and aria-hidden…", K6 "Confirm delete skips a Leaving row…"). The empty-list case of the after-delete rule (focus to the add field) is not walked, because the pass never empties the list. Component tests K6 cover it ("Confirm delete by keyboard on the only row sends focus to the add field").
- **Names and roles:** native elements throughout (checkbox, buttons, textareas, a list of list items, one group, one `<main>`, one `<h1>`). Edit, Delete and Confirm delete names start with their visible label and quote the full text (2.5.3), and so does the 200-character name in the failure path, uncut. The add field is named by its visible label "New todo".
- **States:** `checked` changed at once on every Space. `aria-invalid` was set while over the limit and cleared at 200. Edit, complete and reopen announced nothing, as Voice and Tone says ("the list shows it").
- **Live regions:** the pass records every live region (`role` status, alert or log, or `aria-live`). In Flow 2 the only messages were "Added", "Deleted" and the Field status's over-limit line, each exactly once. The Announcer said nothing that Flow 2 does not expect (the script fails if it does, or if a message comes twice), and no message moved focus. Flow 2 has no failures, so the app's other messages (a failed complete, reopen, edit or delete, "was deleted elsewhere", a refresh failure, and the Loading status's lines) are not heard in this pass. The e2e and component tests assert each of them in its live region (E6, K5, K7), and the e2e ones scan that state with axe.

## Findings

Lighthouse found no failing accessibility audit in either scheme on either form factor, axe found no violation in any scanned e2e state in any project, and the keyboard and tree pass met every Flow 2 expectation. A1 and A2 are epic 1's findings with today's status.

| # | Finding | Status | Change or reason |
|---|---|---|---|
| A1 | Lighthouse, by default, follows the OS colour scheme, so on a host in dark mode the "light" run audited the dark theme. | fixed | Fixed in epic 1: `e2e/perf/lighthouse.mjs` forces each scheme and probes it before each run. All four runs above confirmed their scheme. |
| A2 | The keyboard and screen-reader pass of every core action had not been done. | fixed | Done in this story as `pnpm a11y:pass`, a committed keyboard-only and accessibility-tree pass of Flow 2 and its failure path, which anyone can rerun. Every step met EXPERIENCE (above). The part an agent cannot do is A3. |
| A3 | No real screen reader was driven, so the speech itself and the Accessibility Floor's "Expected, not bugs" list are unchecked. | accepted | No agent can drive a real screen reader (decision 2026-11-25, the ticket's Notes). The tree pass checks everything a screen reader is given. The person's own check is the dated pending line under Scope. Any failure it finds becomes a new bug. |
| A4 | Chromium joins a field's description parts with a space and no punctuation: "0/200 Press Enter to add." where EXPERIENCE writes "0/200, Press Enter to add.", and over the limit "230/200 , over the character limit" with a space before the comma. | accepted | The counter, its hidden over-limit suffix (a `.visually-hidden` span, absolutely positioned) and the hint are separate elements in `aria-describedby`, and Chromium joins them with spaces. The words and their order are what EXPERIENCE specifies. Whether a screen reader pauses between the parts, or voices the stray space, is part of the person's pending check (A3); if it reads them as one run-on phrase, that becomes a new bug. |
| A5 | In edit mode, the hidden label "Edit description", the counter and hint, and the empty Field status show as items in the card's tree. | accepted | They are the field's label, its description and its live region (EXPERIENCE Static strings, Field status), and the tree must hold them for the names, the description and the announcements to work. In browse mode a screen reader reads a label before its field, which is the usual pattern. |

Every finding is fixed or accepted. R14's automated checks pass with no violation, and the keyboard and tree pass covers every core action. What is left is the person's optional screen-reader check, above.
