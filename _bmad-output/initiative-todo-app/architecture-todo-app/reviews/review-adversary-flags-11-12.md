---
type: architecture-review
lens: adversary
target: _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md
scope: 'UX flags 11 and 12: AD-11 "last fetch failure", AD-14 recovery line, AD-8 escaped character class'
reviewed: '2026-11-24'
inputs: [architecture-todo-app.md (git diff), .memlog.md (entries from "update started: UX flags 11 and 12"), ux-todo-app/EXPERIENCE.md]
verdict: 'Close but not yet buildable as written. 3 major, 5 minor. Flag 11 is closed in substance. Flag 12 needs "has spoken" defined, and both flags depend on the success-recording order'
---

# Adversarial review: UX flags 11 and 12

**Lens.** Build two units one level down (the todos store and query function, the list area, the Loading status, the API client, the contract module, the K5 tests). Each follows every AD to the letter, and the pair still builds incompatibly because of this amendment. Each finding comes with the smallest AD tightening that closes it.

**Verdict: one more tightening pass on AD-9, AD-11 and AD-14 before the web stories are refined.** Flag 11's mechanism is right. The store holds the reason, the query function writes it, cancellations and cache writes leave it alone, and the panel no longer reads `query.error`. Flag 12's rule is right in spirit. But three gaps let compliant builds diverge visibly:

- the stored "failure kind" can be read as one of AD-9's three kinds, which loses the `unavailable` reason flag 11 exists for;
- "has spoken" is not defined, and AD-14 has no delay, so the recovery line can be spoken on every cold load or never in the case flag 12 was raised for;
- the query function records **loaded** before TanStack writes the data, so one render sees "loaded, empty cache". The recovery line and its focus condition are decided at that moment.

Severity: **Major** means two compliant units produce a wrong visible state, or a false or missing announcement, at runtime. **Minor** means drift, rework or a rare misleading line.

**Checked, no finding:**

- **"At most one" recovery line is per page session.** Loaded is never reset in a page session, so the list becomes loaded at most once, and "at most one" follows.
- **"No other live region exists."** The recovery line reuses the existing Loading status. The Announcer rule ("never carries a load failure or a load recovery") is consistent with it.
- **Last fetch failure after a cancellation.** It is unchanged, as is retry requested, so a Try again whose fetch the helper cancels stays in Loading until the settle-time refetch records an outcome. Correct.
- **After Try again.** Try again sets retry requested but leaves last fetch failure as it was. Nothing reads the reason while retry requested holds, so that is harmless.
- **After success, then a later background failure.** The state is loaded with a non-none kind. AD-11 derives the error state only "while not loaded", and AD-14 keeps the Loading status silent once loaded, so no reader is misled under the AD text. The residual risk is in m4.
- **"The last fetch failed" in AD-11.** It is now a defined alias ("means it is not none") and reads consistently in the List-state bullet.

---

## Major

### M1. "The AD-9 failure kind" can be stored as one of three kinds, which loses the `unavailable` reason

