# Validation Report — BMad Todos (Todo App v1)

- **DESIGN.md:** `_bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md`
- **Run at:** 2026-11-24

## Overall verdict
The pair is close to a clean build contract. All 74 colour tokens are hex with complete light/dark pairs, every `{token}` reference in both files resolves, every recomputed contrast figure matches the table, component names line up one-to-one across both spines, and every memlog decision is carried through, including the late changes to not-found handling and the storage-unavailable wording. What remains is mostly about the Announcer's position in the page flow. It can be off-screen when a failure happens below the fold, and a late delete-success banner shifts the list under the user's finger when delete can't be undone. Each needs a committed rule before UI stories start. The medium findings are local fixes: one uncovered contrast pair, one flow climax that contradicts the replacement rule, a motion rule that forbids the approved motion, and three state gaps.

The two extra lenses shift that picture. The accessibility lens raises 4 critical findings that would ship real WCAG 2.2 AA failures: a silent empty-submit error, an irreversible and unconfirmed delete (3.3.4), a dark-mode done check below 3:1 in edit mode, and a skeleton that can breathe forever. The spine-consistency lens raises 3 high findings that force a builder to reinterpret AD-9, AD-11 or AD-13, and it judges 2 of the 5 Winston flags inaccurate. Taken together, the spines are not yet build-ready. The blockers cluster around four areas: the Announcer, delete, live regions and the add path.

## Category verdicts
- Flow coverage — adequate
- Token completeness — adequate
- Component coverage — strong
- State coverage — adequate
- Visual reference coverage — pending
- Bloat & overspecification — adequate
- Inheritance discipline — strong
- Shape fit — strong

## Findings by severity

### Critical (4)

**[Accessibility]** — Empty-submit error is a silent status message (WCAG 4.1.3, 3.3.1) (§ EXPERIENCE.md § Component Patterns — Add form, Inline error, Save button; § Interaction Primitives — Focus management "Add (invalid)", "Save or Enter (invalid)")
On an empty Add/Save, focus stays in the field and "Enter a description." appears, but the only link is that it is added to `aria-describedby`. NVDA, JAWS and VoiceOver do not re-announce a description that changes on an already-focused field, so a screen-reader user who presses Enter hears nothing. A second empty submit, or Enter while over the limit (Flow 2 failure path: "Enter saves nothing"), is just as silent, because nothing in the DOM changes. AD-8 keeps field errors out of the Announcer, so the spines need a field-local mechanism, and today only the over-limit *crossing* has one.
Fix: Give each field a field-local polite region that is always mounted and starts empty (reuse the over-limit region). On every blocked submit, write "Enter a description." or "Over the character limit, {n}/200", clearing it first so a repeat is announced again. Keep `aria-describedby` for when focus returns to the field. Mark the inline-error "!" icon `aria-hidden`. Add an e2e/component assertion that the region text changes on each invalid submit.

**[Accessibility]** — Delete is neither reversible, checked nor confirmed (WCAG 3.3.4) (§ EXPERIENCE.md § Component Patterns — Delete button; § Inspiration & Anti-patterns "Confirm dialogs and undo"; ticket Boundaries vs R14)
The criterion is AA and covers pages that "modify or delete user-controllable data in data storage systems". A todo deleted from the server's SQLite store is exactly that, and the spine makes delete immediate "with no confirm and no undo (R5)". The ticket's Boundaries (no undo, no confirm) therefore conflict with its own R14. The risk is raised by a 40–44px Delete sitting 8px from Edit, and by the Announcer appearing above the form and shifting every card down by a banner's height during a background refetch failure. A mis-tap then destroys data permanently.
Fix: This needs a product decision from the user/PO, not a UX workaround. The lightest compliant option is "Reversible": an "Undo" button in the existing "Deleted “{t}”." status announcer that re-creates the todo with its original id, text, completed flag and position. That position requires the server to accept or keep `createdAt`, so raise it with Winston (AD-6/AD-7). The alternative is to record an explicit, owned risk acceptance against R14.

