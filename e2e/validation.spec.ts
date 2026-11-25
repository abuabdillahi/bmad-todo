import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

/**
 * Add-form validation in a real browser (E6, E7, E8, K1), by keyboard only.
 * Each test uses a unique description and asserts only on its own todos.
 */
function uniqueDescription(project: string): string {
  return `E6 ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todoItem(page: Page, description: string) {
  return page.getByRole('list', { name: 'Todos' }).getByRole('listitem').filter({ hasText: description });
}

/** Records every create request the page sends, so a test can assert none went out. */
function recordCreates(page: Page): string[] {
  const bodies: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/todos') {
      bodies.push(request.postData() ?? '');
    }
  });
  return bodies;
}

/** Opens the app and moves focus to the add field with Tab. */
async function focusAddField(page: Page) {
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  return field;
}

async function writeClipboard(page: Page, text: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
}

test.describe('add form validation', () => {
  test('E6 E8 an empty Enter shows "Enter a description." and adds nothing', async ({ page }) => {
    const creates = recordCreates(page);
    const field = await focusAddField(page);

    await page.keyboard.press('Enter');

    await expect(page.getByText('Enter a description.')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/Enter a description\./);
    await expect(field).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Enter a description.' })).toHaveCount(1);
    expect(creates).toEqual([]);
    await expectNoAxeViolations(page, 'empty submit');

    // The error clears on the next input that makes the text non-empty.
    await page.keyboard.type('a');
    await expect(page.getByText('Enter a description.')).toHaveCount(0);
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('E6 E7 K1 pasting two lines joins them with one space and counts the trimmed text', async ({ page }, testInfo) => {
    const description = uniqueDescription(testInfo.project.name);
    const field = await focusAddField(page);

    await writeClipboard(page, `${description}\nsecond line\n`);
    await page.keyboard.press('ControlOrMeta+V');

    const shown = `${description} second line `;
    await expect(field).toHaveValue(shown);
    await expect(page.getByText(`${[...shown.trim()].length}/200`)).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(todoItem(page, description)).toHaveCount(1);
    await expect(todoItem(page, description)).toHaveText(shown.trim());
    await expect(field).toHaveValue('');
  });

  test('E6 K1 a mid-text paste leaves the caret after the text and one undo restores the field', async ({ page }) => {
    const field = await focusAddField(page);

    await page.keyboard.type('Buy  milk');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await writeClipboard(page, 'oat\r\n');
    await page.keyboard.press('ControlOrMeta+V');

    await expect(field).toHaveValue('Buy oat   milk');
    expect(await field.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([9, 9]);

    await page.keyboard.press('ControlOrMeta+Z');
    await expect(field).toHaveValue('Buy  milk');
  });

  test('E6 E8 over 200 characters shows the over state, Enter adds nothing, and 200 clears it', async ({ page }, testInfo) => {
    const creates = recordCreates(page);
    const description = uniqueDescription(testInfo.project.name);
    const field = await focusAddField(page);
    const text = `${description} ${'x'.repeat(200)}`.slice(0, 201);

    await page.keyboard.insertText(text);
    await expect(page.getByText('201/200')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    // Chromium's name computation puts a space before the absolutely positioned hidden suffix.
    await expect(field).toHaveAccessibleDescription(/201\/200 ?, over the character limit/);

    await page.keyboard.press('Enter');
    await expect(field).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'over the character limit' })).toHaveCount(1);
    expect(creates).toEqual([]);
    await expect(todoItem(page, description)).toHaveCount(0);
    await expectNoAxeViolations(page, 'over limit');

    await page.keyboard.press('Backspace');
    await expect(page.getByText('200/200')).toBeVisible();
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });
});