- **Build A (todos store and query function):** AD-9 says the client "classifies every failure as exactly one of three kinds: a problem …; `network` …; or generic". AD-11 stores "the AD-9 failure kind". So the store holds `'problem' | 'network' | 'generic'`, and the problem's `type` is dropped.
- **Build B (list area, Voice and Tone):** AD-14 keys `messages.ts` "by failure kind: each problem `type`, `network`, and generic". So the panel looks up `reason['/problems/unavailable']`.
- **What breaks:** an nginx `503` during the first load (the API restarting, flag 6's main case) is stored as `'problem'`. Build B finds no reason for that key and falls back to generic: "Something went wrong on our side." instead of "The server isn't available right now." The Loading status speaks the same wrong line. Flag 11 exists to carry this reason through optimistic adds, and the store can't hold it.
- **Both comply because:** "failure kind" means the three-way split in AD-9 and the type-level key in AD-14. AD-13's per-call promise ("`failed` (with its failure kind, AD-9)") has the same ambiguity.
- **Fix (AD-9, last sentence):** "A **failure kind** is exactly one of: a problem `type` from the closed set, `network`, or `generic` (a non-2xx without a problem body, or with an unknown `type`). AD-11's store, AD-13's promise and AD-14's message keys all use this one `FailureKind` type, exported from `apps/web/src/api/`." AD-11's "the AD-9 failure kind" then needs no change.

### M2. "Only if it has spoken earlier in the page session" can be read three ways

AD-14 says the status speaks "progress when the list enters its loading state", with no delay. The 500 ms delay that keeps fast loads silent lives only in EXPERIENCE, as an **[ASSUMPTION]**. "Has spoken" is not defined.

- **Build A (Loading status, from AD-14 literally):** the list enters loading at mount, so the status counts as having spoken progress, whether or not a timer later set text. Every cold load ends with "Your todos are loaded.", which contradicts "fast loads stay silent" and fails a K5 test written from EXPERIENCE.
- **Build B (Loading status, from EXPERIENCE):** "spoken" means a non-empty line was set at least once (the 500 ms timer fired, or the error line was set). A load under 500 ms stays silent. This is the intended build.
- **Build C (Loading status, checking current content):** "has spoken" means the status holds text now. The error line is emptied 5 s after it is set (EXPERIENCE). So the user in flag 12's motivating case (heard "Couldn't load your todos…", then the Wi-Fi comes back a minute later) hears no recovery line. That is the failure flag 12 was raised to fix.
- **Also undefined:** where the "has spoken" flag lives. AD-11 forbids components keeping their own copy of *store* state, but this flag is not listed as store state. A component ref survives StrictMode but is lost if the list area remounts (an error boundary reset or a key change). That drift is benign in v1.
- **All comply because:** AD-14 neither defines speaking nor carries the delay that makes "has spoken" a meaningful filter.
- **Fix (AD-14, loading-status bullet):** "…progress when the list has been in its loading state for a short delay (EXPERIENCE sets it), so a fast first load says nothing; the error panel's text when it enters its error state; and, when the list becomes loaded, at most one recovery line, only if the status has set a non-empty line earlier in the page session. A line counts once it is set, even if it was emptied since. A progress line whose delay had not elapsed does not count. Becoming loaded cancels any pending line or delay. After that the status says nothing more in the page session."

### M3. The query function records **loaded** before the fetched list is in the cache, so one render sees "loaded, empty"

- **Build A (query function, per AD-11):** "Fetch outcomes are recorded once, by the query function … A success sets loaded." So it does `const todos = await api.list({ signal }); store.setLoaded(); return todos;`. The store notifies its `useSyncExternalStore` subscribers synchronously.
- **Build B (list area, per AD-11):** "Once loaded, the list renders the cache (populated or empty)." It reads `loaded` from the store and the list from its `useQuery` observer.
- **What breaks:** TanStack writes the returned array to the cache only after the query function's promise settles, and it tells React through `notifyManager`, which batches on a later tick by default in v5. React re-renders for the store change first. That render sees `loaded = true` with the old observer data: `undefined`, or only optimistic adds. So:
  - the list area renders the **Empty panel "No todos yet."** for one commit, then the real list. That is the false empty flag 4 closed, and Playwright or axe can catch it;
  - if focus was in the List error panel, the list area's layout effect moves it to the **Empty panel** (EXPERIENCE: an empty list sends focus there). The next commit replaces the Empty panel with the list. The list area tracks rows and the error panel, not the Empty panel, so focus drops to `<body>`, which EXPERIENCE forbids;
  - flag 12's decision (recovery line "unless focus moved to the list") is taken on that flash commit, when focus has moved to the Empty panel, not the list. Two Loading-status builds, one checking "focus is inside the list area" and one checking "focus is on the `<ul>`", then differ on whether the line is spoken.
- **Both comply because:** AD-11 fixes *who* records success (the query function) but not *when* relative to the cache write. This is a consequence of the earlier choice to record outcomes in the query function rather than in a cache subscriber (see review-adversary-ux-update.md, M1), and the amendment's recovery line now hinges on it. Verify the `notifyManager` default against the pinned 5.x.
- **Fix (AD-11, "Fetch outcomes" bullet):** "On success, the query function first writes the fetched list to `['todos']` with `setQueryData`, then sets loaded and clears last fetch failure and retry requested, then returns the same list. No render may see loaded without the fetched list. A K5 component test asserts that the Empty panel never renders when the first successful fetch returns todos." An alternative is that the list area treats the list as loaded only when the store's loaded is set **and** the observer's `dataUpdatedAt` is not older than the recorded success. The first fix is simpler, and it keeps one writer.

---

## Minor

### m1. The recovery line's focus condition crosses two units, so it can make two builds diverge

- **Build A:** the Loading status is its own component (IA row 4, a sibling before the list area, row 5). In its own layout effect on "became loaded", it checks whether focus is in the list. Sibling layout effects run in tree order, so it runs **before** the list area's layout effect moves focus. It sees focus on `<body>` (the panel has already been removed) and speaks.
- **Build B:** the list area renders the Loading status and decides the line in the same layout effect that moves focus. It skips the line.
- The memlog says the focus condition "can't make two units diverge". It can, once the status and the list area are separate components.
- **Fix (AD-14, loading-status bullet):** "The list area owns the loading status and decides its recovery line in the same commit in which it moves focus (EXPERIENCE: Focus management), after the focus move."

### m2. A reason change while already in Error: is it a re-entry?

- **Build A:** the status speaks only on a change of list state. A focus refetch that fails with a new kind while the panel shows changes the panel's reason silently (EXPERIENCE: "updates the reason in place, silently").
- **Build B:** the status's effect depends on `[state, panelText]`, so a new reason counts as entering the error state again and is spoken.
- **Fix (AD-14):** after "when it enters its error state", add "(a change of state, not of reason; a new failure kind while already in the error state is not spoken)". If UX would rather speak the new reason, state that instead. Either way, the AD has to choose.

### m3. "Once loaded, it is silent" and a pending progress timer

- **Build A:** when the list becomes loaded, it empties the status but does not cancel the 500 ms progress timer. EXPERIENCE says only that "each entry" into loading or error cancels timers, and becoming loaded is neither. A load that succeeds at 450 ms is followed, at 500 ms, by "Loading your todos" after the list is on screen.
- **Build B:** cancels it.
- AD-14's "Once loaded, it is silent" arguably forbids Build A, but the same sentence also allows a recovery line "when the list becomes loaded", and EXPERIENCE runs a 5 s clear timer after it. A builder can't tell which post-loaded actions are allowed.
- **Fix:** the M2 wording covers it ("Becoming loaded cancels any pending line or delay. After that the status says nothing more"). Emptying the status is not speaking.

### m4. Two readers derive the list state separately; "loaded plus a non-none kind" is the trap

After a background refresh failure, the store holds `loaded = true` and a non-none last fetch failure for the rest of the session, or until the next success. The list area and the Loading status each derive "loading, error or loaded" from three store fields. A build that writes `failure && !retry ? 'error' : …` without checking loaded first shows the error panel, or speaks "Couldn't load your todos", over a loaded list. AD-11's text forbids that, but two hand-written derivations will drift.

- **Fix (AD-11, "List state" bullet):** "One selector in `apps/web/src/todos/`, `listState(store)` returning `loading | error | loaded`, is the only derivation of list state. The list area and the loading status both read it. Once loaded, last fetch failure feeds nothing."

### m5. AD-8's escape-text class breaks if it is copied into a string literal

The class is now written as regex source, `[\p{Cc}  ]`. That is right in a regex literal (`/[\p{Cc}  ]/u`). But AD-8 also requires "the schema's pattern … come[s] from it", and a TypeBox `pattern` is a **string**.

- **Build A:** `const CLASS = '[\p{Cc}  ]'`. In a plain TS string, `\p` is an identity escape and becomes `p`. So the class is `[p{Cc}` + U+2028 + U+2029 + `]`, and the server rejects every description containing `p`, `c`, `C`, `{` or `}`. The ` ` escapes become literal characters, which works but puts invisible characters into `openapi.json`.
- **Build B:** a regex literal for the client and a hand-built pattern string for the schema. These are two sources, which defeats "one module".
- `no-useless-escape` would flag Build A only if that ESLint rule is on.
- **Fix (AD-8):** "`description.ts` holds the class body as `String.raw` text (`\p{Cc}  `). The client check is `new RegExp(`[${body}]`, 'u')`, and the schema pattern is `^[^${body}]*$`. The U1 table includes ordinary text containing `p` and `c`."

---

## EXPERIENCE.md sentences

| # | Where | Sentence (short) | Status | Suggested edit |
|---|---|---|---|---|
| 1 | Voice and Tone › List error panel text | "The kind is the last recorded fetch failure's, read from the todos store, never from the query's `error` … (pending flag 11)." | **Satisfied** (AD-11), provided "kind" means the type-level kind (M1). | Drop "(pending flag 11)". |
| 2 | Same paragraph | "A later failed fetch with a different kind updates the reason in place, silently." | **Relies on something unstated.** AD-14 doesn't say whether a reason change is an entry (m2). | None if the m2 fix lands with "not spoken". Otherwise: "…updates the reason in place. The Loading status does not speak it again." |
| 3 | Voice and Tone › Loading status text | "'Your todos are loaded.' once when the list becomes loaded after the status has spoken (pending flag 12)." | **Satisfied** (AD-14), but "has spoken" needs the M2 definition. | "…once when the list becomes loaded, if the status has set any line since the page loaded (even one since emptied), and focus was not moved to the list." Drop the flag marker. |
| 4 | Component Patterns › Loading status | "When the list becomes loaded, it says 'Your todos are loaded.' once, if it had spoken since the page loaded and focus was not moved to the list …, then empties 5 s later (pending flag 12). Otherwise it is emptied when the list or Empty panel renders. After that it is silent." | **Needs UX edit** (m1, m3, M2). | "When the list becomes loaded, any pending 500 ms or 5 s timer is cancelled. If the status has set a line since the page loaded (a 500 ms timer that never fired doesn't count; a line since emptied does) and the list area did not move focus to the list in that commit, it says 'Your todos are loaded.' once, then empties 5 s later. The list area makes this choice after it moves focus. Otherwise it is emptied when the list or Empty panel renders. After that it is silent." Drop the flag marker. |
| 5 | State Patterns › List states, row "Error, recovered without Try again" | "The Loading status says 'Your todos are loaded.' unless focus moved to the list (pending flag 12)." | **Satisfied**. The spoken-earlier condition holds, because the error line was set on entering Error. | Drop "(pending flag 12)". Also add the line to the **Loading** row: "On becoming loaded, the Loading status says 'Your todos are loaded.' only if it has spoken (a slow load or a Try again after an error)." That covers a Try again that succeeds. Today no row says so. |
| 6 | State Patterns › List states preamble (not flagged) | "**last fetch failed** and **retry requested** are recorded from fetch outcomes and Try again." | **Needs UX edit** (terminology now differs from AD-11). | "**last fetch failure** (a failure kind, or none; 'the last fetch failed' means it is not none) and **retry requested** …". The Condition cells can keep "the last fetch failed". |
| 7 | Accessibility table (4.1.3 row) | "First-load progress, failure, and recovery are spoken by the one hidden Loading status (AD-14; recovery pending flag 12)." | **Satisfied**. | "(AD-14)". |
| 8 | Journeys › Priya failure path | "Focus stays in the add field, and screen readers hear 'Your todos are loaded.' (pending flag 12)." | **Satisfied**. The status spoke the error line twice, and focus was not moved to the list. Note that M3's flash commit does not affect this path (focus is outside the list area). | Drop "(pending flag 12)". |
| 9 | Flags › Flag 11 | Proposal: `lastFetchFailure: FailureKind \| null` … cleared on success, unchanged by cancellation, untouched by cache writes. | **Satisfied**: accepted as proposed (AD-11 "last fetch failure"). | Add "**Resolution: accepted** (AD-11). The store's **last fetch failure** replaces the boolean. Try again does not clear it. The panel and the Loading status read it. The kind is the type-level failure kind (AD-9)." |
| 10 | Flags › Flag 12 | Proposal: speak once at not-loaded → loaded, if already spoken and focus not moved to the list. | **Satisfied, amended**: AD-14 allows at most one recovery line, if the status spoke earlier. The focus condition and the wording stay in EXPERIENCE. | Add "**Resolution: accepted, amended** (AD-14). The spine allows the line only if the status has spoken earlier in the page session. The focus condition and the wording are EXPERIENCE's (Component Patterns › Loading status)." |
| 11 | Ticket changes › K5 | "…and the 'Your todos are loaded.' line (once flag 12 is resolved)." | **Satisfied**. | Drop the parenthetical. Add the cases: a load under 500 ms says nothing on becoming loaded; recovery more than 5 s after the error line still speaks; and the first success never renders the Empty panel when the server returned todos (M3). |
| 12 | Assumptions table | "'Your todos are loaded.' wording (pending flag 12)." | **Satisfied**. | Drop "(pending flag 12)". |
