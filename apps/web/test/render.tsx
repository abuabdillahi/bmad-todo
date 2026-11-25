import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { App } from '../src/components/App.tsx';
import { createQueryClient, TodosProvider } from '../src/todos/TodosProvider.tsx';

/**
 * Renders the real app: the real `TodosProvider` (store, announcer, query
 * policy) around `App`, against MSW. `children` render inside the provider,
 * after the app, for tests that drive the hooks the way a caller would.
 */
export function renderApp({ children }: { children?: ReactNode } = {}) {
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const result = render(
    <TodosProvider queryClient={queryClient}>
      <App />
      {children}
    </TodosProvider>,
  );
  return {
    ...result,
    user,
    queryClient,
    field: screen.getByRole('textbox', { name: 'New todo' }) as HTMLTextAreaElement,
    addButton: screen.getByRole('button', { name: 'Add' }),
    heading: screen.getByRole('heading', { level: 1, name: 'BMad Todos' }),
    /** The Todo list, queried on each read: it renders only while it has rows. */
    get list(): HTMLElement {
      return screen.getByRole('list', { name: 'Todos' });
    },
  };
}
