import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The epic-close measurement scripts write todos, so each refuses any host but
 * a local one before its first request (README › Measurements). Run with a
 * non-local BASE_URL, each must exit 1 with its refusal and no other output.
 * Spawns each script with Node; it needs no stack.
 */

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const scripts = [
  'scripts/perf-api.mjs',
  'e2e/perf/first-load.mjs',
  'e2e/perf/actions.mjs',
  'e2e/perf/lighthouse.mjs',
  'e2e/a11y/keyboard-pass.mjs',
];

describe('measurement scripts refuse a non-local host', () => {
  it.each(scripts)('%s exits 1 before any request', (script) => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, BASE_URL: 'https://example.com' },
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^[a-z0-9:-]+: refusing https:\/\/example\.com: /);
  });
});
