/**
 * The one rule for a todo description (AD-8), shared by the API schema and the
 * web client's check. Dependency-free: the web imports it at runtime (AD-5).
 *
 * The rule applies to the trimmed value: 1–200 Unicode code points, and no
 * control character (`\p{Cc}`, which includes `\n`, `\r` and `\t`) and no
 * U+2028 or U+2029.
 */

/**
 * One forbidden character. A RegExp literal with the `u` flag, never a plain
 * string, where `\p{Cc}` would silently become the letters `p`, `C` and `c`.
 */
export const FORBIDDEN_CHARACTER = /[\p{Cc}\u2028\u2029]/u;

export const DESCRIPTION_MIN_LENGTH = 1;
export const DESCRIPTION_MAX_LENGTH = 200;

/**
 * The schema's pattern: the anchored, negated form of `FORBIDDEN_CHARACTER`,
 * built from the literal's source. Ajv compiles it with the `u` flag.
 */
export const DESCRIPTION_PATTERN = `^[^${FORBIDDEN_CHARACTER.source.slice(1, -1)}]*$`;

export type DescriptionProblem = 'empty' | 'too-long' | 'forbidden-character';

/** Checks an already-trimmed description; `null` means it is valid. Counts code points. */
export function checkDescription(trimmed: string): DescriptionProblem | null {
  const length = [...trimmed].length;
  if (length < DESCRIPTION_MIN_LENGTH) return 'empty';
  if (length > DESCRIPTION_MAX_LENGTH) return 'too-long';
  if (FORBIDDEN_CHARACTER.test(trimmed)) return 'forbidden-character';
  return null;
}
