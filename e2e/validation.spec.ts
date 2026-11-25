import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';
import { containing, fieldStatus, MESSAGES, todoItem, uniqueDescription, visibleText } from './helpers.ts';

/**
 * Add-form validation in a real browser (E6, E7, E8, K1), by keyboard only.
 * Each test uses a unique description and asserts only on its own todos.
 */
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

/**
 * Enter as a keyboard that keeps every word composing sends it (e.g. Gboard): keyCode 229,
 * which the keydown handler stands aside for, so Chromium's own default action raises a
 * trusted `beforeinput` line break. CDP sends a real key, not a synthetic DOM event.
 */
async function pressComposingEnter(cdp: CDPSession) {
  const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: '\r', unmodifiedText: '\r', ...key });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}

test.describe('add form validation', () => {
  test('E6 E8 an empty Enter shows "Enter a description." and adds nothing', async ({ page }) => {
    const creates = recordCreates(page);
    const field = await focusAddField(page);

    await page.keyboard.press('Enter');

    await expect(visibleText(page, MESSAGES.empty)).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(containing(MESSAGES.empty));
    await expect(field).toBeFocused();
    await expect(fieldStatus(page, MESSAGES.empty)).toHaveCount(1);
    expect(creates).toEqual([]);
    await expectNoAxeViolations(page, 'empty submit');

    // The error clears on the next input that makes the text non-empty.
    await page.keyboard.type('a');
    await expect(page.getByText(MESSAGES.empty)).toHaveCount(0);
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('E6 E7 K1 pasting two lines joins them with one space and counts the trimmed text', async ({ page }, testInfo) => {
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await focusAddField(page);

    await writeClipboard(page, `${description}\nsecond line\n`);
    await page.keyboard.press('ControlOrMeta+V');

    const shown = `${description} second line `;
    await expect(field).toHaveValue(shown);
    await expect(page.getByText(`${[...shown.trim()].length}/200`)).toBeVisible();
    await expectNoAxeViolations(page, 'two-line paste joined');

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
    await expectNoAxeViolations(page, 'mid-text paste');

    await page.keyboard.press('ControlOrMeta+Z');
    await expect(field).toHaveValue('Buy  milk');
  });

  test('E6 K1 a trusted Enter with keyCode 229 submits through beforeinput and inserts no newline', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'CDP key input is Chromium only');
    const creates = recordCreates(page);
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await focusAddField(page);
    // Every line break the engine itself raises, so the test knows the beforeinput path ran.
    await field.evaluate((el) => {
      const seen: string[] = [];
      (window as unknown as { lineBreaks: string[] }).lineBreaks = seen;
      el.addEventListener('beforeinput', (event) => {
        const { inputType, isTrusted } = event as InputEvent;
        if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') seen.push(`${inputType} ${isTrusted}`);
      });
    });
    const lineBreaks = () => page.evaluate(() => (window as unknown as { lineBreaks: string[] }).lineBreaks);

    const cdp = await page.context().newCDPSession(page);

    // Empty: refused inline, nothing sent, no newline.
    await pressComposingEnter(cdp);
    await expect(visibleText(page, MESSAGES.empty)).toBeVisible();
    await expect(field).toHaveValue('');
    expect(await lineBreaks()).toEqual(['insertLineBreak true']);
    expect(creates).toEqual([]);

    // Valid: added once, with no line break, and the field clears.
    await page.keyboard.insertText(description);
    await pressComposingEnter(cdp);
    await expect(todoItem(page, description)).toHaveCount(1);
    await expect(todoItem(page, description)).toHaveText(description);
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    expect(await lineBreaks()).toEqual(['insertLineBreak true', 'insertLineBreak true']);
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0]!).description).toBe(description);
    await expectNoAxeViolations(page, 'keyCode 229 Enter added');
  });

  test('E6 K1 Enter with keyCode 229 during an open composition adds the composed word and the field stays empty', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'CDP key input is Chromium only');
    const creates = recordCreates(page);
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await focusAddField(page);
    const cdp = await page.context().newCDPSession(page);

    // A real IME composition is open on the last word when Enter arrives.
    await page.keyboard.insertText(`${description} `);
    await cdp.send('Input.imeSetComposition', { text: 'milk', selectionStart: 4, selectionEnd: 4 });
    await expect(field).toHaveValue(`${description} milk`);
    const created = page.waitForResponse(
      (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/todos',
    );
    await pressComposingEnter(cdp);

    expect((await created).ok()).toBe(true);
    await expect(todoItem(page, description)).toHaveText(`${description} milk`);
    await expect(field).toHaveValue('');
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0]!).description).toBe(`${description} milk`);
    await expectNoAxeViolations(page, 'composed word added');
    // The composed word never comes back once the add has resolved and a key follows.
    await page.keyboard.type('a');
    await expect(field).toHaveValue('a');
  });

  test('E6 E8 over 200 characters shows the over state, Enter adds nothing, and 200 clears it', async ({ page }, testInfo) => {
    const creates = recordCreates(page);
    const description = uniqueDescription('E6', testInfo.project.name);
    const field = await focusAddField(page);
    const text = `${description} ${'x'.repeat(200)}`.slice(0, 201);

    await page.keyboard.insertText(text);
    await expect(page.getByText('201/200')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    // Chromium's name computation puts a space before the absolutely positioned hidden suffix.
    await expect(field).toHaveAccessibleDescription(new RegExp(`201/200 ?${containing(MESSAGES.overLimitSuffix).source}`));

    await page.keyboard.press('Enter');
    await expect(field).toBeFocused();
    await expect(fieldStatus(page, MESSAGES.overLimit)).toHaveCount(1);
    expect(creates).toEqual([]);
    await expect(todoItem(page, description)).toHaveCount(0);
    await expectNoAxeViolations(page, 'over limit');

    await page.keyboard.press('Backspace');
    await expect(page.getByText('200/200')).toBeVisible();
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });
});
