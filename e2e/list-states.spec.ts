import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import {
  announcement,
  createTodo,
  emptyPanel,
  focusAddField,
  listErrorPanel,
  loadingStatus,
  MESSAGES,
  resetList,
  skeletonList,
  todoItem,
  tryAgain,
  UNAVAILABLE_BODY,
  uniqueDescription,
} from './helpers.ts';

/**
 * The list states (E5, E6's list error-state part, E8), by keyboard: the Empty
 * panel and an add replacing it; a failed first load showing the List error
 * panel, with the list still usable, and Try again recovering it. Each test
 * adds unique todos and asserts only on its own.
 */

test.beforeEach(({ request }) => resetList(request));

/** Presses Tab until `target` holds focus, as a keyboard user reaches it. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 20; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test('E5 E8 with no todos the Empty panel shows, and adding one by keyboard replaces it with the list', async ({ page }, testInfo) => {
  const description = uniqueDescription('E5 first', testInfo.project.name);
  await focusAddField(page);

  await expect(emptyPanel(page)).toBeVisible();
  await expectNoAxeViolations(page, 'empty');

  await page.keyboard.type(description);
  await page.keyboard.press('Enter');

  await expect(todoItem(page, description)).toHaveCount(1);
  await expect(emptyPanel(page)).toHaveCount(0);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
  await expectNoAxeViolations(page, 'list after the first add');
});

for (const { name, reason, fail } of [
  {
    name: 'a 503 from the API',
    reason: MESSAGES.unavailable,
    fail: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
  },
  { name: 'no response', reason: MESSAGES.network, fail: (route: Route) => route.abort() },
]) {
  test(`E6 E8 a first load failing with ${name} shows the List error panel, the list stays usable, and Try again recovers it`, async ({
    page,
    request,
  }, testInfo) => {
    const earlier = uniqueDescription('E6 earlier', testInfo.project.name);
    const added = uniqueDescription('E6 added in error', testInfo.project.name);
    await createTodo(request, earlier);

    // Every list fetch fails, counted once answered; creates go through.
    let failedLists = 0;
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await fail(route);
      failedLists += 1;
    });
    const field = await focusAddField(page);

    await expect(tryAgain(page)).toBeVisible();
    await expect(listErrorPanel(page)).toContainText(MESSAGES.loadFailed(reason));
    await expect(loadingStatus(page)).toHaveText(MESSAGES.loadFailed(reason));
    await expect(todoItem(page, earlier)).toHaveCount(0);
    await expect(field).toBeFocused();
    await expectNoAxeViolations(page, 'list error');

    // The add form still works: the card shows above the panel, which stays.
    const listsBeforeAdd = failedLists;
    await page.keyboard.type(added);
    await page.keyboard.press('Enter');
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(added));
    await expect(todoItem(page, added)).toHaveCount(1);
    await expect(tryAgain(page)).toBeVisible();
    const cardBox = (await todoItem(page, added).boundingBox())!;
    const panelBox = (await listErrorPanel(page).boundingBox())!;
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(panelBox.y);

    // The add's settle-time refetch has failed too, so the list is still in error.
    await expect.poll(() => failedLists).toBeGreaterThan(listsBeforeAdd);
    await expect(tryAgain(page)).toBeVisible();

    // The API is back, but the next list fetch is held until the test lets it through.
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') await released;
      await route.continue();
    });

    await tabTo(page, tryAgain(page));
    await page.keyboard.press('Enter');

    await expect(field).toBeFocused();
    await expect(skeletonList(page)).toBeVisible();
    await expect(tryAgain(page)).toHaveCount(0);
    await expect(loadingStatus(page)).toHaveText(MESSAGES.loading);
    await expectNoAxeViolations(page, 'loading after Try again');

    release();
    await expect(todoItem(page, earlier)).toHaveCount(1);
    await expect(todoItem(page, added)).toHaveCount(1);
    await expect(skeletonList(page)).toHaveCount(0);
    await expect(loadingStatus(page)).toHaveText(MESSAGES.loaded);
    await expectNoAxeViolations(page, 'list after Try again');
  });
}
