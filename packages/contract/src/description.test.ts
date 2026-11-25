import { Ajv } from 'ajv';
import { checkDescription, type DescriptionProblem } from './description.ts';
import { Description } from './todo.ts';

// The API's Ajv options (AD-8): Fastify's defaults with coercion and stripping off.
const ajv = new Ajv({ coerceTypes: false, removeAdditional: false, useDefaults: true, allErrors: false });
const validate = ajv.compile(Description);

const emoji = '\u{1F600}';

/** One table for the schema and the client check (U1). `input` is trimmed first. */
const cases: { name: string; input: string; verdict: DescriptionProblem | null }[] = [
  { name: 'an empty string', input: '', verdict: 'empty' },
  { name: 'whitespace only', input: ' \t\n\u00a0 ', verdict: 'empty' },
  { name: 'one code point', input: 'a', verdict: null },
  { name: 'one code point after trimming', input: '  a\n', verdict: null },
  { name: '200 code points', input: 'x'.repeat(200), verdict: null },
  { name: '201 code points', input: 'x'.repeat(201), verdict: 'too-long' },
  { name: '200 code points after trimming padding', input: `  ${'x'.repeat(200)}  `, verdict: null },
  { name: '200 single-code-point emoji (400 UTF-16 units)', input: emoji.repeat(200), verdict: null },
  { name: '201 single-code-point emoji', input: emoji.repeat(201), verdict: 'too-long' },
  { name: 'the letters p, c, C and braces', input: 'pick up {Cc} and \\p{Cc}', verdict: null },
  { name: 'ordinary punctuation and accents', input: "Caf\u00e9, na\u00efve & <b>'x'</b>", verdict: null },
  { name: 'an inner line feed', input: 'Buy\nmilk', verdict: 'forbidden-character' },
  { name: 'an inner carriage return', input: 'Buy\rmilk', verdict: 'forbidden-character' },
  { name: 'an inner tab', input: 'Buy\tmilk', verdict: 'forbidden-character' },
  { name: 'NUL', input: 'Buy\u0000milk', verdict: 'forbidden-character' },
  { name: 'DEL (U+007F)', input: 'Buy\u007fmilk', verdict: 'forbidden-character' },
  { name: 'NEL (U+0085)', input: 'Buy\u0085milk', verdict: 'forbidden-character' },
  { name: 'LINE SEPARATOR (U+2028)', input: 'Buy\u2028milk', verdict: 'forbidden-character' },
  { name: 'PARAGRAPH SEPARATOR (U+2029)', input: 'Buy\u2029milk', verdict: 'forbidden-character' },
  { name: 'ESC (U+001B)', input: 'Buy\u001bmilk', verdict: 'forbidden-character' },
];

describe('description rule', () => {
  it.each(cases)('U1 $name: schema and client check agree', ({ input, verdict }) => {
    const trimmed = input.trim();

    expect(checkDescription(trimmed)).toBe(verdict);
    expect(validate(trimmed), JSON.stringify(validate.errors)).toBe(verdict === null);
  });
});
