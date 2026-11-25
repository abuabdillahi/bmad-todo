import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { announcement, MESSAGES, todoItem, UNAVAILABLE_BODY, uniqueDescription } from './helpers.ts';

/**
 * A failed background refresh (E6, E8, story 5): the list stays, the Announcer
 * reports it with its reason, and Dismiss clears it. Each test adds a unique
 * todo and asserts only on its own todo.
 */
/** Opens the app and adds a todo by keyboard, leaving focus in the add field. */
async function addTodo(page: Page, description: string) {
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await page.keyboard.type(description);
  // The settle-time refetch follows the create's answer; wait for it, so a later route doesn't catch it.
  const refetched = page
    .waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/todos')
    .then(() =>
      page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/todos'),
    );
  await page.keyboard.press('Enter');
  await expect(todoItem(page, description)).toHaveCount(1);
  await expect(field).toHaveValue('');
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(description));
  await refetched;
  return field;
}

/** The tab regaining focus: TanStack Query refetches on `visibilitychange` while the page is visible. */
async function regainFocus(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
}

test.describe('refresh failure', () => {
  test('E6 E8 a failed refresh keeps the todo, reports the unavailable reason, and Dismiss by keyboard returns focus to the add field', async ({
    page,
  }, testInfo) => {
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await addTodo(page, description);

    await page.route('**/api/todos', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: UNAVAILABLE_BODY })
        : route.continue(),
    );
    await regainFocus(page);

    await expect(announcement(page, MESSAGES.refresh)).toHaveText(`${MESSAGES.refresh} ${MESSAGES.unavailable}`);
    await expect(todoItem(page, description)).toHaveCount(1);
    await expectNoAxeViolations(page, 'refresh failed');

    // Dismiss is the first tab stop on the page: the one before the add field, with nothing before it.
    await expect(field).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const dismiss = page.getByRole('button', { name: 'Dismiss' });
    await expect(dismiss).toBeFocused();
    expect(
      await page.evaluate(() => {
        const tabbable = [...document.querySelectorAll<HTMLElement>('button, textarea, input, a[href], [tabindex]')].filter(
          (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'),
        );
        return tabbable[0] === document.activeElement;
      }),
    ).toBe(true);
    await page.keyboard.press('Enter');

    await expect(dismiss).toHaveCount(0);
    await expect(announcement(page, MESSAGES.refresh)).toHaveCount(0);
    await expect(field).toBeFocused();
    await expect(todoItem(page, description)).toHaveCount(1);
  });

  test('E6 E8 a refresh with no response reports the network reason, and Dismiss by pointer clears it', async ({
    page,
  }, testInfo) => {
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await addTodo(page, description);

    await page.route('**/api/todos', (route) =>
      route.request().method() === 'GET' ? route.abort() : route.continue(),
    );
    await regainFocus(page);

    await expect(announcement(page, MESSAGES.refresh)).toHaveText(`${MESSAGES.refresh} ${MESSAGES.network}`);
    await expect(todoItem(page, description)).toHaveCount(1);
    await expectNoAxeViolations(page, 'refresh failed offline');

    const dismiss = page.getByRole('button', { name: 'Dismiss' });
    if (testInfo.project.use.hasTouch) {
      // A touch activation focuses the heading, so the phone keyboard stays closed.
      await dismiss.tap();
      await expect(page.getByRole('heading', { level: 1, name: 'BMad Todos' })).toBeFocused();
    } else {
      await dismiss.click();
      await expect(field).toBeFocused();
    }
    await expect(dismiss).toHaveCount(0);
    await expect(announcement(page, MESSAGES.refresh)).toHaveCount(0);
  });
});
