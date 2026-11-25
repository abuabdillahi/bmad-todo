import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * One Vitest project per layer (AD-20). `unit`, `component` and `integration`
 * run in-process and report coverage per project. `contract` runs only from
 * `pnpm test:all`, against the test profile at E2E_BASE_URL;
 * `profile` runs there after e2e (it restarts and pauses the api container,
 * checking the stalled-API answer, and checks logs and headers; its compose
 * project-name check needs no stack); `contract-unavailable` runs last, with the api container
 * stopped. Every project reports by scenario id.
 */
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      include: ['apps/api/src/**', 'apps/web/src/**', 'packages/contract/src/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.css'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'apps/*/src/**/*.test.ts',
            'apps/*/src/**/*.test.tsx',
            'packages/*/src/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
          exclude: [...configDefaults.exclude, '**/*.component.test.tsx'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.component.test.tsx'],
          setupFiles: ['apps/web/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['apps/api/test/integration/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'contract',
          environment: 'node',
          include: ['apps/api/test/contract/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'profile',
          environment: 'node',
          include: ['apps/api/test/profile/**/*.test.ts'],
          testTimeout: 60_000,
          // One stack: never restart the api while another file is calling it.
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'contract-unavailable',
          environment: 'node',
          include: ['apps/api/test/unavailable/**/*.test.ts'],
        },
      },
    ],
  },
});
