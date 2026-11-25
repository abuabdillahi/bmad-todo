import { queryOptions, type QueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import type { Todo } from '@todo/contract';
import { isCancellation, listTodos, RequestFailure } from '../api/client.ts';
import type { Announcer } from './announcer.ts';
import { messages } from './messages.ts';
import type { TodosStore } from './store.ts';

/** The one list query key (AD-11). */
export const todosQueryKey = ['todos'] as const;

export interface TodosQueryDeps {
  queryClient: QueryClient;
  store: TodosStore;
  announce: Announcer['announce'];
}

/**
 * The `['todos']` query function, the one place fetch outcomes are recorded
 * (AD-11). A cancellation records and announces nothing, checked after the
 * last `await` too. A success writes the cache before it marks the list
 * loaded. A failure records its kind and, once loaded, announces `refresh`.
 */
export function createTodosQueryFn({ queryClient, store, announce }: TodosQueryDeps) {
  return async ({ signal }: Pick<QueryFunctionContext, 'signal'>): Promise<Todo[]> => {
    try {
      const list = await listTodos(signal);
      if (signal.aborted) throw signal.reason;
      queryClient.setQueryData(todosQueryKey, list);
      store.recordFetchSuccess();
      return list;
    } catch (error) {
      if (isCancellation(error, signal)) throw error;
      const failure = error instanceof RequestFailure ? error : new RequestFailure('generic', String(error));
      const wasLoaded = store.getSnapshot().loaded;
      store.recordFetchFailure(failure.kind);
      if (wasLoaded) announce('refresh', messages.failureMessage('refresh', failure));
      throw error;
    }
  };
}

/**
 * The query's key, function and policy (AD-11): no retries, never paused
 * offline, and the mount, focus and reconnect refetches only while no todo
 * mutation is pending.
 */
export function todosQueryOptions(deps: TodosQueryDeps) {
  const { store } = deps;
  const idle = () => store.getSnapshot().pendingCount === 0;
  return queryOptions({
    queryKey: todosQueryKey,
    queryFn: createTodosQueryFn(deps),
    retry: false,
    networkMode: 'always',
    refetchOnMount: idle,
    refetchOnWindowFocus: idle,
    refetchOnReconnect: idle,
  });
}
