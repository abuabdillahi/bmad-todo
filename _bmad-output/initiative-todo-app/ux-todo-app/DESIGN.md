---
name: 'BMad Todos'
description: 'One shared todo list on soft, rounded cards. Active todos are raised and filled; completed todos recede into hollow dashed outlines. Light and dark follow the system setting. No UI library: CSS Modules plus these tokens.'
status: final
created: '2026-11-24'
updated: '2026-11-24'
sources: ['../initiative-todo-app.md', '../architecture-todo-app/architecture-todo-app.md']
colors:
  # Light values. Each <role>-dark below is the same role in dark mode.
  surface-page: '#F1F2F8'
  surface-card: '#FFFFFF'
  border-card: '#E1E3EE'
  text-primary: '#1B1D2A'
  text-muted: '#565B70'
  border-field: '#80869E'
  border-check: '#6E7391'
  border-check-hover: '#4F5470'
  surface-check-pressed: '#E3E5F0'
  action-primary: '#4B4FD6'
  action-primary-hover: '#3F43C4'
  action-primary-pressed: '#3438B0'
  on-action-primary: '#FFFFFF'
  action-soft: '#ECEDFB'
  action-soft-hover: '#E0E2F8'
  action-soft-pressed: '#D3D6F4'
  on-action-soft: '#3B3FB8'
  action-danger-soft: '#FCEBEA'
  action-danger-soft-hover: '#F9DEDC'
  action-danger-soft-pressed: '#F5D0CD'
  focus-ring: '#4B4FD6'
  danger: '#B3261E'
  danger-hover: '#9E211A'
  danger-pressed: '#8A1C16'
  on-danger: '#FFFFFF'
  surface-announcer: '#FDECEA'
  on-announcer: '#7A1712'
  announcer-button-hover: '#F9DCD9'
  announcer-button-pressed: '#F4CBC7'
  text-done: '#565B70'
  border-done: '#80869E'
  done-button-hover: '#E6E8F1'
  done-button-pressed: '#DADDE9'
  surface-done-chip: '#E3E5F0'
  on-done-chip: '#3A3F55'
  surface-done-check: '#E3E5F0'
  border-done-check: '#80869E'
  glyph-done-check: '#3A3F55'
  skeleton: '#E3E5F0'
  # Dark values
  surface-page-dark: '#12131A'
  surface-card-dark: '#22253A'
  border-card-dark: '#3A3E58'
  text-primary-dark: '#F0F1F8'
  text-muted-dark: '#A4A8BD'
  border-field-dark: '#8B90AD'
  border-check-dark: '#8B90AD'
  border-check-hover-dark: '#B0B4CC'
  surface-check-pressed-dark: '#2A2D42'
  action-primary-dark: '#9A9DFF'
  action-primary-hover-dark: '#8C8FF5'
  action-primary-pressed-dark: '#7F82EB'
  on-action-primary-dark: '#12131A'
  action-soft-dark: '#2E3250'
  action-soft-hover-dark: '#363B5D'
  action-soft-pressed-dark: '#3F4469'
  on-action-soft-dark: '#C8CAFF'
  action-danger-soft-dark: '#3A1F22'
  action-danger-soft-hover-dark: '#47262A'
  action-danger-soft-pressed-dark: '#552D31'
  focus-ring-dark: '#B9BBFF'
  danger-dark: '#FF8A80'
  danger-hover-dark: '#F27D73'
  danger-pressed-dark: '#E57066'
  on-danger-dark: '#12131A'
  surface-announcer-dark: '#3A1715'
  on-announcer-dark: '#FFD7D3'
  announcer-button-hover-dark: '#4A1E1B'
  announcer-button-pressed-dark: '#5A2622'
  text-done-dark: '#8F94AA'
  border-done-dark: '#666B8A'
  done-button-hover-dark: '#1C1E2B'
  done-button-pressed-dark: '#262938'
  surface-done-chip-dark: '#1C1E2B'
  on-done-chip-dark: '#A9ADC2'
  surface-done-check-dark: '#1C1E2B'
  border-done-check-dark: '#6F7494'
  glyph-done-check-dark: '#A9ADC2'
  skeleton-dark: '#4A4F6B'
typography:
  base:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  heading:
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  heading-wide:
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  field-label:
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  todo:
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
  body:
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  counter:
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  counter-over:
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
  button:
    fontSize: 15px
    fontWeight: '600'
  button-add:
    fontSize: 16px
    fontWeight: '600'
  chip:
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 20px
  announcer:
    fontSize: 15.5px
    fontWeight: '400'
    lineHeight: '1.45'
  inline-error:
    fontSize: 14.5px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  card: 16px
  button: 12px
  bar: 6px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  content-max: 720px
  breakpoint-wide: 768px
  target-min: 44px
  target-min-wide: 40px
motion:
  duration-press: 100ms
  duration-swap: 120ms
  duration-fast: 150ms
  duration-base: 200ms
  duration-revert: 1.2s
  duration-skeleton: 1.6s
  skeleton-iterations: '3'
  ease-out: 'cubic-bezier(0.2, 0, 0, 1)'
  ease-in-out: 'cubic-bezier(0.4, 0, 0.2, 1)'
  enter-offset: -8px
  press-scale: '0.97'
  skeleton-opacity-min: '0.6'
