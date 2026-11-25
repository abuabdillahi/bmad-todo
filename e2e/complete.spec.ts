import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import {
  announcement,
  completionCheck,
  createTodo,
  focusAddField,
  MESSAGES,
  resetList,
  todoItem,
  UNAVAILABLE_BODY,
  uniqueDescription,
} from './helpers.ts';

/**
 * Complete and reopen (E2, E6, E7, E8, story 3), by keyboard: the Completion
 * check toggles at once, a done todo looks done, a failed save reverts and says
 * why, and a todo deleted elsewhere goes. Todos are set up through the API.
 */

test.beforeEach(({ request }) => resetList(request));

/** A PATCH to one todo. */
const isPatch = (route: Route) => route.request().method() === 'PATCH';
const TODO_PATH = '**/api/todos/*';

/** The computed colour of the text that names `check`. */
function textColour(check: Locator): Promise<string> {
  return check.evaluate((el) => getComputedStyle(document.getElementById(el.getAttribute('aria-labelledby')!)!).color);
}

/** The opacities of the card's shadow layer (`::before`) and dashed-outline layer (`::after`): `li` › body › card. */
function cardLayers(check: Locator): Promise<{ shadow: string; dashed: string }> {
  return check.evaluate((el) => {
    const card = el.closest('li')!.firstElementChild!.firstElementChild!;
    return { shadow: getComputedStyle(card, '::before').opacity, dashed: getComputedStyle(card, '::after').opacity };
  });
}

