import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Locators, test data and expected copy shared by the e2e specs. Each test
 * adds todos with unique descriptions and asserts only on its own.
 */

/** Opens the app and moves focus to the add field with Tab, its first tab stop. */
export async function focusAddField(page: Page): Promise<Locator> {
  await page.goto('/');
  const field = page.getByRole('textbox', { name: 'New todo' });
  await expect(page.getByText('0/200')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  return field;
}

/** A description no other test or run uses: `<prefix> <project> <time>-<random>`. */
export function uniqueDescription(prefix: string, project: string): string {
  return `${prefix} ${project} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todoList(page: Page): Locator {
  return page.getByRole('list', { name: 'Todos' });
}

/** The todo cards whose text contains `description`. */
export function todoItem(page: Page, description: string): Locator {
  return todoList(page).getByRole('listitem').filter({ hasText: description });
}

/** `{t}`'s text: cut at 40 code points with "…" inside the quote (EXPERIENCE Voice and Tone). */
export function quoteText(description: string): string {
  const points = [...description];
  return points.length <= 40 ? description : `${points.slice(0, 40).join('').trimEnd()}…`;
}

/** The Announcer's live message containing `text`: a `role="status"` outside the add form. */
export function announcement(page: Page, text: string | RegExp): Locator {
  return page.getByRole('status').filter({ hasText: text }).and(page.locator(':not(form [role="status"])'));
}

/** The add form's hidden Field status containing `text`. */
export function fieldStatus(page: Page, text: string | RegExp): Locator {
  return page.locator('form').getByRole('status').filter({ hasText: text });
}

/** The app's copy the specs assert on (EXPERIENCE Voice and Tone). */
export const MESSAGES = {
  /** Failure reasons the Announcer appends. */
  unavailable: "The server isn't available right now. Try again in a moment.",
  network: 'Check your connection and try again.',
  /** The refresh failure's lead. */
  refresh: "Couldn't refresh the list. You're seeing what was last loaded.",
  /** An add's outcome in the Announcer, whichever it is. */
  addOutcome: /^(Added|Couldn't add)/,
  added: (description: string): string => `Added “${quoteText(description)}”.`,
  addFailed: (description: string, reason: string): string => `Couldn't add “${quoteText(description)}”. ${reason}`,
  /** The Inline error for an empty submit. */
  empty: 'Enter a description.',
  /** The over-limit words the Field status speaks once the limit is crossed. */
  overLimit: 'over the character limit',
  /** The hidden suffix the counter carries while over the limit. */
  overLimitSuffix: ', over the character limit',
} as const;

/** A pattern matching `text` literally, anywhere in a string. */
export function containing(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/** AD-4's literal body, as nginx answers when the API can't be reached. */
export const UNAVAILABLE_BODY =
  '{"type":"/problems/unavailable","title":"Service unavailable","status":503,"detail":"The service is unavailable. Try again shortly."}';

/**
 * Elements matching `text` that are neither a `role="status"` live region nor
 * inside one: the hidden Field status carries an Inline error's words one
 * animation frame later, so a bare getByText matches both once that frame runs.
 */
export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).and(page.locator(':not([role="status"], [role="status"] *)'));
}
