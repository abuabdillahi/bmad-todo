import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The app's list loads on mount; a test's own GET handler, added later, wins.
beforeEach(() => {
  server.use(http.get('*/api/todos', () => HttpResponse.json([])));
});

function renderAddForm() {
  const { user, field, addButton } = renderApp();
  return { user, field: field as HTMLElement, addButton };
}

/** The add form's Field status, beside the app's other live regions. */
function addFormStatus() {
  return within(screen.getByRole('textbox', { name: 'New todo' }).closest('form')!).getByRole('status');
}

/**
 * Text queries that skip the live regions (the hidden Field status, and the
 * Announcer's live element). A blocked submit shows the Inline error at once
 * and puts the same words in the Field status one animation frame later, so an
 * unscoped text query matches both once that frame has run.
 */
const NOT_STATUS = { ignore: '[role="status"], script, style' };

/** Answers POST /api/todos with 201 and records each request body. */
function acceptCreates(): CreateTodoBody[] {
  const received: CreateTodoBody[] = [];
  server.use(
    http.post('*/api/todos', async ({ request }) => {
      const body = (await request.json()) as CreateTodoBody;
      received.push(body);
      const todo: Todo = { ...body, completed: false, createdAt: new Date().toISOString() };
      return HttpResponse.json(todo, { status: 201 });
    }),
    http.get('*/api/todos', () => HttpResponse.json([])),
  );
  return received;
}

describe('AddForm', () => {
  it('K1 submits a valid description with Enter and clears itself, keeping focus', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    await user.click(field);
    await user.keyboard('Buy milk');
    expect(screen.getByText('8/200')).toBeTruthy();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Buy milk' }]);
    expect(screen.getByText('0/200')).toBeTruthy();
    expect(document.activeElement).toBe(field);
  });

  it('K1 submits with the Add button and sends the trimmed text', async () => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    await user.type(field, '  Call mum  ');
    await user.click(addButton);

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Call mum' }]);
    expect(document.activeElement).toBe(field);
  });

  it('K1 mints a new id for each add', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    await user.type(field, 'First{Enter}');
    await waitFor(() => expect(field).toHaveProperty('value', ''));
    await user.type(field, 'Second{Enter}');
    await waitFor(() => expect(received).toHaveLength(2));

    expect(received[0]!.id).not.toBe(received[1]!.id);
  });

  it('K1 keeps the text and shows no message when the add fails', async () => {
    let attempts = 0;
    server.use(
      http.post('*/api/todos', () => {
        attempts += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );
    const { user, field } = renderAddForm();

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(attempts).toBe(1));
    // Let the failed call settle before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(field).toHaveProperty('value', 'Buy milk');
    expect(screen.getByText('8/200')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(addFormStatus().textContent).toBe('');
  });

  it('K1 leaves the list unchanged when the add fails', async () => {
    const existing: Todo = {
      id: 'a0000000-0000-4000-8000-000000000001',
      description: 'Already here',
      completed: false,
      createdAt: '2026-11-23T10:00:00.000Z',
    };
    let lists = 0;
    let attempts = 0;
    server.use(
      http.get('*/api/todos', () => {
        lists += 1;
        return HttpResponse.json([existing]);
      }),
      http.post('*/api/todos', () => {
        attempts += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );
    const { user, field, list } = renderApp();
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));

    await user.type(field, 'Buy milk{Enter}');
    await waitFor(() => expect(attempts).toBe(1));
    // Let the failed call settle before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Already here']);
    expect(lists).toBe(1);
  });

  it('K1 Enter never inserts a newline, Shift+Enter included', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();

    await user.type(field, 'One{Shift>}{Enter}{/Shift}two');

    expect(field).toHaveProperty('value', 'Onetwo');
  });

  it('K6 the field and Add button have accessible names, and the field describes its counter and hint', () => {
    const { field, addButton } = renderAddForm();

    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('placeholder')).toBeNull();
    expect(addButton.getAttribute('type')).toBe('submit');
    expect(addButton.hasAttribute('disabled')).toBe(false);
    expect(addButton.hasAttribute('aria-disabled')).toBe(false);
    const describedBy = (field.getAttribute('aria-describedby') ?? '').split(' ');
    const description = describedBy.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(description).toBe('0/200 Press Enter to add.');
  });

  it('K6 the field and Add button are reachable and operable by keyboard', async () => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.keyboard('Walk the dog');
    await user.tab();
    expect(document.activeElement).toBe(addButton);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Walk the dog' }]);
    expect(document.activeElement).toBe(field);
  });
});

