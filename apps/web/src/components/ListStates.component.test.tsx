import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo, UpdateTodoBody } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';
import { todosQueryKey } from '../todos/query.ts';
import { LINE_CLEAR_MS } from './loading-status.ts';
import { LEAVE_MS } from './TodoList.tsx';

const LEAD = "Couldn't load your todos.";
const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
const NETWORK = 'Check your connection and try again.';
const GENERIC = 'Something went wrong on our side. Try again.';
const LOADING = 'Loading your todos';
const LOADED = 'Your todos are loaded.';
const EMPTY = 'No todos yet.';

const milk: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-24T10:00:00.000Z',
};
const rent: Todo = {
  id: 'a0000000-0000-4000-8000-000000000002',
  description: 'Pay rent',
  completed: false,
  createdAt: '2026-11-23T10:00:00.000Z',
};

/** A gate a handler waits on until the test opens it. */
function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open: () => open() };
}

type Answer = () => Response | Promise<Response>;

const problem = (type: string, status: number) => () =>
  HttpResponse.json({ type, title: 'x', status, detail: 'x' }, { status, headers: { 'Content-Type': 'application/problem+json' } });
const unavailable = problem('/problems/unavailable', 503);
const noResponse: Answer = () => HttpResponse.error();
const htmlError: Answer = () => new HttpResponse('<html><body>Bad gateway</body></html>', { status: 500, headers: { 'Content-Type': 'text/html' } });
const listing = (...todos: Todo[]): Answer => () => HttpResponse.json(todos);
/** Waits for `held` to open, then answers with `answer`. */
const after = (held: { opened: Promise<void> }, answer: Answer): Answer => async () => {
  await held.opened;
  return answer();
};
const never: Answer = () => new Promise<Response>(() => {});

/** GET /api/todos answers from a queue; the last answer repeats. Counts the requests. */
function serveLists(...answers: Answer[]) {
  const calls = { count: 0 };
  server.use(
    http.get('*/api/todos', () => {
      const answer = answers[Math.min(calls.count, answers.length - 1)]!;
      calls.count += 1;
      return answer();
    }),
  );
  return calls;
}

/** The todos the server holds: creates go on top, and `listStored` lists them. */
const stored: { todos: Todo[] } = { todos: [] };
const listStored: Answer = () => HttpResponse.json(stored.todos);

beforeEach(() => {
  stored.todos = [];
});

/**
 * POST /api/todos: waits for `held` if given, then answers with `fail` if
 * given, else stores the todo on top of `stored` and answers 201.
 */
function serveCreates({ held, fail }: { held?: { opened: Promise<void> }; fail?: Answer } = {}) {
  const bodies: CreateTodoBody[] = [];
  server.use(
    http.post('*/api/todos', async ({ request }) => {
      const body = (await request.json()) as CreateTodoBody;
      bodies.push(body);
      if (held) await held.opened;
      if (fail) return fail();
      const todo: Todo = { ...body, completed: false, createdAt: new Date().toISOString() };
      stored.todos = [todo, ...stored.todos];
      return HttpResponse.json(todo, { status: 201 });
    }),
  );
  return bodies;
}

/** The one hidden Loading status. */
function loadingStatus(): HTMLElement {
  const statuses = document.querySelectorAll<HTMLElement>('[data-loading-status]');
  expect(statuses).toHaveLength(1);
  return statuses[0]!;
}

/** Every text the Loading status held, in order, from now on. */
function watchStatus() {
  const texts: string[] = [];
  const observer = new MutationObserver(() => texts.push(loadingStatus().textContent ?? ''));
  observer.observe(loadingStatus(), { childList: true, characterData: true, subtree: true });
  return { texts, stop: () => observer.disconnect() };
}