function doneChip(page: Page, description: string): Locator {
  return todoItem(page, description).getByText('Done', { exact: true });
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

/** Opens the app and Tabs from the add field to the todo's check, its only todo: field, Add, check. */
async function tabToOnlyCheck(page: Page, description: string): Promise<Locator> {
  await focusAddField(page);
  const check = completionCheck(page, description);
  await expect(check).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(check).toBeFocused();
  return check;
}

test('E2 E7 E8 Space completes a todo before the save answers, it stays done after a reload, and Space reopens it for good', async ({
  page,
  request,
}, testInfo) => {
  const description = uniqueDescription('E2', testInfo.project.name);
  await createTodo(request, description);

  let check = await tabToOnlyCheck(page, description);
  await expect(check).not.toBeChecked();
  await expect(doneChip(page, description)).toHaveCount(0);
  const activeColour = await textColour(check);
  expect(await cardLayers(check)).toEqual({ shadow: '1', dashed: '0' });

  // Hold the save, so the done state can only come from the optimistic change.
  let hold: (route: Route) => void = () => {};
  const held = new Promise<Route>((resolve) => (hold = resolve));
  await page.route(TODO_PATH, (route) => (isPatch(route) ? hold(route) : route.continue()));
  await page.keyboard.press('Space');

  const patch = await held;
  expect(patch.request().postDataJSON()).toEqual({ completed: true });
  await expect(check).toBeChecked();
  await expect(doneChip(page, description)).toBeVisible();
  await expect.poll(() => textColour(check)).not.toBe(activeColour);
  await expect.poll(() => cardLayers(check)).toEqual({ shadow: '0', dashed: '1' });
  await expect(check).toBeFocused();

  const saved = patchAndRefetch(page);
  await patch.continue();
  expect((await saved).status()).toBe(200);
  await page.unroute(TODO_PATH);
  await expect(check).toBeChecked();
  await expect(check).toBeFocused();
  await expect(announcement(page, /./)).toHaveCount(0);
  await expectNoAxeViolations(page, 'done');

  await page.reload();
  check = completionCheck(page, description);
  await expect(check).toBeChecked();
  await expect(doneChip(page, description)).toBeVisible();

  // Reopen, by keyboard again.
  check = await tabToOnlyCheck(page, description);
  const reopened = patchAndRefetch(page);
  await page.keyboard.press('Space');
  await expect(check).not.toBeChecked();
  await expect(doneChip(page, description)).toHaveCount(0);
  await expect.poll(() => textColour(check)).toBe(activeColour);
  await expect.poll(() => cardLayers(check)).toEqual({ shadow: '1', dashed: '0' });
  const reopen = await reopened;
  expect(reopen.request().postDataJSON()).toEqual({ completed: false });
  expect(reopen.status()).toBe(200);
  await expect(check).toBeFocused();
  await expect(announcement(page, /./)).toHaveCount(0);
  await expectNoAxeViolations(page, 'reopened');

  await page.reload();
  await expect(completionCheck(page, description)).not.toBeChecked();
  await expect(doneChip(page, description)).toHaveCount(0);
});

test('E2 E7 a click or tap on the check completes a todo, and it is still done after a reload', async ({ page, request }, testInfo) => {
  const description = uniqueDescription('E2 tap', testInfo.project.name);
  await createTodo(request, description);
  await page.goto('/');
  const check = completionCheck(page, description);
  await expect(check).not.toBeChecked();

  const saved = patchAndRefetch(page);
  if (testInfo.project.use.hasTouch) await check.tap();
  else await check.click();

  await expect(check).toBeChecked();
  await expect(doneChip(page, description)).toBeVisible();
  expect((await saved).status()).toBe(200);
  await expectNoAxeViolations(page, 'done by pointer');

  await page.reload();
  await expect(completionCheck(page, description)).toBeChecked();
  await expect(doneChip(page, description)).toBeVisible();
});

for (const action of [
  { name: 'complete', done: false, message: MESSAGES.completeFailed },
  { name: 'reopen', done: true, message: MESSAGES.reopenFailed },
]) {
  for (const failure of [
    {
      name: 'a 503 from the API',
      reason: MESSAGES.unavailable,
      answer: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
    },
    { name: 'no response', reason: MESSAGES.network, answer: (route: Route) => route.abort() },
  ]) {
    test(`E6 E8 a ${action.name} failing with ${failure.name} reverts, says why, keeps focus, and the next toggle works`, async ({
      page,
      request,
    }, testInfo) => {
      const description = uniqueDescription(`E6 ${action.name}`, testInfo.project.name);
      await createTodo(request, description, action.done);

      const check = await tabToOnlyCheck(page, description);
      await expect(check).toBeChecked({ checked: action.done });
      await page.route(TODO_PATH, (route) => (isPatch(route) ? failure.answer(route) : route.continue()));
      await page.keyboard.press('Space');

      await expect(announcement(page, failure.reason)).toHaveText(action.message(description, failure.reason));
      await expect(check).toBeChecked({ checked: action.done });
      await expect(doneChip(page, description)).toHaveCount(action.done ? 1 : 0);
      await expect(check).toBeFocused();
      await expectNoAxeViolations(page, `${action.name} failed`);

      // The next toggle goes through.
      await page.unroute(TODO_PATH);
      const saved = patchAndRefetch(page);
      await page.keyboard.press('Space');
      await expect(check).toBeChecked({ checked: !action.done });
      expect((await saved).status()).toBe(200);
      await page.reload();
      await expect(completionCheck(page, description)).toBeChecked({ checked: !action.done });
    });
  }
}

test('E6 E8 Space on a todo deleted elsewhere says so, moves focus to the other todo, and the row goes', async ({
  page,
  request,
}, testInfo) => {
  const stays = uniqueDescription('E6 stays', testInfo.project.name);
  const goes = uniqueDescription('E6 goes', testInfo.project.name);
  await createTodo(request, stays);
  const gone = await createTodo(request, goes);

  await focusAddField(page);
  const check = completionCheck(page, goes);
  await expect(check).toBeVisible();
  await expect(completionCheck(page, stays)).toBeVisible();
  // Tab to its check, wherever the server ordered it.
  for (let presses = 0; presses < 4 && !(await check.evaluate((el) => el === document.activeElement)); presses += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(check).toBeFocused();

  const deleted = await request.delete(`/api/todos/${gone.id}`);
  expect(deleted.status()).toBe(204);
  await page.keyboard.press('Space');

  await expect(announcement(page, MESSAGES.deletedElsewhere(goes))).toHaveText(MESSAGES.deletedElsewhere(goes));
  await expect(completionCheck(page, stays)).toBeFocused();
  await expect(todoItem(page, goes)).toHaveCount(0);
  await expect(completionCheck(page, stays)).toBeFocused();
  await expectNoAxeViolations(page, 'deleted elsewhere');
});
