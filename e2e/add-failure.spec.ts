import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

/**
 * A failed add (E6, E8, story 6), by keyboard: the card shows at once and
 * goes, the Announcer says why, the text is back in the field, and earlier
 * todos stay. Each test adds unique todos and asserts only on its own.
 */
const UNAVAILABLE = "The server isn't available right now. Try again in a moment.";
const NETWORK = 'Check your connection and try again.';

/** AD-4's literal body, as nginx answers when the API can't be reached. */
const UNAVAILABLE_BODY =
  '{"type":"/problems/unavailable","title":"Service unavailable","status":503,"detail":"The service is unavailable. Try again shortly."}';

function uniqueDescription(project: string, label: string): string {
  return `E6 ${label} ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function todoItem(page: Page, description: string) {
  return page.getByRole('list', { name: 'Todos' }).getByRole('listitem').filter({ hasText: description });
}

function announcement(page: Page) {
  return page.getByRole('status').filter({ hasText: /^(Added|Couldn't add)/ });
}

/** Opens the app, adds a todo by keyboard and waits for the server's confirmation. */
async function openWithTodo(page: Page, description: string) {
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await page.keyboard.type(description);
  await page.keyboard.press('Enter');
  await expect(announcement(page)).toHaveText(`Added “${description}”.`);
  await expect(todoItem(page, description)).toHaveCount(1);
  return field;
}

/** Holds the next create until the test answers it. */
async function holdCreate(page: Page): Promise<{ held: Promise<Route> }> {
  let hold: (route: Route) => void = () => {};
  const held = new Promise<Route>((resolve) => (hold = resolve));
  await page.route('**/api/todos', (route) => (route.request().method() === 'POST' ? hold(route) : route.continue()));
  return { held };
}

for (const { name, reason, answer } of [
  {
    name: 'a 503 from the API',
    reason: UNAVAILABLE,
    answer: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
  },
  { name: 'no response', reason: NETWORK, answer: (route: Route) => route.abort() },
]) {
  test(`E6 E8 an add failing with ${name} shows the card, then removes it, says why and puts the text back`, async ({
    page,
  }, testInfo) => {
    const earlier = uniqueDescription(testInfo.project.name, 'earlier');
    const failing = uniqueDescription(testInfo.project.name, 'failing');
    const later = uniqueDescription(testInfo.project.name, 'later');
    const field = await openWithTodo(page, earlier);

    const { held } = await holdCreate(page);
    await page.keyboard.type(failing);
    await page.keyboard.press('Enter');

    // The card appears at once, while the create is held.
    const create = await held;
    await expect(todoItem(page, failing)).toHaveCount(1);
    await expect(field).toHaveValue('');
    await answer(create);

    // It goes, the banner says why, and the text is back in the field with focus there.
    await expect(announcement(page)).toHaveText(`Couldn't add “${failing}”. ${reason}`);
    await expect(todoItem(page, failing)).toHaveCount(0);
    await expect(field).toHaveValue(failing);
    await expect(field).toBeFocused();
    await expect(todoItem(page, earlier)).toHaveCount(1);
    await expectNoAxeViolations(page, 'add failed');

    // A later valid add still works.
    await page.unroute('**/api/todos');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(later);
    await page.keyboard.press('Enter');
    await expect(announcement(page)).toHaveText(`Added “${later}”.`);
    await expect(todoItem(page, later)).toHaveCount(1);
    await expect(todoItem(page, failing)).toHaveCount(0);
    await expect(todoItem(page, earlier)).toHaveCount(1);
  });
}