describe('AddForm validation', () => {
  /** The field's description text, leaving out aria-hidden icons as assistive tech does. */
  function describedByText(field: HTMLElement): string {
    return (field.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => {
        const copy = document.getElementById(id)?.cloneNode(true) as HTMLElement | undefined;
        copy?.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
        return copy?.textContent;
      })
      .join(' ');
  }

  function fieldStatus() {
    return addFormStatus();
  }

  it.each([
    { kind: 'an empty', text: '', via: 'Enter' },
    { kind: 'a whitespace', text: '   ', via: 'Enter' },
    { kind: 'an empty', text: '', via: 'Add' },
    { kind: 'a whitespace', text: '\t \n', via: 'Add' },
  ])('K1 refuses $kind submit by $via inline and sends nothing', async ({ text, via }) => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    expect(fieldStatus().textContent).toBe('');
    if (text) fireEvent.change(field, { target: { value: text } });
    if (via === 'Enter') {
      await user.click(field);
      await user.keyboard('{Enter}');
    } else {
      await user.click(addButton);
    }

    expect(screen.getByText('Enter a description.', NOT_STATUS)).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(describedByText(field)).toBe('Enter a description. 0/200 Press Enter to add.');
    expect(document.activeElement).toBe(field);
    await waitFor(() => expect(fieldStatus().textContent).toBe('Enter a description.'));
    expect(received).toEqual([]);
  });

  it('K1 a second blank submit clears the Field status and sets it again', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();

    await user.click(field);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fieldStatus().textContent).toBe('Enter a description.'));

    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(fieldStatus().textContent ?? ''));
    observer.observe(fieldStatus(), { childList: true, characterData: true, subtree: true });
    await user.keyboard('{Enter}');
    await waitFor(() => expect(seen.at(-1)).toBe('Enter a description.'));
    observer.disconnect();

    expect(seen).toContain('');
  });

  it('K1 typing after an empty submit clears the error silently', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();

    await user.click(field);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fieldStatus().textContent).toBe('Enter a description.'));
    await user.keyboard('a');

    expect(screen.queryByText('Enter a description.', NOT_STATUS)).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(describedByText(field)).toBe('1/200 Press Enter to add.');
    expect(fieldStatus().textContent).toBe('');
  });

  it('K1 pasting two lines shows them joined by a space', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();

    await user.click(field);
    await user.paste('One\nTwo');

    expect(field).toHaveProperty('value', 'One Two');
    expect(screen.getByText('7/200')).toBeTruthy();
  });

  it('K1 a mid-text paste replaces each character one for one and leaves the caret after it', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();
    const textarea = field as HTMLTextAreaElement;

    await user.type(textarea, 'Buy  milk');
    textarea.setSelectionRange(4, 4);
    await user.paste('oat\r\n');

    expect(textarea.value).toBe('Buy oat   milk');
    expect(textarea.selectionStart).toBe(9);
    expect(textarea.selectionEnd).toBe(9);
  });

  it('K1 a tab or line break arriving on input becomes a space, keeping the selection', async () => {
    acceptCreates();
    const { field } = renderAddForm();
    const textarea = field as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Buy\tmilk\nnow', selectionStart: 4, selectionEnd: 4 } });

    expect(textarea.value).toBe('Buy milk now');
    expect(textarea.selectionStart).toBe(4);
    expect(screen.getByText('12/200')).toBeTruthy();
  });

  it('K1 never rewrites the value while an IME composition is open, and cleans it when it ends', () => {
    acceptCreates();
    const { field } = renderAddForm();
    const textarea = field as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;

    fireEvent.compositionStart(textarea);
    setValue.call(textarea, 'Buy\tmilk');
    fireEvent(textarea, new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(textarea.value).toBe('Buy\tmilk');

    fireEvent.compositionEnd(textarea);
    expect(textarea.value).toBe('Buy milk');
    expect(screen.getByText('8/200')).toBeTruthy();
  });

  it('K1 sends the cleaned, trimmed value', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    fireEvent.change(field, { target: { value: '\t Buy milk \n' } });
    await user.click(field);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]!.description).toBe('Buy milk');
  });

  it('K1 over the limit shows the over state, speaks once and sends nothing by Add or Enter', async () => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    fireEvent.change(field, { target: { value: '😀'.repeat(200) } });
    expect(screen.getByText('200/200')).toBeTruthy();
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(fieldStatus().textContent).toBe('');

    fireEvent.change(field, { target: { value: '😀'.repeat(201) } });
    expect(describedByText(field)).toBe('201/200, over the character limit Press Enter to add.');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(fieldStatus().textContent).toBe('over the character limit');

    // Each blocked submit clears the status and sets it again, so it is spoken again.
    async function expectRespoken(blockedSubmit: () => Promise<void>) {
      const seen: string[] = [];
      const observer = new MutationObserver(() => seen.push(fieldStatus().textContent ?? ''));
      observer.observe(fieldStatus(), { childList: true, characterData: true, subtree: true });
      await blockedSubmit();
      await waitFor(() => expect(seen.at(-1)).toBe('over the character limit'));
      observer.disconnect();
      expect(seen).toContain('');
    }

    await expectRespoken(() => user.click(addButton));
    await user.click(field);
    await expectRespoken(() => user.keyboard('{End}{Enter}'));
    expect(fieldStatus().textContent).toBe('over the character limit');
    expect(document.activeElement).toBe(field);
    expect(screen.queryByText('Enter a description.', NOT_STATUS)).toBeNull();
    expect(received).toEqual([]);

    fireEvent.change(field, { target: { value: '😀'.repeat(200) } });
    expect(describedByText(field)).toBe('200/200 Press Enter to add.');
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(fieldStatus().textContent).toBe('');
  });

  it('K1 a beforeinput line break is cancelled and submits the form', async () => {
    const received = acceptCreates();
    const { field } = renderAddForm();

    fireEvent.change(field, { target: { value: 'Buy milk' } });
    const event = new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true });
    fireEvent(field, event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]!.description).toBe('Buy milk');
  });

  it('K1 a beforeinput paragraph on an empty field is cancelled and refused inline', async () => {
    const received = acceptCreates();
    const { field } = renderAddForm();

    const event = new InputEvent('beforeinput', { inputType: 'insertParagraph', bubbles: true, cancelable: true });
    fireEvent(field, event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.getByText('Enter a description.', NOT_STATUS)).toBeTruthy());
    expect(received).toEqual([]);
  });
});
