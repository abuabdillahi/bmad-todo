#!/usr/bin/env node
// `pnpm perf:first-load` (R19, AD-20): profiles first load and the add action
// in Chromium against a local stack, with Playwright and the Chrome DevTools
// Protocol (the reproducible equivalent of a Chrome DevTools MCP profile).
//
// Each run opens a fresh browser context (cold cache) on a seeded list and
// records navigation timing (TTFB, DOMContentLoaded, load), FCP and LCP,
// transferred document/JS/CSS bytes, the time until every seeded todo is
// rendered, CDP Performance.getMetrics totals, and the add action: Enter
// pressed to the new card in the DOM and to the next frame. First load has no
// pass bar (epic decision 2026-11-24); the add action's 100 ms (C4) is
// recorded, not gated. Exits non-zero only when a run fails.
//
// It creates todos, so it refuses any host but a local one (todo-test by
// default). Lives outside Playwright's testMatch (*.spec.ts), so the e2e suite
// never picks it up.
//
// Env: BASE_URL (default http://127.0.0.1:8081), PERF_RUNS (default 5),
// PERF_SEED list size to reach first (default 50).
import { chromium } from '@playwright/test';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function fail(message) {
  console.error(`perf:first-load: ${message}`);
  process.exit(1);
}

const baseUrl = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8081');
if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  fail(`refusing ${baseUrl.origin}: only 127.0.0.1, localhost or [::1] (todo-test, todo-dev) may be measured`);
}
const runs = Number(process.env.PERF_RUNS ?? 5);
const seed = Number(process.env.PERF_SEED ?? 50);
if (!Number.isInteger(runs) || runs < 1) fail('PERF_RUNS must be a positive integer');
if (!Number.isInteger(seed) || seed < 0) fail('PERF_SEED must be a non-negative integer');

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

for (let size = (await api('GET', '/api/todos')).length; size < seed; size++) {
  await api('POST', '/api/todos', { id: crypto.randomUUID(), description: `perf seed ${size}` });
}

// Runs in the page before any of its scripts: paint, LCP and list observers.
function instrument(expected) {
  const perf = { fcp: null, lcp: null, lcpElement: null, listRendered: null };
  window.__perf = perf;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') perf.fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    perf.lcp = entries[entries.length - 1].startTime;
    perf.lcpElement = entries[entries.length - 1].element?.tagName ?? null;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new MutationObserver(() => {
    if (perf.listRendered !== null) return;
    const count = document.querySelectorAll('ul[aria-label="Todos"] > li').length;
    if (count >= expected) perf.listRendered = performance.now();
  }).observe(document, { childList: true, subtree: true });
}

const browser = await chromium.launch();
console.log(`Chromium ${browser.version()}, desktop 1280x720, no throttling, against ${baseUrl.origin}`);
const rows = [];
try {
  for (let run = 1; run <= runs; run++) {
    const expected = (await api('GET', '/api/todos')).length;
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.addInitScript(instrument, expected);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');

    await page.goto(baseUrl.href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__perf.listRendered !== null, null, { timeout: 15_000 });
    // Let LCP settle: it is final once the page has been idle a moment.
    await page.waitForTimeout(500);

    const load = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const bytes = { doc: nav.transferSize, js: 0, css: 0, other: 0 };
      for (const r of performance.getEntriesByType('resource')) {
        const kind = r.name.endsWith('.js') ? 'js' : r.name.endsWith('.css') ? 'css' : 'other';
        bytes[kind] += r.transferSize;
      }
      return {
        ttfb: nav.responseStart - nav.startTime,
        dcl: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
        fcp: window.__perf.fcp,
        lcp: window.__perf.lcp,
        lcpElement: window.__perf.lcpElement,
        listRendered: window.__perf.listRendered,
        bytes,
      };
    });
    const { metrics } = await cdp.send('Performance.getMetrics');
    const metric = (name) => metrics.find((m) => m.name === name)?.value ?? NaN;

    // The add action: Enter to the card in the DOM, and to the frame after it.
    const description = `perf add ${run} ${Date.now().toString(36)}`;
    await page.getByRole('textbox', { name: 'New todo' }).fill(description);
    // Register the listeners first (awaited), then press Enter and wait for the result.
    await page.evaluate((text) => {
      window.__add = { pressed: null, result: null };
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Enter') window.__add.pressed = performance.now();
        },
        { capture: true, once: true },
      );
      const observer = new MutationObserver(() => {
        const items = document.querySelectorAll('ul[aria-label="Todos"] > li');
        // Match the card's text span: the card also holds its Edit and Delete buttons.
        if (![...items].some((li) => [...li.querySelectorAll('span')].some((span) => span.textContent === text))) return;
        observer.disconnect();
        const inDom = performance.now();
        requestAnimationFrame(() => {
          const { pressed } = window.__add;
          window.__add.result = { dom: inDom - pressed, frame: performance.now() - pressed };
        });
      });
      observer.observe(document, { childList: true, subtree: true, characterData: true });
    }, description);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__add.result !== null, null, { timeout: 15_000 });
    const add = await page.evaluate(() => {
      if (window.__add.pressed === null) throw new Error('the Enter keydown was not observed');
      return window.__add.result;
    });
    await page.getByRole('list', { name: 'Todos' }).getByText(description).waitFor();
    await context.close();

    rows.push({
      run,
      listSize: expected,
      ...load,
      scriptMs: metric('ScriptDuration') * 1000,
      layoutMs: metric('LayoutDuration') * 1000,
      styleMs: metric('RecalcStyleDuration') * 1000,
      taskMs: metric('TaskDuration') * 1000,
      heapKb: metric('JSHeapUsedSize') / 1024,
      addDom: add.dom,
      addFrame: add.frame,
    });
  }
} finally {
  await browser.close();
}

const ms = (v) => (v === null || Number.isNaN(v) ? '-' : v.toFixed(1));
const kb = (v) => (v / 1024).toFixed(1);
console.log(
  '\n| Run | List | TTFB | DCL | Load | FCP | LCP (el) | List rendered | Doc KB | JS KB | CSS KB | Script | Layout | Style | Task | Heap KB | Add→DOM | Add→frame |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.run} | ${r.listSize} | ${ms(r.ttfb)} | ${ms(r.dcl)} | ${ms(r.load)} | ${ms(r.fcp)} | ${ms(r.lcp)} (${r.lcpElement}) | ${ms(r.listRendered)} | ${kb(r.bytes.doc)} | ${kb(r.bytes.js)} | ${kb(r.bytes.css)} | ${ms(r.scriptMs)} | ${ms(r.layoutMs)} | ${ms(r.styleMs)} | ${ms(r.taskMs)} | ${r.heapKb.toFixed(0)} | ${ms(r.addDom)} | ${ms(r.addFrame)} |`,
  );
}
const median = (key) => {
  const v = rows.map((r) => r[key]).sort((a, b) => a - b);
  return v[Math.floor((v.length - 1) / 2)];
};
console.log(
  `\nMedians (ms): TTFB ${ms(median('ttfb'))}, DCL ${ms(median('dcl'))}, load ${ms(median('load'))}, FCP ${ms(median('fcp'))}, LCP ${ms(median('lcp'))}, list rendered ${ms(median('listRendered'))}, add→DOM ${ms(median('addDom'))}, add→frame ${ms(median('addFrame'))}`,
);
