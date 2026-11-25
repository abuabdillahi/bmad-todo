import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Todo } from '@todo/contract';
import { dropOnto } from '../../test/drop.ts';
import { renderApp } from '../../test/render.tsx';
import { card, check, liveElement, problem, renderLoaded, serve, UNAVAILABLE } from '../../test/todos.tsx';
import styles from './TodoCard.module.css';

const milk: Todo = {
  id: 'a0000000-0000-4000-8000-000000000001',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-11-24T10:00:00.000Z',
};
const rent: Todo = {
  id: 'a0000000-0000-4000-8000-000000000002',
  description: 'Pay rent',
  completed: true,
  createdAt: '2026-11-23T10:00:00.000Z',
};

function editButton(description: string): HTMLButtonElement {
  return screen.getByRole('button', { name: `Edit “${description}”` }) as HTMLButtonElement;
}

function editField(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement;
}

function editForm(): HTMLFormElement {
  return editField().closest('form')!;
}

/** The edit form's hidden Field status. */
function editStatus(): HTMLElement {
  return within(editForm()).getByRole('status');
}

/** A row's todo text: the span its Completion check's `aria-labelledby` names. */
function shownText(name: string): string | undefined {
  return document.getElementById(check(name).getAttribute('aria-labelledby') ?? '')?.textContent ?? undefined;
}

/** The field's description text, leaving out aria-hidden icons as assistive tech does. */
function describedByText(field: HTMLElement): string {
  return (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => {
      const copy = document.getElementById(id)?.cloneNode(true) as HTMLElement | undefined;
      copy?.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
      return copy?.textContent;
    })
    .join(' ');
}

/**
 * Text queries that skip the live regions: a blocked submit puts the Inline
 * error's words in the Field status one frame later.
 */
const NOT_STATUS = { ignore: '[role="status"], script, style' };

