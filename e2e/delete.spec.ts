import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import {
  announcement,
  completionCheck,
  createTodo,
  deleteButton,
  deleteConfirm,
  focusAddField,
  MESSAGES,
  resetList,
  todoItem,
  todoList,
  UNAVAILABLE_BODY,
  uniqueDescription,
} from './helpers.ts';

/**
 * Delete with an inline confirm (E3, E6, E7, E8, story 5): Delete opens "Delete
 * this todo?" and sends nothing, Cancel or Escape closes it, Confirm delete
 * removes the todo at once and for good, and a failed delete puts it back and
 * says why. Todos are set up through the API.
 */

test.beforeEach(({ request }) => resetList(request));

const isDelete = (route: Route) => route.request().method() === 'DELETE';
const TODO_PATH = '**/api/todos/*';

/** Counts the DELETE requests the page sends. */
function countDeletes(page: Page): { readonly count: number } {
  const counter = { count: 0 };
  page.on('request', (request) => {
    if (request.method() === 'DELETE') counter.count += 1;
  });
  return counter;
}

/** The Delete confirm's Confirm delete button. */
function confirmButton(page: Page, description: string): Locator {
  return deleteConfirm(page, description).getByRole('button', { name: `Delete “${description}”`, exact: true });
}

/** The Delete confirm's Cancel button. */
function cancelButton(page: Page, description: string): Locator {
  return deleteConfirm(page, description).getByRole('button', { name: 'Cancel', exact: true });
}

/** Waits until no Leaving row is rendered, so a scan never sees one mid-exit. */
async function noLeavingRows(page: Page): Promise<void> {
  await expect(todoList(page).locator('li[data-leaving]')).toHaveCount(0);
}

test('E3 E7 E8 by keyboard, Delete asks first and sends nothing, Cancel and Escape keep the todo, and Confirm delete removes it for good', async ({
  page,
  request,
}, testInfo) => {
  const stays = uniqueDescription('E3 stays', testInfo.project.name);
  const goes = uniqueDescription('E3 goes', testInfo.project.name);
  await createTodo(request, stays);
  await createTodo(request, goes);
  const deletes = countDeletes(page);

  await focusAddField(page);
  const del = deleteButton(page, goes);
  await expect(del).toBeVisible();
  await expect(completionCheck(page, stays)).toBeVisible();
  // Tab to its Delete, wherever the server ordered it: field, Add, then check, Edit, Delete per todo.
  for (let presses = 0; presses < 7 && !(await del.evaluate((el) => el === document.activeElement)); presses += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(del).toBeFocused();

  // Delete opens the confirm in place and sends nothing.
  await page.keyboard.press('Enter');
  const confirm = deleteConfirm(page, goes);
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText('Delete this todo?', { exact: true })).toBeVisible();
  await expect(cancelButton(page, goes)).toBeFocused();
  await expectNoAxeViolations(page, 'delete confirm');

  // Cancel closes it.
  await page.keyboard.press('Enter');
  await expect(confirm).toHaveCount(0);
  await expect(del).toBeFocused();

  // Escape closes it too, and the todo stays.
  await page.keyboard.press('Enter');
  await expect(cancelButton(page, goes)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(del).toBeFocused();
  await expect(todoItem(page, goes)).toHaveCount(1);
  expect(deletes.count).toBe(0);

  // Confirm delete removes the row at once, and focus goes to the other todo's check.
  await page.keyboard.press('Enter');
  await expect(cancelButton(page, goes)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirmButton(page, goes)).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(todoItem(page, goes)).toHaveCount(0);
  await expect(completionCheck(page, stays)).toBeFocused();
  await expect(announcement(page, MESSAGES.deleted(goes))).toHaveText(MESSAGES.deleted(goes));
  expect(deletes.count).toBe(1);
  await noLeavingRows(page);
  await expectNoAxeViolations(page, 'deleted');

  await page.reload();
  await expect(completionCheck(page, stays)).toBeVisible();
  await expect(todoItem(page, goes)).toHaveCount(0);
});

test('E3 E7 a click or tap on Delete, then on Confirm delete, removes the todo for good', async ({ page, request }, testInfo) => {
  const description = uniqueDescription('E3 tap', testInfo.project.name);
  await createTodo(request, description);
  await page.goto('/');
  const touch = testInfo.project.use.hasTouch === true;

  const del = deleteButton(page, description);
  if (touch) await del.tap();
  else await del.click();
  await expect(deleteConfirm(page, description)).toBeVisible();

  const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE');
  if (touch) await confirmButton(page, description).tap();
  else await confirmButton(page, description).click();

  await expect(todoItem(page, description)).toHaveCount(0);
  expect((await deleted).status()).toBe(204);
  await expect(announcement(page, MESSAGES.deleted(description))).toHaveText(MESSAGES.deleted(description));
  await noLeavingRows(page);
  await expectNoAxeViolations(page, 'deleted by pointer');

  await page.reload();
  await expect(page.getByText('0/200')).toBeVisible();
  await expect(todoItem(page, description)).toHaveCount(0);
});

for (const failure of [
  {
    name: 'a 503 from the API',
    reason: MESSAGES.unavailable,
    answer: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
  },
  { name: 'no response', reason: MESSAGES.network, answer: (route: Route) => route.abort() },
]) {
  test(`E6 E8 by keyboard, a delete failing with ${failure.name} puts the todo back flagged, says why, leaves focus, and it is still listed after a reload`, async ({
    page,
    request,
  }, testInfo) => {
    const description = uniqueDescription('E6 delete', testInfo.project.name);
    await createTodo(request, description);

    // Keyboard only: field, Add, check, Edit, Delete.
    const field = await focusAddField(page);
    const del = deleteButton(page, description);
    await expect(del).toBeVisible();
    for (let presses = 0; presses < 5 && !(await del.evaluate((el) => el === document.activeElement)); presses += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(del).toBeFocused();
    await page.route(TODO_PATH, (route) => (isDelete(route) ? failure.answer(route) : route.continue()));

    await page.keyboard.press('Enter');
    await expect(cancelButton(page, description)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirmButton(page, description)).toBeFocused();
    await page.keyboard.press('Enter');

    // The only row, by keyboard: focus goes to the add field, and the revert doesn't move it.
    await expect(field).toBeFocused();
    await expect(announcement(page, failure.reason)).toHaveText(MESSAGES.deleteFailed(description, failure.reason));
    const check = completionCheck(page, description);
    await expect(check).toBeVisible();
    // The restored card is flagged: `li` › body › card.
    await expect(todoItem(page, description).locator(':scope > div > div')).toHaveClass(/_flagged_/);
    await expect(deleteButton(page, description)).toBeVisible();
    await expect(field).toBeFocused();
    await noLeavingRows(page);
    await expectNoAxeViolations(page, 'delete failed');

    await page.unroute(TODO_PATH);
    await page.reload();
    await expect(completionCheck(page, description)).toBeVisible();
  });
}
