import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { announcement, focusAddField, MESSAGES, resetList, todoItem, UNAVAILABLE_BODY, uniqueDescription } from './helpers.ts';

/**
 * A failed add (E6, E8, story 6), by keyboard: the card shows at once and
 * goes, the Announcer says why, the text is back in the field, and earlier
 * todos stay. Each test adds unique todos and asserts only on its own.
 */

test.beforeEach(({ request }) => resetList(request));

/** Opens the app, adds a todo by keyboard and waits for the server's confirmation. */
async function openWithTodo(page: Page, description: string) {
  const field = await focusAddField(page);
  await page.keyboard.type(description);
  await page.keyboard.press('Enter');
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
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
    reason: MESSAGES.unavailable,
    answer: (route: Route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY }),
  },
  { name: 'no response', reason: MESSAGES.network, answer: (route: Route) => route.abort() },
]) {
  test(`E6 E8 an add failing with ${name} shows the card, then removes it, says why and puts the text back`, async ({
    page,
  }, testInfo) => {
    const earlier = uniqueDescription('E6 earlier', testInfo.project.name);
    const failing = uniqueDescription('E6 failing', testInfo.project.name);
    const later = uniqueDescription('E6 later', testInfo.project.name);
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
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.addFailed(failing, reason));
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
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(later));
    await expect(todoItem(page, later)).toHaveCount(1);
    await expect(todoItem(page, failing)).toHaveCount(0);
    await expect(todoItem(page, earlier)).toHaveCount(1);
  });
}

/**
 * Lets the next create reach the API and be stored, then hands it to `lose`
 * instead of answering it (aborted: a lost response; left unanswered: a stall).
 * The list refresh that follows is aborted once, so the restored text stays
 * rather than being cleared as landed after all. Everything else passes through.
 */
async function loseCreate(page: Page, lose: (route: Route) => Promise<void>) {
  const bodies: unknown[] = [];
  let stored: (status: number) => void = () => {};
  let refreshAborted: () => void = () => {};
  const state = {
    bodies,
    /** The API's status for the first create, which the page never sees. */
    stored: new Promise<number>((resolve) => (stored = resolve)),
    refreshAborted: new Promise<void>((resolve) => (refreshAborted = resolve)),
  };
  let abortNextList = false;
  await page.route('**/api/todos', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      bodies.push(request.postDataJSON());
      if (bodies.length > 1) return route.continue();
      const response = await route.fetch();
      abortNextList = true;
      stored(response.status());
      return lose(route);
    }
    if (!abortNextList) return route.continue();
    abortNextList = false;
    await route.abort();
    refreshAborted();
  });
  return state;
}

/** Presses Enter on the restored text and returns the resubmitted create's response. */
async function resubmit(page: Page) {
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/todos',
  );
  await page.keyboard.press('Enter');
  return response;
}

test('E6 E8 an add whose response was lost, resubmitted unchanged, sends the same id, is replayed and listed once', async ({
  page,
}, testInfo) => {
  const description = uniqueDescription('E6 lost', testInfo.project.name);
  const field = await focusAddField(page);
  const lost = await loseCreate(page, (route) => route.abort());

  await page.keyboard.type(description);
  await page.keyboard.press('Enter');
  expect(await lost.stored).toBe(201);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.addFailed(description, MESSAGES.network));
  await lost.refreshAborted;
  await expect(todoItem(page, description)).toHaveCount(0);
  await expect(field).toHaveValue(description);
  await expect(field).toBeFocused();
  await expectNoAxeViolations(page, 'response lost, text restored');

  const response = await resubmit(page);
  expect(response.status()).toBe(200);
  expect(lost.bodies).toHaveLength(2);
  expect(lost.bodies[1]).toEqual(lost.bodies[0]);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
  await expect(todoItem(page, description)).toHaveCount(1);
  await expect(field).toHaveValue('');
  await expectNoAxeViolations(page, 'lost add resubmitted');

  await page.reload();
  await expect(todoItem(page, description)).toHaveCount(1);
});

test('E6 E8 a stalled add gives up after 15 s with the network reason, and its unchanged resubmit is listed once', async ({
  page,
}, testInfo) => {
  const description = uniqueDescription('E6 stalled', testInfo.project.name);
  // Only browser time is moved; the stall itself is a create left unanswered.
  await page.clock.install();
  const field = await focusAddField(page);
  const stalled = await loseCreate(page, async () => {});

  await page.keyboard.type(description);
  await page.keyboard.press('Enter');
  expect(await stalled.stored).toBe(201);
  await expect(todoItem(page, description)).toHaveCount(1);
  await expect(field).toHaveValue('');

  // Just short of the deadline the card is still there and nothing is announced.
  await page.clock.fastForward(14_000);
  await expect(todoItem(page, description)).toHaveCount(1);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveCount(0);
  await page.clock.fastForward(1_000);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.addFailed(description, MESSAGES.network));
  await stalled.refreshAborted;
  await expect(todoItem(page, description)).toHaveCount(0);
  await expect(field).toHaveValue(description);
  await expect(field).toBeFocused();
  await expectNoAxeViolations(page, 'stalled add gave up');

  const response = await resubmit(page);
  expect(response.status()).toBe(200);
  expect(stalled.bodies).toHaveLength(2);
  expect(stalled.bodies[1]).toEqual(stalled.bodies[0]);
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
  await expect(todoItem(page, description)).toHaveCount(1);
  await expectNoAxeViolations(page, 'stalled add resubmitted');

  await page.reload();
  await expect(todoItem(page, description)).toHaveCount(1);
});
