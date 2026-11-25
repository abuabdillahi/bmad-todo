import { checkDescription } from '@todo/contract/description';
import { countCodePoints, prepareDescription, replaceForbidden } from './description-input.ts';

describe('description input', () => {
  it.each([
    ['line feed', '\n'],
    ['tab', '\t'],
    ['NUL', '\u0000'],
    ['DEL', '\u007f'],
    ['NEL', '\u0085'],
    ['line separator', ' '],
    ['paragraph separator', ' '],
  ])('K1 replaces a %s with one space', (_name, character) => {
    expect(replaceForbidden(`a${character}b`)).toBe('a b');
  });

  it('K1 replaces CR LF with two spaces, keeping the length in UTF-16 units', () => {
    const raw = 'One\r\nTwo\tThree';
    const cleaned = replaceForbidden(raw);
    expect(cleaned).toBe('One  Two Three');
    expect(cleaned).toHaveLength(raw.length);
  });

  it('K1 leaves the letters p, c, C and braces alone', () => {
    expect(replaceForbidden('p{Cc} cC')).toBe('p{Cc} cC');
  });

  it('K1 prepares a description by replacing, then trimming, so the result passes the check', () => {
    const prepared = prepareDescription('\n  Buy\tmilk  ');
    expect(prepared).toBe('Buy milk');
    expect(checkDescription(prepared)).toBeNull();
    expect(prepareDescription('\r\n\t ')).toBe('');
  });

  it('K1 counts an emoji as one code point', () => {
    expect(countCodePoints('😀')).toBe(1);
    expect(countCodePoints('😀'.repeat(201))).toBe(201);
    expect(countCodePoints('')).toBe(0);
  });
});