**[Accessibility]** — Dark-mode done check fails 1.4.11 while the todo is in edit mode (§ DESIGN.md § Components — Todo card "Edit" state, Completion check "Checked"; § Colors — contrast table)
Edit mode forces the **active** card treatment "even for a done todo", so the checked circle (`border-done-check-dark` #666B8A, fill `surface-done-check-dark` #1C1E2B) sits on `surface-card-dark` #22253A. Edge vs card is **2.90:1** and fill vs card is 1.10:1, so the control's boundary is below 3:1. The pair is missing from the contrast table, which only checks the done check on the page (3.56).
Fix: Pick one: give the checked circle a dark edge of at least 3:1 on both the page and the card (e.g. `border-done-check-dark` ≈ #7A7FA0 or lighter, then re-verify against the page and its own fill), or render the check's checked style with `border-check`/`glyph-done-check` while the card is in edit mode. Then add "`border-done-check` on `surface-card` (edit mode)" to the table: light 3.61, dark must be ≥3.0.

**[Accessibility]** — The skeleton breathes forever with no pause, stop or hide (WCAG 2.2.2) (§ DESIGN.md § Components — Skeleton card; frontmatter `motion.duration-skeleton`; EXPERIENCE.md § Motion "Loading", Rules)
The skeleton breathes `infinite`. The add form is usable during loading, so the "essential pre-load" exception does not apply, and the spines set no fetch timeout. A slow or hung first load leaves pulsing content running alongside interactive content for well over 5 s. That is likely on Flow 4's train and on Flow 3's cold start after a deploy. Honouring `prefers-reduced-motion` is not a pause mechanism for users who have not set it.
Fix: Cap the breathing below 5 s (e.g. `animation-iteration-count: 3` at 1.6 s = 4.8 s, then rest at opacity 1). Optionally add a first-load timeout that falls through to the List error panel.

### High (10)

**[State coverage]** — The Announcer is off-screen when a failure happens below the fold (§ EXPERIENCE.md › Component Patterns › Announcer; Interaction Primitives › Focus management; DESIGN.md › Elevation & Depth)
The Announcer sits in normal flow above the add form, with "no… sticky bars", and it never moves focus. On a list longer than one screen, a failure on a card below the fold is explained in a banner the user can't see. The only on-screen cue is a revert flag that lasts 1.2s. That is exactly what AD-14 exists to prevent ("failures a sighted user never sees"), and it undercuts R7's "a message says so".
Fix: Commit a rule for an out-of-view Announcer. Options include making it sticky to the viewport top while it holds a message (with a matching Elevation exception), scrolling it into view without moving focus, or adding a persistent per-card marker until the next message. Then add a state row for it.

**[State coverage]** — A late delete-success banner shifts the list under the user's finger (§ EXPERIENCE.md › State Patterns › Delete succeeded; Motion › Announcer in; DESIGN.md › Brand & Style)
Delete success is announced "on server confirmation, not on press" ([ASSUMPTION]), so the banner appears roughly 100–300ms after the tap and pushes the add form and the whole list down by its height (about 130px on a phone, with Dismiss stacked). That happens while the deleted card is collapsing and the cards below move up. A user deleting several todos in a row on a phone can land the next tap on a different card's Delete. Delete is immediate with no undo (R5), so the mis-tap destroys data. Nothing in State Patterns or Motion addresses the layout shift.
Fix: Commit a no-shift rule. Options include announcing delete success optimistically on press, so the banner's growth coincides with the collapse; holding the banner's slot open once shown until Dismiss; or ignoring pointer-down on list buttons for the duration of a shift. Then state it in Motion › Rules.

**[Accessibility]** — The Announcer's live-region mechanics break real screen readers (4.1.3) (§ EXPERIENCE.md § Component Patterns — Announcer, Character counter; DESIGN.md § Components — Announcer)
Three gaps. **Hidden region:** "Nothing is drawn and it takes no space" invites `display:none`, `hidden` or conditional mounting; a region that becomes rendered in the same tick as its text is often not announced, especially the first message, in Chrome+NVDA and Safari+VoiceOver. **Atomic content:** `role="status"` is implicitly `aria-atomic="true"`; if the "!" icon and the Dismiss button sit inside the region, every message is read as "exclamation mark … Dismiss, button". **Repeats:** a message identical to the current one does not change the DOM and is not re-announced. The over-limit region has the same repeat problem when the text crosses 200 a second time.
Fix: Specify that the live element is always mounted and exposed (collapse only the visual chrome, never with `display:none`, `visibility:hidden` or `hidden`); that it wraps **only** the message text, with icons `aria-hidden` and Dismiss outside it; that a new message clears the region and sets the text on the next frame so repeats are spoken; and that the over-limit region is cleared after each announcement. Drop the redundant `aria-live="polite"` beside `role="status"`, or keep it knowingly.

**[Accessibility]** — A visually hidden 1px native checkbox fails touch screen readers (§ DESIGN.md § Components — Completion check; EXPERIENCE.md § Component Patterns — Completion check; memlog assumption)
With the usual clip-to-1px pattern, explore-by-touch on the 26px circle in VoiceOver iOS and TalkBack finds nothing focusable, because the SVG is `aria-hidden` and the label has no name. VoiceOver also draws its cursor around a 1px dot, and on some engines double-tap activation lands off-target. A manual pass on a phone (Flow 1, R8) would fail to find or toggle the check by touch.
Fix: Keep the native input but make it `opacity:0; position:absolute; inset:0; margin:0` over the full 44×44 hit area, with `appearance:none` if needed. It then is the touch target, the explore-by-touch target and the AT focus rectangle. Keep the decorative SVG beneath it, styled through `input:checked + svg` and `input:focus-visible + svg`.

**[Accessibility]** — A successful add is silent for screen-reader users (§ EXPERIENCE.md § Voice and Tone — Overrides "Add … succeeded: No message"; § Key Flows — Flow 2)
Enter clears the field, the card appears out of view, focus stays put and nothing is announced. The user cannot tell success from a no-op or from the silent empty-submit above. Flow 2 step 2 ("The card is on top") is not something Tomás can perceive, so the manual R14 pass will flag it. Complete and edit are fine: the checkbox state and the renamed Edit button confirm them.
Fix: Announce "Added “{t}”." either through the Announcer's status variant (visible, so it reverses the user's "delete only" decision) or through the field-local hidden polite region (needs Winston to confirm under FLAG 5 that AD-14 permits it). Take the choice to the user; either way, add it to Flow 2.

**[Accessibility]** — The add field's accessible name does not contain its only visible label (2.5.3, 3.3.2) (§ EXPERIENCE.md § Voice and Tone — Static strings "Text field (add)"; § Key Flows — Flow 2 step 1)
The only visible text labelling the field is the placeholder "Add a todo…", but the accessible name is the hidden label "New todo". Voice Control and Dragon users who say "click Add a todo" get no match. The placeholder also vanishes once typing starts, leaving no visible label at all.
Fix: Make the hidden label match the visible text: "Add a todo", with the placeholder "Add a todo…". Better still, consider a small persistent visible label. Update Flow 2's expected speech.

**[Accessibility]** — A failed edit throws away what the user typed (likely 3.3.7 Redundant Entry) (§ EXPERIENCE.md § State Patterns — Row states "Reverted", Add form states "Add failed"; § Voice and Tone — `edit` lead)
On edit failure the card reverts and the draft is discarded, and the message quotes the *pre-edit* text. Retrying means retyping the whole edit. A failed add whose field is no longer empty loses its text too, except for a 40-character truncated quote in the banner.
Fix: Keep the failed draft per todo. The next Edit on that row opens pre-filled with the failed draft, with the saved text one Cancel away. For add, keep the failed text available: offer it into the field once it is next empty, or quote it in full in the announcer, since the announcer has no length limit.

**[Spine consistency]** — A refresh failure overwrites the mutation-failure message (§ EXPERIENCE Component Patterns › Announcer, State Patterns › Refresh failed, Flow 4 ↔ AD-13, AD-11, AD-14, E6)
EXPERIENCE's Not-found row relies on AD-13 refetching after a *failed* mutation. When the network is down, that invalidation refetch fails at once. AD-11 sends the refresh failure to the announcer, and EXPERIENCE says "A new message replaces the current one". So "Couldn't mark “Pay rent” done…" is replaced almost immediately by "Couldn't refresh the list…". Two polite updates in quick succession also risk the screen reader dropping the first one. This breaks Flow 4 steps 2–4 and its climax, and makes E6 ("a message explains the failure") flaky under `page.route` abort.
Fix: A UX priority rule within AD-14: a refresh failure never replaces an unacknowledged mutation-failure message (it is dropped or appended). Also flag for Winston: proposal that AD-13 invalidates after a failed mutation only for `not-found`, or that AD-14's announcer API state the priority.

**[Spine consistency]** — Adding while the list is in its Error (or Loading) state, then failing, gives a false Empty state (§ EXPERIENCE State Patterns › Error, Add during first load; Component Patterns › Add form ↔ AD-11, AD-13, R9)
The add form stays usable in the Error state. The optimistic add seeds the absent cache, `[todo]`, so the List error panel disappears. The add fails, the helper reverts that todo, leaving `[]`, so the Empty panel shows "No todos yet." The invalidation refetch fails too (still offline). AD-11 now forbids the error state because cached data exists. The user who was told "Couldn't load your todos" now sees "No todos yet". This breaks R9, the Flow 4 failure path ("not an empty list") and K5. The same chain runs from the Loading state if the add fails.
Fix: Flag for Winston. Proposal: define AD-11's "cached data" as data from a successful server fetch (e.g. `dataUpdatedAt` from a fetch, or a `loadedOnce` flag). While none exists, the helper keeps optimistic adds in a separate pending list that renders above the skeletons or the List error panel, instead of seeding `['todos']`. UX change: add State rows for "Add during Error" and "Add fails before the first load succeeded".

**[Spine consistency]** — Network errors get their own wording, but AD-9 classes them as generic (§ EXPERIENCE Voice and Tone › Reasons, Flow 3 failure path, Flow 4 ↔ AD-9, AD-14, AD-4)
AD-9: "The client treats a non-2xx response without a problem body, **or a network error**, as a generic failure". AD-14 keys `messages.ts` by problem `type` and action "with a generic fallback". EXPERIENCE adds a `network` reason separate from the generic one, so a builder would need a non-problem key that AD-9 doesn't define. AD-4 makes it worse: when the API is down, nginx answers with a problem, not a network error; when the host or tunnel is down, Cloudflare answers with HTML, so the generic reason applies. Flow 3's "the server is unreachable… Check your connection" is the wrong copy.
Fix: Flag for Winston. Proposal: amend AD-9 and AD-14 to name `network` (fetch rejected or aborted) as a client-side failure kind in `messages.ts`, beside the generic fallback. UX change: rewrite Flow 3's trigger as "the phone is offline", or show the server-unavailable reason.

### Medium (25)

**[Flow coverage]** — Flow 4's climax contradicts the message-replacement rule (§ EXPERIENCE.md › Key Flows › Flow 4, steps 5–6; Component Patterns › Announcer)
Flow 4's climax ("Jun reads one message that names the exact todo and why… nothing was lost silently") contradicts the committed rule that a new message replaces the current one. After step 5 the banner holds only the `refresh` message, which names no todo. The complete and delete failures from steps 2–3 were overwritten, and their 1.2s revert flags are long gone. Because e2e scenarios are derived from flows, a test written from this climax would assert something the spec forbids.
Fix: Rewrite the climax to what actually holds: the list never vanished, each failure was announced when it happened, and the latest message is on screen. Alternatively, decide explicitly that a `refresh` failure must not replace a pending mutation-failure message.

**[Flow coverage]** — Focusing the add field opens the phone keyboard after Dismiss, Try again and the last delete (§ EXPERIENCE.md › Interaction Primitives › Focus management (Delete, Dismiss, Try again))
Focus moves to the Text field (add) after Dismiss, after Try again and after deleting the last todo. On a phone, focusing a textarea from a tap handler opens the soft keyboard, which covers half the screen when the user only meant to close a banner. Flow 1 step 9 (phone, deletes the last todo) and Flow 4 step 7 (phone, taps Dismiss) both trigger it, but neither flow mentions it.
Fix: Choose a target that doesn't open the keyboard, such as the first Completion check, the list, or `<main>`/`<h1>` with `tabindex="-1"`, or state that the keyboard opening is accepted. Then reflect the result in Flows 1 and 4.

**[Token completeness]** — Dark-mode done check in edit mode is 2.90:1, and the pair is missing from the contrast table (§ DESIGN.md › Components › Todo card › Edit; Colors › Contrast table)
A completed todo in edit mode takes the **active** card treatment ([ASSUMPTION], "so the field and buttons keep their verified contrast"), but its Completion check stays checked. The checked edge `border-done-check-dark` (#666B8A) on `surface-card-dark` (#22253A) is **2.90:1**, under the 3:1 target for the checkbox boundary that DESIGN.md itself sets. The checked fill against the card is 1.10. Light mode passes at 3.61. Flow 2 reaches this state directly: it checks "Send invoice", then edits it. axe won't catch non-text contrast, so it would surface only in the manual R14 pass.
Fix: Add the pair to the table and either lighten `border-done-check-dark` to at least 3:1 on both `surface-page-dark` and `surface-card-dark`, or use `border-check` for the checked edge while in edit mode.

**[Token completeness]** — Optical offsets and glyph sizes exist only in prose, against the no-hard-coded-px rule (§ DESIGN.md › Layout & Spacing › Optical offsets; Components › Announcer, Inline error, Character counter, Done chip; Do's and Don'ts row 8)
The Do's and Don'ts ban hard-coded px in component CSS ("Read every value from tokens… Don't hard-code hex, px or ms"), yet several values exist only in prose with no token: optical offsets (−9px check margins, 1px text top padding, 7px wide-layout nudge, −2px edit-mode nudge), the announcer icon glyph (14px/800, 4px nudge), the inline-error glyph (12px/800), the warning-triangle stroke (1.8), and the Done chip's 1px raise. A builder must either break the rule or invent token names, and three builders will invent three different sets.
Fix: Add these to the relevant `components.*` entries (e.g. `completion-check.margin: -9px`, `todo-card.text-nudge-wide: 7px`), or narrow the Don't to say that optical nudges listed in prose may be literal.

**[State coverage]** — The render for Add during first load is undefined (§ EXPERIENCE.md › IA › Regions row 5; State Patterns › Add during first load)
The IA says the list area shows **exactly one** of the list, Empty panel, skeleton list or List error panel, and the State Patterns row only says the list "must not look emptied". FLAG 4 asks Winston about the data path, but which blocks render (new card above the skeletons? skeletons kept until the load resolves?) is a UX decision the builder still needs.
Fix: Specify the render, e.g. "the optimistic card renders at the top of the skeleton list, and skeletons stay with `aria-busy` until the first load settles", and relax "exactly one" to allow it.

**[State coverage]** — An identical repeated message is not re-announced (§ EXPERIENCE.md › Component Patterns › Announcer; State Patterns › Announcer states)
Replacing an Announcer message with identical text, such as the same complete failure twice in a row, changes nothing in the live region. Screen readers won't re-announce it, and sighted users see no change apart from the brief flag. That's a known live-region pitfall, and nothing tells the builder to handle it.
Fix: Add a rule that a repeated message is re-announced, for example by clearing the region for one frame before setting it or by keying the text node per message, and that the banner gives a visual cue.

**[Bloat & overspecification]** — The motion rule forbids the approved motion (§ DESIGN.md › Brand & Style ¶3; Do's and Don'ts last row; EXPERIENCE.md › Motion › Complete, Revert)
DESIGN.md Do's say "Animate only opacity, transform and grid-row height", and Brand & Style says "opacity, transform and height only". But the approved Complete motion (m2) eases the card from filled to hollow (background-color, border-color), fills the circle and draws the tick (`stroke-dashoffset`). The revert flag pulses an outline, and the revert eases colours back. A builder can't satisfy both.
Fix: Reword the rule to "no layout properties except grid-row height; colour, opacity, transform and `stroke-dashoffset` may transition", and keep the ban on animating width, height, top or margin directly.

**[Accessibility]** — The hidden Loading status will not speak on first load, and chatters on fast loads (§ EXPERIENCE.md § Component Patterns — Loading status; § Key Flows — Flow 3)
It is created already holding "Loading your todos" in the first React commit, and live regions that are born with content are generally not announced. Flow 3 step 2 ("Screen readers hear 'Loading your todos'") is therefore not reliable. On a fast load the text may instead be queued and spoken after the list has rendered.
Fix: Mount the status empty. Set the text only if loading is still in flight after about 500 ms, and clear it on success. State this in the spine and correct Flow 3's wording.

**[Accessibility]** — Focus hand-offs can drop to `<body>` for a frame (§ EXPERIENCE.md § Interaction Primitives — Focus management; § State Patterns — Leaving)
Delete sets the row `inert` and `aria-hidden` "at once", and m5b unmounts the focused Edit button "at once". If React applies `inert` or removes the button before the focus call runs in an effect, focus drops to `<body>` and NVDA/JAWS may announce the document or "blank" before the target.
Fix: Specify the order: move focus first, in the event handler or with `flushSync` and `useLayoutEffect`, then apply `inert`/`aria-hidden` or unmount. Add a component test asserting `document.activeElement` is never `body` across delete and edit enter/exit.

**[Accessibility]** — Enter submits from a control that screen readers announce as "multi line" (§ EXPERIENCE.md § Component Patterns — Text field; § Interaction Primitives — Keyboard map)
NVDA ("edit multi line"), JAWS and VoiceOver ("text area") lead users to expect Enter to add a new line. Here it submits, which may be premature, and nothing explains it. Phone keyboards show a "return" key.
Fix: Add `enterkeyhint="done"` to both fields. Include "Enter adds" or "Enter saves" in the field's hidden description, or accept the risk explicitly and script it into the manual pass. Do not paper over it with `aria-multiline="false"` on a `<textarea>`. Make the IME guard tolerate Android Gboard, where every word is composing, so that Enter still submits there.

**[Accessibility]** — VoiceOver drops list semantics from `<ul>` with `list-style: none` (§ DESIGN.md § Components — Todo list; EXPERIENCE.md § Information Architecture row 5)
Safari/WebKit removes list semantics from an unstyled list, so "Todos, list, 3 items" will not be spoken in VoiceOver on macOS or iOS.
Fix: Add an explicit `role="list"` on the Todos `<ul>`. Make the skeleton container `aria-hidden` as a whole rather than an empty `aria-busy` list. `aria-busy` is barely supported, and the Loading status already carries the state.

**[Accessibility]** — axe-core in every e2e will be flaky over opacity animations (§ EXPERIENCE.md § Motion; § Accessibility Floor — axe row; arch AD-20)
axe computes contrast through opacity. A scan during m5b's 120 ms fade, the Done chip fade, a card's done transition or the add enter animation can report spurious `color-contrast` violations, or "needs review".
Fix: Run e2e with `reducedMotion: 'reduce'` emulated, which the spine already makes instant, and run at least one axe scan per mode in both `colorScheme: 'light'` and `'dark'`. Otherwise, wait for `getAnimations()` to settle before each scan.

**[Accessibility]** — The dark-mode loading cue is nearly invisible to low-vision users (§ DESIGN.md § Colors — decorative pairs; § Components — Skeleton card)
Skeleton on card is 1.11:1, card on page 1.23:1 and hairline on page 1.77:1. There is no visible loading text, and under reduced motion there is no breathing either. A low-vision sighted user sees an apparently empty page, which some auditors treat as a 1.4.11 "graphical object required to understand" issue.
Fix: Either document the skeleton as purely decorative with the hidden status as the sole carrier, an accepted risk, or raise `skeleton-dark` and the skeleton card edge toward 3:1 against the card and page.

**[Accessibility]** — The announcer's entry shifts content under the user's finger or pointer (§ DESIGN.md § Components — Announcer; EXPERIENCE.md § Motion "Announcer in")
A background refresh failure inserts a banner above the add form and pushes every card down mid-interaction. With an irreversible delete one tap away, that invites wrong-target activation, a motor and cognitive risk.
Fix: Resolve this together with the 3.3.4 decision: undo removes the harm. Otherwise ignore pointer activations on card buttons for about 300 ms after a layout shift, or reserve the banner's space while a refetch is in flight.

**[Accessibility]** — The fixes above depend on FLAG 5, which is still open (§ EXPERIENCE.md § Architecture flags — FLAG 5)
The over-limit region, the Loading status and the regions proposed in the critical and high findings all assume that AD-14's "one region" scopes to outcome messages only. If Winston rules the other way, the over-limit and empty-submit announcements lose their mechanism.
Fix: Close FLAG 5 before stories are cut, and name each field-local region in the spine (field-status region: validation only).

**[Spine consistency]** — A failed create leaves its queued follow-ups undefined (§ EXPERIENCE State Patterns › Not found, Delete 404, Add failed ↔ AD-13, U5)
The UX lets the user edit, complete or delete an optimistic todo while its `POST` is pending. AD-13 and U5 hold those requests until the create settles, but say nothing about what happens when it *fails*. If the queue is sent, `PATCH` returns `404` and the UX says "“{t}” was deleted elsewhere." — false, and it replaces "Couldn't add". `DELETE` returns `404`, and "Deleted “{t}”." replaces "Couldn't add".
Fix: Flag for Winston. Proposal: when a create fails, the helper drops that todo's queued mutations silently. UX change: add a Row-state line saying that only "Couldn't add" is announced.

**[Spine consistency]** — The revert flag depends on a signal the helper doesn't provide (§ DESIGN Todo card › Revert flag; EXPERIENCE Row states › Reverted ↔ AD-13, AD-11, AD-7)
The 1.2s danger outline must appear on the card the helper just reverted, and a failed delete re-mounts that card already flagged. AD-13 lists only "revert and announce". AD-11 limits components to the hooks, and the wire `Todo` shape is fixed (AD-7).
Fix: Flag for Winston, folded into flag 3. Proposal: the todos hooks expose `revertedAt(id)` (or an event), kept outside the `Todo` objects in the cache.

**[Spine consistency]** — There is no retry policy for the query (§ EXPERIENCE Component Patterns › Try again; State Patterns › Error, Refresh failed ↔ AD-11, AD-13)
"No automatic retry (AD-13 spirit)" stretches AD-13, which binds the mutation helper only. TanStack retries a failed query three times by default, with backoff, so the List error panel and the refresh failure would arrive about 7s late, and every window-focus refetch adds more retries.
Fix: Flag for Winston. Proposal: AD-11 states `retry: false` for `['todos']` and fixes `refetchOnWindowFocus`. Without that, the UX's timing is undefined.

**[Spine consistency]** — The problem type nginx emits is unspecified, so `storage-unavailable` is nearly unreachable (§ EXPERIENCE Voice and Tone › Reasons ↔ AD-4, AD-6, AD-9)
AD-6 lists no `503` on any todo route. `storage-unavailable` comes only from `/api/health`. nginx's 502/503/504 problem (AD-4) has no named `type`, so "The server isn't available right now." appears only if nginx happens to use that type.
Fix: Flag for Winston. Proposal: AD-4 names `/problems/storage-unavailable`, or another member of the closed set, for nginx upstream failures.

**[Spine consistency]** — C3: the UX asks for a hand-rolled presence layer and cache diffing (§ EXPERIENCE Row states › Leaving, Not found, Edit open-todo vanishes; Motion › Delete ↔ C3, AD-11)
Without an animation library, these all need custom React state: leaving rows kept after they leave the cache (for delete, not-found refetches and rows that vanish while in edit); detecting that an editing row vanished on refetch and announcing it; restoring a failed delete "in place" with its own motion; restoring a failed add only if the field is empty, with the cursor at the end.
Fix: UX change. Keep the exit animation only for a user-initiated delete. Refetch removals unmount at once, and focus follows the after-delete rule. Drop the "deleted elsewhere" announcement for an editing row that vanishes, or keep it only if the draft would otherwise be lost silently.

**[Spine consistency]** — AD-19's CSP blocks data-URI icons (§ DESIGN Character counter, Inline error, Announcer, Completion check ↔ AD-19, Conventions › Styling)
`default-src 'self'` means `img-src 'self'`, so `data:` images are blocked. Vite inlines small assets used in CSS as data URIs by default (`assetsInlineLimit`). The warning triangle, the "!" icons and the tick would break in `test` and `prod` if built as CSS `url()`, while working in dev, where nginx sends no CSP.
Fix: UX change. DESIGN states that every icon is inline JSX SVG or a text glyph with `aria-hidden`, never a CSS `url()`.

**[Spine consistency]** — The auto-growing field isn't achievable in CSS alone in every engine Playwright runs (§ DESIGN Text field ↔ Conventions › Styling, ticket Boundaries › browsers)
`field-sizing: content` is not supported everywhere; Firefox lacked it as of 2025, and a `rows` fallback does not grow. With "no inner scroll", long text would clip or scroll in such engines, breaking DESIGN's "Long text" state and R8 parity under E7.
Fix: UX change. Specify a small JS height-sync fallback (set the height from `scrollHeight` on input) when `CSS.supports('field-sizing','content')` is false. This stays within CSS Modules.

**[Spine consistency]** — axe can run mid-animation (§ EXPERIENCE Motion ↔ AD-20, E8)
AD-20 runs axe in every e2e test. A scan that lands during the add fade-in, the done-card transition, the 120 ms edit fade or the announcer's entry can report `color-contrast` failures on partly transparent text. Leaving rows also rely on `inert` to avoid `aria-hidden-focus`.
Fix: Flag for Winston. Proposal: the Playwright config sets `reducedMotion: 'reduce'` (browser emulation, allowed under AD-20) for axe scans, or scans wait for animations to finish. Keep one motion-on test without axe.

**[Spine consistency]** — Dark mode is never audited automatically (§ DESIGN Colors (`-dark` roles) ↔ AD-20, R14, E8)
Playwright runs in the light scheme by default, so axe in every e2e test checks only the light tokens. R14's "automated audit reports no AA violations" would not cover half of the shipped colour pairs.
Fix: Flag for Winston. Proposal: AD-20 adds a `colorScheme: 'dark'` axe pass, as a second project or one spec per E1–E6 state.

**[Spine consistency]** — C5: dark mode is a feature beyond R1–R22 without a dated ticket decision (§ DESIGN frontmatter, Colors; EXPERIENCE Foundation › Colour mode ↔ C5)
The decision exists only as an undated memlog line. Dark mode doubles the colour contract and its audit surface.
Fix: Record a dated user decision in the ticket's Notes (Sofia), or cut dark mode from v1.

### Low (36)

**[Flow coverage]** — Flow 3's failure path assumes the network reason for every outage (§ EXPERIENCE.md › Key Flows › Flow 3 failure; Voice and Tone › Reasons)
Flow 3's failure path says "the server is unreachable" and shows the `network` reason ("Check your connection…"). That only holds when the whole origin is unreachable (the AD-20 `abort` injection). If the API container is down, nginx answers with an RFC 9457 problem (AD-4), and the Reasons table doesn't say which reason that problem maps to.
Fix: Say "the connection drops" in Flow 3, and state which reason an nginx 502/503/504 problem gets. If its `type` is unknown, add it to the Winston flags.

**[Flow coverage]** — No flow reopens a todo or walks a failed edit save (§ EXPERIENCE.md › Key Flows › Flow 2, Flow 4)
R14 requires a manual keyboard and screen-reader pass of every core action, but Flow 2 never reopens a todo. No flow walks a failed edit save, the one revert whose message differs most ("…is back as it was").
Fix: Add "Space again: not checked" to Flow 2 step 3, and an edit failure step to Flow 4.

**[Token completeness]** — Two ambiguous token definitions: text-field min-height and the status Dismiss (§ DESIGN.md frontmatter `text-field`, `announcer-status`; Components › Text field, Dismiss button)
`components.text-field.min-height: 32px` conflicts with the prose "Rest: … 59px for the add field including the counter", and nothing says which element the 32px applies to. `announcer-status` defines only fill, text and edge, while its Dismiss "takes the Cancel button's soft style" with no token entry.
Fix: Rename to `textarea-min-height` or state the element, and add a `dismiss-button-status` entry that references the `cancel-button` tokens.

**[Component coverage]** — Checked hover and checked pressed are undefined for the Completion check (§ DESIGN.md › Components › Completion check)
The Completion check's states list hover and pressed only for the unchecked circle. Checked + hover and checked + pressed are undefined, though a done card's check is just as clickable.
Fix: State whether the checked circle's edge and fill step on hover and press, and add the resulting pairs to the hover/pressed table.

**[Component coverage]** — The field-local over-limit live region has no component name (§ EXPERIENCE.md › Component Patterns › Character counter; FLAG 5)
The field-local, visually hidden polite region that voices "over the character limit" is a real DOM element with its own rules, but it has no component name in either spine. Loading status was given a DESIGN.md entry "so both spines name it", and this region wasn't.
Fix: Name it (e.g. "Limit status") in both spines, the same way Loading status is named.

**[State coverage]** — The order of the Empty panel and the leaving last row is unspecified (§ EXPERIENCE.md › State Patterns › Leaving, Empty; Key Flows › Flow 1 step 9)
Deleting the last todo leaves the order of events unspecified. The leaving row stays rendered for `{motion.duration-base}` after it leaves the cache, but the list area may show only one block, so it's open whether the Empty panel appears at once beneath the collapsing card or after it unmounts.
Fix: State the order, e.g. "Empty panel fades in after the leaving row unmounts".

**[State coverage]** — The `rows` fallback for `field-sizing` does not grow (§ DESIGN.md › Components › Text field; EXPERIENCE.md › Component Patterns › Text field)
The text field's fallback is `field-sizing: content` with a `rows` fallback. A `rows` fallback doesn't grow, so in any default Playwright browser that lacks `field-sizing`, long text scrolls inside the field, against "no inner scroll" (a user decision).
Fix: Confirm support across Chromium, Firefox and WebKit at the pinned Playwright version, or specify a JS auto-size fallback.

**[Visual reference coverage]** — Three references point at a mock with no path (§ DESIGN.md › Typography; Layout & Spacing › Responsive rules; EXPERIENCE.md › IA › Surface closure R2)
Three references point at a mock with no path: "the locked v5 mock" (DESIGN.md, Typography; EXPERIENCE.md, IA › Surface closure R2), and "The mocks show only a 390px phone and a 1200px desktop" (DESIGN.md, Layout & Spacing › Responsive rules). Today they resolve only to `.working/direction-soft-cards-v5.html`.
Fix: At promotion, replace each with an inline link to the promoted file and name what it shows.

**[Bloat & overspecification]** — Internal render labels and history that readers can't resolve (§ EXPERIENCE.md › Motion; Inspiration & Anti-patterns; DESIGN.md › Brand & Style)
Internal render labels and history appear where downstream readers can't resolve them: "m5b" (Motion table), "m5a, m5c, P1, v4 cross-fade" and "quiet paper, ledger mono, bold block" (Inspiration), "FLAG 2…5" as bare references, and "An early dark rendering… the user rejected it" (DESIGN.md Brand & Style). They only make sense next to `.memlog.md` and `.working/`.
Fix: Drop the labels, or define them once in words (e.g. "instant swap with a fade-in" instead of m5b), and point FLAG n to the Architecture flags table row.

**[Bloat & overspecification]** — Responsive behaviour is stated in full in both spines (§ DESIGN.md › Layout & Spacing › Responsive rules; EXPERIENCE.md › Responsive & Platform)
Responsive behaviour is stated in full in both spines: target heights, Dismiss placement and inline versus stacked actions. Two copies of the same rule will drift.
Fix: Keep geometry in DESIGN.md and only the behavioural invariants ("no action at only one width", browsers) in EXPERIENCE.md, with a pointer.

**[Inheritance discipline]** — Glossary drift: complete, reactivate, reopen, done (§ EXPERIENCE.md › Voice and Tone › Leads; State Patterns › Row states; IA › Surface closure R4)
The glossary drifts on the same concept: the ticket says "mark complete… return it to active", the architecture says "complete and reactivate", and the UX says "reopen" (as a message key and in flows), uses "done" and "Done" for `completed`, and uses "Active / Done" for the row states.
Fix: Add a one-line glossary to EXPERIENCE.md Foundation: "done = `completed: true`; reopen = R4's return to active (the architecture's 'reactivate')".

**[Inheritance discipline]** — The Surface closure table omits R11 and R12 (§ EXPERIENCE.md › IA › Surface closure)
The Surface closure table omits R11 and R12, although Flows 3 and 4 cite them and Flow 4 is the main R12 evidence ("failures without losing the list or blocking further use").
Fix: Add rows R11 → List area on load, Flow 3; R12 → Inline error, Announcer, List error panel, Flows 1, 2, 4.

**[Shape fit]** — The Token-to-CSS rule table sits under Colors (§ DESIGN.md › Colors › Token-to-CSS rule)
The Token-to-CSS rule table maps every group (typography, rounded, spacing, motion, components), but it sits under Colors, where a builder looking up the spacing or motion mapping won't expect it.
Fix: Move it to a short preamble before Brand & Style, or to the top of Components, and leave a one-line pointer in Colors.

**[Accessibility]** — The Done chip may leak into the checkbox name (§ DESIGN.md § Components — Done chip; EXPERIENCE.md § Voice and Tone — Completion check)
If the chip sits inside the element that the check's `aria-labelledby` points at, engines that do not prune `aria-hidden` descendants in labelledby traversal yield "Buy stamps Done".
Fix: Point `aria-labelledby` at a span that holds only the text, and render the chip as a sibling.

**[Accessibility]** — Swapping the name source in edit mode is fragile (§ EXPERIENCE.md § Component Patterns — Completion check)
`aria-labelledby` beats `aria-label`, so if the labelledby attribute stays while the text node is replaced, the name depends on a dangling idref.
Fix: In edit mode, remove `aria-labelledby` and set `aria-label`, or keep a persistent visually hidden span holding the saved text and always label by it.

**[Accessibility]** — Rows are verbose in browse mode (§ EXPERIENCE.md § Voice and Tone — Static strings)
Each row reads the full todo text up to four times (checkbox name, visible text, "Edit “…”", "Delete “…”"), and at 200 characters that is heavy. JAWS at its default punctuation level may also voice the curly quotes.
Fix: Acceptable as is, because it keeps label-in-name and makes names unique. Consider dropping the quote marks from accessible names (keep them in visible messages), and check JAWS punctuation in the manual pass.

**[Accessibility]** — NVDA and JAWS may swallow the first Escape in the edit field (§ EXPERIENCE.md § Interaction Primitives — Keyboard map "Escape")
NVDA and JAWS may use the first Escape to leave focus or forms mode before the page sees it.
Fix: No spec change, since Cancel is always present. Script it into the manual pass so a "two Escapes" result is not logged as a bug.

**[Accessibility]** — Forced-colours mode (Windows High Contrast) is unspecified (§ DESIGN.md § Components — Text field "Invalid", Focus ring, Completion check)
The invalid edge thickens with an inset `box-shadow`, and box-shadows are removed in forced colours. SVG circle and tick colours, and any ring drawn as a shadow, may also vanish.
Fix: Draw rings with `outline`. Add a `@media (forced-colors: active)` rule giving the check circle `stroke: CanvasText`, the tick `CanvasText` and the invalid edge a real border. Test once in Edge.

**[Accessibility]** — Over-limit is described in words for screen readers only (§ DESIGN.md § Components — Character counter)
Sighted users get "201/200" with a red triangle, and the phrase "over the character limit" is SR-only. That is probably sufficient for 3.3.1, but it is borderline for users with cognitive disabilities.
Fix: Optionally show "201/200 · 1 over" visually. It is short and states the fix (3.3.3).

**[Accessibility]** — The `field-sizing: content` fallback contradicts "no inner scroll" (§ DESIGN.md § Components — Text field)
Firefox, and older WebKit in the Playwright default browsers, lack `field-sizing`. A `rows` fallback scrolls internally at 320px with 200 characters.
Fix: Specify a small JS autosize fallback, or accept the inner scroll in those engines.

**[Accessibility]** — Type in `px` ignores the user's browser default font size (§ DESIGN.md § Typography)
Zoom still scales it, so 1.4.4 passes, but users who raise the default font size get nothing.
Fix: Consider `rem` tokens. The 1:1 token mapping makes this a one-file change.

**[Accessibility]** — Focusing the add field after Dismiss or Try again pops the phone keyboard (§ EXPERIENCE.md § Interaction Primitives — Focus management "Dismiss")
Focus lands in the add field after Dismiss or Try again, which opens the phone keyboard when the user only tapped Dismiss.
Fix: Keep it for keyboard activation. On pointer activation, consider moving focus to the next logical element without opening the keyboard, or accept the behaviour.

**[Accessibility]** — Done-card buttons may read as disabled (§ DESIGN.md § Components — Card buttons, Done-card variant)
Transparent fill, grey label and grey outline are the classic disabled look, which conflicts with the spine's own "no disabled appearance" rule for some cognitive and low-vision users.
Fix: Accept, as the recede is a deliberate user decision, or keep `text-done` but restore a faint fill so the buttons look pressable.

**[Accessibility]** — The List error text is read twice in browse mode on a failed first load (§ EXPERIENCE.md § Component Patterns — Loading status)
On a failed first load, the List error text is read once in the hidden Loading status and once in the visible panel.
Fix: Clear the hidden status a few seconds after it announces, or accept the duplication.

**[Accessibility]** — The delete-revert path does not say the returning row drops `inert`/`aria-hidden` (§ EXPERIENCE.md § State Patterns — Leaving, Reverted)
A row that failed to delete must come back fully interactive and exposed, and the spine doesn't say so.
Fix: Add one line saying the restored row is re-mounted fresh, with no `inert` or `aria-hidden`.

**[Spine consistency]** — The leaving row contradicts two other UX rules (§ EXPERIENCE Motion › Rules, IA region 5, Row states › Leaving ↔ AD-11)
"Motion never delays state… the DOM… change at once" and "exactly one of list / Empty panel" both clash with a row kept 200 ms after it leaves the cache, next to an Empty panel after the last delete. Under reduced motion, removal must not wait for `animationend`, which never fires.
Fix: UX change. State that leaving rows are the one DOM exception, that Empty renders only after the last leaving row unmounts, and that removal uses a timer that is 0 under reduced motion.

**[Spine consistency]** — The revert motion is described as a chain (§ EXPERIENCE Motion › Revert ↔ DESIGN Do's and Don'ts)
"The card eases back… *then* the revert flag pulses" is a chain, which DESIGN's Don'ts forbid. A re-entering card after a failed delete would also play the add-enter motion unless that is suppressed.
Fix: UX change. Run them in parallel, and specify the re-entry motion for a failed delete.

**[Spine consistency]** — The optimistic text must match what the server stores (§ EXPERIENCE Add form, Edit form ↔ AD-8, AD-6)
The UX doesn't say that the optimistic card and the `POST`/`PATCH` body carry the *trimmed, newline-normalised* description. If they don't, the card text shifts when the refetch arrives, and an idempotent replay compares a different value.
Fix: UX change. Add one line saying the client sends and renders the trimmed value.

**[Spine consistency]** — "Unchanged" has no comparison basis (§ EXPERIENCE Edit form ↔ AD-8)
"Saving unchanged text sends nothing" doesn't say what it compares against: the trimmed draft against the text when edit opened, or against the current cache, which matters when a refetch changed it elsewhere.
Fix: UX change. Compare the trimmed draft with the current cached description.

**[Spine consistency]** — The `conflict` wording is wrong (§ EXPERIENCE Reasons › conflict ↔ AD-6)
The only `409` is a `POST` that reuses an `id` with different content. Nothing is "a change made elsewhere".
Fix: UX change. Use the generic reason for `conflict`.

**[Spine consistency]** — Rapid adds can reorder after a refetch (§ EXPERIENCE Todo list ↔ AD-6, AD-11, AD-13)
AD-13 orders requests per todo only, so two adds' `POST`s can arrive in either order. The server's `createdAt` (or, on a same-ms tie, the random `id`) can then reorder the cards after the refetch, with no motion specified.
Fix: UX change. Accept the reorder and state it, or animate nothing.

**[Spine consistency]** — C4 measurement: define "shows" as the first painted frame (§ DESIGN motion; EXPERIENCE Motion ↔ C4, R19)
Enter animations start at opacity 0 and `0fr`. With the given ease-out, about 85–90% of the change is visible at 100 ms, which is probably fine. The performance report should still define "shows" as the first painted frame of the change, not the end of the animation.
Fix: Note this for the R19 report. No UX change needed.

**[Spine consistency]** — The Key Flows don't cite AD-20 scenario ids (§ EXPERIENCE IA › Surface closure, Key Flows ↔ AD-20, test-strategy)
The flows don't map to E1–E8, and the Surface closure table omits R11 and R12 even though Flows 3 and 4 serve them.
Fix: UX change. Tag each flow and failure path with its E id (Flow 1 → E1–E5, E7; Flow 2 → E8; Flow 3 → E1, E6; Flow 4 → E6). Add R11 and R12 rows.

**[Spine consistency]** — The Try again citation is stretched (§ EXPERIENCE Component Patterns › Try again ↔ AD-13)
"AD-13 spirit" cites a mutation-helper AD for a query behaviour.
Fix: UX change. Cite AD-11 once Winston settles the query retry policy.

**[Spine consistency]** — Wording outside the announcer must also come from `messages.ts` (§ EXPERIENCE Voice and Tone ↔ AD-14)
The vanished-in-edit and not-found messages, and the List error panel text, are fine under AD-14 only if they also come from `messages.ts`. `messages.ts` must also key a status that is neither a problem type nor an action ("deleted elsewhere" on a refetch).
Fix: UX change. List the `status.deletedElsewhere` and `status.deleted` keys explicitly.

**[Spine consistency]** — The AD-19 check found nothing to fix (§ AD-19)
Todo text appears only through React text and `aria-label` (escaped). Problem `detail` is never shown, and the client does no logging. Listed for completeness.
Fix: None.

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
- `review-spine-consistency.md`
