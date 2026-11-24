import { expect, test, type BrowserContextOptions, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

/**
 * List reset (story 1 Decision 2026-11-24): each test adds a todo with a unique
 * description and asserts only on its own todo. `pnpm test:all` starts
 * todo-test on a fresh volume. Epic 2 adds the AD-20 reset through DELETE.
 */
function uniqueDescription(project: string): string {
  return `E1 ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    await page.keyboard.press('Enter');

    // The card shows on top once the server has answered; the field clears and keeps focus.
    await expect(todoItem(page, description)).toHaveCount(1);
    await expect(todoList(page).getByRole('listitem').first()).toHaveText(description);
    await expect(field).toHaveValue('');
    await expect(page.getByText('0/200')).toBeVisible();
    await expect(field).toBeFocused();
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