components:
  focus-ring:
    color: '{colors.focus-ring}'
    width: 3px
    offset: 3px
  page:
    background: '{colors.surface-page}'
    foreground: '{colors.text-primary}'
    max-width: '{spacing.content-max}'
    padding-top: '{spacing.2}'
    padding-top-wide: '{spacing.6}'
    padding-inline: '{spacing.4}'
    padding-bottom: '{spacing.6}'
  page-heading:
    foreground: '{colors.text-primary}'
    margin-bottom: '{spacing.4}'
  announcer:
    background: '{colors.surface-announcer}'
    foreground: '{colors.on-announcer}'
    border-color: '{colors.danger}'
    border-width: 1px
    radius: '{rounded.card}'
    bottom: '{spacing.2}'
    inset-inline: '{spacing.4}'
    max-width: '{spacing.content-max}'
    shadow: '0 -4px 16px rgba(10, 12, 30, 0.16)'
    z-index: '10'
    padding-block: '{spacing.3}'
    padding-inline-start: '{spacing.4}'
    padding-inline-end: '{spacing.3}'
    gap: '{spacing.3}'
    icon-size: 24px
    icon-background: '{colors.danger}'
    icon-foreground: '{colors.on-danger}'
    icon-glyph-size: 14px
    icon-glyph-weight: '800'
    icon-nudge: 4px
    message-padding-top: '{spacing.1}'
  announcer-status:
    background: '{colors.surface-card}'
    foreground: '{colors.text-primary}'
    border-color: '{colors.border-field}'
  dismiss-button:
    background: transparent
    background-hover: '{colors.announcer-button-hover}'
    background-pressed: '{colors.announcer-button-pressed}'
    foreground: '{colors.on-announcer}'
    border-color: '{colors.danger}'
    border-width: 1.5px
    radius: '{rounded.button}'
    min-height: '{spacing.target-min}'
    padding-inline: '{spacing.4}'
  dismiss-button-status:
    background: '{colors.action-soft}'
    background-hover: '{colors.action-soft-hover}'
    background-pressed: '{colors.action-soft-pressed}'
    foreground: '{colors.on-action-soft}'
    border-color: transparent
  add-form:
    gap: '{spacing.2}'
    margin-bottom: '{spacing.5}'
    label-foreground: '{colors.text-primary}'
    label-gap: '{spacing.2}'
  text-field:
    background: '{colors.surface-card}'
    foreground: '{colors.text-primary}'
    border-color: '{colors.border-field}'
    border-width: 1.5px
    border-width-invalid: 2.5px
    border-color-invalid: '{colors.danger}'
    radius: '{rounded.card}'
    padding-top: '{spacing.2}'
    padding-inline: '{spacing.3}'
    padding-bottom: '{spacing.2}'
    textarea-min-height: 32px
  character-counter:
    foreground: '{colors.text-muted}'
    foreground-over: '{colors.danger}'
    icon-size: 14px
    icon-glyph: '{colors.surface-card}'
    icon-stroke: '1.8'
    gap: '{spacing.1}'
  inline-error:
    foreground: '{colors.danger}'
    icon-size: 18px
    icon-background: '{colors.danger}'
    icon-foreground: '{colors.on-danger}'
    icon-glyph-size: 12px
    icon-glyph-weight: '800'
    gap: '{spacing.2}'
    margin-top: '{spacing.2}'
  add-button:
    background: '{colors.action-primary}'
    background-hover: '{colors.action-primary-hover}'
    background-pressed: '{colors.action-primary-pressed}'
    foreground: '{colors.on-action-primary}'
    radius: '{rounded.card}'
    height: 59px
    padding-inline: 22px
  todo-list:
    gap: '{spacing.3}'
  todo-card:
    background: '{colors.surface-card}'
    foreground: '{colors.text-primary}'
    border-color: '{colors.border-card}'
    border-width: 1.5px
    radius: '{rounded.card}'
    padding-block: '{spacing.3}'
    padding-inline: '{spacing.4}'
    gap: '{spacing.3}'
    actions-gap: '{spacing.2}'
    text-nudge: 1px
    check-row-nudge-wide: 7px
    shadow: '0 1px 3px rgba(10, 12, 30, 0.10)'
  todo-card-done:
    background: transparent
    foreground: '{colors.text-done}'
    border-color: '{colors.border-done}'
    border-style: dashed
    shadow: none
  revert-flag:
    color: '{colors.danger}'
    width: 2px
    offset: '{spacing.1}'
  completion-check:
    size: 26px
    hit-area: '{spacing.target-min}'
    margin: -9px
    nudge-edit: -2px
    border-width: 2px
    border-color: '{colors.border-check}'
    border-color-hover: '{colors.border-check-hover}'
    background: '{colors.surface-card}'
    background-pressed: '{colors.surface-check-pressed}'
    radius: '{rounded.full}'
  completion-check-done:
    background: '{colors.surface-done-check}'
    border-color: '{colors.border-done-check}'
    border-color-hover: '{colors.border-check-hover}'
    glyph: '{colors.glyph-done-check}'
    glyph-size: 16px
    glyph-stroke: 2.4px
    glyph-dash: '14'
  done-chip:
    background: '{colors.surface-done-chip}'
    foreground: '{colors.on-done-chip}'
    radius: '{rounded.full}'
    padding-inline: 9px
    margin-left: '{spacing.2}'
    raise: 1px
  edit-form:
    gap: '{spacing.2}'
  delete-confirm:
    foreground: '{colors.text-primary}'
    foreground-done: '{colors.text-done}'
    gap: '{spacing.2}'
  card-button:
    radius: '{rounded.button}'
    min-height: '{spacing.target-min}'
    min-height-wide: '{spacing.target-min-wide}'
    min-width: 64px
    padding-inline: '{spacing.4}'
    border-width: 1.5px
  edit-button:
    background: '{colors.action-soft}'
    background-hover: '{colors.action-soft-hover}'
    background-pressed: '{colors.action-soft-pressed}'
    foreground: '{colors.on-action-soft}'
  cancel-button:
    background: '{colors.action-soft}'
    background-hover: '{colors.action-soft-hover}'
    background-pressed: '{colors.action-soft-pressed}'
    foreground: '{colors.on-action-soft}'
  delete-button:
    background: '{colors.action-danger-soft}'
    background-hover: '{colors.action-danger-soft-hover}'
    background-pressed: '{colors.action-danger-soft-pressed}'
    foreground: '{colors.danger}'
  confirm-delete-button:
    background: '{colors.danger}'
    background-hover: '{colors.danger-hover}'
    background-pressed: '{colors.danger-pressed}'
    foreground: '{colors.on-danger}'
  save-button:
    background: '{colors.action-primary}'
    background-hover: '{colors.action-primary-hover}'
    background-pressed: '{colors.action-primary-pressed}'
    foreground: '{colors.on-action-primary}'
    padding-inline: 20px
  card-button-done:
    background: transparent
    background-hover: '{colors.done-button-hover}'
    background-pressed: '{colors.done-button-pressed}'
    foreground: '{colors.text-done}'
    border-color: '{colors.border-done}'
  empty-panel:
    foreground: '{colors.text-muted}'
    border-color: '{colors.border-card}'
    border-width: 1.5px
    radius: '{rounded.card}'
    padding: '{spacing.6}'
  skeleton-card:
    background: '{colors.surface-card}'
    border-color: '{colors.border-card}'
    border-width: 1.5px
    radius: '{rounded.card}'
    padding-block: '{spacing.3}'
    padding-inline: '{spacing.4}'
    shape-color: '{colors.skeleton}'
    circle-size: 26px
    bar-height: 12px
    bar-radius: '{rounded.bar}'
  list-error-panel:
    background: '{colors.surface-announcer}'
    foreground: '{colors.on-announcer}'
    border-color: '{colors.danger}'
    border-width: 1px
    radius: '{rounded.card}'
    padding: '{spacing.6}'
    gap: '{spacing.4}'
  try-again-button:
    background: transparent
    background-hover: '{colors.announcer-button-hover}'
    background-pressed: '{colors.announcer-button-pressed}'
    foreground: '{colors.on-announcer}'
    border-color: '{colors.danger}'
    border-width: 1.5px
    radius: '{rounded.button}'
    min-height: '{spacing.target-min}'
    padding-inline: '{spacing.4}'
