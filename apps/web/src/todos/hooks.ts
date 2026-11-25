import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { Todo } from '@todo/contract';
import type { Announcer, AnnouncerSnapshot } from './announcer.ts';
import { messages } from './messages.ts';
import type { AddOutcome, MutationOutcome } from './mutations.ts';
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

export type { AddOutcome, MutationOutcome };

/**
 * Adds a todo through the optimistic-mutation helper (AD-13): the card goes on
 * top at once, and the promise resolves with the outcome and the todo's id,
 * minted unless a failed add's id is passed back. It never rejects.
 */
export function useAddTodo(): (description: string, id?: string) => Promise<AddOutcome> {
  return useTodosContext().mutations.addTodo;
}

/**
 * Completes or reopens a todo through the optimistic-mutation helper (AD-13):
 * the card changes at once, and the promise resolves with the outcome. It
 * never rejects.
 */
export function useSetCompleted(): (todo: Pick<Todo, 'id' | 'description'>, completed: boolean) => Promise<MutationOutcome> {
  return useTodosContext().mutations.setCompleted;
}

/**
 * Changes a todo's text through the optimistic-mutation helper (AD-13): the
 * card shows the new text at once, and the promise resolves with the outcome.
 * It never rejects.
 */
export function useEditDescription(): (todo: Pick<Todo, 'id' | 'description'>, description: string) => Promise<MutationOutcome> {
  return useTodosContext().mutations.editDescription;
}

/**
 * Deletes a todo through the optimistic-mutation helper (AD-13): the todo
 * leaves the cache at once, and the promise resolves with the outcome. It
 * never rejects.
 */
export function useDeleteTodo(): (todo: Pick<Todo, 'id' | 'description'>) => Promise<MutationOutcome> {
  return useTodosContext().mutations.deleteTodo;
}

/**
 * The list area's one announcement (AD-14): “{t}” was deleted elsewhere, kind
 * `failure`, when a refetch removes the row in edit mode. Skipped while that
 * exact failure message is already showing (a `not-found` the helper announced).
 */
export function useAnnounceDeletedElsewhere(): (description: string) => void {
  const { announcer } = useTodosContext();
  return useCallback(
    (description: string) => {
      const text = messages.deletedElsewhere(description);
      const showing = announcer.getSnapshot().message;
      if (showing?.kind === 'failure' && showing.text === text) return;
      announcer.announce('failure', text);
    },
    [announcer],
  );
}

/**
 * When this todo's last revert happened (AD-13), or undefined. Selects only
 * this id's record, so a card re-renders only when its own record changes.
 */
export function useRevertedAt(id: string): number | undefined {
  const { store } = useTodosContext();
  const select = useCallback(() => store.getSnapshot().revertedAt.get(id), [store, id]);
  return useSyncExternalStore(store.subscribe, select);
}

/** The list area reports the ids it renders, each time they change (Add landed after all). */
export function useReportRenderedIds(todos: readonly Todo[]): void {
  const { landed } = useTodosContext();
  useEffect(() => {
    landed.report(todos.map((todo) => todo.id));
  }, [landed, todos]);
}

/** Calls `listener` with the ids the list area renders, each time they change. */
export function useLandedAfterAll(listener: (ids: ReadonlySet<string>) => void): void {
  const { landed } = useTodosContext();
  const latest = useRef(listener);
  useLayoutEffect(() => {
    latest.current = listener;
  });
  useEffect(() => landed.subscribe((ids) => latest.current(ids)), [landed]);
}