/** Whether the Empty panel was ever in the document from now on. */
function watchEmptyPanel() {
  const seen = { empty: false };
  const observer = new MutationObserver(() => {
    if ([...document.querySelectorAll('p')].some((p) => p.textContent === EMPTY)) seen.empty = true;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return { seen, stop: () => observer.disconnect() };
}

/** Records document.activeElement whenever the list area changes, to catch a drop to <body>. */
function watchFocus() {
  const seen: (Element | null)[] = [];
  const observer = new MutationObserver(() => seen.push(document.activeElement));
  observer.observe(loadingStatus().parentElement!, { childList: true, subtree: true });
  return { seen, stop: () => observer.disconnect() };
}

/**
 * Records each blur of `button` and whether it was still in the document then:
 * the hand-off order moves focus before the button is removed.
 */
function watchHandOff(button: HTMLElement) {
  const blurs: { connected: boolean; to: EventTarget | null }[] = [];
  button.addEventListener('blur', (event) => blurs.push({ connected: button.isConnected, to: event.relatedTarget }));
  return blurs;
}

/** The Announcer's live element: the status outside the add form and the list area. */
function liveElement(): HTMLElement {
  const statuses = screen.getAllByRole('status').filter((el) => el.closest('form') === null && !el.hasAttribute('data-loading-status'));
  expect(statuses).toHaveLength(1);
  return statuses[0]!;
}

const skeletonList = () => document.querySelector<HTMLElement>('ul[aria-busy="true"]');
const todoList = () => screen.queryByRole('list', { name: 'Todos' });
const emptyPanel = () => screen.queryByText(EMPTY, { ignore: '[role="status"]' });
const tryAgain = () => screen.queryByRole('button', { name: 'Try again' });
/** The List error panel's line, beside Try again. */
const panelLine = () => tryAgain()?.parentElement?.querySelector('p')?.textContent ?? null;

function check(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement;
}

/** The rows' todo texts, in order (Leaving copies included). */
function items(): string[] {
  const list = todoList();
  if (!list) return [];
  return within(list)
    .queryAllByRole('listitem', { hidden: true })
    .map((item) => item.querySelector('input[type="checkbox"]'))
    .map((box) => document.getElementById(box!.getAttribute('aria-labelledby')!)?.textContent ?? '');
}

async function settled(queryClient: ReturnType<typeof renderApp>['queryClient']) {
  await waitFor(() => expect(queryClient.getQueryState(todosQueryKey)?.fetchStatus).toBe('idle'));
}

/** A focus refetch, the way TanStack sees the tab regain focus. */
async function regainFocus() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

/** A reconnect refetch, the way TanStack sees the network come back. */
async function reconnect() {
  await act(async () => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  });
}

/**
 * Holds every leave timer (a `LEAVE_MS` setTimeout) until `run()`, so a Leaving
 * copy stays rendered while the test acts.
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
  return { run: () => act(() => held.splice(0).forEach((callback) => callback())) };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Renders the app and waits for the List error panel. */
async function renderInError(...answers: Answer[]) {
  const calls = serveLists(...answers);
  // Assigned, not spread, so the app's `list` getter stays a getter.
  const app = Object.assign(renderApp(), { calls });
  await waitFor(() => expect(tryAgain()).not.toBeNull());
  return app;
}

/** Adds `text` by keyboard from the add field. */
async function add(app: ReturnType<typeof renderApp>, text: string) {
  await app.user.click(app.field);
  await app.user.keyboard(`${text}{Enter}`);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('List states: loading', () => {
  it('K5 loading shows three skeleton cards hidden from assistive tech, inside the aria-busy list, and the Loading status outside it', async () => {
    const held = gate();
    serveLists(after(held, listing(milk)));
    renderApp();

    const skeletons = skeletonList()!;
    expect(skeletons).not.toBeNull();
    const cards = [...skeletons.children];
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.tagName).toBe('LI');
      expect(card.getAttribute('aria-hidden')).toBe('true');
    }
    expect(skeletons.textContent).toBe('');
    expect(todoList()).toBeNull();
    expect(emptyPanel()).toBeNull();
    expect(tryAgain()).toBeNull();

    const status = loadingStatus();
    expect(status.getAttribute('role')).toBe('status');
    expect(status.classList.contains('visually-hidden')).toBe(true);
    expect(status.textContent).toBe('');
    expect(status.closest('[aria-busy]')).toBeNull();
    expect(skeletons.contains(status)).toBe(false);

    held.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    // The same element, outside the part that swaps.
    expect(loadingStatus()).toBe(status);
    expect(todoList()!.contains(status)).toBe(false);
    expect(skeletonList()).toBeNull();
  });

  it('K5 a load under 500 ms says nothing, at mount or when it finishes', async () => {
    const held = gate();
    serveLists(after(held, listing(milk)));
    const { queryClient } = renderApp();
    const watch = watchStatus();

    await sleep(200);
    held.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    await settled(queryClient);
    await sleep(600);
    watch.stop();

    expect(loadingStatus().textContent).toBe('');
    expect(watch.texts.filter((text) => text !== '')).toEqual([]);
  });

  it('K5 a slow first load says "Loading your todos" after about 500 ms, then "Your todos are loaded.", emptied 5 s later', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    const held = gate();
    serveLists(after(held, listing(milk)));
    renderApp();

    await sleep(300);
    expect(loadingStatus().textContent).toBe('');
    await waitFor(() => expect(loadingStatus().textContent).toBe(LOADING), { timeout: 1000 });

    held.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(loadingStatus().textContent).toBe(LOADED);
    // No Announcer message for a load.
    expect(liveElement().textContent).toBe('');

    act(() => vi.advanceTimersByTime(LINE_CLEAR_MS - 100));
    expect(loadingStatus().textContent).toBe(LOADED);
    act(() => vi.advanceTimersByTime(100));
    expect(loadingStatus().textContent).toBe('');
  });

  it('K5 the first successful load never renders the Empty panel when the server returned todos', async () => {
    const held = gate();
    serveLists(after(held, listing(milk, rent)));
    renderApp();
    const watch = watchEmptyPanel();

    held.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk', 'Pay rent']));
    watch.stop();

    expect(watch.seen.empty).toBe(false);
    expect(emptyPanel()).toBeNull();
  });

  it('K5 an add during Loading renders above the skeletons, which stay, because the cancelled fetch is not a failure', async () => {
    const created = gate();
    stored.todos = [rent];
    serveLists(never, listStored);
    serveCreates({ held: created });
    const app = renderApp();

    await add(app, 'Buy milk');

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(skeletonList()).not.toBeNull();
    expect(tryAgain()).toBeNull();
    // The Todo list sits above the skeleton list.
    expect(todoList()!.compareDocumentPosition(skeletonList()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    created.open();
    await waitFor(() => expect(skeletonList()).toBeNull());
    expect(items()).toEqual(['Buy milk', 'Pay rent']);
  });
});

describe('List states: empty', () => {
  it('K5 E5 a loaded list with no todos shows the Empty panel, and an add replaces it with the list', async () => {
    serveLists(listStored);
    serveCreates();
    const app = renderApp();

    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(emptyPanel()!.tagName).toBe('P');
    expect(todoList()).toBeNull();
    expect(skeletonList()).toBeNull();

    await add(app, 'Buy milk');

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(emptyPanel()).toBeNull();
  });

  it('K5 the Empty panel waits until the last Leaving row has unmounted', async () => {
    const state = { todos: [milk] };
    serveLists(() => HttpResponse.json(state.todos));
    server.use(
      http.delete('*/api/todos/:id', () => {
        state.todos = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const app = renderApp();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));

    await app.user.click(screen.getByRole('button', { name: 'Delete “Buy milk”' }));
    const confirm = within(screen.getByRole('group', { name: 'Delete this todo? Buy milk' }));
    await app.user.click(confirm.getByRole('button', { name: 'Delete “Buy milk”' }));

    expect(document.querySelector('li[data-leaving]')).not.toBeNull();
    expect(emptyPanel()).toBeNull();
    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(todoList()).toBeNull();
  });
});

describe('List states: error', () => {
  it.each([
    ['a 503 problem', unavailable, UNAVAILABLE],
    ['no response', noResponse, NETWORK],
    ['an HTML 500', htmlError, GENERIC],
  ])('K5 a first load failing with %s shows the List error panel and the Loading status speaks its line, without moving focus', async (_name, answer, reason) => {
    const held = gate();
    serveLists(after(held, answer));
    const app = renderApp();
    app.field.focus();

    held.open();
    await waitFor(() => expect(tryAgain()).not.toBeNull());

    expect(panelLine()).toBe(`${LEAD} ${reason}`);
    expect(loadingStatus().textContent).toBe(`${LEAD} ${reason}`);
    expect(skeletonList()).toBeNull();
    expect(emptyPanel()).toBeNull();
    expect(todoList()).toBeNull();
    expect(document.activeElement).toBe(app.field);
    // The Announcer never carries a load failure.
    expect(liveElement().textContent).toBe('');
  });

  it('K5 the error line empties from the Loading status 5 s after it was spoken; the panel stays', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    await renderInError(unavailable);
    expect(loadingStatus().textContent).toBe(`${LEAD} ${UNAVAILABLE}`);

    act(() => vi.advanceTimersByTime(LINE_CLEAR_MS - 100));
    expect(loadingStatus().textContent).toBe(`${LEAD} ${UNAVAILABLE}`);
    act(() => vi.advanceTimersByTime(100));
    expect(loadingStatus().textContent).toBe('');
    expect(panelLine()).toBe(`${LEAD} ${UNAVAILABLE}`);
  });

  it('K5 a new failure kind while in Error changes the panel reason and the Loading status says nothing', async () => {
    const { calls, queryClient } = await renderInError(unavailable, noResponse);
    await settled(queryClient);
    const watch = watchStatus();

    await regainFocus();
    await waitFor(() => expect(calls.count).toBe(2));
    await waitFor(() => expect(panelLine()).toBe(`${LEAD} ${NETWORK}`));
    await settled(queryClient);
    watch.stop();

    expect(watch.texts).toEqual([]);
    expect(loadingStatus().textContent).toBe(`${LEAD} ${UNAVAILABLE}`);
    expect(skeletonList()).toBeNull();
  });

  it('K5 an add during Error renders above the panel, which stays', async () => {
    const created = gate();
    serveCreates({ held: created });
    const app = await renderInError(unavailable);
    await add(app, 'Buy milk');

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(tryAgain()).not.toBeNull();
    expect(todoList()!.compareDocumentPosition(tryAgain()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    created.open();
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    await waitFor(() => expect(app.calls.count).toBe(2));
    await settled(app.queryClient);
    expect(tryAgain()).not.toBeNull();
  });

  it.each([
    ['Loading', [never] as Answer[]],
    ['Error', [unavailable] as Answer[]],
  ])('K5 a failed add during %s leaves the skeletons or panel, never the Empty panel', async (name, answers) => {
    serveLists(...answers);
    serveCreates({ fail: noResponse });
    const app = renderApp();
    if (name === 'Error') await waitFor(() => expect(tryAgain()).not.toBeNull());
    const watch = watchEmptyPanel();

    await add(app, 'Buy milk');

    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy milk”. ${NETWORK}`));
    await waitFor(() => expect(items()).toEqual([]));
    await sleep(50);
    watch.stop();
    expect(watch.seen.empty).toBe(false);
    expect(emptyPanel()).toBeNull();
    if (name === 'Error') expect(tryAgain()).not.toBeNull();
    else expect(skeletonList()).not.toBeNull();
  });
});

describe('List states: Try again', () => {
  it('K5 K6 Try again by keyboard moves focus to the add field first, shows the skeletons at once and fetches now; success loads the list and speaks the recovery line', async () => {
    const held = gate();
    const app = await renderInError(unavailable, after(held, listing(milk)));
    await settled(app.queryClient);

    // A tab stop named "Try again", the next one after Add.
    app.addButton.focus();
    await app.user.tab();
    expect(document.activeElement).toBe(tryAgain());

    const focus = watchFocus();
    const handOff = watchHandOff(tryAgain()!);
    await app.user.keyboard('{Enter}');
    focus.stop();

    expect(document.activeElement).toBe(app.field);
    expect(handOff).toEqual([{ connected: true, to: app.field }]);
    expect(focus.seen.length).toBeGreaterThan(0);
    expect(focus.seen).not.toContain(document.body);
    expect(tryAgain()).toBeNull();
    expect(skeletonList()).not.toBeNull();
    expect(loadingStatus().textContent).toBe('');
    await waitFor(() => expect(app.calls.count).toBe(2));

    held.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(loadingStatus().textContent).toBe(LOADED);
    expect(document.activeElement).toBe(app.field);
    expect(liveElement().textContent).toBe('');
  });

  it('K6 Space on Try again works too', async () => {
    const app = await renderInError(unavailable, listing(milk));
    tryAgain()!.focus();

    await app.user.keyboard(' ');

    expect(document.activeElement).toBe(app.field);
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
  });

  it('K5 a click on Try again moves focus to the add field, never to <body>', async () => {
    const app = await renderInError(unavailable, listing(milk));

    const focus = watchFocus();
    const handOff = watchHandOff(tryAgain()!);
    await app.user.click(tryAgain()!);
    focus.stop();

    expect(document.activeElement).toBe(app.field);
    expect(handOff).toEqual([{ connected: true, to: app.field }]);
    expect(focus.seen).not.toContain(document.body);
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
  });

  it('K5 after a touch pointerdown, Try again sends focus to the heading without scrolling', async () => {
    const app = await renderInError(unavailable, never);
    const focus = vi.spyOn(app.heading, 'focus');
    const button = tryAgain()!;

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button, { detail: 1 });

    expect(document.activeElement).toBe(app.heading);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(skeletonList()).not.toBeNull();
  });

  it('K5 a keyboard press after an earlier touch on Try again goes to the add field', async () => {
    const app = await renderInError(unavailable, never);
    const button = tryAgain()!;

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    button.focus();
    await app.user.keyboard('{Enter}');

    expect(document.activeElement).toBe(app.field);
  });

  it('K5 a failed Try again shows the panel again and speaks the error line again', async () => {
    const held = gate();
    const app = await renderInError(unavailable, after(held, unavailable));
    await settled(app.queryClient);
    expect(loadingStatus().textContent).toBe(`${LEAD} ${UNAVAILABLE}`);

    await app.user.click(tryAgain()!);
    expect(skeletonList()).not.toBeNull();
    expect(loadingStatus().textContent).toBe('');

    held.open();
    await waitFor(() => expect(tryAgain()).not.toBeNull());
    expect(loadingStatus().textContent).toBe(`${LEAD} ${UNAVAILABLE}`);
    expect(document.activeElement).toBe(app.field);
  });

  it('K5 Try again while a save is pending shows the skeletons at once and fetches only when the save settles', async () => {
    const created = gate();
    serveCreates({ held: created });
    const app = await renderInError(unavailable, listStored);
    await settled(app.queryClient);
    await add(app, 'Buy bread');
    await waitFor(() => expect(items()).toEqual(['Buy bread']));
    const gets = app.calls.count;

    await app.user.click(tryAgain()!);

    expect(skeletonList()).not.toBeNull();
    expect(tryAgain()).toBeNull();
    await sleep(100);
    expect(app.calls.count).toBe(gets);

    created.open();
    await waitFor(() => expect(skeletonList()).toBeNull());
    expect(app.calls.count).toBe(gets + 1);
    expect(tryAgain()).toBeNull();
    expect(items()).toEqual(['Buy bread']);
  });

  it('K5 a recovery more than 5 s after the error line emptied still speaks the recovery line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    const app = await renderInError(unavailable, listing(milk));
    await settled(app.queryClient);
    act(() => vi.advanceTimersByTime(LINE_CLEAR_MS + 1000));
    expect(loadingStatus().textContent).toBe('');

    await app.user.click(tryAgain()!);

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(loadingStatus().textContent).toBe(LOADED);
  });
});

describe.each([
  ['focus', regainFocus],
  ['reconnect', reconnect],
])('List states: recovered without Try again, by a %s refetch', (kind, refetch) => {
  it.each([
    ['the Todo list when the list has todos', [milk], () => todoList()],
    ['the Empty panel when the list is empty', [], () => emptyPanel()],
  ])(`K5 a ${kind} refetch replacing the panel while focus is on Try again moves focus to %s, and the recovery line is not spoken`, async (_name, todos, target) => {
    const app = await renderInError(unavailable, listing(...todos));
    await settled(app.queryClient);
    tryAgain()!.focus();
    const watch = watchStatus();

    await refetch();

    await waitFor(() => expect(tryAgain()).toBeNull());
    watch.stop();
    expect(app.calls.count).toBe(2);
    expect(skeletonList()).toBeNull();
    expect(document.activeElement).toBe(target());
    expect(target()!.getAttribute('tabindex')).toBe('-1');
    expect(watch.texts).not.toContain(LOADED);
    expect(loadingStatus().textContent).toBe('');
    expect(liveElement().textContent).toBe('');
  });

  it(`K5 a ${kind} refetch replacing the panel while focus is elsewhere leaves focus there and speaks the recovery line`, async () => {
    const app = await renderInError(unavailable, listing(milk));
    await settled(app.queryClient);
    app.field.focus();
    const watch = watchStatus();

    await refetch();

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    watch.stop();
    expect(app.calls.count).toBe(2);
    expect(watch.texts).not.toContain(LOADING);
    expect(skeletonList()).toBeNull();
    expect(document.activeElement).toBe(app.field);
    expect(loadingStatus().textContent).toBe(LOADED);
    expect(liveElement().textContent).toBe('');
  });
});

describe('List states: focus across the first load', () => {
  /**
   * Renders the app loading, adds "Buy milk" (stored at once), and holds the
   * settle-time refetch that loads the list until `loaded` opens.
   */
  async function renderWithEarlyCard() {
    const loaded = gate();
    stored.todos = [rent];
    serveCreates();
    serveLists(never, after(loaded, listStored));
    const app = renderApp();
    await add(app, 'Buy milk');
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    await waitFor(() => expect(liveElement().textContent).toBe('Added “Buy milk”.'));
    expect(skeletonList()).not.toBeNull();
    return { app, loaded, list: todoList()! };
  }

  it('K5 an early card keeps focus across the first successful load, in the same list element', async () => {
    const { app, loaded, list } = await renderWithEarlyCard();
    const box = check('Buy milk');
    box.focus();

    loaded.open();
    await waitFor(() => expect(items()).toEqual(['Buy milk', 'Pay rent']));
    await settled(app.queryClient);

    expect(todoList()).toBe(list);
    expect(check('Buy milk')).toBe(box);
    expect(document.activeElement).toBe(box);
  });

  it('K5 an early card keeps an open Edit form and its draft across the first successful load', async () => {
    const { app, loaded, list } = await renderWithEarlyCard();
    await app.user.click(screen.getByRole('button', { name: 'Edit “Buy milk”' }));
    const field = screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement;
    await app.user.keyboard('{Control>}a{/Control}Buy oat milk');

    loaded.open();
    await waitFor(() => expect(skeletonList()).toBeNull());
    await settled(app.queryClient);

    expect(todoList()).toBe(list);
    expect(screen.getByRole('textbox', { name: 'Edit description' })).toBe(field);
    expect(field.value).toBe('Buy oat milk');
    expect(document.activeElement).toBe(field);
  });

  it('K5 an early card keeps an open Delete confirm across the first successful load', async () => {
    const { app, loaded, list } = await renderWithEarlyCard();
    await app.user.click(screen.getByRole('button', { name: 'Delete “Buy milk”' }));
    const group = screen.getByRole('group', { name: 'Delete this todo? Buy milk' });
    const cancel = within(group).getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);

    loaded.open();
    await waitFor(() => expect(skeletonList()).toBeNull());
    await settled(app.queryClient);

    expect(todoList()).toBe(list);
    expect(screen.getByRole('group', { name: 'Delete this todo? Buy milk' })).toBe(group);
    expect(document.activeElement).toBe(cancel);
  });
});

describe('List states: the last row removed', () => {
  it('K5 a refetch removing the focused last row moves focus to the Empty panel', async () => {
    const state = { todos: [milk] };
    serveLists(() => HttpResponse.json(state.todos));
    const app = renderApp();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    await settled(app.queryClient);
    check('Buy milk').focus();
    state.todos = [];

    await regainFocus();

    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(document.activeElement).toBe(emptyPanel());
  });

  it('K5 a not-found on the last row moves focus to the list, then to the Empty panel when the list goes', async () => {
    const answered = gate();
    const listed = gate();
    // The settle-time refetch, which removes the row, is held until the test opens it.
    serveLists(listing(milk), after(listed, listing()));
    server.use(
      http.patch('*/api/todos/:id', async ({ request }) => {
        (await request.json()) as UpdateTodoBody;
        await answered.opened;
        return problem('/problems/not-found', 404)();
      }),
    );
    const app = renderApp();
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    await settled(app.queryClient);

    check('Buy milk').focus();
    await app.user.keyboard(' ');
    answered.open();

    // The interim stop: the Todo list, while the row waits for the refetch.
    await waitFor(() => expect(document.activeElement).toBe(todoList()));
    expect(items()).toEqual(['Buy milk']);

    listed.open();
    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(document.activeElement).toBe(emptyPanel());
    expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.');
  });

  it('K5 a failed add of the last row, once loaded, moves focus from inside it to the Empty panel', async () => {
    const created = gate();
    serveLists(listing());
    serveCreates({ held: created, fail: noResponse });
    const app = renderApp();
    await waitFor(() => expect(emptyPanel()).not.toBeNull());

    await add(app, 'Buy milk');
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    check('Buy milk').focus();
    created.open();

    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(items()).toEqual([]);
    expect(document.activeElement).toBe(emptyPanel());
  });

  it('K5 a refetch bringing rows while focus is on the Empty panel moves focus to the Todo list', async () => {
    const calls = serveLists(listing(), listing(milk));
    const app = renderApp();
    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    await settled(app.queryClient);
    emptyPanel()!.focus();

    await regainFocus();

    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(calls.count).toBe(2);
    expect(emptyPanel()).toBeNull();
    expect(document.activeElement).toBe(todoList());
  });

  it('K5 with only a Leaving row left, a removed focused row sends focus to the Todo list, then to the Empty panel when the copy unmounts', async () => {
    const timers = holdLeaveTimers();
    const state = { todos: [milk, rent] };
    serveLists(() => HttpResponse.json(state.todos));
    server.use(
      http.delete('*/api/todos/:id', ({ params }) => {
        state.todos = state.todos.filter((todo) => todo.id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const app = renderApp();
    await waitFor(() => expect(items()).toEqual(['Buy milk', 'Pay rent']));
    await settled(app.queryClient);

    // Delete "Buy milk": its Leaving copy stays while its leave timer is held, and focus goes to "Pay rent".
    await app.user.click(screen.getByRole('button', { name: 'Delete “Buy milk”' }));
    const confirm = within(screen.getByRole('group', { name: 'Delete this todo? Buy milk' }));
    await app.user.click(confirm.getByRole('button', { name: 'Delete “Buy milk”' }));
    await waitFor(() => expect(state.todos).toEqual([rent]));
    await settled(app.queryClient);
    expect(document.querySelector('li[data-leaving]')).not.toBeNull();
    expect(document.activeElement).toBe(check('Pay rent'));

    // "Pay rent" is deleted elsewhere; a refetch removes it while focused.
    state.todos = [];
    await regainFocus();

    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Pay rent' })).toBeNull());
    expect(document.querySelector('li[data-leaving]')).not.toBeNull();
    expect(emptyPanel()).toBeNull();
    expect(document.activeElement).toBe(todoList());

    // The last Leaving copy unmounts: a commit that changes only the Leaving rows.
    timers.run();

    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(todoList()).toBeNull();
    expect(document.activeElement).toBe(emptyPanel());
  });

  it.each([
    ['focused', false, 'Error'],
    ['toggled while its create was pending', true, 'Error'],
    ['focused', false, 'Loading'],
  ])('K5 a failed add of the only early card, %s, during %s before the first load moves focus to the heading', async (_name, toggle, during) => {
    const created = gate();
    serveCreates({ held: created, fail: noResponse });
    server.use(http.patch('*/api/todos/:id', () => HttpResponse.json({})));
    let app: ReturnType<typeof renderApp>;
    if (during === 'Error') {
      app = await renderInError(unavailable);
    } else {
      serveLists(never);
      app = renderApp();
    }
    const headingFocus = vi.spyOn(app.heading, 'focus');

    await add(app, 'Buy milk');
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    if (toggle) {
      await app.user.click(check('Buy milk'));
      expect(check('Buy milk').checked).toBe(true);
    } else {
      check('Buy milk').focus();
    }
    expect(document.activeElement).toBe(check('Buy milk'));
    created.open();

    await waitFor(() => expect(items()).toEqual([]));
    expect(document.activeElement).toBe(app.heading);
    expect(headingFocus).toHaveBeenCalledWith({ preventScroll: true });
    if (during === 'Error') expect(tryAgain()).not.toBeNull();
    else expect(skeletonList()).not.toBeNull();
    expect(emptyPanel()).toBeNull();
  });
});

describe('List states: focus targets', () => {
  it('K6 the Todo list and the Empty panel are programmatic focus targets, not tab stops', async () => {
    serveLists(listStored);
    serveCreates();
    const app = renderApp();
    await waitFor(() => expect(emptyPanel()).not.toBeNull());
    expect(emptyPanel()!.getAttribute('tabindex')).toBe('-1');

    // Tab from the heading goes through the add form and out: never to the Empty panel.
    app.heading.focus();
    for (let i = 0; i < 4; i += 1) {
      await app.user.tab();
      expect(document.activeElement).not.toBe(emptyPanel());
    }

    await add(app, 'Buy milk');
    await waitFor(() => expect(items()).toEqual(['Buy milk']));
    expect(todoList()!.getAttribute('tabindex')).toBe('-1');
    app.field.focus();
    await app.user.tab();
    // The next stop after the add form's controls is a control inside the card, never the list itself.
    const stops: (Element | null)[] = [document.activeElement];
    for (let i = 0; i < 3; i += 1) {
      await app.user.tab();
      stops.push(document.activeElement);
    }
    expect(stops).not.toContain(todoList());
  });
});