---

## Brand & Style

BMad Todos is a list that wants to be finished. It has no brand to inherit, no onboarding to sell, and no dashboard to admire. The page carries one heading, one labelled field, and a stack of soft cards. Every card is an open promise until it is done, and then it steps back.

The style is **soft cards**: rounded, lightly raised surfaces on a cool grey-lavender page, with one indigo accent that means "do this now". Completion is shown by withdrawal, not celebration. A done card loses its fill, shadow, and accent and keeps a dashed outline, quiet text, and a grey tick, so nothing finished is ever brighter than anything still to do. That holds in dark mode too.

Motion confirms, never performs: 100–200 ms transitions of opacity, transform, colour, and height that never stand between the user and the result. Outcomes are spoken plainly in one banner pinned to the bottom of the screen, and a failure is outlined, for a moment, on the card it concerns. Then the page is quiet again.

This file is the visual contract. Behaviour, wording, focus, and flows live in EXPERIENCE.md, and both spines (this file and EXPERIENCE.md) win over any mock. Open assumptions for both files: EXPERIENCE.md Open Items.

## Colors

**Token-to-CSS rule.** Every token maps to exactly one CSS custom property, named from its path. Groups get a fixed prefix, and the path joins with hyphens:

| Token path | CSS custom property | Example |
|---|---|---|
| `colors.<role>` | `--color-<role>` | `colors.surface-card` → `--color-surface-card` |
| `colors.<role>-dark` | the **same** `--color-<role>`, assigned inside `@media (prefers-color-scheme: dark)` | `colors.surface-card-dark` → `--color-surface-card` (dark value) |
| `typography.<role>.<prop>` | `--font-<role>-<prop>`, where `fontFamily`→`family`, `fontSize`→`size`, `fontWeight`→`weight`, `lineHeight`→`line-height`, `letterSpacing`→`tracking` | `typography.body.fontSize` → `--font-body-size` |
| `rounded.<name>` | `--radius-<name>` | `rounded.card` → `--radius-card` |
| `spacing.<name>` | `--space-<name>` | `spacing.4` → `--space-4`; `spacing.content-max` → `--space-content-max` |
| `motion.<name>` | `--motion-<name>` | `motion.duration-base` → `--motion-duration-base` |
| `components.<component>.<prop>` | `--<component>-<prop>` | `components.focus-ring.width` → `--focus-ring-width` |

A component token whose value is a `{reference}` resolves to `var(--…)` of the referenced token, so components follow the colour mode automatically. `motion` is an extension group: the Google Labs spec defines colors, typography, rounded, spacing, and components only. CSS cannot read custom properties inside `@media`, so `spacing.breakpoint-wide` is the documented value and the media query repeats it literally. The tokens are declared on `:root` with `color-scheme: light dark`. The dark values are reassigned under `prefers-color-scheme: dark`. There is no in-app theme toggle. One runtime custom property is not a token: `--announcer-block-size`, which a script sets from the Announcer's measured height (see Components › Announcer).

**Roles.** All values are in the frontmatter. Each role is listed once below. Its purpose is the same in both modes; only its value changes.

- **Page and card.** `surface-page` is the canvas. `surface-card` is the active card, the text-field fill, the skeleton card, and the status Announcer. `border-card` is the hairline around active cards, the empty panel, and skeletons. It is decorative and exempt from WCAG 1.4.11, because the card is already defined by fill and shadow.
- **Text.** `text-primary` is the heading, the "New todo" label, and active todo text; it is the strongest pair on the page. `text-muted` is the counter and the empty-panel line.
- **Accent.** `action-primary` fills Add and Save, and only those. `focus-ring` is the same indigo as `action-primary` in light mode and a lighter lavender in dark mode, so the ring clears 3:1 on every surface.
- **Soft actions.** `action-soft`/`on-action-soft` are used by Edit, Cancel, and the status Announcer's Dismiss. `action-danger-soft` with `danger` text is used by Delete.
- **Danger.** `danger` is the over-limit counter, the inline error, the invalid field edge, the failure Announcer's edge and icon, the revert flag, and the fill of the Confirm delete button. Only on that button is it a fill behind text, with an `on-danger` label (6.54 light / 8.11 dark). It is never the only signal (see Do's and Don'ts).
- **Announcer.** `surface-announcer`/`on-announcer` form the failure banner and the list error panel. The status banner uses the card colours.
- **Done.** `text-done`, `border-done`, `surface-done-chip`/`on-done-chip`, and `surface-done-check`/`border-done-check`/`glyph-done-check` together make the receded card. No done role uses the accent, in either mode.
- **States.** `*-hover` and `*-pressed` step one shade per state. In light mode every fill steps darker. In dark mode the primary and danger fills step darker, and the tinted fills (soft, danger-soft, announcer button, and done button) step **lighter**, because a darker tint would sink into the dark card. `border-check-hover` strengthens the circle edge (darker in light mode, lighter in dark mode), checked or not, and `surface-check-pressed` is the faint press fill inside the unchecked circle.
- **Skeleton.** `skeleton` is the loading circle and bars. It is decorative: the hidden Loading status carries the loading state to assistive technology, and the page heading and labelled add form are always visible.

**Contrast, load-bearing pairs.** The targets are WCAG 2.2 AA: 4.5:1 for text and 3:1 for UI boundaries, focus indicators, and the checkbox. Values were computed from the hex values above.

