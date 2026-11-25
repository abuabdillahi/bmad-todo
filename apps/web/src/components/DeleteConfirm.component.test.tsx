import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo, UpdateTodoBody } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';
import { todosQueryKey } from '../todos/query.ts';
import { useTodosContext, type TodosContextValue } from '../todos/TodosProvider.tsx';
import { LEAVE_MS } from './TodoList.tsx';
import buttons from './CardButton.module.css';
import styles from './TodoCard.module.css';

const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
const NETWORK = 'Check your connection and try again.';
const GENERIC = 'Something went wrong on our side. Try again.';

const milk: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-24T10:00:00.000Z',
};
const rent: Todo = {
  id: 'a0000000-0000-4000-8000-000000000002',
  description: 'Pay rent',
  completed: true,
  createdAt: '2026-11-23T10:00:00.000Z',
};
const bills: Todo = {
  id: 'a0000000-0000-4000-8000-000000000003',
  description: 'Pay bills',
  completed: false,
  createdAt: '2026-11-22T10:00:00.000Z',
};

/** A gate a handler waits on until the test opens it. */
function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open: () => open() };
}

const problem = (type: string, status: number) =>
  HttpResponse.json({ type, title: 'x', status, detail: 'x' }, { status, headers: { 'Content-Type': 'application/problem+json' } });

/**
 * A server holding `initial`: GET lists what it holds; each PATCH waits for
 * `release`, then applies the body (404 for an id it doesn't hold); each DELETE
 * is recorded, waits for `deleted`, then answers with `failDelete` if set, else
 * removes the todo with a 204 (404 for an id it doesn't hold); each POST waits
 * for `created`, then answers with `failCreate` if set, else stores the todo.
 */
function serve(initial: Todo[]) {
  const state = {
    todos: initial.map((todo) => ({ ...todo })),
    lists: 0,
    patches: [] as { id: string; body: UpdateTodoBody }[],
    deletes: [] as { id: string; body: string; contentType: string | null }[],
    release: gate(),
    deleted: gate(),
    failDelete: undefined as undefined | (() => Response | Promise<Response>),
    created: gate(),
    failCreate: undefined as undefined | (() => Response),
  };
  server.use(
    http.get('*/api/todos', () => {
      state.lists += 1;
      return HttpResponse.json(state.todos);
    }),
    http.patch('*/api/todos/:id', async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as UpdateTodoBody;
      state.patches.push({ id, body });
      await state.release.opened;
      const at = state.todos.findIndex((todo) => todo.id === id);
      if (at === -1) return problem('/problems/not-found', 404);
      state.todos[at] = { ...state.todos[at]!, ...body };
      return HttpResponse.json(state.todos[at]);
    }),
    http.delete('*/api/todos/:id', async ({ params, request }) => {
      const id = String(params.id);
      state.deletes.push({ id, body: await request.text(), contentType: request.headers.get('Content-Type') });
      await state.deleted.opened;
      if (state.failDelete) return state.failDelete();
      const at = state.todos.findIndex((todo) => todo.id === id);
      if (at === -1) return problem('/problems/not-found', 404);
      state.todos.splice(at, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/todos', async ({ request }) => {
      const body = (await request.json()) as CreateTodoBody;
      await state.created.opened;
      if (state.failCreate) return state.failCreate();
      const todo: Todo = { ...body, completed: false, createdAt: new Date().toISOString() };
      state.todos.unshift(todo);
      return HttpResponse.json(todo, { status: 201 });
    }),
  );
  return state;
}

/** The Announcer's live element: the status outside every form. */
function liveElement(): HTMLElement {
  const statuses = screen.getAllByRole('status').filter((el) => el.closest('form') === null);
  expect(statuses).toHaveLength(1);
  return statuses[0]!;
}

function check(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement;
}

function row(name: string): HTMLElement {
  return check(name).closest('li')!;
}

/** The card element inside a row: `li` › body › card. */
function card(name: string): HTMLElement {
  return row(name).firstElementChild!.firstElementChild as HTMLElement;
}

function editButton(name: string): HTMLButtonElement {
  return within(row(name)).getByRole('button', { name: `Edit “${name}”` }) as HTMLButtonElement;
}

/** A row's Delete button (not the confirm's, which shares its name). */
function deleteButton(name: string): HTMLButtonElement {
  return within(row(name)).getByRole('button', { name: `Delete “${name}”` }) as HTMLButtonElement;
}

