import type { FailureKind } from '../api/client.ts';
import { messages, quote, type TodoAction } from './messages.ts';

/** EXPERIENCE Voice and Tone, verbatim. */
const REASON = {
  network: 'Check your connection and try again.',
  unavailable: "The server isn't available right now. Try again in a moment.",
  generic: 'Something went wrong on our side. Try again.',
  validation: 'Keep it to 1–200 characters.',
};

const KINDS: FailureKind[] = ['validation', 'not-found', 'conflict', 'unavailable', 'internal', 'network', 'generic'];

/** The reason each kind gets when validation doesn't apply to the action. */
function plainReason(kind: FailureKind): string {
  if (kind === 'network') return REASON.network;
  if (kind === 'unavailable') return REASON.unavailable;
  return REASON.generic;
}

describe('messages', () => {
  it('K7 quotes text in curly double quotes', () => {
    expect(quote('Buy milk')).toBe('“Buy milk”');
  });

  it('K7 keeps exactly 40 code points uncut, emoji counted as one', () => {
    const text = `${'a'.repeat(39)}😀`;
    expect(quote(text)).toBe(`“${text}”`);
  });

  it('K7 cuts over 40 code points at 40 and puts the ellipsis inside the closing quote', () => {
    expect(quote(`${'😀'.repeat(40)}x`)).toBe(`“${'😀'.repeat(40)}…”`);
    expect(quote('a'.repeat(41))).toBe(`“${'a'.repeat(40)}…”`);
  });

  it('K7 trims trailing whitespace at the cut before the ellipsis', () => {
    expect(quote(`${'a'.repeat(37)}   tail`)).toBe(`“${'a'.repeat(37)}…”`);
  });

  const leads: Record<TodoAction, string> = {
    add: 'Couldn\'t add “Buy milk”.',
    edit: 'Couldn\'t save your edit, so “Buy milk” is back as it was.',
    complete: 'Couldn\'t mark “Buy milk” done, so it\'s still open.',
    reopen: 'Couldn\'t reopen “Buy milk”, so it\'s still done.',
    delete: 'Couldn\'t delete “Buy milk”, so it\'s back in the list.',
  };

  for (const [action, lead] of Object.entries(leads) as [TodoAction, string][]) {
    it.each(KINDS)(`K7 composes the ${action} lead with the reason for %s`, (kind) => {
      expect(messages.failureMessage(action, { kind }, 'Buy milk')).toBe(`${lead} ${plainReason(kind)}`);
    });
  }

  it.each(['add', 'edit'] as const)('K7 gives %s the validation reason only when the problem names description', (action) => {
    expect(messages.failureMessage(action, { kind: 'validation', namesDescription: true }, 'Buy milk')).toBe(
      `${leads[action]} ${REASON.validation}`,
    );
    expect(messages.failureMessage(action, { kind: 'validation', namesDescription: false }, 'Buy milk')).toBe(
      `${leads[action]} ${REASON.generic}`,
    );
  });

  it.each(['complete', 'reopen', 'delete'] as const)('K7 never gives %s the validation reason', (action) => {
    expect(messages.failureMessage(action, { kind: 'validation', namesDescription: true }, 'Buy milk')).toBe(
      `${leads[action]} ${REASON.generic}`,
    );
  });

  it.each(KINDS)('K7 composes the refresh lead with the reason for %s', (kind) => {
    expect(messages.failureMessage('refresh', { kind, namesDescription: true })).toBe(
      `Couldn't refresh the list. You're seeing what was last loaded. ${plainReason(kind)}`,
    );
  });

  it.each(KINDS)('K7 composes the List error panel line for %s', (kind) => {
    expect(messages.loadError(kind)).toBe(`Couldn't load your todos. ${plainReason(kind)}`);
  });

  it('K7 quotes the todo in the overrides and status messages', () => {
    expect(messages.deletedElsewhere('Buy milk')).toBe('“Buy milk” was deleted elsewhere.');
    expect(messages.added('Buy milk')).toBe('Added “Buy milk”.');
    expect(messages.deleted('Buy milk')).toBe('Deleted “Buy milk”.');
    expect(messages.failureMessage('add', { kind: 'network' }, 'a'.repeat(50))).toBe(
      `Couldn't add “${'a'.repeat(40)}…”. ${REASON.network}`,
    );
    expect(messages.dismiss).toBe('Dismiss');
  });
});