| Pair (foreground on background) | Use | Light | Dark | Target | Verdict |
|---|---|---|---|---|---|
| `text-primary` on `surface-card` | active todo text; Delete confirm prompt; status Announcer text | 16.72 | 13.38 | 4.5 | AA |
| `text-primary` on `surface-page` | page heading; "New todo" label | 14.97 | 16.44 | 4.5 | AA |
| `text-done` on `surface-page` | completed todo text, done-card button labels, Delete confirm prompt on a done card | 6.01 | 6.16 | 4.5 | AA |
| `on-done-chip` on `surface-done-chip` | Done chip | 8.27 | 7.44 | 4.5 | AA |
| `text-muted` on `surface-card` | counter | 6.72 | 6.40 | 4.5 | AA |
| `text-muted` on `surface-page` | empty-panel line | 6.01 | 7.86 | 4.5 | AA |
| `danger` on `surface-card` | over-limit counter in field; failure Announcer edge over a card | 6.54 | 6.60 | 4.5 | AA |
| `danger` on `surface-page` | inline error text; invalid add-field edge; revert flag; failure Announcer edge over the page | 5.85 | 8.11 | 4.5 | AA |
| `on-action-primary` on `action-primary` | Add, Save labels | 6.20 | 7.62 | 4.5 | AA |
| `on-action-soft` on `action-soft` | Edit, Cancel, status Dismiss labels | 6.98 | 7.91 | 4.5 | AA |
| `danger` on `action-danger-soft` | Delete label | 5.67 | 6.58 | 4.5 | AA |
| `on-danger` on `danger` | Confirm delete button label; announcer and inline-error icon glyph | 6.54 | 8.11 | 4.5 | AA |
| `on-announcer` on `surface-announcer` | announcer text, Dismiss and Try again labels | 9.37 | 12.12 | 4.5 | AA |
| `danger` on `surface-announcer` | Dismiss and Try again edge | 5.72 | 7.00 | 3.0 | AA |
| `border-field` on `surface-page` | add-field edge; status Announcer edge over the page | 3.23 | 5.90 | 3.0 | AA |
| `border-field` on `surface-card` | edit-field edge; status Announcer edge over a card | 3.61 | 4.80 | 3.0 | AA |
| `border-check` on `surface-card` | unchecked circle | 4.64 | 4.80 | 3.0 | AA |
| `border-done-check` on `surface-page` | checked circle edge | 3.23 | 4.06 | 3.0 | AA |
| `border-done-check` on `surface-card` | checked circle edge in edit mode (active card treatment) | 3.61 | 3.30 | 3.0 | AA |
| `glyph-done-check` on `surface-done-check` | tick inside checked circle | 8.27 | 7.44 | 3.0 | AA |
| `border-done` on `surface-page` | done card dashed outline | 3.23 | 3.56 | 3.0 | AA |
| `focus-ring` on `surface-page` | ring around Add, field, Dismiss area | 5.55 | 10.24 | 3.0 | AA |
| `focus-ring` on `surface-card` | ring inside cards and on the status Announcer | 6.20 | 8.33 | 3.0 | AA |
| `focus-ring` on `surface-announcer` | ring on Dismiss and Try again | 5.42 | 8.84 | 3.0 | AA |
| `border-card` on `surface-card` | card hairline | 1.28 | 1.44 | — | decorative (1.4.11 exempt) |
| `skeleton` on `surface-card` | skeleton circle and bars | 1.26 | 1.88 | — | decorative (1.4.11 exempt) |

Both shadows are decorative as well. The recede check requires active todo text to out-contrast completed text in both modes: 16.72 vs 6.01 in light and 13.38 vs 6.16 in dark.

**Adjusted dark values.** `border-done-check-dark` was raised from #666B8A (2.90 on the card) to #6F7494 so the checked circle holds 3:1 when a done todo is edited; it still sits below the active circle edge (4.80), so the done check still recedes. `skeleton-dark` was raised from #2A2D42 (1.11) to #4A4F6B so low-vision users can see the cards are loading in dark mode. **[ASSUMPTION]**

**Contrast, hover and pressed.** Labels hold AA in every state. Hover applies only under `@media (hover: hover)`.

| Button | State fill token | Light rest / hover / pressed | Dark rest / hover / pressed |
|---|---|---|---|
| Add button, Save button | `action-primary` → `-hover` → `-pressed` | 6.20 / 7.47 / 8.98 | 7.62 / 6.49 / 5.55 |
| Edit button, Cancel button, status Dismiss | `action-soft` → `-hover` → `-pressed` | 6.98 / 6.34 / 5.68 | 7.91 / 6.88 / 5.95 |
| Delete button | `action-danger-soft` → `-hover` → `-pressed` | 5.67 / 5.14 / 4.60 | 6.58 / 5.83 / 5.09 |
| Confirm delete button | `danger` → `danger-hover` → `danger-pressed` | 6.54 / 7.82 / 9.30 | 8.11 / 7.02 / 6.03 |
| Dismiss button, Try again button | transparent → `announcer-button-hover` → `-pressed` | 9.37 / 8.30 / 7.26 | 12.12 / 10.66 / 9.17 |
| Done-card Edit and Delete | transparent → `done-button-hover` → `-pressed` | 6.01 / 5.49 / 4.96 | 6.16 / 5.50 / 4.79 |
| Completion check edge | `border-check` → `border-check-hover` | 4.64 / 7.41 | 4.80 / 7.35 |
| Completion check pressed fill | `surface-check-pressed`, edge unchanged | edge 3.70 | edge 4.31 |
| Checked circle edge, on the page | `border-done-check` → `border-check-hover` (hover and pressed) | 3.23 / 6.63 | 4.06 / 9.04 |

The lowest is 4.60, Delete pressed in light mode. All are AA.

**Forced colours.** Under `@media (forced-colors: active)`, box-shadows disappear, so these rules apply: focus rings are always `outline`, never shadow; the invalid field edge becomes a real 2.5px border; the check circle and tick use `CanvasText`; the revert flag is an outline; and the Announcer, empty panel, and list error panel keep a 1px `CanvasText` border. **[ASSUMPTION]**

## Typography

There is one family, the platform system stack (`typography.base`), with no web fonts. Every role inherits `base.fontFamily`.

