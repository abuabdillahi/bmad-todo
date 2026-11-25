import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import {
  announcement,
  completionCheck,
  createTodo,
  editButton,
  editField,
  focusAddField,
  MESSAGES,
  resetList,
  todoItem,
  todoList,
  UNAVAILABLE_BODY,
  uniqueDescription,
  visibleText,
} from './helpers.ts';

/**
 * Edit in place (E4, E6, E7, E8, story 4): Edit swaps the row to the Edit form,
 * Save or Enter shows the new text at once and it persists, Cancel or Escape
 * changes nothing, an empty Save is refused inline, a failed save reverts and
 * keeps its draft, and a todo deleted elsewhere while editing goes. Todos are
 * set up through the API.
 */

test.beforeEach(({ request }) => resetList(request));

/** A PATCH to one todo. */
const isPatch = (route: Route) => route.request().method() === 'PATCH';
const TODO_PATH = '**/api/todos/*';

/** Records the body of every PATCH the page sends. */
function recordPatches(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH') bodies.push(request.postDataJSON());
  });
  return bodies;
}

/** Waits for the next answered PATCH, then for the settle-time refetch that follows it. */
function patchAndRefetch(page: Page) {
  return page
    .waitForResponse((response) => response.request().method() === 'PATCH')
    .then((patch) =>
      page
        .waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/todos')
        .then(() => patch),
    );
}

/** Opens the app and Tabs from the add field to the only todo's Edit button: field, Add, check, Edit. */
async function tabToOnlyEdit(page: Page, description: string): Promise<Locator> {
  await focusAddField(page);
  const check = completionCheck(page, description);
  await expect(check).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(check).toBeFocused();
  await page.keyboard.press('Tab');
  const edit = editButton(page, description);
  await expect(edit).toBeFocused();
  return edit;
}

/** The field's selection, as [start, end]. */
function selection(field: Locator): Promise<[number, number]> {
  return field.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd] as [number, number]);
}

/** A focus refetch: TanStack refetches the list when the tab becomes visible again. */
async function regainFocus(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
}

test('E4 E7 E8 an edit by keyboard shows the new text before the save answers, persists after a reload, and Escape changes nothing', async ({
  page,
  request,
}, testInfo) => {
  const description = uniqueDescription('E4', testInfo.project.name);
  const edited = `${description} edited`;
  await createTodo(request, description);
  const patches = recordPatches(page);

  await tabToOnlyEdit(page, description);
  await page.keyboard.press('Enter');
  const field = editField(page);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(description);
  expect(await selection(field)).toEqual([0, description.length]);
  await expect(completionCheck(page, description)).toBeVisible();
  await expectNoAxeViolations(page, 'edit mode');

  // Hold the save, so the new text can only come from the optimistic change.
  let hold: (route: Route) => void = () => {};
  const held = new Promise<Route>((resolve) => (hold = resolve));
  await page.route(TODO_PATH, (route) => (isPatch(route) ? hold(route) : route.continue()));
  await page.keyboard.type(edited);
  await page.keyboard.press('Enter');

  const patch = await held;
  expect(patch.request().postDataJSON()).toEqual({ description: edited });
  await expect(editField(page)).toHaveCount(0);
  await expect(completionCheck(page, edited)).toBeVisible();
  await expect(editButton(page, edited)).toBeFocused();

  const saved = patchAndRefetch(page);
  await patch.continue();
  expect((await saved).status()).toBe(200);
  await page.unroute(TODO_PATH);
  await expect(completionCheck(page, edited)).toBeVisible();
  await expect(editButton(page, edited)).toBeFocused();
  await expect(announcement(page, /./)).toHaveCount(0);
  await expectNoAxeViolations(page, 'edit saved');

  await page.reload();
  await expect(completionCheck(page, edited)).toBeVisible();

  // Edit, then Escape: the saved text stays, focus is back on Edit, and nothing is sent.
  const edit = await tabToOnlyEdit(page, edited);
  await page.keyboard.press('Enter');
  await expect(editField(page)).toBeFocused();
  await page.keyboard.type('Discarded');
  await page.keyboard.press('Escape');
  await expect(editField(page)).toHaveCount(0);
  await expect(completionCheck(page, edited)).toBeVisible();
  await expect(edit).toBeFocused();
  expect(patches).toEqual([{ description: edited }]);
});

