import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';
import { useTodosStore } from '../todos/hooks.ts';
import type { TodosSnapshot } from '../todos/store.ts';

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

  it('K1 a beforeinput line break with Shift held (keyCode 229) is cancelled and adds nothing; Enter then submits', async () => {
    const received = acceptCreates();
    const { field } = renderAddForm();
    const lineBreak = () => new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true });

    fireEvent.change(field, { target: { value: 'Buy milk' } });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229, shiftKey: true });
    const shifted = lineBreak();
    fireEvent(field, shifted);

    expect(shifted.defaultPrevented).toBe(true);
    expect(field).toHaveProperty('value', 'Buy milk');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toEqual([]);

    fireEvent.keyUp(field, { key: 'Shift', keyCode: 229 });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    const plain = lineBreak();
    fireEvent(field, plain);

    expect(plain.defaultPrevented).toBe(true);
    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]!.description).toBe('Buy milk');
  });

  it('K1 a Shift held when the field loses focus does not block a later beforeinput line break', async () => {
    const received = acceptCreates();
    const { field } = renderAddForm();

    fireEvent.change(field, { target: { value: 'Buy milk' } });
    // Shift+Tab: Shift goes down in the field, its keyup lands elsewhere.
    fireEvent.keyDown(field, { key: 'Shift', shiftKey: true });
    fireEvent.blur(field);
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

describe('AddForm: optimistic add', () => {
  const existing: Todo = {
    id: 'a0000000-0000-4000-8000-000000000001',
    description: 'Already here',
    completed: false,
    createdAt: '2026-11-23T10:00:00.000Z',
  };
  const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  /** The Announcer's live element: the status outside the add form. */
  function liveElement(): HTMLElement {
    const statuses = screen.getAllByRole('status').filter((el) => el.closest('form') === null);
    expect(statuses).toHaveLength(1);
    return statuses[0]!;
  }

  /** Each row's todo text: the span its Completion check's `aria-labelledby` names. */
  function items(list: HTMLElement): string[] {
    return within(list)
      .queryAllByRole('listitem')
      .map((item) => {
        const check = within(item).getByRole('checkbox');
        return document.getElementById(check.getAttribute('aria-labelledby')!)?.textContent ?? '';
      });
  }

  /** A gate a handler waits on until the test opens it. */
  function gate() {
    let open: () => void = () => {};
    const opened = new Promise<void>((resolve) => (open = resolve));
    return { opened, open: () => open() };
  }

  const unavailable = () =>
    HttpResponse.json(
      { type: '/problems/unavailable', title: 'Service unavailable', status: 503, detail: 'x' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );

  /**
   * Serves [existing] plus whatever `landed` holds, counting GETs, and answers
   * each POST with `answer` once `release` opens.
   */
  function serve(answer: (body: CreateTodoBody) => Response) {
    const state = { lists: 0, landed: [] as Todo[], bodies: [] as CreateTodoBody[], release: gate() };
    server.use(
      http.get('*/api/todos', () => {
        state.lists += 1;
        return HttpResponse.json([...state.landed, existing]);
      }),
      http.post('*/api/todos', async ({ request }) => {
        const body = (await request.json()) as CreateTodoBody;
        state.bodies.push(body);
        await state.release.opened;
        return answer(body);
      }),
    );
    return state;
  }

  async function renderLoaded() {
    const app = renderApp();
    await waitFor(() => expect(items(app.list)).toEqual(['Already here']));
    await waitFor(() => expect(app.queryClient.getQueryState(['todos'])?.fetchStatus).toBe('idle'));
    return app;
  }

  const created = (body: CreateTodoBody) =>
    HttpResponse.json({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }, { status: 201 });

  it('K1 the card is on top before the server answers, the field clears with focus in it, and Added follows', async () => {
    const state = serve((body) => {
      state.landed = [{ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }];
      return created(body);
    });
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    expect(state.bodies).toHaveLength(1);
    expect(field.value).toBe('');
    expect(screen.getByText('0/200')).toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(liveElement().textContent).toBe('');

    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(items(list)).toEqual(['Buy milk', 'Already here']);
  });

  it('K1 a failed add removes its card, keeps the earlier todo, announces the reason and restores the text with the caret at the end', async () => {
    const state = serve(unavailable);
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    expect(field.value).toBe('');

    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy milk”. ${UNAVAILABLE}`));
    expect(items(list)).toEqual(['Already here']);
    await waitFor(() => expect(field.value).toBe('Buy milk'));
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(8);
    expect(field.selectionEnd).toBe(8);
    expect(screen.getByText('8/200')).toBeTruthy();
    expect(addFormStatus().textContent).toBe('');
    // The settle-time refetch follows a failure too.
    await waitFor(() => expect(state.lists).toBe(2));
    expect(items(list)).toEqual(['Already here']);
  });

  it('K1 a failed add never overwrites newer typing', async () => {
    const state = serve(unavailable);
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    await user.keyboard('Call mum');

    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy milk”. ${UNAVAILABLE}`));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(field.value).toBe('Call mum');
    expect(items(list)).toEqual(['Already here']);
  });

  it('K1 a failed add restored after an empty submit clears the empty error and the Field status', async () => {
    const state = serve(unavailable);
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(addFormStatus().textContent).toBe('Enter a description.'));
    expect(field.getAttribute('aria-invalid')).toBe('true');

    state.release.open();
    await waitFor(() => expect(field.value).toBe('Buy milk'));
    expect(screen.queryByText('Enter a description.', NOT_STATUS)).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(field.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
    expect(addFormStatus().textContent).toBe('');
  });

  it('K1 a failed add that landed after all clears its exactly restored text, without moving focus or speaking', async () => {
    const state = serve(unavailable);
    const { user, field, list, addButton, queryClient } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    state.release.open();
    await waitFor(() => expect(field.value).toBe('Buy milk'));
    await waitFor(() => expect(state.lists).toBe(2));
    await waitFor(() => expect(queryClient.getQueryState(['todos'])?.fetchStatus).toBe('idle'));
    const message = liveElement().textContent;

    addButton.focus();
    state.landed = [{ ...state.bodies[0]!, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }];
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    await waitFor(() => expect(field.value).toBe(''));
    expect(screen.getByText('0/200')).toBeTruthy();
    expect(document.activeElement).toBe(addButton);
    expect(liveElement().textContent).toBe(message);
    expect(addFormStatus().textContent).toBe('');
  });

  it('K1 a failed add that landed after all leaves changed text alone', async () => {
    const state = serve(unavailable);
    const { user, field, list, queryClient } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    state.release.open();
    await waitFor(() => expect(field.value).toBe('Buy milk'));
    await waitFor(() => expect(state.lists).toBe(2));
    await waitFor(() => expect(queryClient.getQueryState(['todos'])?.fetchStatus).toBe('idle'));
    await user.keyboard(' now');

    state.landed = [{ ...state.bodies[0]!, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }];
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    expect(field.value).toBe('Buy milk now');
  });

  /**
   * A server that keeps what it stores and replays a repeated id with 200
   * (AD-6). The first create is answered with `firstAnswer`, after it is stored
   * if `storedFirst`: a lost response. The list shows only creates that were
   * answered, so a failed add's restored text stays in the field.
   */
  function replaying(firstAnswer: () => Response, storedFirst: boolean) {
    const state = { lists: 0, landed: [] as Todo[], bodies: [] as CreateTodoBody[], statuses: [] as number[], release: gate() };
    const stored = new Map<string, Todo>();
    server.use(
      http.get('*/api/todos', () => {
        state.lists += 1;
        return HttpResponse.json([...state.landed, existing]);
      }),
      http.post('*/api/todos', async ({ request }) => {
        const body = (await request.json()) as CreateTodoBody;
        state.bodies.push(body);
        if (state.bodies.length === 1) {
          await state.release.opened;
          if (storedFirst) stored.set(body.id, { ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' });
          return firstAnswer();
        }
        const replay = stored.get(body.id);
        const todo = replay ?? { ...body, completed: false, createdAt: '2026-11-25T10:00:01.000Z' };
        stored.set(body.id, todo);
        state.landed = [...stored.values()].reverse();
        state.statuses.push(replay ? 200 : 201);
        return HttpResponse.json(todo, { status: replay ? 200 : 201 });
      }),
    );
    return state;
  }

  /** Adds `text`, lets its create fail, and waits until the text is restored and the list has settled. */
  async function failAndRestore(text: string, state: ReturnType<typeof replaying>) {
    const app = await renderLoaded();
    await app.user.type(app.field, `${text}{Enter}`);
    state.release.open();
    await waitFor(() => expect(app.field.value).toBe(text));
    await waitFor(() => expect(state.lists).toBe(2));
    await waitFor(() => expect(app.queryClient.getQueryState(['todos'])?.fetchStatus).toBe('idle'));
    return app;
  }

  it('K1 a failed add stored after all, resubmitted unchanged, sends the first id, is replayed and leaves one card', async () => {
    const state = replaying(() => HttpResponse.error(), true);
    const { user, list } = await failAndRestore('Buy milk', state);
    expect(liveElement().textContent).toBe("Couldn't add “Buy milk”. Check your connection and try again.");

    await user.keyboard('{Enter}');

    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    expect(state.bodies).toHaveLength(2);
    expect(state.bodies[1]).toEqual(state.bodies[0]);
    expect(state.statuses).toEqual([200]);
    await waitFor(() => expect(state.lists).toBe(3));
    expect(items(list)).toEqual(['Buy milk', 'Already here']);
  });

  it('K1 a failed add resubmitted with different text sends a new id', async () => {
    const state = replaying(unavailable, false);
    const { user, list } = await failAndRestore('Buy milk', state);

    await user.keyboard(' now{Enter}');

    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk now”.'));
    expect(state.bodies[1]).toEqual({ id: expect.stringMatching(UUID), description: 'Buy milk now' });
    expect(state.bodies[1]!.id).not.toBe(state.bodies[0]!.id);
    expect(state.statuses).toEqual([201]);
    await waitFor(() => expect(items(list)).toEqual(['Buy milk now', 'Already here']));
  });

  it('K1 a failed add edited and returned to exactly the restored text reuses its id', async () => {
    const state = replaying(unavailable, false);
    const { user, field } = await failAndRestore('Buy milk', state);

    await user.keyboard('s');
    expect(field.value).toBe('Buy milks');
    await user.keyboard('{Backspace}{Enter}');

    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    expect(state.bodies[1]).toEqual(state.bodies[0]);
    expect(state.statuses).toEqual([201]);
  });

  it('K1 a failed add whose text was not restored never lends its id to the same text typed later', async () => {
    const state = replaying(unavailable, false);
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'Buy milk{Enter}');
    await waitFor(() => expect(items(list)).toEqual(['Buy milk', 'Already here']));
    await user.keyboard('Call mum');
    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy milk”. ${UNAVAILABLE}`));
    expect(field.value).toBe('Call mum');

    await user.clear(field);
    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    expect(state.bodies[1]).toEqual({ id: expect.stringMatching(UUID), description: 'Buy milk' });
    expect(state.bodies[1]!.id).not.toBe(state.bodies[0]!.id);
  });

  it('K1 two adds, the first failing: only its card goes', async () => {
    const firstAnswer = gate();
    const saved: Todo[] = [existing];
    server.use(
      http.get('*/api/todos', () => HttpResponse.json(saved)),
      http.post('*/api/todos', async ({ request }) => {
        const body = (await request.json()) as CreateTodoBody;
        if (body.description !== 'First') {
          saved.unshift({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' });
          return created(body);
        }
        await firstAnswer.opened;
        return unavailable();
      }),
    );
    const { user, field, list } = await renderLoaded();

    await user.type(field, 'First{Enter}');
    await user.type(field, 'Second{Enter}');
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Second”.'));
    expect(items(list)).toEqual(['Second', 'First', 'Already here']);

    firstAnswer.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “First”. ${UNAVAILABLE}`));
    expect(items(list)).toEqual(['Second', 'Already here']);
    await waitFor(() => expect(field.value).toBe('First'));
  });

  it('K1 an add during Loading renders above, cancels the first fetch and keeps the list loading', async () => {
    let lists = 0;
    let firstAborted = false;
    const release = gate();
    server.use(
      http.get('*/api/todos', async ({ request }) => {
        lists += 1;
        if (lists === 1) {
          request.signal.addEventListener('abort', () => (firstAborted = true));
          await new Promise(() => {});
        }
        return HttpResponse.json([existing]);
      }),
      http.post('*/api/todos', async ({ request }) => {
        const body = (await request.json()) as CreateTodoBody;
        await release.opened;
        return created(body);
      }),
    );
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    const { user, field, list, queryClient } = renderApp({ children: <Probe /> });
    await waitFor(() => expect(lists).toBe(1));
    const before = snapshot;

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(items(list)).toEqual(['Buy milk']));
    await waitFor(() => expect(firstAborted).toBe(true));
    expect(queryClient.getQueryState(['todos'])?.fetchStatus).toBe('idle');
    const recorded = ({ loaded, lastFetchFailure, retryRequested }: TodosSnapshot) => ({ loaded, lastFetchFailure, retryRequested });
    expect(recorded(snapshot!)).toEqual(recorded(before!));
    expect(snapshot).toMatchObject({ loaded: false, lastFetchFailure: null, pendingCount: 1 });
    expect(liveElement().textContent).toBe('');

    release.open();
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    await waitFor(() => expect(snapshot).toMatchObject({ loaded: true }));
    expect(lists).toBe(2);
    expect(items(list)).toEqual(['Already here']);
  });

  it('K1 an add during Error renders above while the list stays in error', async () => {
    const release = gate();
    server.use(
      http.get('*/api/todos', () => unavailable()),
      http.post('*/api/todos', async ({ request }) => {
        const body = (await request.json()) as CreateTodoBody;
        await release.opened;
        return created(body);
      }),
    );
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    const { user, field, list } = renderApp({ children: <Probe /> });
    await waitFor(() => expect(snapshot).toMatchObject({ lastFetchFailure: 'unavailable' }));

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(items(list)).toEqual(['Buy milk']));
    expect(snapshot).toMatchObject({ loaded: false, lastFetchFailure: 'unavailable', retryRequested: false, pendingCount: 1 });
    release.open();
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
  });

  it('K1 an add failing before the first load removes its card and leaves the list in error, never empty', async () => {
    server.use(
      http.get('*/api/todos', () => unavailable()),
      http.post('*/api/todos', () => HttpResponse.error()),
    );
    let snapshot: TodosSnapshot | undefined;
    function Probe() {
      snapshot = useTodosStore();
      return null;
    }
    const { user, field, list } = renderApp({ children: <Probe /> });
    await waitFor(() => expect(snapshot).toMatchObject({ lastFetchFailure: 'unavailable' }));

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(liveElement().textContent).toBe("Couldn't add “Buy milk”. Check your connection and try again."));
    await waitFor(() => expect(field.value).toBe('Buy milk'));
    expect(items(list)).toEqual([]);
    expect(snapshot).toMatchObject({ loaded: false, lastFetchFailure: 'unavailable' });
  });
});
