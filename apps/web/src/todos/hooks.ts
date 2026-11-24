import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Todo } from '@todo/contract';
import { createTodo, listTodos } from '../api/client.ts';

export const todosQueryKey = ['todos'] as const;

/** The one `['todos']` query, in the order the server returned (AD-11). */
export function useTodos(): Todo[] {
  const { data } = useQuery({
    queryKey: todosQueryKey,
    queryFn: ({ signal }) => listTodos(signal),
  });
  return data ?? [];
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
