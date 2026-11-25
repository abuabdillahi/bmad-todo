#!/usr/bin/env node
// `pnpm test:all` (R17, Conventions › One command): brings up todo-test on a
// fresh volume, runs every layer, writes coverage, and always tears the
// project down. Exits non-zero if any step fails.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = process.env.TEST_WEB_PORT ?? '8081';
const env = {
  ...process.env,
  APP_ENV: 'test',
  // The profile tests read these (stack.ts); pin them to the project this script starts.
  COMPOSE_PROJECT: 'todo-test',
  COMPOSE_PROFILE: 'test',
  TEST_WEB_PORT: port,
  E2E_BASE_URL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`,
};
const compose = ['compose', '-p', 'todo-test', '--profile', 'test'];

let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    console.error(`\n${signal} received: finishing the current step, then tearing down todo-test.`);
  });
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', (error) => {
      console.error(`Could not start ${command}: ${error.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

const results = [];

async function step(label, command, args) {
  if (interrupted) {
    results.push({ label, status: 'skipped' });
    return false;
  }
  console.log(`\n=== ${label} ===`);
  const code = await run(command, args);
  results.push({ label, status: code === 0 ? 'passed' : 'failed' });
  return code === 0;
}

function skip(label, reason) {
  results.push({ label, status: `skipped (${reason})` });
}

// Each project's coverage counts the sources that layer is meant to exercise.
const coverageSources = {
  unit: ['apps/api/src/**', 'apps/web/src/**', 'packages/contract/src/**'],
  component: ['apps/web/src/**'],
  integration: ['apps/api/src/**', 'packages/contract/src/**'],
};

/** Vitest's JSON report for a project, which scenario-coverage.mjs reads by scenario id. */
function jsonReport(project) {
  return ['--reporter=default', '--reporter=json', `--outputFile.json=coverage/${project}-report.json`];
}

function coverage(project) {
  return [
    'exec', 'vitest', 'run', '--project', project,
    '--coverage.enabled', `--coverage.reportsDirectory=coverage/${project}`,
    ...coverageSources[project].map((glob) => `--coverage.include=${glob}`),
    ...jsonReport(project),
  ];
}

rmSync(`${root}coverage`, { recursive: true, force: true });
mkdirSync(`${root}coverage`, { recursive: true });

let up = false;
try {
  // Start from a fresh volume even if an earlier run was killed before teardown.
  await run('docker', [...compose, 'down', '-v', '--remove-orphans']);
  up = await step('todo-test up', 'docker', [...compose, 'up', '-d', '--build', '--wait']);
  if (!up && !interrupted) await run('docker', [...compose, 'logs', '--no-color']);

  await step('unit', 'pnpm', coverage('unit'));
  await step('component', 'pnpm', coverage('component'));
  await step('integration', 'pnpm', coverage('integration'));

  if (up) {
    await step('contract', 'pnpm', ['exec', 'vitest', 'run', '--project', 'contract', ...jsonReport('contract')]);
    await step('playwright browsers', 'pnpm', ['--filter', '@todo/e2e', 'exec', 'playwright', 'install', 'chromium']);
    await step('e2e', 'pnpm', ['--filter', '@todo/e2e', 'exec', 'playwright', 'test']);
    // Restarts the api (I6) and reads its logs, so it runs after e2e and before api stops.
    await step('profile', 'pnpm', ['exec', 'vitest', 'run', '--project', 'profile', ...jsonReport('profile')]);
    // Last, because it takes the API away: with api stopped and web-test still
    // up, nginx must answer /api/* with the unavailable problem (AD-4).
    if (await step('stop api', 'docker', [...compose, 'stop', 'api'])) {
      await step('contract-unavailable', 'pnpm', [
        'exec', 'vitest', 'run', '--project', 'contract-unavailable', ...jsonReport('contract-unavailable'),
      ]);
    } else {
      skip('contract-unavailable', 'api did not stop');
    }
  } else {
    skip('contract', 'todo-test did not start');
    skip('e2e', 'todo-test did not start');
    skip('profile', 'todo-test did not start');
    skip('contract-unavailable', 'todo-test did not start');
  }

  await step('scenario coverage', 'node', ['scripts/scenario-coverage.mjs']);
} finally {
  console.log('\n=== todo-test down ===');
  const down = await run('docker', [...compose, 'down', '-v', '--remove-orphans']);
  results.push({ label: 'todo-test down', status: down === 0 ? 'passed' : 'failed' });
}

console.log('\n=== Summary ===');
for (const { label, status } of results) console.log(`${status.padEnd(28)} ${label}`);
console.log('\nCoverage: coverage/unit, coverage/component, coverage/integration; by scenario: coverage/scenarios.md');

const ok = !interrupted && results.every(({ status }) => status === 'passed');
process.exit(ok ? 0 : 1);
