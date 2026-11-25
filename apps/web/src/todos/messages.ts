import { DESCRIPTION_MAX_LENGTH } from '@todo/contract/description';
import type { FailureKind } from '../api/client.ts';

/** The longest `{t}` in code points before it is cut (EXPERIENCE Voice and Tone). */
const QUOTE_MAX_LENGTH = 40;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * `{t}`: the todo text in curly double quotes. Over 40 code points it is cut to
 * at most 40, on a whole user-perceived character (grapheme cluster), so it may
 * keep fewer than 40 but never more. Trailing whitespace is trimmed, and "…"
 * goes inside the closing quote.
 */
export function quote(text: string): string {
  if ([...text].length <= QUOTE_MAX_LENGTH) return `“${text}”`;
  let kept = '';
  let count = 0;
  for (const { segment } of graphemes.segment(text)) {
    count += [...segment].length;
    if (count > QUOTE_MAX_LENGTH) break;
    kept += segment;
  }
  return `“${kept.trimEnd()}…”`;
}

/** Actions whose failure lead names the todo. */
export type TodoAction = 'add' | 'edit' | 'complete' | 'reopen' | 'delete';
/** Actions on the whole list. `load` is the List error panel's only. */
export type ListAction = 'refresh' | 'load';
export type FailureAction = TodoAction | ListAction;

/** What a message needs from a failure (AD-9): its kind, and whether a validation problem names `description`. */
export interface FailureInfo {
  readonly kind: FailureKind;
  readonly namesDescription?: boolean;
}

const genericReason = 'Something went wrong on our side. Try again.';

/** Reasons per `FailureKind` (AD-14). Kinds without a reason of their own get the generic one. */
const reason: Readonly<Record<FailureKind, string>> = {
  network: 'Check your connection and try again.',
  unavailable: "The server isn't available right now. Try again in a moment.",
  validation: 'Keep it to 1–200 characters.',
  internal: genericReason,
  conflict: genericReason,
  'not-found': genericReason,
  generic: genericReason,
};

/** Failure leads per action (EXPERIENCE Voice and Tone). */
const lead = {
  add: (t: string): string => `Couldn't add ${quote(t)}.`,
  edit: (t: string): string => `Couldn't save your edit, so ${quote(t)} is back as it was.`,
  complete: (t: string): string => `Couldn't mark ${quote(t)} done, so it's still open.`,
  reopen: (t: string): string => `Couldn't reopen ${quote(t)}, so it's still done.`,
  delete: (t: string): string => `Couldn't delete ${quote(t)}, so it's back in the list.`,
  refresh: "Couldn't refresh the list. You're seeing what was last loaded.",
  load: "Couldn't load your todos.",
} as const;

/**
 * The reason for a failure of this action: `validation` only for `add` and
 * `edit` when the problem names `description`, otherwise its kind's reason,
 * which is the generic one for `validation`, `conflict`, `not-found` and `internal`.
 */
function reasonFor(action: FailureAction, failure: FailureInfo): string {
  if (failure.kind === 'validation') {
    return (action === 'add' || action === 'edit') && failure.namesDescription === true
      ? reason.validation
      : genericReason;
  }
  return reason[failure.kind];
}

/** `lead[action] + " " + reason[kind]` (EXPERIENCE Voice and Tone › Composition). */
function failureMessage(action: TodoAction, failure: FailureInfo, text: string): string;
function failureMessage(action: ListAction, failure: FailureInfo): string;
function failureMessage(action: FailureAction, failure: FailureInfo, text = ''): string {
  const head = lead[action];
  return `${typeof head === 'function' ? head(text) : head} ${reasonFor(action, failure)}`;
}

/**
 * Every runtime string the app speaks or shows (AD-14, EXPERIENCE.md Voice and
 * Tone): the failure leads per action, the reasons per `FailureKind`, the
 * overrides, the status messages, the List error panel line and the inline
 * field strings.
 */
export const messages = {
  /** Field strings, never sent to the Announcer (EXPERIENCE Voice and Tone › Inline, AD-8). */
  inline: {
    empty: 'Enter a description.',
    counter: (count: number): string => `${count}/${DESCRIPTION_MAX_LENGTH}`,
    overLimitSuffix: ', over the character limit',
    overLimit: 'over the character limit',
    hintAdd: 'Press Enter to add.',
    hintEdit: 'Press Enter to save.',
  },
  lead,
  reason,
  failureMessage,
  /** Replaces lead plus reason for `not-found` on edit, complete or reopen, and a refetch removing a row in edit mode. */
  deletedElsewhere: (t: string): string => `${quote(t)} was deleted elsewhere.`,
  /** Status: an add the server confirmed. */
  added: (t: string): string => `Added ${quote(t)}.`,
  /** Status: a delete the server confirmed, or `not-found` on delete. */
  deleted: (t: string): string => `Deleted ${quote(t)}.`,
  /** The List error panel line (and the Loading status on entering Error). */
  loadError: (kind: FailureKind): string => failureMessage('load', { kind }),
  dismiss: 'Dismiss',
} as const;
