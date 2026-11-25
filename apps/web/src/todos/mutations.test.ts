import { QueryClient } from '@tanstack/react-query';
import type { Todo } from '@todo/contract';
import { RequestFailure } from '../api/client.ts';
import { messages } from './messages.ts';
import { createMutationHelper, type MutationSpec } from './mutations.ts';
import { todosQueryKey } from './query.ts';
import { createTodosStore } from './store.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const first: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Already here',
  completed: false,
  createdAt: '2026-11-23T10:00:00.000Z',
};
const second: Todo = {
  id: 'a0000000-0000-4000-8000-000000000002',
  description: 'Also here',
  completed: false,
  createdAt: '2026-11-22T10:00:00.000Z',
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(initial?: Todo[]) {
  const queryClient = new QueryClient();
  if (initial) queryClient.setQueryData(todosQueryKey, initial);
  const store = createTodosStore();
  const announce = vi.fn();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const cancel = vi.spyOn(queryClient, 'cancelQueries');
  const helper = createMutationHelper({ queryClient, store, announce, now: () => 1234 });
  const list = () => queryClient.getQueryData<Todo[]>(todosQueryKey);
  return { queryClient, store, announce, invalidate, cancel, helper, list };
}

/** A send the test settles by hand. */
function held() {
  let resolve: (value?: unknown) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const send = vi.fn(
    () =>
      new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return { send, resolve: (value?: unknown) => resolve(value), reject: (error: unknown) => reject(error) };
}

/** Lets queued promise steps run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function problem(type: string, status: number, errors?: unknown[]): Response {
  return new Response(JSON.stringify({ type, title: 'x', status, detail: 'x', ...(errors ? { errors } : {}) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

function completeSpec(todo: Todo, send: () => Promise<unknown>): MutationSpec {
  return {
    id: todo.id,
    kind: 'follow-up',
    apply: (prev) => (prev ? { ...prev, completed: true } : null),
    send,
    failureText: (failure) => messages.failureMessage('complete', failure, todo.description),
  };
}

describe('mutation helper: add (U4)', () => {
  it('U4 puts the todo on top at once, before the send resolves, and counts it pending', async () => {
    const { helper, store, list, cancel } = setup([first]);
    fetchMock.mockReturnValue(new Promise(() => {}));

    void helper.addTodo('Buy milk');
    expect(store.getSnapshot().pendingCount).toBe(1);
    await flush();

    expect(cancel).toHaveBeenCalledWith({ queryKey: todosQueryKey });
    const [added, ...rest] = list()!;
    expect(added).toEqual({ id: expect.stringMatching(UUID), description: 'Buy milk', completed: false, createdAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(added!.createdAt))).toBe(false);
    expect(rest).toEqual([first]);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({ id: added!.id, description: 'Buy milk' });
  });

  it('U4 applies onto an undefined cache, before the first load', async () => {
    const { helper, list } = setup();
    fetchMock.mockReturnValue(new Promise(() => {}));

    void helper.addTodo('Buy milk');
    await flush();

    expect(list()!.map((todo) => todo.description)).toEqual(['Buy milk']);
  });

  it.each([
    ['201', 201],
    ['a 200 replay', 200],
  ])('U4 announces Added on %s, resolves ok and refetches once the count is 0', async (_name, status) => {
    const { helper, store, announce, invalidate } = setup([first]);
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init!.body)) as { id: string; description: string };
      return Response.json({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }, { status });
    });

    const outcome = await helper.addTodo('Buy milk');

    expect(outcome).toEqual({ status: 'ok', id: expect.stringMatching(UUID) });
    expect(announce).toHaveBeenCalledExactlyOnceWith('status', 'Added “Buy milk”.');
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it.each([
    ['a 503 problem', () => problem('/problems/unavailable', 503), "The server isn't available right now. Try again in a moment."],
    ['no response', () => Promise.reject(new TypeError('Failed to fetch')), 'Check your connection and try again.'],
    ['an HTML 500', () => new Response('<html>boom</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }), 'Something went wrong on our side. Try again.'],
    ['a 400 naming description', () => problem('/problems/validation', 400, [{ field: 'description', message: 'x' }]), 'Keep it to 1–200 characters.'],
    ['a 400 naming another field', () => problem('/problems/validation', 400, [{ field: 'id', message: 'x' }]), 'Something went wrong on our side. Try again.'],
  ])('U4 %s removes only that todo, records the revert and announces add plus the reason', async (_name, answer, reason) => {
    const { helper, store, announce, invalidate, list, queryClient } = setup([first, second]);
    let fail: () => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve, reject) => (fail = () => Promise.resolve().then(answer).then(resolve, reject))),
    );

    const pending = helper.addTodo('Buy milk');
    await flush();
    // Another todo changes meanwhile; the revert keeps that change.
    queryClient.setQueryData<Todo[]>(todosQueryKey, (todos) => todos!.map((t) => (t.id === second.id ? { ...t, completed: true } : t)));
    fail();
    const outcome = await pending;

    expect(outcome).toMatchObject({ status: 'failed', id: expect.stringMatching(UUID) });
    expect(list()).toEqual([first, { ...second, completed: true }]);
    expect(store.getSnapshot().revertedAt.get(outcome.id)).toBe(1234);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', `Couldn't add “Buy milk”. ${reason}`);
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it('U4 carries the failure kind and never rejects', async () => {
    const { helper } = setup([first]);
    const spec: MutationSpec = {
      ...completeSpec(first, () => Promise.reject(new Error('not a request failure'))),
      apply: () => {
        throw new Error('apply broke');
      },
    };

    await expect(helper.run(spec)).resolves.toEqual({ status: 'failed', failure: { kind: 'generic' } });
    await expect(helper.run(completeSpec(first, () => Promise.reject(new RequestFailure('network', 'x'))))).resolves.toEqual({
      status: 'failed',
      failure: { kind: 'network', namesDescription: false },
    });
  });

  it('U4 puts back an edited todo at its place and refetches once, after the last call settles', async () => {
    const { helper, store, invalidate, list } = setup([first, second]);
    const a = held();
    const b = held();

    const failing = helper.run(completeSpec(first, a.send));
    const succeeding = helper.run(completeSpec(second, b.send));
    await flush();
    expect(list()).toEqual([{ ...first, completed: true }, { ...second, completed: true }]);
    expect(store.getSnapshot().pendingCount).toBe(2);

    a.reject(new RequestFailure('unavailable', 'x'));
    await failing;
    expect(list()).toEqual([first, { ...second, completed: true }]);
    expect(invalidate).not.toHaveBeenCalled();

    b.resolve();
    await succeeding;
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('U4 a failed call keeps a later pending call on the same todo, and that call then fails back to the original', async () => {
    const { helper, store, list } = setup([first, second]);
    const a = held();
    const b = held();
    const editSpec: MutationSpec = {
      id: first.id,
      kind: 'follow-up',
      apply: (prev) => (prev ? { ...prev, description: 'Edited' } : null),
      send: a.send,
      failureText: (failure) => messages.failureMessage('edit', failure, first.description),
    };

    // v0 → v1 (edit), then v1 → v2 (complete), both pending.
    const edited = helper.run(editSpec);
    const completed = helper.run(completeSpec(first, b.send));
    await flush();
    expect(list()).toEqual([{ ...first, description: 'Edited', completed: true }, second]);

    // Call 1 fails: v0 with call 2's change, not v0 and not v2.
    a.reject(new RequestFailure('unavailable', 'x'));
    await expect(edited).resolves.toMatchObject({ status: 'failed' });
    expect(list()).toEqual([{ ...first, completed: true }, second]);

    // Call 2 fails in turn: back to v0, never the refused v1.
    await flush();
    expect(b.send).toHaveBeenCalledOnce();
    b.reject(new RequestFailure('unavailable', 'x'));
    await expect(completed).resolves.toMatchObject({ status: 'failed' });
    expect(list()).toEqual([first, second]);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });
});

describe('mutation helper: per-todo order (U5)', () => {
  function createSpec(todo: Todo, send: () => Promise<unknown>): MutationSpec {
    return {
      id: todo.id,
      kind: 'create',
      apply: () => todo,
      position: 'top',
      send,
      failureText: (failure) => messages.failureMessage('add', failure, todo.description),
      successText: messages.added(todo.description),
    };
  }

  it('U5 a follow-up on the same id is not sent until the create settles', async () => {
    const { helper, store, announce, list } = setup([second]);
    const create = held();
    const followUp = held();

    const created = helper.run(createSpec(first, create.send));
    const completed = helper.run(completeSpec(first, followUp.send));
    await flush();

    expect(list()).toEqual([{ ...first, completed: true }, second]);
    expect(create.send).toHaveBeenCalledOnce();
    expect(followUp.send).not.toHaveBeenCalled();
    expect(store.getSnapshot().pendingCount).toBe(2);

    create.resolve();
    await created;
    await flush();
    expect(followUp.send).toHaveBeenCalledOnce();

    followUp.resolve();
    await expect(completed).resolves.toEqual({ status: 'ok' });
    expect(announce).toHaveBeenCalledExactlyOnceWith('status', 'Added “Already here”.');
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('U5 a failed create drops its queued follow-up: not sent, announced or reverted', async () => {
    const { helper, store, announce, invalidate, list } = setup([second]);
    const create = held();
    const followUp = held();

    const created = helper.run(createSpec(first, create.send));
    const completed = helper.run(completeSpec(first, followUp.send));
    await flush();

    create.reject(new RequestFailure('network', 'x'));
    await expect(created).resolves.toMatchObject({ status: 'failed' });
    await expect(completed).resolves.toEqual({ status: 'dropped' });

    expect(followUp.send).not.toHaveBeenCalled();
    expect(list()).toEqual([second]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', "Couldn't add “Already here”. Check your connection and try again.");
    expect([...store.getSnapshot().revertedAt.keys()]).toEqual([first.id]);
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('U5 a follow-up on another id is not held back', async () => {
    const { helper } = setup([second]);
    const create = held();
    const other = held();

    void helper.run(createSpec(first, create.send));
    const completed = helper.run(completeSpec(second, other.send));
    await flush();

    expect(other.send).toHaveBeenCalledOnce();
    other.resolve();
    await expect(completed).resolves.toEqual({ status: 'ok' });
  });
});
