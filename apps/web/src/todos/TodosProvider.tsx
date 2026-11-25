import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createAnnouncer, type Announcer } from './announcer.ts';
import { createMutationHelper, type MutationHelper } from './mutations.ts';
import { todosQueryOptions } from './query.ts';
import { createTodosStore, type TodosStore } from './store.ts';

/** The app's `QueryClient` (AD-11): fail fast, no silent retries, no pausing while offline. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

/**
 * Tells the add form which ids the list area renders (EXPERIENCE Add form
 * states › Add landed after all), so the add form never observes `['todos']`
 * itself (AD-11).
 */
export interface LandedChannel {
  report(ids: readonly string[]): void;
  subscribe(listener: (ids: ReadonlySet<string>) => void): () => void;
}

export function createLandedChannel(): LandedChannel {
  const listeners = new Set<(ids: ReadonlySet<string>) => void>();
  return {
    report(ids) {
      const set = new Set(ids);
      for (const listener of listeners) listener(set);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface TodosContextValue {
  store: TodosStore;
  announcer: Announcer;
  queryOptions: ReturnType<typeof todosQueryOptions>;
  mutations: MutationHelper;
  landed: LandedChannel;
}

const TodosContext = createContext<TodosContextValue | null>(null);

/** One todos store, announcer and mutation helper per `QueryClient` (AD-11, AD-13, AD-14). */
const perClient = new WeakMap<QueryClient, TodosContextValue>();

function todosContextFor(queryClient: QueryClient): TodosContextValue {
  let value = perClient.get(queryClient);
  if (!value) {
    const store = createTodosStore();
    const announcer = createAnnouncer();
    const deps = { queryClient, store, announce: announcer.announce };
    value = {
      store,
      announcer,
      queryOptions: todosQueryOptions(deps),
      mutations: createMutationHelper(deps),
      landed: createLandedChannel(),
    };
    perClient.set(queryClient, value);
  }
  return value;
}

/** Provides the `QueryClient` and, beside it, the todos store, the announcer and the list query. */
export function TodosProvider({ queryClient, children }: { queryClient?: QueryClient; children: ReactNode }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <TodosContext value={todosContextFor(client)}>{children}</TodosContext>
    </QueryClientProvider>
  );
}

export function useTodosContext(): TodosContextValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodosContext needs a <TodosProvider>');
  return value;
}
