import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** The AD-20 tags: WCAG 2.2 AA and everything below it. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Scans the page as it is now and fails on any AA violation (E8). Each scan is
 * recorded as an `axe` annotation in the test's result, and
 * scripts/axe-coverage.mjs fails `pnpm test:all` when a passed e2e test has none.
 */
export async function expectNoAxeViolations(page: Page, state: string): Promise<void> {
  test.info().annotations.push({ type: 'axe', description: state });
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary, `axe violations in state "${state}"`).toEqual([]);
}