test('E4 E7 a click or tap on Edit, then on Save, changes the text, and it is still changed after a reload', async ({ page, request }, testInfo) => {
  const description = uniqueDescription('E4 tap', testInfo.project.name);
  const edited = `${description} edited`;
  await createTodo(request, description);
  await page.goto('/');
  const touch = testInfo.project.use.hasTouch === true;

  const edit = editButton(page, description);
  await expect(edit).toBeVisible();
  if (touch) await edit.tap();
  else await edit.click();
  const field = editField(page);
  await expect(field).toBeFocused();
  await field.fill(edited);

  const saved = patchAndRefetch(page);
  const save = todoList(page).getByRole('button', { name: 'Save', exact: true });
  if (touch) await save.tap();
  else await save.click();

  await expect(completionCheck(page, edited)).toBeVisible();
  const patch = await saved;
  expect(patch.request().postDataJSON()).toEqual({ description: edited });
  expect(patch.status()).toBe(200);
  await expectNoAxeViolations(page, 'edited by pointer');

  await page.reload();
  await expect(completionCheck(page, edited)).toBeVisible();
});

test('E6 E8 an empty Save says "Enter a description.", keeps focus in the field and sends nothing', async ({ page, request }, testInfo) => {
  const description = uniqueDescription('E6 empty', testInfo.project.name);
  await createTodo(request, description);
  const patches = recordPatches(page);

  await tabToOnlyEdit(page, description);
  await page.keyboard.press('Enter');
  const field = editField(page);
  await expect(field).toBeFocused();
  // All text is selected: one Backspace empties the field.
  await page.keyboard.press('Backspace');
  await expect(field).toHaveValue('');
  await page.keyboard.press('Enter');

  await expect(visibleText(page, MESSAGES.empty)).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toBeFocused();
  await expect(announcement(page, /./)).toHaveCount(0);
  await expectNoAxeViolations(page, 'edit empty');
  expect(patches).toEqual([]);
});

for (const failure of [
  {
    name: 'a 503 from the API',
    reason: MESSAGES.unavailable,
    answer: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
  },
  { name: 'no response', reason: MESSAGES.network, answer: (route: Route) => route.abort() },
]) {
  test(`E6 E8 an edit failing with ${failure.name} reverts, says why, keeps focus, and the next Edit opens with the failed draft`, async ({
    page,
    request,
  }, testInfo) => {
    const description = uniqueDescription('E6 edit', testInfo.project.name);
    const edited = `${description} draft`;
    await createTodo(request, description);

    await tabToOnlyEdit(page, description);
    await page.route(TODO_PATH, (route) => (isPatch(route) ? failure.answer(route) : route.continue()));
    await page.keyboard.press('Enter');
    await expect(editField(page)).toBeFocused();
    await page.keyboard.type(edited);
    await page.keyboard.press('Enter');

    await expect(announcement(page, failure.reason)).toHaveText(MESSAGES.editFailed(description, failure.reason));
    await expect(completionCheck(page, description)).toBeVisible();
    await expect(todoItem(page, edited)).toHaveCount(0);
    await expect(editButton(page, description)).toBeFocused();
    await expectNoAxeViolations(page, 'edit failed');

    // The next Edit opens with the failed draft, and Enter saves it once the API answers again.
    await page.keyboard.press('Enter');
    await expect(editField(page)).toBeFocused();
    await expect(editField(page)).toHaveValue(edited);
    await page.unroute(TODO_PATH);
    const saved = patchAndRefetch(page);
    await page.keyboard.press('Enter');
    expect((await saved).status()).toBe(200);
    await expect(completionCheck(page, edited)).toBeVisible();
    await expect(editButton(page, edited)).toBeFocused();

    await page.reload();
    await expect(completionCheck(page, edited)).toBeVisible();
  });
}

test('E6 E8 a todo deleted elsewhere while its edit is open says so, and only that row goes', async ({ page, request }, testInfo) => {
  const stays = uniqueDescription('E6 stays', testInfo.project.name);
  const goes = uniqueDescription('E6 goes', testInfo.project.name);
  await createTodo(request, stays);
  const gone = await createTodo(request, goes);

  await focusAddField(page);
  await expect(completionCheck(page, stays)).toBeVisible();
  const edit = editButton(page, goes);
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(editField(page)).toBeFocused();
  await page.keyboard.type(' unsaved');

  const deleted = await request.delete(`/api/todos/${gone.id}`);
  expect(deleted.status()).toBe(204);
  await regainFocus(page);

  await expect(announcement(page, MESSAGES.deletedElsewhere(goes))).toHaveText(MESSAGES.deletedElsewhere(goes));
  await expect(todoItem(page, goes)).toHaveCount(0);
  // In edit mode the row's text is in the field, not its text content: the check, named by aria-label, must go too.
  await expect(completionCheck(page, goes)).toHaveCount(0);
  await expect(editField(page)).toHaveCount(0);
  await expect(completionCheck(page, stays)).toBeVisible();
  await expect(completionCheck(page, stays)).toBeFocused();
  await expectNoAxeViolations(page, 'deleted elsewhere while editing');
});
