import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { Todo } from '@todo/contract';
import { server } from '../../test/msw.ts';
import { renderApp } from '../../test/render.tsx';
import { card, check, gate, liveElement, problem, renderLoaded, row, serve, UNAVAILABLE } from '../../test/todos.tsx';
import { useTodosContext, type TodosContextValue } from '../todos/TodosProvider.tsx';
import { REVERT_FLAG_MS } from './TodoCard.tsx';
import styles from './TodoCard.module.css';

const milk: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-24T10:00:00.000Z',
};
const bills: Todo = {
  id: 'a0000000-0000-4000-8000-000000000003',
  description: 'Pay bills',
  completed: false,
  createdAt: '2026-11-22T10:00:00.000Z',
};
const rent: Todo = {
  id: 'a0000000-0000-4000-8000-000000000002',
  description: 'Pay rent',
  completed: true,
  createdAt: '2026-11-23T10:00:00.000Z',
};

function chip(name: string): HTMLElement | null {
  return within(row(name)).queryByText('Done');
}

describe('TodoCard', () => {
  it('K2 an active and a done todo render distinctly: checked state, Done chip and done class', async () => {
    serve([milk, rent]).release.open();
    await renderLoaded(['Buy milk', 'Pay rent']);

    expect(check('Buy milk').checked).toBe(false);
    expect(chip('Buy milk')).toBeNull();
    expect(card('Buy milk').classList.contains(styles.done!)).toBe(false);

    expect(check('Pay rent').checked).toBe(true);
    expect(chip('Pay rent')!.getAttribute('aria-hidden')).toBe('true');
    expect(card('Pay rent').classList.contains(styles.done!)).toBe(true);
    // The chip sits beside the span that names the check, never inside it.
    const label = document.getElementById(check('Pay rent').getAttribute('aria-labelledby')!)!;
    expect(label.textContent).toBe('Pay rent');
    expect(label.contains(chip('Pay rent'))).toBe(false);
  });

  it('K2 a click completes a todo at once, before the server answers, and sends the body', async () => {
    const state = serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(check('Buy milk'));

    await waitFor(() => expect(check('Buy milk').checked).toBe(true));
    expect(chip('Buy milk')).not.toBeNull();
    expect(card('Buy milk').classList.contains(styles.done!)).toBe(true);
    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { completed: true } }]));
    expect(state.todos[0]!.completed).toBe(false);

    state.release.open();
    await waitFor(() => expect(state.lists).toBe(2));
    expect(check('Buy milk').checked).toBe(true);
    expect(liveElement().textContent).toBe('');
  });

  it('K2 K6 Space reopens a done todo at once, keeping focus on the check', async () => {
    const state = serve([rent]);
    const { user } = await renderLoaded(['Pay rent']);

    check('Pay rent').focus();
    await user.keyboard(' ');

    await waitFor(() => expect(check('Pay rent').checked).toBe(false));
    expect(chip('Pay rent')).toBeNull();
    expect(card('Pay rent').classList.contains(styles.done!)).toBe(false);
    expect(document.activeElement).toBe(check('Pay rent'));
    await waitFor(() => expect(state.patches).toEqual([{ id: rent.id, body: { completed: false } }]));

    state.release.open();
    await waitFor(() => expect(state.lists).toBe(2));
    expect(check('Pay rent').checked).toBe(false);
    expect(document.activeElement).toBe(check('Pay rent'));
    expect(liveElement().textContent).toBe('');
  });

  it('K6 the check is named by the todo text alone, and Tab reaches it after the Add button, then its Edit and Delete buttons', async () => {
    serve([rent, milk]).release.open();
    const { user, field, addButton } = await renderLoaded(['Pay rent', 'Buy milk']);

    // Done or not, the name is the text: the chip is hidden from assistive tech.
    expect(screen.getAllByRole('checkbox')).toEqual([check('Pay rent'), check('Buy milk')]);
    expect(screen.queryByRole('checkbox', { name: /Done/ })).toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.tab();
    expect(document.activeElement).toBe(addButton);
    await user.tab();
    expect(document.activeElement).toBe(check('Pay rent'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit “Pay rent”' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete “Pay rent”' }));
    await user.tab();
    expect(document.activeElement).toBe(check('Buy milk'));
  });

  it('K6 a failing save reverts, announces the lead and reason, keeps focus and flags the card for about 1.2 s', async () => {
    const state = serve([milk]);
    state.fail = () => problem('/problems/unavailable', 503);
    const { user } = await renderLoaded(['Buy milk']);

    check('Buy milk').focus();
    await user.keyboard(' ');
    await waitFor(() => expect(check('Buy milk').checked).toBe(true));

    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't mark “Buy milk” done, so it's still open. ${UNAVAILABLE}`));
    const flaggedAt = Date.now();
    expect(check('Buy milk').checked).toBe(false);
    expect(chip('Buy milk')).toBeNull();
    expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(true);
    expect(document.activeElement).toBe(check('Buy milk'));

    await waitFor(() => expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(false), { timeout: REVERT_FLAG_MS + 1000 });
    expect(Date.now() - flaggedAt).toBeGreaterThan(REVERT_FLAG_MS - 300);
    expect(document.activeElement).toBe(check('Buy milk'));

    // The next toggle works.
    state.fail = undefined;
    await user.keyboard(' ');
    await waitFor(() => expect(state.todos[0]!.completed).toBe(true));
    expect(check('Buy milk').checked).toBe(true);
  });

  it.each([
    ['the next row\'s check', 'Buy milk', [milk, rent], () => check('Pay rent')],
    ['the previous row\'s check', 'Pay rent', [milk, rent], () => check('Buy milk')],
    ['the Empty panel when it is the only row', 'Buy milk', [milk], () => screen.getByText('No todos yet.')],
    ['the next row\'s check, not the previous one\'s, from a middle row', 'Pay rent', [milk, rent, bills], () => check('Pay bills')],
  ])('K6 a 404 announces deleted elsewhere, moves focus to %s, and the row goes on the refetch', async (_name, name, todos, target) => {
    const state = serve(todos);
    const { user } = await renderLoaded(todos.map((todo) => todo.description));
    const removed = todos.find((todo) => todo.description === name)!;
    // Deleted elsewhere: the server no longer holds it.
    state.todos = state.todos.filter((todo) => todo.id !== removed.id);
    const lists = state.lists;

    check(name).focus();
    await user.keyboard(' ');
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe(`“${name}” was deleted elsewhere.`));
    await waitFor(() => expect(document.activeElement).toBe(target()));
    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name })).toBeNull());
    expect(document.activeElement).toBe(target());
  });

  it('K6 a card mounting inside the flag window is flagged only for the time that remains', async () => {
    serve([milk]).release.open();
    const listed = gate();
    server.use(
      http.get('*/api/todos', async () => {
        await listed.opened;
        return HttpResponse.json([milk]);
      }),
    );
    let context: TodosContextValue | undefined;
    function Probe() {
      context = useTodosContext();
      return null;
    }
    const app = renderApp({ children: <Probe /> });
    const remaining = 300;
    context!.store.recordRevert(milk.id, Date.now() - (REVERT_FLAG_MS - remaining));

    listed.open();
    await waitFor(() => expect(within(app.list).queryAllByRole('checkbox')).toHaveLength(1));
    const mountedAt = Date.now();
    expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(true);

    await waitFor(() => expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(false), { timeout: REVERT_FLAG_MS });
    expect(Date.now() - mountedAt).toBeLessThan(REVERT_FLAG_MS - remaining + 200);
  });

  it('K6 a 404 leaves focus alone when it has left the row before the answer', async () => {
    const state = serve([milk, rent]);
    const { user, field } = await renderLoaded(['Buy milk', 'Pay rent']);
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    const lists = state.lists;

    check('Buy milk').focus();
    await user.keyboard(' ');
    await waitFor(() => expect(state.patches).toHaveLength(1));
    field.focus();
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull());
    expect(document.activeElement).toBe(field);
  });

  it('K6 a second revert inside the flag window extends the flag to 1.2 s after the second', async () => {
    serve([milk]).release.open();
    let context: TodosContextValue | undefined;
    function Probe() {
      context = useTodosContext();
      return null;
    }
    const app = renderApp({ children: <Probe /> });
    await waitFor(() => expect(within(app.list).queryAllByRole('checkbox')).toHaveLength(1));

    const first = Date.now();
    act(() => context!.store.recordRevert(milk.id, first));
    expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const second = Date.now();
    act(() => context!.store.recordRevert(milk.id, second));

    // Past the first window, still flagged for the second.
    await new Promise((resolve) => setTimeout(resolve, first + REVERT_FLAG_MS + 100 - Date.now()));
    expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(true);

    await waitFor(() => expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(false), { timeout: REVERT_FLAG_MS });
    expect(Date.now() - second).toBeGreaterThanOrEqual(REVERT_FLAG_MS - 50);
  });
});
