import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createAnnouncer, type Announcer } from './announcer.ts';
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

export interface TodosContextValue {
  store: TodosStore;
  announcer: Announcer;
  queryOptions: ReturnType<typeof todosQueryOptions>;
}

const TodosContext = createContext<TodosContextValue | null>(null);

/** One todos store and one announcer per `QueryClient` (AD-11, AD-14). */
const perClient = new WeakMap<QueryClient, TodosContextValue>();

function todosContextFor(queryClient: QueryClient): TodosContextValue {
  let value = perClient.get(queryClient);
  if (!value) {
    const store = createTodosStore();
    const announcer = createAnnouncer();
    value = { store, announcer, queryOptions: todosQueryOptions({ queryClient, store, announce: announcer.announce }) };
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
