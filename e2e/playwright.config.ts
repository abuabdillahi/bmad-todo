import { defineConfig, devices } from '@playwright/test';

/**
 * E2e against the test profile, through web-test's origin (AD-20). One worker:
 * the suites share one list. Every project emulates reduced motion, so no axe
 * scan lands mid-transition, and `desktop-dark` reruns every spec in the dark
 * colour scheme.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8081';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: 'test-results',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '../coverage/e2e-report.json' }]],
  use: {
    baseURL,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light', reducedMotion: 'reduce' },
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], colorScheme: 'light', reducedMotion: 'reduce' },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark', reducedMotion: 'reduce' },
    },
  ],
});
