import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type CDPSession, type Locator, type Page } from '@playwright/test';

/**
 * Locators, test data, list setup and expected copy shared by the e2e specs.
 * Every spec empties the list through the public API before each test
 * (`resetList`, AD-20), and sets up todos through it (`createTodo`); a test
 * still gives its todos unique descriptions and asserts only on its own.
 */

/** A todo as the API returns it (AD-6). */
export interface Todo {
  id: string;
  description: string;
  completed: boolean;
  createdAt: string;
}

/**
 * Empties the list through the public API (AD-20): lists the todos, deletes
 * each one, and checks the list is then empty. A 404 means another delete got
 * there first. DELETE goes
 * with no body and no content type: a JSON content type with an empty body is
 * refused with 400.
 */
export async function resetList(request: APIRequestContext): Promise<void> {
  const listed = await request.get('/api/todos');
  expect(listed.status()).toBe(200);
  const todos = (await listed.json()) as Todo[];
  for (const { id } of todos) {
    const deleted = await request.delete(`/api/todos/${encodeURIComponent(id)}`);
    expect([204, 404]).toContain(deleted.status());
  }
  const after = await request.get('/api/todos');
  expect(after.status()).toBe(200);
  expect(await after.json()).toEqual([]);
}

/** Creates a todo through the public API with a fresh id, then completes it when `completed`. */
export async function createTodo(request: APIRequestContext, description: string, completed = false): Promise<Todo> {
  const id = randomUUID();
  const created = await request.post('/api/todos', { data: { id, description } });
  expect(created.status()).toBe(201);
  if (!completed) return (await created.json()) as Todo;
  const updated = await request.patch(`/api/todos/${encodeURIComponent(id)}`, { data: { completed: true } });
  expect(updated.status()).toBe(200);
  return (await updated.json()) as Todo;
}

/** Opens the app and moves focus to the add field with Tab, its first tab stop. */
export async function focusAddField(page: Page): Promise<Locator> {
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  return field;
}

/**
 * Enter as a keyboard that keeps every word composing sends it (e.g. Gboard): keyCode 229,
 * which the keydown handler stands aside for, so Chromium's own default action raises a
 * trusted `beforeinput` line break. CDP sends a real key, not a synthetic DOM event.
 * With `shift`, Shift goes down first, Enter carries it, and Shift comes up after.
 */
export async function pressComposingEnter(cdp: CDPSession, { shift = false }: { shift?: boolean } = {}): Promise<void> {
  const composing = { windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 };
  const shiftKey = { key: 'Shift', code: 'ShiftLeft', ...composing };
  const enter = { key: 'Enter', code: 'Enter', ...composing, ...(shift ? { modifiers: 8 } : {}) };
  if (shift) await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 8, ...shiftKey });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: '\r', unmodifiedText: '\r', ...enter });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...enter });
  if (shift) await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, ...shiftKey });
}

/** A description no other test or run uses: `<prefix> <project> <time>-<random>`. */
export function uniqueDescription(prefix: string, project: string): string {
  return `${prefix} ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todoList(page: Page): Locator {
  return page.getByRole('list', { name: 'Todos' });
}

/** The todo cards whose text contains `description`. */
export function todoItem(page: Page, description: string): Locator {
  return todoList(page).getByRole('listitem').filter({ hasText: description });
}

/** A todo's Completion check, named by its text alone. */
export function completionCheck(page: Page, description: string): Locator {
  return todoList(page).getByRole('checkbox', { name: description, exact: true });
}

/** A todo's Edit button, named `Edit “{full text}”`, never cut. */
export function editButton(page: Page, description: string): Locator {
  return todoList(page).getByRole('button', { name: `Edit “${description}”`, exact: true });
}

/**
 * A todo's Delete button, named `Delete “{full text}”`, never cut. The Delete
 * confirm's Confirm delete button has the same name, but it replaces the row's
 * Delete, so the two never show at once; scope by `deleteConfirm` for it.
 */
export function deleteButton(page: Page, description: string): Locator {
  return todoList(page).getByRole('button', { name: `Delete “${description}”`, exact: true });
}

/** A todo's open Delete confirm: the group named by its prompt and the todo text. */
export function deleteConfirm(page: Page, description: string): Locator {
  return todoList(page).getByRole('group', { name: `Delete this todo? ${description}`, exact: true });
}

/** The open Edit form's Text field (edit), named by its hidden label. */
export function editField(page: Page): Locator {
  return todoList(page).getByRole('textbox', { name: 'Edit description', exact: true });
}

/** `{t}`'s text: cut at 40 code points with "…" inside the quote (EXPERIENCE Voice and Tone). */
export function quoteText(description: string): string {
  const points = [...description];
  return points.length <= 40 ? description : `${points.slice(0, 40).join('').trimEnd()}…`;
}

/** The Announcer's live message containing `text`: a `role="status"` outside the add form. */
export function announcement(page: Page, text: string | RegExp): Locator {
  return page.getByRole('status').filter({ hasText: text }).and(page.locator(':not(form [role="status"])'));
}

/** The add form's hidden Field status containing `text`. */
export function fieldStatus(page: Page, text: string | RegExp): Locator {
  return page.locator('form').getByRole('status').filter({ hasText: text });
}

/** The app's copy the specs assert on (EXPERIENCE Voice and Tone). */
export const MESSAGES = {
  /** Failure reasons the Announcer appends. */
  unavailable: "The server isn't available right now. Try again in a moment.",
  network: 'Check your connection and try again.',
  /** The refresh failure's lead. */
  refresh: "Couldn't refresh the list. You're seeing what was last loaded.",
  /** An add's outcome in the Announcer, whichever it is. */
  addOutcome: /^(Added|Couldn't add)/,
  added: (description: string): string => `Added “${quoteText(description)}”.`,
  addFailed: (description: string, reason: string): string => `Couldn't add “${quoteText(description)}”. ${reason}`,
  completeFailed: (description: string, reason: string): string =>
    `Couldn't mark “${quoteText(description)}” done, so it's still open. ${reason}`,
  reopenFailed: (description: string, reason: string): string =>
    `Couldn't reopen “${quoteText(description)}”, so it's still done. ${reason}`,
  editFailed: (description: string, reason: string): string =>
    `Couldn't save your edit, so “${quoteText(description)}” is back as it was. ${reason}`,
  deletedElsewhere: (description: string): string => `“${quoteText(description)}” was deleted elsewhere.`,
  deleted: (description: string): string => `Deleted “${quoteText(description)}”.`,
  deleteFailed: (description: string, reason: string): string =>
    `Couldn't delete “${quoteText(description)}”, so it's back in the list. ${reason}`,
  /** The Inline error for an empty submit. */
  empty: 'Enter a description.',
  /** The over-limit words the Field status speaks once the limit is crossed. */
  overLimit: 'over the character limit',
  /** The hidden suffix the counter carries while over the limit. */
  overLimitSuffix: ', over the character limit',
} as const;

/** A pattern matching `text` literally, anywhere in a string. */
export function containing(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/** AD-4's literal body, as nginx answers when the API can't be reached. */
export const UNAVAILABLE_BODY =
  '{"type":"/problems/unavailable","title":"Service unavailable","status":503,"detail":"The service is unavailable. Try again shortly."}';

/**
 * Elements matching `text` that are neither a `role="status"` live region nor
 * inside one: the hidden Field status carries an Inline error's words one
 * animation frame later, so a bare getByText matches both once that frame runs.
 */
export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).and(page.locator(':not([role="status"], [role="status"] *)'));
}