| Role | Used by | Size / line-height | Weight |
|---|---|---|---|
| `heading` | page heading, below the wide breakpoint | 30px / 36px, −0.02em | 700 |
| `heading-wide` | page heading, at the wide breakpoint and above | 36px / 44px, −0.02em | 700 |
| `field-label` | the "New todo" label above the add field | 15px / 20px | 600 |
| `todo` | todo text on cards | 17px / 24px | 400 |
| `body` | add and edit fields, empty panel, Delete confirm prompt | 16px / 24px | 400 |
| `counter` | character counter | 13px / 16px, tabular numerals | 500 |
| `counter-over` | character counter over the limit | 13px / 16px, tabular numerals | 700 |
| `button` | Edit, Delete, Confirm delete, Save, Cancel, Dismiss, Try again | 15px | 600 |
| `button-add` | Add | 16px | 600 |
| `chip` | Done chip | 13px / 20px | 600 |
| `announcer` | announcer text, list error panel text | 15.5px / 1.45 | 400 |
| `inline-error` | "Enter a description." | 14.5px / 20px | 500 |

There is no all-caps text and no italics. Todo text is never truncated: it wraps, and long unbroken strings break with `overflow-wrap: anywhere`. Sizes are in px for parity with the mocks, and they scale with browser zoom.

## Layout & Spacing

→ Composition reference: [mockups/key-list.html](mockups/key-list.html) (phone and desktop, light and dark, bottom Announcer padding) and [mockups/key-list-states.html](mockups/key-list-states.html).

**Scale.** Every vertical gap is one of `{spacing.1}`–`{spacing.6}`: 4 / 8 / 12 / 16 / 24 / 32px. There are no off-scale vertical gaps.

**Single column.** The content column is at most `{spacing.content-max}` (720px), centred. There is no sidebar, no grid, and no second surface. The Announcer floats over this column and takes no space in it.

**Gap table.**

| From → to | Gap (px) | Token |
|---|---|---|
| Page side margin (phone) | 16 | `{spacing.4}` |
| Page top: phone / wide | 8 / 32 | `{spacing.2}` / `{spacing.6}` |
| Page bottom | 32, plus `--announcer-block-size` while the Announcer shows | `{spacing.6}` |
| Page heading → add form (its label) | 16 | `{spacing.4}` |
| "New todo" label → text field | 8 | `{components.add-form.label-gap}` |
| Text field ↔ Add button (horizontal) | 8 | `{spacing.2}` |
| Text field → inline error | 8 | `{spacing.2}` |
| Add form group (label, field, and inline error) → list, empty panel, skeleton list, or list error panel | 24 | `{spacing.5}` |
| Card → card | 12 | `{spacing.3}` |
| Card padding (vertical × horizontal) | 12 × 16 | `{spacing.3}` × `{spacing.4}` |
| Completion check → text | 12 | `{spacing.3}` |
| Text → actions row (phone) | 8 | `{spacing.2}` |
| Between card buttons | 8 | `{spacing.2}` |
| Delete confirm prompt ↔ its buttons | 8 | `{spacing.2}` |
| Edit field (or its inline error) → Save/Cancel | 8 | `{spacing.2}` |
| Done chip ← text | 8 | `{spacing.2}` |
| Empty panel and list error panel inner padding | 32 | `{spacing.6}` |
| Announcer → viewport bottom (plus the safe-area inset) | 8 | `{components.announcer.bottom}` |
| Announcer → viewport sides (phone) | 16 | `{components.announcer.inset-inline}` |
| Announcer padding (top, right, bottom / left) | 12 / 16 | `{spacing.3}` / `{spacing.4}` |
| Announcer icon → text | 12 | `{spacing.3}` |
| Announcer text → Dismiss (phone, stacked) | 8 | `{spacing.2}` |
| Announcer text ↔ Dismiss (wide, inline) | 16 | `{spacing.4}` |
| Counter icon → digits | 4 | `{spacing.1}` |

The 24px gap is the add form's bottom margin; blocks below it have zero margin (see Do's and Don'ts). The 12px card gap is a flex `gap`. Before the first successful load, pending added cards sit 12px (`{spacing.3}`) above the skeleton list or List error panel, so the two read as one stack. In the delete animation the gap lives inside the collapsing wrapper, so it collapses with the card.

**Optical offsets** are alignment nudges, not gaps.

| Element | Token | Value | Purpose |
|---|---|---|---|
| Completion check margin | `{components.completion-check.margin}` | −9px | Gives the 44×44 hit area a 26px footprint; the hit area spills into the card padding. |
| Todo text top padding | `{components.todo-card.text-nudge}` | 1px | Lines the text up with the circle. |
| Check-and-text block top padding (wide layout) | `{components.todo-card.check-row-nudge-wide}` | 7px | Centres the circle and first line on the 40px buttons. |
| Completion check top margin (edit mode) | `{components.completion-check.nudge-edit}` | −2px | Nudges the check up in edit mode. |

**Responsive rules.** There is one breakpoint, `{spacing.breakpoint-wide}` (768px), which is **[ASSUMPTION]**. The mocks show only a 390px phone and a 1200px desktop, and no file fixes the switch point. 768px is the smallest width that fits the 720px column plus 24px on each side.

| Concern | Phone (< 768px) | Wide (≥ 768px) |
|---|---|---|
| Side and top margins | Full width with 16px side margins; 8px top | A centred 720px column; 32px top |
| Heading role | `heading` | `heading-wide` |
| Card actions placement | Card actions (Edit/Delete, the Delete confirm, or Save/Cancel) sit **under** the text on their own row, right-aligned, 8px below. | Edit/Delete, or the Delete confirm that replaces them, sit **inline** on the card's first line, top-aligned, right side. Edit mode keeps Save/Cancel under the field in both layouts. |
| Delete confirm wrap | The row wraps, so its prompt sits on its own line above its buttons when they don't fit on one line. | The same wrap rule (see Components › Delete confirm). |
| Card button min height | `{spacing.target-min}` (44px) | `{spacing.target-min-wide}` (40px) |
| Announcer placement and Dismiss position | Pinned to the bottom of the viewport, spanning the width less 16px each side; the text stacks above a right-aligned Dismiss. | Pinned to the bottom of the viewport, centred, at most 720px wide; Dismiss sits inline to the right of the text. |

