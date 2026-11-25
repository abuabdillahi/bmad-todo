#!/usr/bin/env node
// `pnpm perf:lighthouse` (R14, R19, AD-20): the epic-close Lighthouse audit
// against a local stack, in the light and the dark colour scheme, on the
// mobile (default) and desktop form factors. Categories: accessibility,
// best-practices, performance. Lighthouse runs through `pnpm dlx` at a pinned
// version, on Playwright's Chromium (CHROME_PATH).
//
// The scheme is forced with a Blink setting, never left to the OS (a host in
// dark mode would otherwise turn the "light" run dark). Before each run the
// same Chromium and flags load a probe page and must report the expected
// `prefers-color-scheme`, so a run that did not get its scheme fails.
//
// Before the runs it seeds the list through the public API, so the audit sees
// active and done cards with their buttons: at least 10 todos, at least 3 of
// them done. It only adds todos (done ones are its own), and prints the counts.
//
// Writes JSON and HTML reports to coverage/lighthouse/ (git-ignored), prints
// category scores and every failing scored audit, and exits non-zero when the
// accessibility category has any failing audit or a run fails.
//
// Env: BASE_URL (default http://127.0.0.1:8081; local hosts only).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const LIGHTHOUSE = 'lighthouse@13.6.0';
const CATEGORIES = 'accessibility,best-practices,performance';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
// Blink's PreferredColorScheme enum: 0 is dark, 1 is light.
const SCHEMES = { light: 1, dark: 0 };
const FORM_FACTORS = { mobile: [], desktop: ['--preset=desktop'] };

function fail(message) {
  console.error(`perf:lighthouse: ${message}`);
  process.exit(1);
}

const baseUrl = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8081');
if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  fail(`refusing ${baseUrl.origin}: run it against todo-test or todo-dev only`);
}
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();
const outDir = fileURLToPath(new URL('../../coverage/lighthouse/', import.meta.url));
mkdirSync(outDir, { recursive: true });

/** Loads a probe page with these flags and returns whether it matched prefers-color-scheme: dark. */
function probeDark(flags) {
  const page = 'data:text/html,<body><script>document.body.textContent="dark="+matchMedia("(prefers-color-scheme: dark)").matches</script>';
  const { stdout, status } = spawnSync(chromePath, [...flags, '--dump-dom', page], { encoding: 'utf8' });
  if (status !== 0) fail(`the scheme probe could not run ${chromePath}`);
  return stdout.includes('dark=true');
}

async function api(method, path, body) {
  let response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    fail(`${method} ${path}: ${baseUrl.origin} unreachable (${error.cause?.code ?? error.message})`);
  }
  if (!response.ok) fail(`${method} ${path} answered ${response.status}`);
  return response.json();
}

// The list the audit sees: at least MIN_TODOS todos, at least MIN_DONE of them done.
const MIN_TODOS = 10;
const MIN_DONE = 3;
const stamp = Date.now().toString(36);
let todos = await api('GET', '/api/todos');
for (let i = todos.filter((t) => t.completed).length; i < MIN_DONE; i++) {
  const id = crypto.randomUUID();
  await api('POST', '/api/todos', { id, description: `lighthouse done ${i + 1} ${stamp}` });
  await api('PATCH', `/api/todos/${encodeURIComponent(id)}`, { completed: true });
}
todos = await api('GET', '/api/todos');
for (let i = todos.length; i < MIN_TODOS; i++) {
  await api('POST', '/api/todos', { id: crypto.randomUUID(), description: `lighthouse open ${i + 1} ${stamp}` });
}
todos = await api('GET', '/api/todos');
const done = todos.filter((t) => t.completed).length;
console.log(`List audited: ${todos.length} todos, ${todos.length - done} active and ${done} done`);

let a11yFailures = 0;
for (const [scheme, value] of Object.entries(SCHEMES)) {
  const flags = ['--headless=new', `--blink-settings=preferredColorScheme=${value}`];
  const dark = probeDark(flags);
  if (dark !== (scheme === 'dark')) fail(`Chromium with ${flags.join(' ')} did not apply the ${scheme} scheme`);

  for (const [formFactor, extra] of Object.entries(FORM_FACTORS)) {
    const name = `${formFactor}-${scheme}`;
    const outputPath = `${outDir}${name}`;
    const run = spawnSync(
      'pnpm',
      [
        'dlx', LIGHTHOUSE, baseUrl.href, `--only-categories=${CATEGORIES}`, ...extra,
        `--chrome-flags=${flags.join(' ')}`,
        '--output=json', '--output=html', `--output-path=${outputPath}`, '--quiet',
      ],
      { env: { ...process.env, CHROME_PATH: chromePath }, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    if (run.status !== 0) fail(`lighthouse ${name} exited ${run.status}`);

    const report = JSON.parse(readFileSync(`${outputPath}.report.json`, 'utf8'));
    if (report.runtimeError) fail(`lighthouse ${name}: ${report.runtimeError.message}`);
    const scores = Object.values(report.categories).map((c) => `${c.id} ${Math.round(c.score * 100)}`);
    console.log(`\n## ${name} (Lighthouse ${report.lighthouseVersion}, prefers-color-scheme: ${dark ? 'dark' : 'light'} confirmed): ${scores.join(', ')}`);
    for (const category of Object.values(report.categories)) {
      for (const { id } of category.auditRefs) {
        const audit = report.audits[id];
        // An audit that failed to run counts as a failure in accessibility.
        if (audit.scoreDisplayMode === 'error') {
          if (category.id === 'accessibility') a11yFailures++;
          console.log(`  ${category.id}: ${id} (error: ${audit.errorMessage ?? 'audit did not run'})`);
          continue;
        }
        if (audit.score === null || audit.score >= 1) continue;
        if (!['binary', 'numeric', 'metricSavings'].includes(audit.scoreDisplayMode)) continue;
        if (category.id === 'accessibility') a11yFailures++;
        console.log(`  ${category.id}: ${id} (score ${audit.score}${audit.displayValue ? `, ${audit.displayValue}` : ''})`);
      }
    }
    const metric = (id) => report.audits[id]?.displayValue ?? '-';
    console.log(
      `  FCP ${metric('first-contentful-paint')}, LCP ${metric('largest-contentful-paint')}, TBT ${metric('total-blocking-time')}, CLS ${metric('cumulative-layout-shift')}, SI ${metric('speed-index')}, TTI ${metric('interactive')}, weight ${metric('total-byte-weight')}`,
    );
  }
}
console.log(`\nReports: ${outDir}`);
if (a11yFailures > 0) fail(`${a11yFailures} failing accessibility audit(s)`);