describe('EditForm', () => {
  it('K3 Edit swaps the row to the form at once: the saved text all selected, focus in it, the check still there and toggling', async () => {
    const state = serve([rent, milk]);
    state.release.open();
    const { user } = await renderLoaded(['Pay rent', 'Buy milk']);
    expect(card('Pay rent').classList.contains(styles.done!)).toBe(true);

    await user.click(editButton('Pay rent'));

    const field = editField();
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('Pay rent');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'Pay rent'.length]);
    // Edit mode takes the active treatment, with no chip, and the check keeps its state and its name.
    expect(card('Pay rent').classList.contains(styles.editing!)).toBe(true);
    expect(card('Pay rent').classList.contains(styles.done!)).toBe(false);
    expect(within(card('Pay rent')).queryByText('Done')).toBeNull();
    expect(check('Pay rent').checked).toBe(true);
    expect(check('Pay rent').getAttribute('aria-label')).toBe('Pay rent');
    expect(check('Pay rent').hasAttribute('aria-labelledby')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Edit “Pay rent”' })).toBeNull();

    await user.click(check('Pay rent'));
    await waitFor(() => expect(state.patches).toEqual([{ id: rent.id, body: { completed: false } }]));
    expect(check('Pay rent').checked).toBe(false);
    expect(editField().value).toBe('Pay rent');
  });

  it('K3 a changed Save closes at once, shows the new text before the server answers, sends it and announces nothing', async () => {
    const state = serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Buy oat milk{Enter}');

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    await waitFor(() => expect(shownText('Buy oat milk')).toBe('Buy oat milk'));
    expect(document.activeElement).toBe(editButton('Buy oat milk'));
    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { description: 'Buy oat milk' } }]));
    expect(state.todos[0]!.description).toBe('Buy milk');

    state.release.open();
    await waitFor(() => expect(state.lists).toBe(2));
    expect(shownText('Buy oat milk')).toBe('Buy oat milk');
    expect(document.activeElement).toBe(editButton('Buy oat milk'));
    expect(liveElement().textContent).toBe('');
  });

  it('K3 Save sends the cleaned, trimmed text, which the counter counts', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: '  Buy\toat milk \n' } });
    expect(editField().value).toBe('  Buy oat milk  ');
    expect(describedByText(editField())).toBe('12/200 Press Enter to save.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { description: 'Buy oat milk' } }]));
    expect(shownText('Buy oat milk')).toBe('Buy oat milk');
  });

  it('K3 a Save whose cleaned, trimmed text is unchanged closes, focuses Edit and sends nothing', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: ' Buy milk\t' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(document.activeElement).toBe(editButton('Buy milk'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);
  });

  it.each([
    ['Cancel', async (user: ReturnType<typeof renderApp>['user']) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape in the field', async (user: ReturnType<typeof renderApp>['user']) => user.keyboard('{Escape}')],
    [
      'Escape on Save',
      async (user: ReturnType<typeof renderApp>['user']) => {
        screen.getByRole('button', { name: 'Save' }).focus();
        await user.keyboard('{Escape}');
      },
    ],
  ])('K3 %s discards the draft, shows the saved text, focuses Edit and sends nothing', async (_name, cancel) => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Something else');
    await cancel(user);

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(shownText('Buy milk')).toBe('Buy milk');
    expect(document.activeElement).toBe(editButton('Buy milk'));
    await user.click(editButton('Buy milk'));
    expect(editField().value).toBe('Buy milk');
    expect(state.patches).toEqual([]);
  });

  it('K3 Escape during an IME composition does not cancel', async () => {
    serve([milk]).release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.keyDown(editField(), { key: 'Escape', isComposing: true });

    expect(document.activeElement).toBe(editField());
  });

  it('K3 an empty Save is refused inline, keeps the form open with focus in the field, speaks and sends nothing', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    expect(editStatus().textContent).toBe('');
    fireEvent.change(editField(), { target: { value: ' \t ' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter a description.', NOT_STATUS)).toBeTruthy();
    expect(editField().getAttribute('aria-invalid')).toBe('true');
    expect(describedByText(editField())).toBe('Enter a description. 0/200 Press Enter to save.');
    expect(document.activeElement).toBe(editField());
    await waitFor(() => expect(editStatus().textContent).toBe('Enter a description.'));
    expect(liveElement().textContent).toBe('');
    expect(state.patches).toEqual([]);
  });

  it('K3 over the limit speaks once on crossing, sends nothing, and speaks again on a second blocked Save', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: '😀'.repeat(201) } });
    expect(describedByText(editField())).toBe('201/200, over the character limit Press Enter to save.');
    expect(editField().getAttribute('aria-invalid')).toBe('true');
    expect(editStatus().textContent).toBe('over the character limit');

    async function expectRespoken(blockedSave: () => Promise<void>) {
      const seen: string[] = [];
      const observer = new MutationObserver(() => seen.push(editStatus().textContent ?? ''));
      observer.observe(editStatus(), { childList: true, characterData: true, subtree: true });
      await blockedSave();
      await waitFor(() => expect(seen.at(-1)).toBe('over the character limit'));
      observer.disconnect();
      expect(seen).toContain('');
    }

    await expectRespoken(() => user.click(screen.getByRole('button', { name: 'Save' })));
    expect(document.activeElement).toBe(editField());
    await expectRespoken(() => user.keyboard('{End}{Enter}'));
    expect(document.activeElement).toBe(editField());
    expect(screen.queryByText('Enter a description.', NOT_STATUS)).toBeNull();
    expect(state.patches).toEqual([]);
  });

  it('K3 a pasted line break or a tab shows as a space', async () => {
    serve([milk]).release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.paste('One\nTwo');
    expect(editField().value).toBe('One Two');
    expect(screen.getByText('7/200')).toBeTruthy();

    fireEvent.change(editField(), { target: { value: 'One\tTwo' } });
    expect(editField().value).toBe('One Two');
  });

  it('K3 a failed Save reverts, says why, flags the card and leaves focus; the next Edit opens with the draft, and Cancel shows the saved text', async () => {
    const state = serve([milk]);
    state.fail = () => problem('/problems/unavailable', 503);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Buy oat milk{Enter}');
    await waitFor(() => expect(shownText('Buy oat milk')).toBe('Buy oat milk'));
    const edit = editButton('Buy oat milk');
    expect(document.activeElement).toBe(edit);

    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't save your edit, so “Buy milk” is back as it was. ${UNAVAILABLE}`));
    expect(shownText('Buy milk')).toBe('Buy milk');
    expect(card('Buy milk').classList.contains(styles.flagged!)).toBe(true);
    expect(document.activeElement).toBe(edit);
    expect(edit.getAttribute('aria-label')).toBe('Edit “Buy milk”');

    await user.click(edit);
    expect(editField().value).toBe('Buy oat milk');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(shownText('Buy milk')).toBe('Buy milk');

    // The draft served one Edit only.
    await user.click(editButton('Buy milk'));
    expect(editField().value).toBe('Buy milk');
  });

  it('K3 a Save answered 404 says it was deleted elsewhere and moves focus to the next check, and the row goes', async () => {
    const state = serve([milk, rent]);
    const { user } = await renderLoaded(['Buy milk', 'Pay rent']);
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    const lists = state.lists;

    await user.click(editButton('Buy milk'));
    await user.keyboard('Buy oat milk{Enter}');
    await waitFor(() => expect(state.patches).toHaveLength(1));
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
    await waitFor(() => expect(document.activeElement).toBe(check('Pay rent')));
    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull());
    expect(document.activeElement).toBe(check('Pay rent'));
  });

  it.each([
    ['the next row\'s check', milk, [milk, rent], () => check('Pay rent')],
    ['the previous row\'s check when it was the last row', rent, [milk, rent], () => check('Buy milk')],
    ['the Empty panel when it was the only row', milk, [milk], () => screen.getByText('No todos yet.')],
  ])('K3 a refetch removing the row in edit mode closes it, announces once and moves focus to %s', async (_name, removed, todos, target) => {
    const state = serve(todos);
    const { user, listAnnounce, refetch } = await renderLoaded(todos.map((todo) => todo.description));

    await user.click(editButton(removed.description));
    await user.keyboard('Draft');
    state.todos = state.todos.filter((todo) => todo.id !== removed.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: removed.description })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(document.activeElement).toBe(target());
    expect(liveElement().textContent).toBe(`“${removed.description}” was deleted elsewhere.`);
    expect(listAnnounce).toHaveBeenCalledExactlyOnceWith('failure', `“${removed.description}” was deleted elsewhere.`);

    // Another refetch says nothing more.
    await refetch();
    expect(listAnnounce).toHaveBeenCalledOnce();
  });

  it('K3 a failed save superseded by a later save on the card keeps no draft: the next Edit opens on the shown text', async () => {
    const state = serve([milk]);
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Buy oat milk{Enter}');
    await waitFor(() => expect(state.patches).toHaveLength(1));
    await user.click(editButton('Buy oat milk'));
    await user.keyboard('Buy soy milk{Enter}');
    await waitFor(() => expect(shownText('Buy soy milk')).toBe('Buy soy milk'));

    // The first save fails; the second, queued behind it, succeeds.
    state.fail = () => {
      state.fail = undefined;
      return problem('/problems/unavailable', 503);
    };
    state.release.open();
    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't save your edit, so “Buy soy milk” is back as it was. ${UNAVAILABLE}`));
    await waitFor(() => expect(state.todos[0]!.description).toBe('Buy soy milk'));
    await waitFor(() => expect(state.lists).toBe(2));

    await user.click(editButton('Buy soy milk'));
    expect(editField().value).toBe('Buy soy milk');
  });

  it('K3 a blur with nowhere to go while the field stays active (the window lost focus) still moves focus when a refetch removes the row', async () => {
    const state = serve([milk, rent]);
    const { user, refetch } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(editButton('Buy milk'));
    fireEvent.focusOut(editField());
    await Promise.resolve();
    expect(document.activeElement).toBe(editField());
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(document.activeElement).toBe(check('Pay rent'));
  });

  it('K3 focus that left a row for nothing stays on <body> when a refetch removes that row', async () => {
    const state = serve([milk, rent]);
    const { refetch } = await renderLoaded(['Buy milk', 'Pay rent']);

    check('Buy milk').focus();
    check('Buy milk').blur();
    expect(document.activeElement).toBe(document.body);
    await Promise.resolve();
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('K3 the text and Edit fade in only when the row comes back from edit mode, never on first load', async () => {
    serve([milk]).release.open();
    const { user } = await renderLoaded(['Buy milk']);
    const content = () => document.getElementById(check('Buy milk').getAttribute('aria-labelledby')!)!.parentElement!;
    const actions = () => editButton('Buy milk').parentElement!;

    expect(content().classList.contains(styles.swapIn!)).toBe(false);
    expect(actions().classList.contains(styles.swapIn!)).toBe(false);

    await user.click(editButton('Buy milk'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(content().classList.contains(styles.swapIn!)).toBe(true);
    expect(actions().classList.contains(styles.swapIn!)).toBe(true);
  });

  it('K3 Shift+Enter in the edit field inserts no newline and does not save', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('{End} oat{Shift>}{Enter}{/Shift}');

    expect(editField().value).toBe('Buy milk oat');
    expect(document.activeElement).toBe(editField());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);
  });

  it.each([
    ['isComposing', { isComposing: true }],
    ['keyCode 229', { keyCode: 229 }],
  ])('K3 Enter during an IME composition (%s) does not save', async (_name, init) => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: 'Buy oat milk' } });
    fireEvent.keyDown(editField(), { key: 'Enter', ...init });

    expect(document.activeElement).toBe(editField());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);
  });

  it('K3 a beforeinput line break in the edit field is cancelled and saves', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: 'Buy oat milk' } });
    const event = new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true });
    fireEvent(editField(), event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { description: 'Buy oat milk' } }]));
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
  });

  it('K3 a dropped line break in the edit field is cancelled and the text goes in cleaned at the drop point; nothing is saved', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: 'Buy  milk' } });
    editField().setSelectionRange(0, 0);
    const event = dropOnto(editField(), { data: 'One\nTwo', pointsAt: 4 });

    expect(event.defaultPrevented).toBe(true);
    expect(editField().value).toBe('Buy One Two milk');
    expect(editField().selectionStart).toBe(11);
    expect(editField().selectionEnd).toBe(11);
    expect(document.activeElement).toBe(editField());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);
  });

  it('K3 a beforeinput line break with Shift held (keyCode 229) is cancelled and does not save; Enter then saves', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user } = await renderLoaded(['Buy milk']);
    const lineBreak = () => new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true });

    await user.click(editButton('Buy milk'));
    fireEvent.change(editField(), { target: { value: 'Buy oat milk' } });
    fireEvent.keyDown(editField(), { key: 'Enter', keyCode: 229, shiftKey: true });
    const shifted = lineBreak();
    fireEvent(editField(), shifted);

    expect(shifted.defaultPrevented).toBe(true);
    expect(editField().value).toBe('Buy oat milk');
    expect(document.activeElement).toBe(editField());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);

    fireEvent.keyUp(editField(), { key: 'Shift', keyCode: 229 });
    fireEvent.keyDown(editField(), { key: 'Enter', keyCode: 229 });
    const plain = lineBreak();
    fireEvent(editField(), plain);

    expect(plain.defaultPrevented).toBe(true);
    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { description: 'Buy oat milk' } }]));
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
  });

  it('K3 a failed add removing its card in edit mode announces only the add failure, and focus moves to the next check', async () => {
    const state = serve([milk]);
    state.failCreate = () => problem('/problems/unavailable', 503);
    const { user, field, listAnnounce } = await renderLoaded(['Buy milk']);

    await user.type(field, 'Buy bread{Enter}');
    await waitFor(() => expect(editButton('Buy bread')).toBeTruthy());
    await user.click(editButton('Buy bread'));
    await user.keyboard('Buy rye bread');
    state.created.open();

    await waitFor(() => expect(liveElement().textContent).toBe(`Couldn't add “Buy bread”. ${UNAVAILABLE}`));
    expect(screen.queryByRole('checkbox', { name: 'Buy bread' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(document.activeElement).toBe(check('Buy milk'));
    await waitFor(() => expect(state.lists).toBe(2));
    expect(listAnnounce).not.toHaveBeenCalled();
    expect(state.patches).toEqual([]);
  });

  it('K3 a toggle answered 404 in edit mode is announced once: the refetch that removes the row adds nothing', async () => {
    const state = serve([milk, rent]);
    const { user, listAnnounce } = await renderLoaded(['Buy milk', 'Pay rent']);
    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    const lists = state.lists;

    await user.click(editButton('Buy milk'));
    await user.click(check('Buy milk'));
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull());
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(document.activeElement).toBe(check('Pay rent'));
    expect(listAnnounce).not.toHaveBeenCalled();
  });

  it('K3 a toggle answered 404 in edit mode whose message was dismissed: a later refetch removing the row is announced', async () => {
    const state = serve([milk, rent]);
    const { user, listAnnounce, refetch } = await renderLoaded(['Buy milk', 'Pay rent']);
    // The PATCH answers 404 while the todo stays listed, so the settle-time refetch keeps the row.
    state.fail = () => problem('/problems/not-found', 404);
    const lists = state.lists;

    await user.click(editButton('Buy milk'));
    await user.click(check('Buy milk'));
    state.release.open();

    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(liveElement().textContent).toBe(''));
    expect(screen.getByRole('textbox', { name: 'Edit description' })).toBeTruthy();

    state.todos = state.todos.filter((todo) => todo.id !== milk.id);
    await refetch();

    expect(screen.queryByRole('checkbox', { name: 'Buy milk' })).toBeNull();
    expect(listAnnounce).toHaveBeenCalledExactlyOnceWith('failure', '“Buy milk” was deleted elsewhere.');
    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
  });

  it('K3 a toggle answered 404 on one todo still lets the list announce another todo with the same text that a refetch removes in edit mode', async () => {
    const twin: Todo = { ...milk, id: 'a0000000-0000-4000-8000-000000000004' };
    const state = serve([milk, twin, rent]);
    const { user, listAnnounce } = await renderLoaded(['Buy milk', 'Buy milk', 'Pay rent']);
    const rowOf = (id: string) => document.querySelector<HTMLElement>(`li[data-todo-id="${id}"]`);
    state.todos = state.todos.filter((todo) => todo.id === rent.id);
    const lists = state.lists;

    await user.click(within(rowOf(twin.id)!).getByRole('button', { name: 'Edit “Buy milk”' }));
    await user.click(within(rowOf(milk.id)!).getByRole('checkbox'));
    state.release.open();

    await waitFor(() => expect(state.lists).toBe(lists + 1));
    await waitFor(() => expect(rowOf(twin.id)).toBeNull());
    expect(rowOf(milk.id)).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(document.activeElement).toBe(check('Pay rent'));
    expect(listAnnounce).toHaveBeenCalledExactlyOnceWith('failure', '“Buy milk” was deleted elsewhere.');
    await waitFor(() => expect(liveElement().textContent).toBe('“Buy milk” was deleted elsewhere.'));
  });

  it('K3 text changed elsewhere while editing: the draft is kept, and Save overwrites', async () => {
    const state = serve([milk]);
    state.release.open();
    const { user, refetch } = await renderLoaded(['Buy milk']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Buy oat milk');
    state.todos[0] = { ...state.todos[0]!, description: 'Buy soy milk' };
    await refetch();

    expect(editField().value).toBe('Buy oat milk');
    expect(check('Buy soy milk').getAttribute('aria-label')).toBe('Buy soy milk');
    expect(document.activeElement).toBe(editField());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(state.patches).toEqual([{ id: milk.id, body: { description: 'Buy oat milk' } }]));
    await waitFor(() => expect(shownText('Buy oat milk')).toBe('Buy oat milk'));
  });

  it('K3 Edit on another row closes the open one silently, losing its draft, and focuses the new field', async () => {
    const state = serve([milk, rent]);
    state.release.open();
    const { user, listAnnounce } = await renderLoaded(['Buy milk', 'Pay rent']);

    await user.click(editButton('Buy milk'));
    await user.keyboard('Draft');
    await user.click(editButton('Pay rent'));

    expect(screen.getAllByRole('textbox', { name: 'Edit description' })).toHaveLength(1);
    expect(document.activeElement).toBe(editField());
    expect(editField().value).toBe('Pay rent');
    expect(shownText('Buy milk')).toBe('Buy milk');

    await user.click(editButton('Buy milk'));
    expect(editField().value).toBe('Buy milk');
    expect(state.patches).toEqual([]);
    expect(listAnnounce).not.toHaveBeenCalled();
  });

  it('K6 Edit is named with the full text, and Tab runs check, Edit, Delete, next check; in edit mode check, field, Save, Cancel', async () => {
    const long = { ...milk, description: 'Call the plumber about the leaking kitchen tap before Friday' };
    serve([long, rent]).release.open();
    const { user, addButton } = await renderLoaded([long.description, 'Pay rent']);

    const edit = editButton(long.description);
    expect(edit.textContent).toBe('Edit');
    expect(edit.getAttribute('type')).toBe('button');

    addButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(check(long.description));
    await user.tab();
    expect(document.activeElement).toBe(edit);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: `Delete “${long.description}”` }));
    await user.tab();
    expect(document.activeElement).toBe(check('Pay rent'));

    await user.click(editButton(long.description));
    const field = editField();
    expect(field.tagName).toBe('TEXTAREA');
    expect(describedByText(field)).toBe(`${[...long.description].length}/200 Press Enter to save.`);
    expect(check(long.description).getAttribute('aria-label')).toBe(long.description);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(check(long.description));
    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await user.tab();
    expect(document.activeElement).toBe(check('Pay rent'));
  });

  it('K6 focus reaches its target in the same task as each swap: Edit, Save, Cancel and Escape', async () => {
    serve([milk]).release.open();
    await renderLoaded(['Buy milk']);

    fireEvent.click(editButton('Buy milk'));
    expect(document.activeElement).toBe(editField());
    fireEvent.change(editField(), { target: { value: 'Buy oat milk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Edit “/ }));

    fireEvent.click(screen.getByRole('button', { name: /^Edit “/ }));
    expect(document.activeElement).toBe(editField());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Edit “/ }));

    fireEvent.click(screen.getByRole('button', { name: /^Edit “/ }));
    expect(document.activeElement).toBe(editField());
    fireEvent.keyDown(editField(), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Edit “/ }));
  });
});