The Add button sits beside the field at every width (see Components › Add form). The minimum supported width is 320px, **[ASSUMPTION]**, from WCAG 1.4.10 reflow.

## Elevation & Depth

There are three layers: the page, the card, and the overlay. The active Todo card, and only the active card, carries `components.todo-card.shadow`, a single 1px/3px shadow at 10% ink. It is the same value in both modes and is decorative. Done cards have no fill and no shadow; they sit *on* the page, not above it. The skeleton card, empty panel, and list error panel are flat and are defined by fill or edge.

The **Announcer is the only thing that floats** (position, z-index, and shadow: Components › Announcer). Its shadow is the same value in both modes but barely reads in dark mode, so there the overlay's fill and its 1px edge (≥ 3:1 over both page and card, see Colors) separate it from the content beneath. There are no dialogs, popovers, menus, toasts, or other sticky bars. Hierarchy comes from fill vs. no fill and from text contrast, not from stacked shadows.

## Shapes

| Token | Value | Used by |
|---|---|---|
| `{rounded.card}` | 16px | Todo card, text field box, Add button, Announcer, empty panel, skeleton card, list error panel |
| `{rounded.button}` | 12px | Edit, Delete, Confirm delete, Save, Cancel, Dismiss, Try again |
| `{rounded.bar}` | 6px | skeleton text bar |
| `{rounded.full}` | 9999px | Completion check circle, Done chip, announcer and inline-error icons |

Containers are 16px, controls inside them are 12px, and status marks are round. There are no square corners and no pill-shaped buttons.

## Components

→ Visual reference: [mockups/key-row-interactions.html](mockups/key-row-interactions.html) for the edit, invalid, over-limit, delete-confirm, revert, and Announcer states, and [mockups/key-motion-and-buttons.html](mockups/key-motion-and-buttons.html) for rest, hover, pressed, and focus-visible on every button and the completion check. These mocks illustrate this file.

Each spec lists anatomy, then appearance per state. Token values are in the frontmatter, and the token-to-CSS rule is under Colors. Behaviour lives in EXPERIENCE.md under the same component names. Icons (the announcer and inline-error "!", the warning triangle, and the tick): inline SVG or text glyph, `aria-hidden` (see Do's and Don'ts).

**Focus ring** (global). A `{components.focus-ring.width}` (3px) solid `{colors.focus-ring}` outline at a `{components.focus-ring.offset}` (3px) offset, shown on `:focus-visible` for every focusable element in every state. On a text field it wraps the whole field box, counter included (`:focus-within`). On the Completion check it is drawn on the visual circle. The ring always sits outside the fill, on the page or card, so its contrast is measured against those surfaces.

**Page heading.** `<h1>` "BMad Todos". `heading` below the breakpoint, `heading-wide` at or above it, in `{colors.text-primary}` on the page. It has no states. It carries `tabindex="-1"` as a programmatic focus target only (see EXPERIENCE.md Interaction Primitives › Focus management), and shows no ring when focused that way.

**Announcer.** A bottom overlay. While it holds a message it is `position: fixed` at `bottom: calc(env(safe-area-inset-bottom, 0px) + {components.announcer.bottom})` on every width, inset `{components.announcer.inset-inline}` from each side, at most `{components.announcer.max-width}` wide and centred, so it lines up with the content column. It floats over content at `{components.announcer.z-index}` with `{components.announcer.shadow}` (cast upward), and never pushes or shifts anything. While it shows, a script measures it and sets `--announcer-block-size` (its height plus its bottom offset plus `{spacing.2}`). The page adds that to its bottom padding, and the root sets `scroll-padding-bottom: var(--announcer-block-size, 0px)`, so the last cards can scroll clear of it and a focused control is never scrolled under it (WCAG 2.4.11). Padding added below the list shifts nothing above it. The property returns to 0 when the message clears. Live-element rules (what the live element wraps, never hiding it, replacement, and the soft keyboard): EXPERIENCE.md Component Patterns › Announcer.
- **Anatomy:** a 24px round icon (failure variant only, `aria-hidden`), the message text, and a Dismiss button.
- **Failure variant** (every failure): `{colors.surface-announcer}` fill, a 1px `{colors.danger}` edge, `{rounded.card}`, and the message in `announcer` type and `{colors.on-announcer}`. The icon is a `{colors.danger}` circle with "!" in `{colors.on-danger}` at `{components.announcer.icon-glyph-size}`/`{components.announcer.icon-glyph-weight}`, nudged `{components.announcer.icon-nudge}` down. The message text has `{components.announcer.message-padding-top}` top padding so its first line aligns with the icon.
- **Status variant** ("Added “…”." and "Deleted “…”."), **[ASSUMPTION]** because the user approved the copy but no colour was designed for a success message: `{colors.surface-card}` fill, `{colors.text-primary}` text, a 1px `{colors.border-field}` edge, and no icon. Every pair in both variants is verified in the Colors contrast table.
- **Empty:** no fill, edge, shadow, padding, icon, or Dismiss, and `pointer-events: none`. Only the empty live element stays mounted.
- **States:** entering (see EXPERIENCE.md Motion), shown, replaced (the text swaps in place), and leaving on Dismiss.

**Dismiss button.** Outline button inside the Announcer. Failure variant: transparent fill, 1.5px `{colors.danger}` edge, `{colors.on-announcer}` label, `button` type, `{rounded.button}`, min-height `{spacing.target-min}`, and 16px side padding. Hover: `{colors.announcer-button-hover}`. Pressed: `{colors.announcer-button-pressed}` plus scale `{motion.press-scale}`. Focus-visible: ring. Status variant, **[ASSUMPTION]**: the Cancel button's soft style, from `components.dismiss-button-status` (`{colors.action-soft}` fill, `{colors.on-action-soft}` label, and the soft hover and pressed fills).

**Add form.** The visible label "New todo" (a `<label>` for the textarea, in `field-label` type and `{components.add-form.label-foreground}`, on the page). Then, `{components.add-form.label-gap}` below, a row with the Text field (flex 1) and the Add button (flex none), 8px apart and top-aligned, with the Inline error beneath. Bottom margin `{spacing.5}`. There is no placeholder.

