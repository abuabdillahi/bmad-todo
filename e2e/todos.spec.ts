import { expect, test, type BrowserContextOptions, type Page, type Route } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

/**
 * List reset (story 1 Decision 2026-11-24): each test adds a todo with a unique
 * description and asserts only on its own todo. `pnpm test:all` starts
 * todo-test on a fresh volume. Epic 2 adds the AD-20 reset through DELETE.
 */
function uniqueDescription(project: string): string {
  return `E1 ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** `{t}`'s text: cut at 40 code points with "…" inside the quote (EXPERIENCE Voice and Tone). */
function quoteText(description: string): string {
  const points = [...description];
  return points.length <= 40 ? description : `${points.slice(0, 40).join('').trimEnd()}…`;
}

function todoList(page: Page) {
  return page.getByRole('list', { name: 'Todos' });
}

function todoItem(page: Page, description: string) {
  return todoList(page).getByRole('listitem').filter({ hasText: description });
}

test.describe('add a todo', () => {
  test('E1 E7 E8 a todo added by keyboard is listed, and is still there after a reload and in a new session', async ({
    page,
    browser,
  }, testInfo) => {
    const description = uniqueDescription(testInfo.project.name);

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
    await expect(todoList(page).getByRole('listitem').first()).toHaveText(description);
    await expect(field).toHaveValue('');
    await expect(page.getByText('0/200')).toBeVisible();
    await expect(field).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveCount(0);

    // Once the server answers, the Announcer says so.
    await create.continue();
    await page.unroute('**/api/todos');
    await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText(`Added “${quoteText(description)}”.`);
    await expect(todoList(page).getByRole('listitem').first()).toHaveText(description);
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
