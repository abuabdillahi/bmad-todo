import { DESCRIPTION_MAX_LENGTH } from '@todo/contract/description';

/**
 * Every runtime string the app speaks or shows (AD-14, EXPERIENCE.md Voice and
 * Tone). Story 5 adds the failure leads per action, the reasons per
 * `FailureKind`, the `deletedElsewhere` override, the status messages (`added`,
 * `deleted`) and the List error panel line here.
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
} as const;
