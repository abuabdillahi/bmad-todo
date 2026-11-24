import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { CreateTodoBody, Todo } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { AddForm } from './AddForm.tsx';
import { TodoList } from './TodoList.tsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function renderAddForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AddForm />
    </QueryClientProvider>,
  );
  return {
    user: userEvent.setup(),
    field: screen.getByRole('textbox', { name: 'New todo' }),
    addButton: screen.getByRole('button', { name: 'Add' }),
  };
}

/** Answers POST /api/todos with 201 and records each request body. */
function acceptCreates(): CreateTodoBody[] {
  const received: CreateTodoBody[] = [];
  server.use(
    http.post('*/api/todos', async ({ request }) => {
      const body = (await request.json()) as CreateTodoBody;
      received.push(body);
      const todo: Todo = { ...body, completed: false, createdAt: new Date().toISOString() };
      return HttpResponse.json(todo, { status: 201 });
    }),
    http.get('*/api/todos', () => HttpResponse.json([])),
  );
  return received;
}

describe('AddForm', () => {
  it('K1 submits a valid description with Enter and clears itself, keeping focus', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    await user.click(field);
    await user.keyboard('Buy milk');
    expect(screen.getByText('8/200')).toBeTruthy();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Buy milk' }]);
    expect(screen.getByText('0/200')).toBeTruthy();
    expect(document.activeElement).toBe(field);
  });

  it('K1 submits with the Add button and sends the trimmed text', async () => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    await user.type(field, '  Call mum  ');
    await user.click(addButton);

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Call mum' }]);
    expect(document.activeElement).toBe(field);
  });

  it('K1 mints a new id for each add', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    await user.type(field, 'First{Enter}');
    await waitFor(() => expect(field).toHaveProperty('value', ''));
    await user.type(field, 'Second{Enter}');
    await waitFor(() => expect(received).toHaveLength(2));

    expect(received[0]!.id).not.toBe(received[1]!.id);
  });

  it('K1 sends nothing for a blank submit', async () => {
    const received = acceptCreates();
    const { user, field } = renderAddForm();

    await user.type(field, '   {Enter}');

    expect(received).toEqual([]);
    expect(field).toHaveProperty('value', '   ');
  });

  it('K1 keeps the text and shows no message when the add fails', async () => {
    let attempts = 0;
    server.use(
      http.post('*/api/todos', () => {
        attempts += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );
    const { user, field } = renderAddForm();

    await user.type(field, 'Buy milk{Enter}');

    await waitFor(() => expect(attempts).toBe(1));
    // Let the failed call settle before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(field).toHaveProperty('value', 'Buy milk');
    expect(screen.getByText('8/200')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('K1 leaves the list unchanged when the add fails', async () => {
    const existing: Todo = {
      id: 'a0000000-0000-4000-8000-000000000001',
      description: 'Already here',
      completed: false,
      createdAt: '2026-11-23T10:00:00.000Z',
    };
    let lists = 0;
    let attempts = 0;
    server.use(
      http.get('*/api/todos', () => {
        lists += 1;
        return HttpResponse.json([existing]);
      }),
      http.post('*/api/todos', () => {
        attempts += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, networkMode: 'always' },
        mutations: { retry: false, networkMode: 'always' },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AddForm />
        <TodoList />
      </QueryClientProvider>,
    );
    const list = screen.getByRole('list', { name: 'Todos' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Buy milk{Enter}');
    await waitFor(() => expect(attempts).toBe(1));
    // Let the failed call settle before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Already here']);
    expect(lists).toBe(1);
  });

  it('K1 Enter never inserts a newline, Shift+Enter included', async () => {
    acceptCreates();
    const { user, field } = renderAddForm();

    await user.type(field, 'One{Shift>}{Enter}{/Shift}two');

    expect(field).toHaveProperty('value', 'Onetwo');
  });

  it('K6 the field and Add button have accessible names, and the field describes its counter and hint', () => {
    const { field, addButton } = renderAddForm();

    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('placeholder')).toBeNull();
    expect(addButton.getAttribute('type')).toBe('submit');
    expect(addButton.hasAttribute('disabled')).toBe(false);
    expect(addButton.hasAttribute('aria-disabled')).toBe(false);
    const describedBy = (field.getAttribute('aria-describedby') ?? '').split(' ');
    const description = describedBy.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(description).toBe('0/200 Press Enter to add.');
  });

  it('K6 the field and Add button are reachable and operable by keyboard', async () => {
    const received = acceptCreates();
    const { user, field, addButton } = renderAddForm();

    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.keyboard('Walk the dog');
    await user.tab();
    expect(document.activeElement).toBe(addButton);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(field).toHaveProperty('value', ''));
    expect(received).toEqual([{ id: expect.stringMatching(UUID), description: 'Walk the dog' }]);
    expect(document.activeElement).toBe(field);
  });
});