/** A row's Delete confirm group, named by its prompt and the todo text. */
function confirmGroup(name: string): HTMLElement {
  return screen.getByRole('group', { name: `Delete this todo? ${name}` });
}

function confirmButton(name: string): HTMLButtonElement {
  return within(confirmGroup(name)).getByRole('button', { name: `Delete “${name}”` }) as HTMLButtonElement;
}

function cancelButton(name: string): HTMLButtonElement {
  return within(confirmGroup(name)).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
}

function leavingRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('li[data-leaving]')];
}

/**
 * Holds every leave timer (a `LEAVE_MS` setTimeout) until `run()`, so a Leaving
 * row stays rendered for as long as a test needs; other timers run as usual.
 */
function holdLeaveTimers() {
  const real = globalThis.setTimeout;
  const held: (() => void)[] = [];
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, ms?: number, ...args: unknown[]) => {
    if (ms === LEAVE_MS) {
      held.push(callback);
      return real(() => {}, 0);
    }
    return real(callback, ms, ...args);
  }) as typeof setTimeout);
  return {
    held,
    run: () => act(() => held.splice(0).forEach((callback) => callback())),
  };
}

async function renderLoaded(names: string[]) {
  let context: TodosContextValue | undefined;
  function Probe() {
    context = useTodosContext();
    return null;
  }
  const app = renderApp({ children: <Probe /> });
  await waitFor(() => expect(within(app.list).queryAllByRole('checkbox')).toHaveLength(names.length));
  await waitFor(() => expect(app.queryClient.getQueryState(todosQueryKey)?.fetchStatus).toBe('idle'));
  // Calls the list area makes; the helper holds its own reference, so its announcements are not counted.
  const listAnnounce = vi.spyOn(context!.announcer, 'announce');
  // A refetch, then the macrotask on which TanStack notifies its observers.
  const refetch = () =>
    act(async () => {
      await app.queryClient.refetchQueries({ queryKey: todosQueryKey });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  return { ...app, context: context!, listAnnounce, refetch };
}

/** Waits for a confirmed delete's answer, so no request of this test reaches the next test's handlers. */
async function deleteSettled(name: string) {
  await waitFor(() => expect(liveElement().textContent).toBe(`Deleted “${name}”.`));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Delete confirm', () => {
  it('K4 Delete opens the confirm in place of Edit and Delete, focuses Cancel and sends nothing', async () => {
    const state = serve([milk, rent]);
    const { user } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(deleteButton('Buy milk'));

    const group = confirmGroup('Buy milk');
    expect(within(group).getByText('Delete this todo?')).toBeTruthy();
    expect(document.activeElement).toBe(cancelButton('Buy milk'));
    expect(within(row('Buy milk')).queryByRole('button', { name: 'Edit “Buy milk”' })).toBeNull();
    expect(within(row('Buy milk')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Delete', 'Cancel']);
    // The other row is untouched.
    expect(editButton('Pay rent')).toBeTruthy();
    expect(deleteButton('Pay rent')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(state.deletes).toEqual([]);
    expect(liveElement().textContent).toBe('');
  });

  it('K4 Cancel closes the confirm with nothing sent, and focus returns to Delete', async () => {
    const state = serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(deleteButton('Buy milk'));
    await user.click(cancelButton('Buy milk'));

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(deleteButton('Buy milk'));
    expect(editButton('Buy milk')).toBeTruthy();
    expect(check('Buy milk')).toBeTruthy();
    expect(state.deletes).toEqual([]);
  });

  it.each([
    ['Cancel', () => cancelButton('Buy milk')],
    ['Confirm delete', () => confirmButton('Buy milk')],
  ])('K4 Escape with focus on %s closes the confirm with nothing sent, and focus returns to Delete', async (_name, target) => {
    const state = serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(deleteButton('Buy milk'));
    target().focus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(deleteButton('Buy milk'));
    expect(state.deletes).toEqual([]);
  });

  it('K4 Escape during an IME composition does not close the confirm', async () => {
    serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(deleteButton('Buy milk'));
    fireEvent.keyDown(cancelButton('Buy milk'), { key: 'Escape', isComposing: true });

    expect(confirmGroup('Buy milk')).toBeTruthy();
  });

  it('K4 the check stays operable in the confirm, and toggling it keeps the confirm open', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(deleteButton('Buy milk'));
    await user.click(check('Buy milk'));

    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { completed: true } }]));
    expect(check('Buy milk').checked).toBe(true);
    expect(confirmGroup('Buy milk')).toBeTruthy();
    await waitFor(() => expect(state.lists).toBe(2));
    expect(confirmGroup('Buy milk')).toBeTruthy();
  });

  it('K4 Confirm delete removes the row at once, before the server answers, and Deleted is announced only once it does', async () => {
    const state = serve([milk, rent]);
    const { user, refetch } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(deleteButton('Buy milk'));
    await user.click(confirmButton('Buy milk'));

    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(check('Pay rent'));
    await waitFor(() => expect(state.deletes).toEqual([{ id: milk.id, body: '', contentType: null }]));
    expect(liveElement().textContent).toBe('');

    state.deleted.open();
    await waitFor(() => expect(liveElement().textContent).toBe('Deleted “Buy milk”.'));
    await waitFor(() => expect(state.lists).toBe(2));
    await waitFor(() => expect(leavingRows()).toEqual([]));
    await refetch();
    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toEqual([check('Pay rent')]);
    expect(document.activeElement).toBe(check('Pay rent'));
  });

  it('K4 a delete answered 404 is success: Deleted is announced and the row stays gone', async () => {
    const state = serve([milk, rent]);
    state.deleted.open();
    const { user } = await renderLoaded(['Buy milk', 'Pay rent']);
    // Already deleted elsewhere.
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);

    await user.click(deleteButton('Buy milk'));
    await user.click(confirmButton('Buy milk'));

    await waitFor(() => expect(liveElement().textContent).toBe('Deleted “Buy milk”.'));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(card('Pay rent').classList.contains(styles.flagged!)).toBe(false);
  });

  it.each([
    ['a 503 problem', () => problem('/problems/unavailable', 503), UNAVAILABLE],
    ['a 500 problem', () => problem('/problems/internal', 500), GENERIC],
    ['a non-problem error', () => new HttpResponse('<html>bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }), GENERIC],
    ['no response', () => HttpResponse.error(), NETWORK],
  ])('K4 a delete failing with %s puts the row back at its index, fresh, flagged and operable, says why, and leaves focus', async (_name, answer, reason) => {
    const state = serve([milk, rent, bills]);
    state.failDelete = answer;
    const { user } = await renderLoaded(['Buy milk', 'Pay rent', 'Pay bills']);

    await user.click(deleteButton('Pay rent'));
    await user.click(confirmButton('Pay rent'));
    expect(screen.queryByRole('checkbox', { name: 'Pay rent' })).toBeNull();
    expect(document.activeElement).toBe(check('Pay bills'));

    state.deleted.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't delete “Pay rent”, so it's back in the list. ${reason}`));
    expect(screen.getAllByRole('checkbox')).toEqual([check('Buy milk'), check('Pay rent'), check('Pay bills')]);
    expect(leavingRows()).toEqual([]);
    expect(row('Pay rent').hasAttribute('inert')).toBe(false);
    expect(row('Pay rent').getAttribute('aria-hidden')).toBeNull();
    expect(row('Pay rent').classList.contains(styles.enter!)).toBe(true);
    expect(card('Pay rent').classList.contains(styles.flagged!)).toBe(true);
    expect(check('Pay rent').checked).toBe(true);
    expect(document.activeElement).toBe(check('Pay bills'));

    // Fully operable: Delete opens its confirm again.
    await user.click(deleteButton('Pay rent'));
    expect(document.activeElement).toBe(cancelButton('Pay rent'));
  });

  it.each([
    ['the next row\'s check', 'Buy milk', [milk, rent, bills], () => check('Pay rent')],
    ['the previous row\'s check, from the last row', 'Pay bills', [milk, rent, bills], () => check('Pay rent')],
    ['the add field, from the only row', 'Buy milk', [milk], () => screen.getByRole('textbox', { name: 'New todo' })],
  ])('K6 Confirm delete sends focus to %s', async (_name, name, todos, target) => {
    serve(todos).deleted.open();
    const { user } = await renderLoaded(todos.map((todo) => todo.description));

    await user.click(deleteButton(name));
    await user.click(confirmButton(name));

    expect(document.activeElement).toBe(target());
    await deleteSettled(name);
  });

  it('K6 Confirm delete by keyboard on the only row sends focus to the add field', async () => {
    serve([milk]).deleted.open();
    const { user, field } = await renderLoaded(['Buy milk']);

    deleteButton('Buy milk').focus();
    await user.keyboard('{Enter}');
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirmButton('Buy milk'));
    // A touch earlier on the card doesn't count for a keyboard press.
    fireEvent.pointerDown(confirmButton('Buy milk'), { pointerType: 'touch' });
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(field);
    await deleteSettled('Buy milk');
  });

  it('K6 a tapped Confirm delete on the only row sends focus to the heading without scrolling', async () => {
    serve([milk]).deleted.open();
    const { user, heading } = await renderLoaded(['Buy milk']);
    const focus = vi.spyOn(heading, 'focus');

    await user.click(deleteButton('Buy milk'));
    fireEvent.pointerDown(confirmButton('Buy milk'), { pointerType: 'touch' });
    fireEvent.click(confirmButton('Buy milk'), { detail: 1 });

    expect(document.activeElement).toBe(heading);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    await deleteSettled('Buy milk');
  });

  it('K4 Delete on another row closes an open edit silently and focuses that row\'s Cancel; Edit closes an open confirm', async () => {
    const state = serve([milk, rent]);
    const { user, listAnnounce } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Draft');
    await user.click(deleteButton('Pay rent'));

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(screen.getAllByRole('group')).toEqual([confirmGroup('Pay rent')]);
    expect(document.activeElement).toBe(cancelButton('Pay rent'));
    expect(editButton('Buy milk')).toBeTruthy();

    await user.click(editButton('Buy milk'));
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Edit description' }));
    expect(deleteButton('Pay rent')).toBeTruthy();

    // A confirm on one row closes a confirm on another.
    await user.click(deleteButton('Pay rent'));
    await user.click(deleteButton('Buy milk'));
    expect(screen.getAllByRole('group')).toEqual([confirmGroup('Buy milk')]);
    expect(document.activeElement).toBe(cancelButton('Buy milk'));

    expect(state.patches).toEqual([]);
    expect(state.deletes).toEqual([]);
    expect(listAnnounce).not.toHaveBeenCalled();
  });

  it('K4 a row in the confirm that a refetch removes unmounts silently, focus moves to the next check, and the confirm is cleared', async () => {
    const state = serve([milk, rent]);
    const { user, refetch, listAnnounce } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(deleteButton('Buy milk'));
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(leavingRows()).toEqual([]);
    expect(document.activeElement).toBe(check('Pay rent'));
    expect(listAnnounce).not.toHaveBeenCalled();
    expect(liveElement().textContent).toBe('');

    // Back again: it shows Edit and Delete, not the confirm.
    state.todos.unshift({ ...milk });
    await refetch();
    expect(deleteButton('Buy milk')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(state.deletes).toEqual([]);
  });

  it('K6 Delete, the group, Confirm delete and Cancel are named, and the done card keeps full-style confirm buttons', async () => {
    const long = { ...milk, description: 'Call the plumber about the leaking kitchen tap before Friday' };
    serve([long, rent]);
    const { user } = await renderLoaded([long.description, 'Pay rent']);

    const del = deleteButton(long.description);
    expect(del.textContent).toBe('Delete');
    expect(del.getAttribute('type')).toBe('button');

    await user.click(deleteButton('Pay rent'));
    const confirm = confirmButton('Pay rent');
    expect(confirm.textContent).toBe('Delete');
    expect(confirm.getAttribute('type')).toBe('button');
    expect(cancelButton('Pay rent').getAttribute('type')).toBe('button');
    // The card keeps its done treatment in the confirm, and both confirm buttons keep their full style.
    expect(card('Pay rent').classList.contains(styles.done!)).toBe(true);
    expect(confirm.classList.contains(buttons.dangerStrong!)).toBe(true);
    expect(confirm.classList.contains(buttons.done!)).toBe(false);
    expect(cancelButton('Pay rent').classList.contains(buttons.cancel!)).toBe(true);
    expect(cancelButton('Pay rent').classList.contains(buttons.done!)).toBe(false);

    // The row's Delete: soft danger on an open card, the done variant on a done card.
    await user.click(cancelButton('Pay rent'));
    expect(del.classList.contains(buttons.danger!)).toBe(true);
    expect(del.classList.contains(buttons.done!)).toBe(false);
    expect(deleteButton('Pay rent').classList.contains(buttons.done!)).toBe(true);
    expect(deleteButton('Pay rent').classList.contains(buttons.danger!)).toBe(false);
  });

  it('K4 Edit and Delete fade in when they come back from the confirm, never on first load, and the text never fades', async () => {
    serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);
    const content = () => document.getElementById(check('Buy milk').getAttribute('aria-labelledby')!)!.parentElement!;
    const actions = () => deleteButton('Buy milk').parentElement!;

    expect(actions().classList.contains(styles.swapIn!)).toBe(false);
    expect(content().classList.contains(styles.swapIn!)).toBe(false);

    await user.click(deleteButton('Buy milk'));
    expect(confirmGroup('Buy milk').parentElement!.classList.contains(styles.swapIn!)).toBe(true);
    await user.click(cancelButton('Buy milk'));

    expect(actions().classList.contains(styles.swapIn!)).toBe(true);
    expect(content().classList.contains(styles.swapIn!)).toBe(false);
  });

  it('K4 a failed add removing its card in the confirm unmounts it at once, announces only the add failure, and clears the confirm', async () => {
    const state = serve([milk]);
    state.failCreate = () => problem('/problems/unavailable', 503);
    const { user, field, listAnnounce } = await renderLoaded(['Buy milk']);

    await user.type(field, 'Buy bread{Enter}');
    await waitFor(() => expect(deleteButton('Buy bread')).toBeTruthy());
    await user.click(deleteButton('Buy bread'));
    expect(document.activeElement).toBe(cancelButton('Buy bread'));
    state.created.open();

    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy bread”. ${UNAVAILABLE}`));
    expect(screen.queryByRole('checkbox', { name: 'Buy bread' })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(leavingRows()).toEqual([]);
    expect(document.activeElement).toBe(check('Buy milk'));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(listAnnounce).not.toHaveBeenCalled();
    expect(state.deletes).toEqual([]);

    // Resubmitted with the same id, the card comes back with Edit and Delete, not the confirm.
    state.failCreate = undefined;
    expect(field.value).toBe('Buy bread');
    field.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy bread”.'));
    expect(deleteButton('Buy bread')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('K6 Tab runs check, Edit, Delete, next check; in the confirm check, Confirm delete, Cancel, next check', async () => {
    serve([milk, rent]);
    const { user, addButton } = await renderLoaded(['Buy milk', 'Pay rent']);

    addButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(check('Buy milk'));
    await user.tab();
    expect(document.activeElement).toBe(editButton('Buy milk'));
    await user.tab();
    expect(document.activeElement).toBe(deleteButton('Buy milk'));
    await user.tab();
    expect(document.activeElement).toBe(check('Pay rent'));

    await user.click(deleteButton('Buy milk'));
    check('Buy milk').focus();
    await user.tab();
    expect(document.activeElement).toBe(confirmButton('Buy milk'));
    await user.tab();
    expect(document.activeElement).toBe(cancelButton('Buy milk'));
    await user.tab();
    expect(document.activeElement).toBe(check('Pay rent'));
  });

  it('K6 focus reaches its target in the same task as each swap: Delete, Cancel, Escape and Confirm delete', async () => {
    serve([milk, rent]).deleted.open();
    await renderLoaded(['Buy milk', 'Pay rent']);

    fireEvent.click(deleteButton('Buy milk'));
    expect(document.activeElement).toBe(cancelButton('Buy milk'));
    fireEvent.click(cancelButton('Buy milk'));
    expect(document.activeElement).toBe(deleteButton('Buy milk'));

    fireEvent.click(deleteButton('Buy milk'));
    expect(document.activeElement).toBe(cancelButton('Buy milk'));
    fireEvent.keyDown(cancelButton('Buy milk'), { key: 'Escape' });
    expect(document.activeElement).toBe(deleteButton('Buy milk'));

    fireEvent.click(deleteButton('Buy milk'));
    fireEvent.click(confirmButton('Buy milk'));
    expect(document.activeElement).toBe(check('Pay rent'));
    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    await deleteSettled('Buy milk');
  });

  it('K4 the Leaving row is inert and aria-hidden, plays no enter motion, and unmounts once its timer runs', async () => {
    const timers = holdLeaveTimers();
    const state = serve([milk, rent]);
    state.deleted.open();
    const { user } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(deleteButton('Buy milk'));
    await user.click(confirmButton('Buy milk'));

    const [leaving] = leavingRows();
    expect(leavingRows()).toHaveLength(1);
    expect(leaving!.hasAttribute('inert')).toBe(true);
    expect(leaving!.getAttribute('aria-hidden')).toBe('true');
    expect(leaving!.classList.contains(styles.leaving!)).toBe(true);
    expect(leaving!.classList.contains(styles.enter!)).toBe(false);
    expect(leaving!.textContent).toContain('Buy milk');
    // It sits where the row was, above the next one.
    expect(leaving!.nextElementSibling).toBe(row('Pay rent'));

    await waitFor(() => expect(liveElement().textContent).toBe('Deleted “Buy milk”.'));
    await waitFor(() => expect(timers.held).toHaveLength(1));
    expect(leavingRows()).toHaveLength(1);
    timers.run();
    expect(leavingRows()).toEqual([]);
    expect(within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('K4 under reduced motion the Leaving row unmounts with a 0 ms timer', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query }),
    });
    try {
      const timeout = vi.spyOn(globalThis, 'setTimeout');
      serve([milk, rent]).deleted.open();
      const { user } = await renderLoaded(['Buy milk', 'Pay rent']);

      await user.click(deleteButton('Buy milk'));
      await user.click(confirmButton('Buy milk'));

      await waitFor(() => expect(leavingRows()).toEqual([]), { timeout: LEAVE_MS / 2 });
      expect(timeout.mock.calls.some(([, ms]) => ms === LEAVE_MS)).toBe(false);
      await deleteSettled('Buy milk');
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('K6 a 404 focus move skips a Leaving row: from the last row it lands on the check before the leaving one', async () => {
    holdLeaveTimers();
    const state = serve([milk, rent, bills]);
    state.deleted.open();
    const { user } = await renderLoaded(['Buy milk', 'Pay rent', 'Pay bills']);

    await user.click(deleteButton('Pay rent'));
    await user.click(confirmButton('Pay rent'));
    expect(document.activeElement).toBe(check('Pay bills'));
    expect(leavingRows()).toHaveLength(1);
    await deleteSettled('Pay rent');

    // Deleted elsewhere, then toggled here: the 404 moves focus off the row.
    state.todos = state.todos.filter((todo) => todo.id !== bills.id);
    await user.keyboard(' ');
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe('“Pay bills” was deleted elsewhere.'));
    await waitFor(() => expect(document.activeElement).toBe(check('Buy milk')));
    expect(leavingRows()).toHaveLength(1);
  });

  it('K6 Confirm delete skips a Leaving row: the next operable row\'s check, else the add field', async () => {
    holdLeaveTimers();
    serve([milk, rent, bills]).deleted.open();
    const { user, field } = await renderLoaded(['Buy milk', 'Pay rent', 'Pay bills']);

    await user.click(deleteButton('Pay rent'));
    await user.click(confirmButton('Pay rent'));
    // Buy milk's next row is the leaving Pay rent: focus skips it to Pay bills.
    await user.click(deleteButton('Buy milk'));
    await user.click(confirmButton('Buy milk'));
    expect(document.activeElement).toBe(check('Pay bills'));
    expect(leavingRows()).toHaveLength(2);

    // Only leaving rows around it: the add field.
    await user.click(deleteButton('Pay bills'));
    await user.click(confirmButton('Pay bills'));
    expect(document.activeElement).toBe(field);
    await deleteSettled('Pay bills');
    // Each leaving row's todo text, in order: they stay where they showed.
    const texts = leavingRows().map((item) => document.getElementById(item.querySelector('input')!.getAttribute('aria-labelledby')!)!.textContent);
    expect(texts).toEqual(['Buy milk', 'Pay rent', 'Pay bills']);
  });

  it('K6 a refetch removing the focused row skips Leaving rows for its target', async () => {
    holdLeaveTimers();
    const state = serve([milk, rent, bills]);
    state.deleted.open();
    const { user, refetch } = await renderLoaded(['Buy milk', 'Pay rent', 'Pay bills']);

    await user.click(deleteButton('Pay rent'));
    await user.click(confirmButton('Pay rent'));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(document.activeElement).toBe(check('Pay bills'));

    state.todos = state.todos.filter((todo) => todo.id !== bills.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: 'Pay bills' })).toBeNull();
    expect(document.activeElement).toBe(check('Buy milk'));
  });
});
