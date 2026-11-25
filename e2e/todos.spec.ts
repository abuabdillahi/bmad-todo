import { expect, test, type BrowserContextOptions, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { announcement, MESSAGES, resetList, todoItem, todoList, uniqueDescription } from './helpers.ts';

/**
 * List reset (AD-20): each test starts from a list emptied through the public
 * API, and still adds a todo with a unique description and asserts only on its
 * own todo.
 */
test.beforeEach(({ request }) => resetList(request));

test.describe('add a todo', () => {
  test('E1 E7 E8 a todo added by keyboard is listed, and is still there after a reload and in a new session', async ({
    page,
    browser,
  }, testInfo) => {
    const description = uniqueDescription('E1', testInfo.project.name);

    await page.goto('/');
    await expect(page).toHaveTitle('BMad Todos');
    await expect(page.getByRole('heading', { level: 1, name: 'BMad Todos' })).toBeVisible();
    const field = page.getByRole('textbox', { name: 'New todo' });
    await expect(page.getByText('0/200')).toBeVisible();
    await expectNoAxeViolations(page, 'loaded');

    // E8: keyboard only. The first tab stop is the add field.
    await page.keyboard.press('Tab');
    await expect(field).toBeFocused();
    await page.keyboard.type(description);
    await expect(page.getByText(`${[...description].length}/200`)).toBeVisible();

    // Hold the create, so the card can only come from the optimistic add.
    let heldCreate: (route: Route) => void = () => {};
    const createHeld = new Promise<Route>((resolve) => (heldCreate = resolve));
    await page.route('**/api/todos', (route) =>
      route.request().method() === 'POST' ? heldCreate(route) : route.continue(),
    );
    await page.keyboard.press('Enter');

    // The card shows on top at once, before the server answers; the field clears and keeps focus.
    const create = await createHeld;
    await expect(todoItem(page, description)).toHaveCount(1);
    await expect(todoList(page).getByRole('listitem').first().getByRole('checkbox')).toHaveAccessibleName(description);
    await expect(field).toHaveValue('');
    await expect(page.getByText('0/200')).toBeVisible();
    await expect(field).toBeFocused();
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveCount(0);

    // Once the server answers, the Announcer says so.
    await create.continue();
    await page.unroute('**/api/todos');
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
    await expect(todoList(page).getByRole('listitem').first().getByRole('checkbox')).toHaveAccessibleName(description);
    await expectNoAxeViolations(page, 'added');

    // The Add button is the next tab stop.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Add' })).toBeFocused();

    await page.reload();
    await expect(todoItem(page, description)).toHaveCount(1);
    await expectNoAxeViolations(page, 'reloaded');

    // A new session: a fresh context shares no storage or cache with this one.
    const use = testInfo.project.use;
    const options: BrowserContextOptions = {
      baseURL: use.baseURL,
      viewport: use.viewport,
      userAgent: use.userAgent,
      deviceScaleFactor: use.deviceScaleFactor,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      colorScheme: use.colorScheme,
      reducedMotion: use.reducedMotion,
    };
    const session = await browser.newContext(options);
    try {
      const other = await session.newPage();
      await other.goto('/');
      await expect(todoItem(other, description)).toHaveCount(1);
      await expectNoAxeViolations(other, 'new session');
    } finally {
      await session.close();
    }
  });
});
