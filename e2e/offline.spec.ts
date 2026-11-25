import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { announcement, MESSAGES, resetList, todoItem, uniqueDescription } from './helpers.ts';

/**
 * Offline (E6, AD-20): with the browser offline, a focus refetch and an add
 * each fail at once as `network`, and the list stays.
 */

test.beforeEach(({ request }) => resetList(request));

test('E6 offline, a focus refetch and an add fail at once with the network reason and the text comes back', async ({
  page,
  context,
}, testInfo) => {
  const earlier = uniqueDescription('E6 off ok', testInfo.project.name);
  const failing = uniqueDescription('E6 off fail', testInfo.project.name);

  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await page.keyboard.type(earlier);
  // The settle-time refetch follows the create's answer; let it finish before going offline.
  const refetched = page
    .waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/todos')
    .then(() =>
      page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/todos'),
    );
  await page.keyboard.press('Enter');
  await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(MESSAGES.added(earlier));
  await refetched;

  await context.setOffline(true);
  try {
    // A focus refetch fails at once with the network refresh message.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    await expect(announcement(page, MESSAGES.refresh)).toHaveText(`${MESSAGES.refresh} ${MESSAGES.network}`, {
      timeout: 2000,
    });
    await expect(todoItem(page, earlier)).toHaveCount(1);

    // An add fails within 2 s as `network` and the text comes back.
    await field.focus();
    await page.keyboard.type(failing);
    await page.keyboard.press('Enter');
    await expect(announcement(page, MESSAGES.addOutcome)).toHaveText(
      MESSAGES.addFailed(failing, MESSAGES.network),
      { timeout: 2000 },
    );
    await expect(field).toHaveValue(failing);
    await expect(field).toBeFocused();
    await expect(todoItem(page, failing)).toHaveCount(0);
    await expect(todoItem(page, earlier)).toHaveCount(1);
    await expectNoAxeViolations(page, 'offline');
  } finally {
    await context.setOffline(false);
  }
});
