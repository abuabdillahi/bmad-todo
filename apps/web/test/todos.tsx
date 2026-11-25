import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo, UpdateTodoBody } from '@todo/contract';
import { LEAVE_MS } from '../src/components/TodoList.tsx';
import { todosQueryKey } from '../src/todos/query.ts';
import { useTodosContext, type TodosContextValue } from '../src/todos/TodosProvider.tsx';
import { server } from './msw.ts';
import { renderApp } from './render.tsx';

/**
 * Helpers the todo component tests share: a stub server for the todos API, the
 * failure reasons the Announcer appends, lookups by todo text, and a loaded
 * app. Each test file keeps its own fixtures.
 */

export const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
export const NETWORK = 'Check your connection and try again.';
export const GENERIC = 'Something went wrong on our side. Try again.';

/** A gate a handler waits on until the test opens it. */
export function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open: () => open() };
}

export const problem = (type: string, status: number) =>
  HttpResponse.json({ type, title: 'x', status, detail: 'x' }, { status, headers: { 'Content-Type': 'application/problem+json' } });

/**
 * A server holding `initial`: GET lists what it holds; each PATCH waits for
 * `release`, then answers with `fail` if set, else applies the body (404 for an
 * id it doesn't hold); each DELETE is recorded, waits for `deleted`, then
 * answers with `failDelete` if set, else removes the todo with a 204 (404 for an
 * id it doesn't hold); each POST waits for `created`, then answers with
 * `failCreate` if set, else stores the todo.
 */
export function serve(initial: Todo[]) {
  const state = {
    todos: initial.map((todo) => ({ ...todo })),
    lists: 0,
    patches: [] as { id: string; body: UpdateTodoBody }[],
    deletes: [] as { id: string; body: string; contentType: string | null }[],
    release: gate(),
    fail: undefined as undefined | (() => Response),
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
      if (state.fail) return state.fail();
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

/** An answer to a request, for `serveLists`. */
export type Answer = () => Response | Promise<Response>;

/** GET /api/todos answers from a queue; the last answer repeats. Counts the requests. */
export function serveLists(...answers: Answer[]) {
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

/** The Announcer's live element: the status outside every form and the list area. */
export function liveElement(): HTMLElement {
  const statuses = screen.getAllByRole('status').filter((el) => el.closest('form') === null && !el.hasAttribute('data-loading-status'));
  expect(statuses).toHaveLength(1);
  return statuses[0]!;
}

export function check(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement;
}

export function row(name: string): HTMLElement {
  return check(name).closest('li')!;
}

/** The card element inside a row: `li` › body › card. */
export function card(name: string): HTMLElement {
  return row(name).firstElementChild!.firstElementChild as HTMLElement;
}

/**
 * Holds every leave timer (a `LEAVE_MS` setTimeout) until `run()`, so a Leaving
 * row stays rendered for as long as a test needs; other timers run as usual.
 */
export function holdLeaveTimers() {
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

/** Waits until no `['todos']` fetch is running. */
export async function settled(queryClient: ReturnType<typeof renderApp>['queryClient']) {
  await waitFor(() => expect(queryClient.getQueryState(todosQueryKey)?.fetchStatus).toBe('idle'));
}

/** A focus refetch, the way TanStack sees the tab regain focus. */
export async function regainFocus() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

/**
 * Renders the app and waits until it shows `names.length` rows and no fetch is
 * running. Adds the todos context, a spy on the announcer for the calls the list
 * area makes, and a refetch.
 */
export async function renderLoaded(names: string[]) {
  let context: TodosContextValue | undefined;
  function Probe() {
    context = useTodosContext();
    return null;
  }
  const app = renderApp({ children: <Probe /> });
  await waitFor(() => expect(within(app.list).queryAllByRole('checkbox')).toHaveLength(names.length));
  await settled(app.queryClient);
  // Calls the list area makes; the helper holds its own reference, so its announcements are not counted.
  const listAnnounce = vi.spyOn(context!.announcer, 'announce');
  // A refetch, then the macrotask on which TanStack notifies its observers.
  const refetch = () =>
    act(async () => {
      await app.queryClient.refetchQueries({ queryKey: todosQueryKey });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  // Assigned, not spread, so the app's `list` getter stays a getter.
  return Object.assign(app, { context: context!, listAnnounce, refetch });
}
