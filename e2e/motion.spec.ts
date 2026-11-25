import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { announcement, MESSAGES, resetList, todoItem, uniqueDescription } from './helpers.ts';

/**
 * The one motion-on spec (AD-20). An added card plays its enter motion and ends
 * fully visible. The axe scan waits until no animation is running anywhere on
 * the page, so it never lands mid-transition.
 */
test.use({ reducedMotion: 'no-preference' });

test.beforeEach(({ request }) => resetList(request));

test('E1 an added card runs its enter animation and ends fully visible', async ({ page }, testInfo) => {
  const description = uniqueDescription('E1 motion', testInfo.project.name);
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await field.focus();
  await page.keyboard.type(description);

  // Records the animations on the card as it mounts, before they can finish. The
  // observer is installed (awaited) before Enter, so the mount can't slip past it.
  await page.evaluate((text) => {
    const list = document.querySelector('ul[aria-label="Todos"]')!;
    const observer = new MutationObserver(() => {
      const item = [...list.querySelectorAll('li')].find((li) => li.textContent === text);
      if (!item) return;
      observer.disconnect();
      (window as unknown as { mountedAnimations?: number }).mountedAnimations = item.getAnimations({ subtree: true }).length;
    });
    observer.observe(list, { childList: true, subtree: true });
  }, description);
  await page.keyboard.press('Enter');

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { mountedAnimations?: number }).mountedAnimations ?? -1))
    .toBeGreaterThan(0);
  const item = todoItem(page, description);
  await expect(item).toBeVisible();
  await expect
    .poll(() => item.evaluate((li) => li.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length))
    .toBe(0);
  expect(await item.evaluate((li) => getComputedStyle(li.firstElementChild!.firstElementChild!).opacity)).toBe('1');
  await expect(announcement(page, MESSAGES.added(description))).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length))
    .toBe(0);
  await expectNoAxeViolations(page, 'added with motion');
});
