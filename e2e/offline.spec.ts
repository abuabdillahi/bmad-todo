import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

/**
 * Offline (E6, AD-20): with the browser offline, a focus refetch and an add
 * each fail at once as `network`, and the list stays.
 */
const NETWORK = 'Check your connection and try again.';
const REFRESH = "Couldn't refresh the list. You're seeing what was last loaded.";

test('E6 offline, a focus refetch and an add fail at once with the network reason and the text comes back', async ({
  page,
  context,
}, testInfo) => {
  const earlier = `E6 off ok ${testInfo.project.name} ${Date.now().toString(36)}`;
  const failing = `E6 off fail ${testInfo.project.name} ${Date.now().toString(36)}`;
  const items = page.getByRole('list', { name: 'Todos' }).getByRole('listitem');

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
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText(`Added “${earlier}”.`);
  await refetched;

  await context.setOffline(true);
  try {
    // A focus refetch fails at once with the network refresh message.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    await expect(page.getByRole('status').filter({ hasText: REFRESH })).toHaveText(`${REFRESH} ${NETWORK}`, {
      timeout: 2000,
    });
    await expect(items.filter({ hasText: earlier })).toHaveCount(1);

    // An add fails within 2 s as `network` and the text comes back.
    await field.focus();
    await page.keyboard.type(failing);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: "Couldn't add" })).toHaveText(
      `Couldn't add “${failing}”. ${NETWORK}`,
      { timeout: 2000 },
    );
    await expect(field).toHaveValue(failing);
    await expect(field).toBeFocused();
    await expect(items.filter({ hasText: failing })).toHaveCount(0);
    await expect(items.filter({ hasText: earlier })).toHaveCount(1);
    await expectNoAxeViolations(page, 'offline');
  } finally {
    await context.setOffline(false);
  }
});
