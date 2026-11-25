import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { Todo } from '@todo/contract';
import { createTodo } from '../api/client.ts';
import type { Announcer, AnnouncerSnapshot } from './announcer.ts';
import { todosQueryKey } from './query.ts';
import { selectListState, type ListState, type TodosSnapshot } from './store.ts';
import { useTodosContext } from './TodosProvider.tsx';

export { todosQueryKey };

/** The todos store's snapshot (AD-11). */
export function useTodosStore(): TodosSnapshot {
  const { store } = useTodosContext();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * The list state and the todos to render, in the order the server returned
 * (AD-11). Holds the one `['todos']` observer, so only the list area uses it.
 */
export function useListState(): { state: ListState; todos: Todo[] } {
  const { queryOptions } = useTodosContext();
  const { data } = useQuery(queryOptions);
  const snapshot = useTodosStore();
  return { state: selectListState(snapshot, data), todos: data ?? [] };
}

/** Try again (AD-11): requests a retry, and fetches now only when no todo mutation is pending. */
export function useRetryFetch(): () => void {
  const queryClient = useQueryClient();
  const { store } = useTodosContext();
  return useCallback(() => {
    store.requestRetry();
    if (store.getSnapshot().pendingCount === 0) void queryClient.refetchQueries({ queryKey: todosQueryKey });
  }, [queryClient, store]);
}

/** The announcer's `announce` and `dismiss` (AD-14). */
export function useAnnouncer(): Pick<Announcer, 'announce' | 'dismiss'> {
  return useTodosContext().announcer;
}

/** What the Announcer region shows and speaks (AD-14). */
export function useAnnouncement(): AnnouncerSnapshot {
  const { announcer } = useTodosContext();
  return useSyncExternalStore(announcer.subscribe, announcer.getSnapshot);
}

export type AddOutcome = 'ok' | 'failed';

/**
 * Adds a todo and waits for the server: mints the id (AD-7), sends it, and on
 * `201` refetches the list. Resolves with the outcome and never rejects.
 * Story 6 moves this onto the optimistic-mutation helper (AD-13).
 */
export function useAddTodo(): (description: string) => Promise<AddOutcome> {
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (description: string) => createTodo({ id: crypto.randomUUID(), description }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
  });

  return useCallback(
    async (description: string) => {
      try {
        await mutateAsync(description);
        return 'ok';
      } catch {
        return 'failed';
      }
    },
    [mutateAsync],
  );
}
