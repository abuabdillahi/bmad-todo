import { QueryClient } from '@tanstack/react-query';
import type { Todo } from '@todo/contract';
import { createTodosQueryFn, todosQueryKey, todosQueryOptions } from './query.ts';
import { createTodosStore } from './store.ts';

const todo: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-25T10:00:00.000Z',
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const queryClient = new QueryClient();
  const store = createTodosStore();
  const announce = vi.fn();
  const queryFn = createTodosQueryFn({ queryClient, store, announce });
  return { queryClient, store, announce, queryFn };
}

const unavailable = () =>
  new Response(JSON.stringify({ type: '/problems/unavailable', title: 'x', status: 503, detail: 'x' }), {
    status: 503,
    headers: { 'Content-Type': 'application/problem+json' },
  });

describe('todos query function', () => {
  it('K7 writes the cache before it marks the list loaded', async () => {
    const { queryClient, store, queryFn } = setup();
    fetchMock.mockResolvedValue(Response.json([todo]));
    store.recordFetchFailure('network');
    store.requestRetry();
    const seen: unknown[] = [];
    store.subscribe(() => seen.push(queryClient.getQueryData(todosQueryKey)));

    expect(await queryFn({ signal: new AbortController().signal })).toEqual([todo]);
    expect(seen).toEqual([[todo]]);
    expect(store.getSnapshot()).toMatchObject({ loaded: true, lastFetchFailure: null, retryRequested: false });
  });

  it('K7 a first-load failure records its kind and announces nothing', async () => {
    const { store, announce, queryFn } = setup();
    fetchMock.mockResolvedValue(unavailable());
    store.requestRetry();
    await expect(queryFn({ signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(store.getSnapshot()).toMatchObject({ loaded: false, lastFetchFailure: 'unavailable', retryRequested: false });
    expect(announce).not.toHaveBeenCalled();
  });

  it('K7 a failure once loaded announces refresh with its reason', async () => {
    const { store, announce, queryFn } = setup();
    store.recordFetchSuccess();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(queryFn({ signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'network' });
    expect(store.getSnapshot()).toMatchObject({ loaded: true, lastFetchFailure: 'network' });
    expect(announce).toHaveBeenCalledWith(
      'refresh',
      "Couldn't refresh the list. You're seeing what was last loaded. Check your connection and try again.",
    );
  });

  it('K7 a result that arrives after a cancellation records nothing', async () => {
    const { queryClient, store, announce, queryFn } = setup();
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      return Response.json([todo]);
    });
    await expect(queryFn({ signal: controller.signal })).rejects.toBe(controller.signal.reason);
    expect(queryClient.getQueryData(todosQueryKey)).toBeUndefined();
    expect(store.getSnapshot()).toMatchObject({ loaded: false, lastFetchFailure: null });
    expect(announce).not.toHaveBeenCalled();
  });

  it('K7 a failure that arrives after a cancellation records nothing', async () => {
    const { store, announce, queryFn } = setup();
    store.recordFetchSuccess();
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      return unavailable();
    });
    await expect(queryFn({ signal: controller.signal })).rejects.toBeDefined();
    expect(store.getSnapshot().lastFetchFailure).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it('K7 refetches on mount, focus and reconnect only while no mutation is pending', () => {
    const { queryClient, store } = setup();
    const options = todosQueryOptions({ queryClient, store, announce: vi.fn() });
    expect(options).toMatchObject({ queryKey: todosQueryKey, retry: false, networkMode: 'always' });
    const predicates = [options.refetchOnMount, options.refetchOnWindowFocus, options.refetchOnReconnect];
    for (const predicate of predicates) {
      expect(typeof predicate).toBe('function');
    }
    const query = queryClient.getQueryCache().build(queryClient, { queryKey: todosQueryKey });
    const call = (predicate: unknown) => (predicate as (q: typeof query) => boolean)(query);
    expect(predicates.map(call)).toEqual([true, true, true]);
    store.mutationStarted();
    expect(predicates.map(call)).toEqual([false, false, false]);
    store.mutationSettled();
    expect(predicates.map(call)).toEqual([true, true, true]);
  });
});