**Text field** (add and edit). A box with a `{colors.surface-card}` fill, a 1.5px `{colors.border-field}` edge, and `{rounded.card}`. It holds an auto-growing textarea (`field-sizing: content`, no inner scroll, no resize handle, `overflow-wrap: anywhere`), at least `{components.text-field.textarea-min-height}` tall (8px top padding plus one 24px line). Where `CSS.supports('field-sizing', 'content')` is false, a small script sets the textarea's height from its `scrollHeight` on mount, on input, and on width change, so it still grows with no inner scroll. Text padding is 8px top and 12px sides. The Character counter sits bottom-right inside the box, in a footer with 12px side and 8px bottom padding. Text in `body` type. No placeholder. States:
- **Rest:** as above, one line tall, 59px for the add field including the counter.
- **Focus-visible:** focus ring around the whole box.
- **Invalid (empty submit, or over the limit):** the edge becomes `{colors.danger}` and thickens inward from 1.5 to 2.5px, using a 1px inset shadow, so the 3px-offset focus ring keeps a clean gap.
- **Over-limit:** invalid edge plus the Character counter's over state.
- **Long text:** the box grows downward. In the add form, the Add button stays top-aligned and does not move.

**Character counter.** "n/200" in `counter` type and `{colors.text-muted}`, tabular numerals, always visible, "0/200" when empty. Over the limit: `counter-over` (bold) in `{colors.danger}`, preceded by a 14px warning triangle (`{colors.danger}` fill, an "!" in `{components.character-counter.icon-glyph}` with a `{components.character-counter.icon-stroke}` stroke), 4px gap. Red, bold, an icon, and a number above 200 make four signals, so colour is never the only one.

**Inline error.** Under the field, 8px below. An 18px round icon (`{colors.danger}` fill, "!" in `{colors.on-danger}` at `{components.inline-error.icon-glyph-size}`/`{components.inline-error.icon-glyph-weight}`, `aria-hidden`), 8px gap, then the text in `inline-error` type and `{colors.danger}`. Used only for "Enter a description." Over-limit uses the counter, not a sentence.

**Field status.** A visually hidden live region beside each Text field, with no visual appearance. It is listed so both spines name it.

**Add button.** `{colors.action-primary}` fill, `{colors.on-action-primary}` label "Add" in `button-add` type, `{rounded.card}`, 59px tall, 22px side padding, and no border. Hover: `{colors.action-primary-hover}`. Pressed: `{colors.action-primary-pressed}` plus scale. Focus-visible: ring on the page. It is never shown disabled.

**Todo list.** A `<ul role="list">` with no bullets or padding, a flex column with a `{spacing.3}` gap. The explicit role keeps list semantics in WebKit, which drops them when a list's bullets are removed (`list-style: none`). While loading, a separate skeleton list holds the skeleton cards.

**Todo card.** An `<li>` wrapper holding the card, so the 12px gap lives inside the wrapper and collapses with the card on delete. Phone: the check-and-text line on top (check, 12px gap, text), then the actions row. Wide: a single flex row with the check-and-text line (flex 1, `{components.todo-card.check-row-nudge-wide}` top nudge) and inline actions. Text in `todo` type wraps fully, and the check aligns to the first line. The text sits in its own element, and the Done chip is a sibling of it, not inside it. States:
- **Active (rest):** `{colors.surface-card}` fill, 1.5px `{colors.border-card}` hairline, `{rounded.card}`, card shadow, `{colors.text-primary}` text, an empty check, and soft Edit and Delete.
- **Done:** transparent fill, no shadow, 1.5px **dashed** `{colors.border-done}` outline, `{colors.text-done}` text, a checked circle, the Done chip after the text, and done-card buttons. The cues are fill, outline style, tick, chip, and text tone, so colour is never alone (R6).
- **Edit:** the text is replaced by the Text field (edit), with Save and Cancel right-aligned 8px below it, or below its inline error. The card always takes the **active** treatment in edit mode, even for a done todo, so the field and buttons keep their verified contrast. **[ASSUMPTION]** The check stays visible, nudged 2px up, and a checked circle keeps 3:1 on the card (3.61 light / 3.30 dark). The card height snaps to fit.
- **Edit, invalid / over-limit:** the Text field's invalid states, inside the card.
- **Delete confirm:** Edit and Delete are replaced, in place, by the Delete confirm. The card keeps its active or done treatment. **[ASSUMPTION]**
- **Leaving (deleted):** the card fades out and collapses, taking its 12px gap with it. Animates per EXPERIENCE.md Motion.
- **Revert flag:** after a failed save, the card returns to its previous state and a `{components.revert-flag.width}` `{colors.danger}` CSS `outline` appears with `outline-offset: {components.revert-flag.offset}`, so it sits clear of the card's edge and follows the card's radius without a token of its own. Animates per EXPERIENCE.md Motion.
- **Hover:** the card itself has no hover state. Only its controls do.

**Completion check.** A round 26px visual circle with a 44×44 hit area, bound to a native checkbox. The native `<input type="checkbox">` is `opacity: 0; position: absolute; inset: 0; margin: 0` (with `appearance: none`) and covers the full 44×44 hit area, so it is the touch target, the explore-by-touch target, and the assistive-technology focus rectangle. The decorative `aria-hidden` SVG circle and tick sit beneath it and are styled through `input:checked + svg`, `input:hover + svg`, `input:active + svg`, and `input:focus-visible + svg`. The tick path is `M3.5 8.4l3 3 6-6.8` in a 16×16 box, with a `{components.completion-check-done.glyph-stroke}` stroke, round caps and joins, and `stroke-dasharray: {components.completion-check-done.glyph-dash}`. States:
- **Unchecked rest:** a 2px `{colors.border-check}` edge with a `{colors.surface-card}` fill.
- **Hover:** the edge goes to `{colors.border-check-hover}`.
- **Pressed:** the fill goes to `{colors.surface-check-pressed}`, edge unchanged.
- **Checked:** `{colors.surface-done-check}` fill, a `{colors.border-done-check}` edge, and a `{colors.glyph-done-check}` tick (`stroke-dashoffset: 0`). It is grey, never the accent, in both modes.
- **Checked, hover and pressed:** the edge goes to `{components.completion-check-done.border-color-hover}`; the fill and tick stay. **[ASSUMPTION]**
- **Focus-visible:** the ring around the circle.

