import { FORBIDDEN_CHARACTER } from '@todo/contract/description';

/** Every forbidden character, from the contract's one-character class (AD-8). */
const FORBIDDEN_CHARACTERS = new RegExp(FORBIDDEN_CHARACTER.source, 'gu');

/**
 * Replaces each control character and U+2028/U+2029 with one space. Every
 * forbidden character is one UTF-16 unit, so the length and any caret offset
 * are unchanged.
 */
export function replaceForbidden(text: string): string {
  return text.replace(FORBIDDEN_CHARACTERS, ' ');
}

/** The value that is counted, checked and sent (AD-8): replace, then trim. */
export function prepareDescription(raw: string): string {
  return replaceForbidden(raw).trim();
}

/** Unicode code points, the unit the API's limit uses (AD-8). */
export function countCodePoints(text: string): number {
  return [...text].length;
}
