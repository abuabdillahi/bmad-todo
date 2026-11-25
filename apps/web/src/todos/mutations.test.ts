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

  it('U4 an add given a failed add\'s id sends that id, and a 200 replay announces Added', async () => {
    const { helper, announce, list } = setup([first]);
    const reused = 'b0000000-0000-4000-8000-000000000009';
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init!.body)) as { id: string; description: string };
      return Response.json({ ...body, completed: false, createdAt: '2026-11-24T10:00:00.000Z' }, { status: 200 });
    });

    const pending = helper.addTodo('Buy milk', reused);
    await flush();
    expect(list()![0]).toMatchObject({ id: reused, description: 'Buy milk' });
    const outcome = await pending;

    expect(outcome).toEqual({ status: 'ok', id: reused });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({ id: reused, description: 'Buy milk' });
    expect(announce).toHaveBeenCalledExactlyOnceWith('status', 'Added “Buy milk”.');
  });

  it('U4 an add without an id mints a fresh UUID each time', async () => {
    const { helper } = setup([first]);
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init!.body)) as { id: string; description: string };
      return Response.json({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }, { status: 201 });
    });

    const one = await helper.addTodo('Buy milk');
    const two = await helper.addTodo('Buy milk', undefined);

    expect(one.id).toMatch(UUID);
    expect(two.id).toMatch(UUID);
    expect(two.id).not.toBe(one.id);
    const sent = fetchMock.mock.calls.map(([, init]) => (JSON.parse(String(init!.body)) as { id: string }).id);
    expect(sent).toEqual([one.id, two.id]);
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

  it('U5 a create resubmitted while the failed one\'s chain is alive: its follow-up is sent once it succeeds, the earlier follow-up is dropped', async () => {
    const { helper, store, list } = setup([second]);
    const create1 = held();
    const f1 = held();
    const create2 = held();
    const f2 = held();

    const created1 = helper.run(createSpec(first, create1.send));
    const followed1 = helper.run(completeSpec(first, f1.send));
    const created2 = helper.run(createSpec(first, create2.send));
    const followed2 = helper.run(completeSpec(first, f2.send));
    await flush();

    create1.reject(new RequestFailure('network', 'x'));
    await expect(created1).resolves.toMatchObject({ status: 'failed' });
    await expect(followed1).resolves.toEqual({ status: 'dropped' });
    expect(f1.send).not.toHaveBeenCalled();
    // The resubmitted card stays, with its own follow-up's change.
    expect(list()).toEqual([{ ...first, completed: true }, second]);
    await flush();
    expect(create2.send).toHaveBeenCalledOnce();
    expect(f2.send).not.toHaveBeenCalled();

    create2.resolve();
    await expect(created2).resolves.toEqual({ status: 'ok' });
    await flush();
    expect(f2.send).toHaveBeenCalledOnce();
    f2.resolve();
    await expect(followed2).resolves.toEqual({ status: 'ok' });
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(list()).toEqual([{ ...first, completed: true }, second]);
  });

  it('U5 a resubmitted create that fails again drops the follow-up queued behind it', async () => {
    const { helper, store, announce, list } = setup([second]);
    const create1 = held();
    const f1 = held();
    const create2 = held();
    const f2 = held();

    const created1 = helper.run(createSpec(first, create1.send));
    const followed1 = helper.run(completeSpec(first, f1.send));
    const created2 = helper.run(createSpec(first, create2.send));
    const followed2 = helper.run(completeSpec(first, f2.send));
    await flush();

    create1.reject(new RequestFailure('network', 'x'));
    await expect(followed1).resolves.toEqual({ status: 'dropped' });
    await flush();
    create2.reject(new RequestFailure('unavailable', 'x'));
    await expect(created1).resolves.toMatchObject({ status: 'failed' });
    await expect(created2).resolves.toMatchObject({ status: 'failed' });
    await expect(followed2).resolves.toEqual({ status: 'dropped' });

    expect(f1.send).not.toHaveBeenCalled();
    expect(f2.send).not.toHaveBeenCalled();
    expect(announce.mock.calls.map(([kind]) => kind)).toEqual(['failure', 'failure']);
    expect(list()).toEqual([second]);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('U5 a create resubmitted after the failed one\'s chain is gone sends its follow-up once it succeeds', async () => {
    const { helper, store } = setup([second]);
    const create1 = held();
    const f1 = held();

    const created1 = helper.run(createSpec(first, create1.send));
    const followed1 = helper.run(completeSpec(first, f1.send));
    await flush();
    create1.reject(new RequestFailure('network', 'x'));
    await expect(created1).resolves.toMatchObject({ status: 'failed' });
    await expect(followed1).resolves.toEqual({ status: 'dropped' });
    await flush();

    const create2 = held();
    const f2 = held();
    const created2 = helper.run(createSpec(first, create2.send));
    const followed2 = helper.run(completeSpec(first, f2.send));
    await flush();
    create2.resolve();
    await expect(created2).resolves.toEqual({ status: 'ok' });
    await flush();
    f2.resolve();
    await expect(followed2).resolves.toEqual({ status: 'ok' });

    expect(f1.send).not.toHaveBeenCalled();
    expect(f2.send).toHaveBeenCalledOnce();
    expect(store.getSnapshot().pendingCount).toBe(0);
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

describe('mutation helper: complete and reopen (U3, U4, U5)', () => {
  const done: Todo = { ...first, completed: true };
  const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
  const NETWORK = 'Check your connection and try again.';

  /** Answers each PATCH once the test settles it, recording its path and body. */
  function heldPatches() {
    const calls: { path: string; body: unknown; settle: (answer: () => Response | Promise<Response>) => void }[] = [];
    fetchMock.mockImplementation(
      (url, init) =>
        new Promise<Response>((resolve, reject) => {
          calls.push({
            path: String(url),
            body: JSON.parse(String(init!.body)),
            settle: (answer) => void Promise.resolve().then(answer).then(resolve, reject),
          });
        }),
    );
    return calls;
  }

  it.each([
    ['complete', first, true],
    ['reopen', done, false],
  ])('U3 %s applies at once, sends {completed} by PATCH and announces nothing', async (_name, todo, completed) => {
    const { helper, store, announce, invalidate, list } = setup([todo, second]);
    const calls = heldPatches();

    const pending = helper.setCompleted(todo, completed);
    await flush();

    expect(list()).toEqual([{ ...todo, completed }, second]);
    expect(store.getSnapshot().pendingCount).toBe(1);
    expect(calls.map(({ path, body }) => ({ path, body }))).toEqual([{ path: `/api/todos/${todo.id}`, body: { completed } }]);
    expect(fetchMock.mock.calls[0]![1]!.method).toBe('PATCH');

    calls[0]!.settle(() => Response.json({ ...todo, completed }));
    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(list()).toEqual([{ ...todo, completed }, second]);
    expect(announce).not.toHaveBeenCalled();
    expect(store.getSnapshot().revertedAt.size).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it.each([
    ['complete', first, true, 'a 503 problem', () => problem('/problems/unavailable', 503), `Couldn't mark “Already here” done, so it's still open. ${UNAVAILABLE}`],
    ['complete', first, true, 'no response', () => Promise.reject(new TypeError('Failed to fetch')), `Couldn't mark “Already here” done, so it's still open. ${NETWORK}`],
    ['reopen', done, false, 'a 503 problem', () => problem('/problems/unavailable', 503), `Couldn't reopen “Already here”, so it's still done. ${UNAVAILABLE}`],
    ['reopen', done, false, 'an HTML 500', () => new Response('<html>boom</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }), "Couldn't reopen “Already here”, so it's still done. Something went wrong on our side. Try again."],
  ])('U4 a %s failing with %s reverts only that todo, records the revert and announces the lead plus reason', async (_name, todo, completed, _answerName, answer, message) => {
    const { helper, store, announce, invalidate, list, queryClient } = setup([todo, second]);
    const calls = heldPatches();

    const pending = helper.setCompleted(todo, completed);
    await flush();
    // Another todo changes meanwhile; the revert keeps that change.
    queryClient.setQueryData<Todo[]>(todosQueryKey, (todos) => todos!.map((t) => (t.id === second.id ? { ...t, description: 'Changed' } : t)));
    calls[0]!.settle(answer);
    const outcome = await pending;

    expect(outcome).toMatchObject({ status: 'failed' });
    expect(list()).toEqual([todo, { ...second, description: 'Changed' }]);
    expect([...store.getSnapshot().revertedAt]).toEqual([[todo.id, 1234]]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', message);
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it.each([
    ['complete', first, true],
    ['reopen', done, false],
  ])('U4 a %s answered 404 reverts and announces deletedElsewhere, with no lead or reason', async (_name, todo, completed) => {
    const { helper, store, announce, list } = setup([todo, second]);
    const calls = heldPatches();

    const pending = helper.setCompleted(todo, completed);
    await flush();
    calls[0]!.settle(() => problem('/problems/not-found', 404));

    await expect(pending).resolves.toMatchObject({ status: 'failed', failure: { kind: 'not-found' } });
    expect(list()).toEqual([todo, second]);
    expect(store.getSnapshot().revertedAt.get(todo.id)).toBe(1234);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', '“Already here” was deleted elsewhere.');
  });

  it('U4 two quick toggles are sent in order, and a failed first one re-applies the second on the restored value', async () => {
    const { helper, store, list } = setup([first]);
    const calls = heldPatches();

    const completed = helper.setCompleted(first, true);
    const reopened = helper.setCompleted(first, false);
    await flush();
    expect(list()).toEqual([first]);
    expect(calls.map(({ body }) => body)).toEqual([{ completed: true }]);

    calls[0]!.settle(() => problem('/problems/unavailable', 503));
    await expect(completed).resolves.toMatchObject({ status: 'failed' });
    expect(list()).toEqual([first]);
    await flush();
    expect(calls.map(({ body }) => body)).toEqual([{ completed: true }, { completed: false }]);

    calls[1]!.settle(() => Response.json(first));
    await expect(reopened).resolves.toEqual({ status: 'ok' });
    expect(list()).toEqual([first]);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  /** Holds each request by method, so a create and a toggle on its todo settle independently. */
  function heldByMethod() {
    type Settle = (answer: (body: Record<string, unknown>) => Response) => void;
    const held: { POST: Settle[]; PATCH: Settle[] } = { POST: [], PATCH: [] };
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((resolve) => {
          const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
          held[init!.method as keyof typeof held].push((answer) => resolve(answer(body)));
        }),
    );
    return held;
  }

  it('U5 a toggle on a todo whose create is pending shows at once and is sent only after the create settles', async () => {
    const { helper, announce, list } = setup([second]);
    const held = heldByMethod();

    const added = helper.addTodo('Buy milk');
    await flush();
    const id = list()![0]!.id;
    const completed = helper.setCompleted({ id, description: 'Buy milk' }, true);
    await flush();

    expect(list()![0]).toMatchObject({ id, completed: true });
    expect(held.POST).toHaveLength(1);
    expect(held.PATCH).toHaveLength(0);

    held.POST[0]!((body) => Response.json({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }, { status: 201 }));
    await expect(added).resolves.toMatchObject({ status: 'ok' });
    await flush();
    expect(held.PATCH).toHaveLength(1);
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/todos/${id}`);

    held.PATCH[0]!(() => Response.json({ id, description: 'Buy milk', completed: true, createdAt: '2026-11-25T10:00:00.000Z' }));
    await expect(completed).resolves.toEqual({ status: 'ok' });
    expect(announce).toHaveBeenCalledExactlyOnceWith('status', 'Added “Buy milk”.');
  });

  it('U5 a toggle behind a create that fails is dropped: not sent, announced or reverted', async () => {
    const { helper, store, announce, list } = setup([second]);
    const held = heldByMethod();

    const added = helper.addTodo('Buy milk');
    await flush();
    const id = list()![0]!.id;
    const completed = helper.setCompleted({ id, description: 'Buy milk' }, true);
    await flush();

    held.POST[0]!(() => problem('/problems/unavailable', 503));
    await expect(added).resolves.toMatchObject({ status: 'failed' });
    await expect(completed).resolves.toEqual({ status: 'dropped' });

    expect(held.PATCH).toHaveLength(0);
    expect(list()).toEqual([second]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', `Couldn't add “Buy milk”. ${UNAVAILABLE}`);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });
});

describe('mutation helper: edit (U4, U5)', () => {
  const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
  const NETWORK = 'Check your connection and try again.';
  const GENERIC = 'Something went wrong on our side. Try again.';
  const VALIDATION = 'Keep it to 1–200 characters.';

  /** Answers each PATCH once the test settles it, recording its path and body. */
  function heldPatches() {
    const calls: { path: string; body: unknown; settle: (answer: () => Response | Promise<Response>) => void }[] = [];
    fetchMock.mockImplementation(
      (url, init) =>
        new Promise<Response>((resolve, reject) => {
          calls.push({
            path: String(url),
            body: JSON.parse(String(init!.body)),
            settle: (answer) => void Promise.resolve().then(answer).then(resolve, reject),
          });
        }),
    );
    return calls;
  }

  it('U4 an edit applies at once, sends {description} by PATCH and announces nothing', async () => {
    const { helper, store, announce, invalidate, list } = setup([first, second]);
    const calls = heldPatches();

    const pending = helper.editDescription(first, 'Edited text');
    await flush();

    expect(list()).toEqual([{ ...first, description: 'Edited text' }, second]);
    expect(store.getSnapshot().pendingCount).toBe(1);
    expect(calls.map(({ path, body }) => ({ path, body }))).toEqual([{ path: `/api/todos/${first.id}`, body: { description: 'Edited text' } }]);
    expect(fetchMock.mock.calls[0]![1]!.method).toBe('PATCH');

    calls[0]!.settle(() => Response.json({ ...first, description: 'Edited text' }));
    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(list()).toEqual([{ ...first, description: 'Edited text' }, second]);
    expect(announce).not.toHaveBeenCalled();
    expect(store.getSnapshot().revertedAt.size).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it.each([
    ['a 503 problem', () => problem('/problems/unavailable', 503), UNAVAILABLE],
    ['no response', () => Promise.reject(new TypeError('Failed to fetch')), NETWORK],
    ['an HTML 500', () => new Response('<html>boom</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }), GENERIC],
    ['a 400 naming description', () => problem('/problems/validation', 400, [{ field: 'description', message: 'x' }]), VALIDATION],
    ['a 400 naming another field', () => problem('/problems/validation', 400, [{ field: 'id', message: 'x' }]), GENERIC],
  ])('U4 an edit failing with %s reverts only that todo\'s text, records the revert and announces edit with the pre-edit text plus the reason', async (_name, answer, reason) => {
    const { helper, store, announce, invalidate, list, queryClient } = setup([first, second]);
    const calls = heldPatches();

    const pending = helper.editDescription(first, 'Edited text');
    await flush();
    // Another todo changes meanwhile; the revert keeps that change.
    queryClient.setQueryData<Todo[]>(todosQueryKey, (todos) => todos!.map((t) => (t.id === second.id ? { ...t, completed: true } : t)));
    calls[0]!.settle(answer);
    const outcome = await pending;

    expect(outcome).toMatchObject({ status: 'failed' });
    expect(list()).toEqual([first, { ...second, completed: true }]);
    expect([...store.getSnapshot().revertedAt]).toEqual([[first.id, 1234]]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', `Couldn't save your edit, so “Already here” is back as it was. ${reason}`);
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: todosQueryKey });
  });

  it('U4 an edit answered 404 reverts and announces deletedElsewhere with the pre-edit text, with no lead or reason', async () => {
    const { helper, store, announce, list } = setup([first, second]);
    const calls = heldPatches();

    const pending = helper.editDescription(first, 'Edited text');
    await flush();
    calls[0]!.settle(() => problem('/problems/not-found', 404));

    await expect(pending).resolves.toMatchObject({ status: 'failed', failure: { kind: 'not-found' } });
    expect(list()).toEqual([first, second]);
    expect(store.getSnapshot().revertedAt.get(first.id)).toBe(1234);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', '“Already here” was deleted elsewhere.');
  });

  it('U4 two queued edits, the first failing: the card shows the second, and the message quotes it', async () => {
    const { helper, announce, list } = setup([first]);
    const calls = heldPatches();

    const toB = helper.editDescription(first, 'Text B');
    const toC = helper.editDescription({ ...first, description: 'Text B' }, 'Text C');
    await flush();
    expect(list()).toEqual([{ ...first, description: 'Text C' }]);
    expect(calls.map(({ body }) => body)).toEqual([{ description: 'Text B' }]);

    calls[0]!.settle(() => problem('/problems/unavailable', 503));
    await expect(toB).resolves.toMatchObject({ status: 'failed' });
    // Rebuilt from "Already here", with the queued edit re-applied on it.
    expect(list()).toEqual([{ ...first, description: 'Text C' }]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', `Couldn't save your edit, so “Text C” is back as it was. ${UNAVAILABLE}`);

    await flush();
    calls[1]!.settle(() => Response.json({ ...first, description: 'Text C' }));
    await expect(toC).resolves.toEqual({ status: 'ok' });
  });

  /** Holds each request by method, so a create and an edit on its todo settle independently. */
  function heldByMethod() {
    type Settle = (answer: (body: Record<string, unknown>) => Response) => void;
    const held: { POST: Settle[]; PATCH: { body: Record<string, unknown>; settle: Settle }[] } = { POST: [], PATCH: [] };
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((resolve) => {
          const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
          const settle: Settle = (answer) => resolve(answer(body));
          if (init!.method === 'POST') held.POST.push(settle);
          else held.PATCH.push({ body, settle });
        }),
    );
    return held;
  }

  it('U5 an edit on a todo whose create is pending shows at once and is sent only after the create settles', async () => {
    const { helper, announce, list } = setup([second]);
    const held = heldByMethod();

    const added = helper.addTodo('Buy milk');
    await flush();
    const id = list()![0]!.id;
    const edited = helper.editDescription({ id, description: 'Buy milk' }, 'Buy oat milk');
    await flush();

    expect(list()![0]).toMatchObject({ id, description: 'Buy oat milk' });
    expect(held.POST).toHaveLength(1);
    expect(held.PATCH).toHaveLength(0);

    held.POST[0]!((body) => Response.json({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }, { status: 201 }));
    await expect(added).resolves.toMatchObject({ status: 'ok' });
    await flush();
    expect(held.PATCH.map(({ body }) => body)).toEqual([{ description: 'Buy oat milk' }]);
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/todos/${id}`);

    held.PATCH[0]!.settle(() => Response.json({ id, description: 'Buy oat milk', completed: false, createdAt: '2026-11-25T10:00:00.000Z' }));
    await expect(edited).resolves.toEqual({ status: 'ok' });
    expect(list()![0]).toMatchObject({ id, description: 'Buy oat milk' });
    expect(announce).toHaveBeenCalledExactlyOnceWith('status', 'Added “Buy milk”.');
  });

  it('U5 an edit behind a create that fails is dropped: not sent, announced or reverted', async () => {
    const { helper, store, announce, list } = setup([second]);
    const held = heldByMethod();

    const added = helper.addTodo('Buy milk');
    await flush();
    const id = list()![0]!.id;
    const edited = helper.editDescription({ id, description: 'Buy milk' }, 'Buy oat milk');
    await flush();

    held.POST[0]!(() => problem('/problems/unavailable', 503));
    await expect(added).resolves.toMatchObject({ status: 'failed' });
    await expect(edited).resolves.toEqual({ status: 'dropped' });

    expect(held.PATCH).toHaveLength(0);
    expect(list()).toEqual([second]);
    expect(announce).toHaveBeenCalledExactlyOnceWith('failure', `Couldn't add “Buy milk”. ${UNAVAILABLE}`);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });
});