**Done chip.** "Done" in `chip` type, `{colors.on-done-chip}` on `{colors.surface-done-chip}`, `{rounded.full}`, 9px side padding, 8px after the text, sitting on the text baseline (raised `{components.done-chip.raise}`). It appears only on done cards and is decorative to assistive technology.

**Edit form.** The Text field (edit) plus Save and Cancel, right-aligned, 8px apart, and 8px below. It sits inside the card's 12×16px padding.

**Delete confirm.** Replaces the card's Edit and Delete in the same place: the prompt "Delete this todo?" in `body` type, then the Confirm delete button and the Cancel button, `{components.delete-confirm.gap}` apart, right-aligned, and vertically centred. The prompt is `{components.delete-confirm.foreground}` on an active card and `{components.delete-confirm.foreground-done}` on a done card. The row wraps, so on a narrow card the prompt sits on its own line above the buttons. Both buttons keep their full style on a done card (not the done-card variant), so the choice reads clearly. **[ASSUMPTION]** It has no icon and no fill of its own.

**Card buttons.** All share `{rounded.button}`, `button` type, min-width 64px, 16px side padding, a 1.5px border (transparent unless stated), and min-height `{spacing.target-min}`, or `{spacing.target-min-wide}` in the wide layout. Every card button has rest, hover (pointer only), pressed (one more step plus scale `{motion.press-scale}`), and focus-visible (ring) states. None has a disabled appearance.
- **Edit button:** `{colors.action-soft}` fill, `{colors.on-action-soft}` label.
- **Delete button:** `{colors.action-danger-soft}` fill, `{colors.danger}` label.
- **Confirm delete button:** the strong danger button. `{colors.danger}` fill, `{colors.on-danger}` label "Delete", and no border. Hover: `{colors.danger-hover}`. Pressed: `{colors.danger-pressed}`. Used only in the Delete confirm.
- **Save button:** `{colors.action-primary}` fill, `{colors.on-action-primary}` label, 20px side padding, and no border.
- **Cancel button:** the same soft style as Edit, used in both the Edit form and the Delete confirm.
- **Done-card variant (Edit and Delete on a done card):** transparent fill, a 1.5px `{colors.border-done}` edge, and a `{colors.text-done}` label. Hover: `{colors.done-button-hover}`. Pressed: `{colors.done-button-pressed}`. Delete loses its red on a done card, deliberately, so the card recedes.

**Empty panel.** A `<p>` "No todos yet." in `body` type and `{colors.text-muted}`, centred, with 32px padding, a 1.5px `{colors.border-card}` outline, `{rounded.card}`, and no fill. It has no illustration, icon, or button.

**Skeleton card.** Three cards in the skeleton list while loading. Each has the active card's fill, hairline, radius, and 12×16px padding, a `{components.skeleton-card.circle-size}` `{colors.skeleton}` circle, a 12px gap, and a 12px-tall `{colors.skeleton}` bar at `{rounded.bar}`. The bar widths are 62%, 44%, and 54%. Breathing animates per EXPERIENCE.md Motion. There is no visible loading text.

**Loading status.** A visually hidden status text with no visual appearance. It is listed so both spines name it.

**List error panel.** **[ASSUMPTION]** No mock shows this state. It uses the announcer's verified failure colours on the empty panel's geometry: `{colors.surface-announcer}` fill, a 1px `{colors.danger}` edge, `{rounded.card}`, 32px padding, and centred text in `announcer` type and `{colors.on-announcer}`. It holds the message line, then the Try again button 16px below and centred. There is no icon.

**Try again button.** The same style as the Dismiss button (failure variant): transparent, a 1.5px `{colors.danger}` edge, a `{colors.on-announcer}` label, the hover and pressed announcer-button fills, scale on press, and the ring on focus.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Write every global or element reset at zero specificity: `:where(.app) :where(h1, p, ul) { margin: 0 }`, `:where(.app) :where(button, input, textarea) { font: inherit; color: inherit }`. CSS Module classes must always win. | Write resets like `.app p` or `.app button` (specificity 0,1,1). In an earlier mock (v2), they beat the single-class component rules (0,1,0), zeroed every section gap, and stripped the Add/Save label colour, which was an AA failure. |
| Put the 24px section gap on the add form's bottom margin and keep list, empty, skeleton, and error blocks at zero margin. | Add ad-hoc margins to the blocks below the form, or use any gap off the 4/8/12/16/24/32 scale. |
| Pair every colour signal with a second cue: a dashed outline, tick, and chip for done; an icon, bold weight, number, and thicker edge for over the limit; an icon and text for errors; an outline plus colour for the revert flag, paired with the announcer text. | Signal state by colour alone (WCAG 1.4.1), or let a done card out-shine an active one in either mode. |
| Keep every button enabled and styled the same in every state. Invalid input is caught on press. | Use `disabled`, `aria-disabled`, or a greyed-out look on any control. |
| Show Edit and Delete on every card at all times, except where the card's own Edit form or Delete confirm replaces them. Hover only tints a fill, and only under `@media (hover: hover)`. | Hide actions until hover or focus, or put them behind a menu or swipe. |
| Report outcomes in the one Announcer overlay, validation inline under the field, and confirm a delete inline in its card. | Add toasts, snackbars, per-row alerts, modal confirm dialogs, or popovers, or let the Announcer push content down. |
| Draw the focus ring outside the fill at 3px/3px, as an `outline`, and thicken the invalid edge inward. | Remove outlines, rely on the browser default ring, draw the ring as a shadow, or let the ring overlap the red edge. |
| Draw every icon as inline SVG in JSX or a text glyph, `aria-hidden`. | Use CSS `url()` or data-URI icons: AD-19's CSP (`default-src 'self'`) blocks `data:` images, and Vite inlines small CSS assets as data URIs. |
| Read every value from tokens through the 1:1 custom properties. The tick's SVG path data and the skeleton bar percentages are the only literals. | Hard-code hex, px, or ms in component CSS, or add a CSS framework or CSS-in-JS. |
| Transition only opacity, transform, colour (fill, edge, text), `stroke-dashoffset`, and grid-row height, inside `prefers-reduced-motion: no-preference`. Put the card shadow and the done card's dashed outline on their own layers and fade those layers' opacity. | Animate `width`, `height`, `top`, `margin`, or other layout properties directly, chain animations, loop anything beyond the skeleton's three breaths, or make any state wait for an animation. |
