#!/usr/bin/env node
// `pnpm perf:actions` (R19, C4, AD-20): times each core action in Chromium
// against a local stack, at desktop 1280x720 and on Pixel 7: add, edit,
// complete, reactivate and delete. Each is timed from the triggering input
// event's `timeStamp` (the Enter keydown, or the pointerdown of a click or a
// tap) to the change in the DOM (a MutationObserver) and to the painted frame
// after it (EXPERIENCE Motion: an action "shows" at the first painted frame of
// its change). The painted time is taken in a message posted from the next
// `requestAnimationFrame` callback: rAF runs before that frame's style, layout
// and paint, and the message runs after them. Untimed setup opens Edit or the
// Delete confirm first.
//
// The Pixel 7 profile is Playwright's device (viewport, touch, user agent); the
// CPU is not throttled, so both profiles run at the host's speed.
//
//   add         Enter in "New todo"     → a new card with the text
//   edit        Enter in the edit field → the card's text shows the new text
//   complete    click the check         → checked, and the Done chip shows
//   reactivate  click the check         → unchecked, and the Done chip is gone
//   delete      click Confirm delete    → the row is a Leaving copy or gone
//
// Exits non-zero, naming the action, the profile and the run, when any run's
// input → painted frame is 100 ms or more (C4), when a change never shows, or
// when an API request it causes fails (any 4xx or 5xx, 404 included). Medians are printed too. Between actions it
// waits until no request is in flight, so one action's settle-time refetch
// never lands inside the next one's timing.
//
// It creates todos through the public API and the page, so it refuses any host
// but a local one (todo-test by default), and at the end deletes only the
// todos it created. Lives outside Playwright's testMatch (*.spec.ts).
//
// Env: BASE_URL (default http://127.0.0.1:8081), PERF_RUNS runs per action
// and profile (default 5, minimum 5).
import { chromium, devices } from '@playwright/test';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const BAR_MS = 100;
const ACTIONS = ['add', 'edit', 'complete', 'reactivate', 'delete'];
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  'Pixel 7': devices['Pixel 7'],
};

function fail(message) {
  console.error(`perf:actions: ${message}`);
  process.exit(1);
}

const baseUrl = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8081');
// Refuse before any request: this script writes todos, and production data is real.
if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  fail(`refusing ${baseUrl.origin}: only 127.0.0.1, localhost or [::1] (todo-test, todo-dev) may be measured`);
}
const runs = Number(process.env.PERF_RUNS ?? 5);
if (!Number.isInteger(runs) || runs < 5) fail(`PERF_RUNS must be an integer >= 5 (got ${process.env.PERF_RUNS})`);

/** One API call; throws (never exits) on failure, so a run's clean-up still runs. */
async function api(method, path, body) {
  let response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`${method} ${path}: ${baseUrl.origin} unreachable (${error.cause?.code ?? error.message})`);
  }
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new Error(`${method} ${path} answered ${response.status}`);
  return response.status === 204 || response.status === 404 ? null : response.json();
}

const stamp = Date.now().toString(36);
/** Descriptions this run created or saved, so the clean-up deletes only its own todos. */
const own = new Set();
const ownIds = new Set();

async function seed(description) {
  const todo = await api('POST', '/api/todos', { id: crypto.randomUUID(), description });
  own.add(description);
  ownIds.add(todo.id);
  return todo;
}

/**
 * Runs in the page: arms one measurement. A capture listener keeps the
 * trigger's `timeStamp`; a MutationObserver checks the action's condition
 * after each DOM change and, once it holds, records the time and the next
 * frame. Throws if the condition already holds before the input.
 */
function arm({ action, trigger, text, id }) {
  window.__armed?.abort();
  const controller = new AbortController();
  window.__armed = controller;
  const state = { input: null, dom: null, frame: null };
  window.__action = state;

  const list = () => document.querySelector('ul[aria-label="Todos"]');
  const row = () => list()?.querySelector(`:scope > li[data-todo-id="${id}"]:not([data-leaving])`) ?? null;
  const shows = (li, value) => [...li.querySelectorAll('span')].some((span) => span.textContent === value);
  const chip = (li) => [...li.querySelectorAll('span[aria-hidden="true"]')].some((span) => span.textContent === 'Done');
  const checked = (li) => li.querySelector('input[type="checkbox"]')?.checked === true;
  const conditions = {
    add: () => [...(list()?.querySelectorAll(':scope > li:not([data-leaving])') ?? [])].some((li) => shows(li, text)),
    edit: () => {
      const li = row();
      return li !== null && li.querySelector('textarea') === null && shows(li, text);
    },
    complete: () => {
      const li = row();
      return li !== null && checked(li) && chip(li);
    },
    reactivate: () => {
      const li = row();
      return li !== null && !checked(li) && !chip(li);
    },
    delete: () => row() === null,
  };
  const holds = conditions[action];
  if (holds()) throw new Error(`${action}: the change already shows before the input`);

  document.addEventListener(
    trigger,
    (event) => {
      if (trigger === 'keydown' && event.key !== 'Enter') return;
      if (state.input === null) state.input = event.timeStamp;
    },
    { capture: true, signal: controller.signal },
  );
  const observer = new MutationObserver(() => {
    if (state.input === null || state.dom !== null || !holds()) return;
    observer.disconnect();
    state.dom = performance.now() - state.input;
    // rAF runs before the frame's rendering; a message posted from it runs after the paint.
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        state.frame = performance.now() - state.input;
      };
      channel.port2.postMessage(null);
    });
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  controller.signal.addEventListener('abort', () => observer.disconnect());
}

const browser = await chromium.launch();
console.log(`Chromium ${browser.version()}, no throttling, against ${baseUrl.origin}, ${runs} runs per action and profile`);
const listSize = (await api('GET', '/api/todos').catch((error) => fail(error.message))).length;
console.log(`List before seeding: ${listSize} todos`);

/** results[profile][action] = [{ dom, frame }] */
const results = {};
// A failed run throws, so the browser closes and the clean-up runs before the exit.
let aborted = null;
try {
  for (const [profile, options] of Object.entries(PROFILES)) {
    const touch = options.hasTouch === true;
    // Each run edits, toggles and deletes todos of its own, seeded before the page loads.
    const targets = [];
    for (let run = 1; run <= runs; run++) {
      const tag = `${profile.replace(' ', '').toLowerCase()} ${run} ${stamp}`;
      targets.push({
        edit: await seed(`perf edit ${tag}`),
        toggle: await seed(`perf toggle ${tag}`),
        remove: await seed(`perf delete ${tag}`),
        added: `perf add ${tag}`,
        edited: `perf edited ${tag}`,
      });
    }

    const context = await browser.newContext({ ...options });
    const page = await context.newPage();
    let inflight = 0;
    const apiFailures = [];
    page.on('request', () => inflight++);
    page.on('requestfinished', () => inflight--);
    page.on('requestfailed', (request) => {
      inflight--;
      apiFailures.push(`${request.method()} ${request.url()} failed (${request.failure()?.errorText})`);
    });
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) {
        apiFailures.push(`${response.request().method()} ${response.url()} answered ${response.status()}`);
      }
    });
    /** Waits until no request has been in flight for 250 ms, then checks none failed. */
    async function settle(label) {
      let quietSince = Date.now();
      while (Date.now() - quietSince < 250) {
        await page.waitForTimeout(25);
        if (inflight > 0) quietSince = Date.now();
      }
      if (apiFailures.length > 0) throw new Error(`${label}: ${apiFailures.join('; ')}`);
    }
    const press = (locator) => (touch ? locator.tap() : locator.click());

    /** Arms the measurement, sends the input, and waits for the change and its frame. */
    async function measure(action, run, spec, input) {
      const label = `${action}, ${profile}, run ${run}`;
      await page.evaluate(arm, { action, ...spec });
      await input();
      try {
        await page.waitForFunction(() => window.__action.frame !== null, null, { timeout: 5_000 });
      } catch {
        const { input: seen } = await page.evaluate(() => window.__action);
        throw new Error(`${label}: ${seen === null ? `the ${spec.trigger} was not observed` : 'the change never showed'} within 5 s`);
      }
      const { dom, frame } = await page.evaluate(() => window.__action);
      results[profile] ??= {};
      (results[profile][action] ??= []).push({ dom, frame });
      await settle(label);
    }

    const todos = page.getByRole('list', { name: 'Todos' });
    await page.goto(baseUrl.href, { waitUntil: 'load' });
    await todos.getByText(targets.at(-1).remove.description, { exact: true }).waitFor();
    await settle('first load');

    for (let run = 1; run <= runs; run++) {
      const t = targets[run - 1];
      const trigger = 'pointerdown';

      // add: type, then Enter.
      await page.getByRole('textbox', { name: 'New todo' }).fill(t.added);
      own.add(t.added);
      await measure('add', run, { trigger: 'keydown', text: t.added }, () => page.keyboard.press('Enter'));

      // edit: Edit opened and the new text filled untimed, then Enter.
      await press(todos.getByRole('button', { name: `Edit “${t.edit.description}”`, exact: true }));
      const field = todos.getByRole('textbox', { name: 'Edit description', exact: true });
      await field.fill(t.edited);
      own.add(t.edited);
      await measure('edit', run, { trigger: 'keydown', text: t.edited, id: t.edit.id }, () => page.keyboard.press('Enter'));

      // complete, then reactivate: the Completion check.
      const check = todos.getByRole('checkbox', { name: t.toggle.description, exact: true });
      await measure('complete', run, { trigger, id: t.toggle.id }, () => press(check));
      await measure('reactivate', run, { trigger, id: t.toggle.id }, () => press(check));

      // delete: Delete and its confirm opened untimed, then Confirm delete.
      await press(todos.getByRole('button', { name: `Delete “${t.remove.description}”`, exact: true }));
      const confirm = todos.getByRole('group', { name: `Delete this todo? ${t.remove.description}`, exact: true });
      await measure('delete', run, { trigger, id: t.remove.id }, () =>
        press(confirm.getByRole('button', { name: `Delete “${t.remove.description}”`, exact: true })),
      );
    }
    await context.close();
  }
} catch (error) {
  aborted = error;
} finally {
  await browser.close().catch(() => {});
  // Clean up: only the todos this run created (by id, or by a description it chose).
  // A clean-up error is a warning: it never replaces the run's own failure.
  try {
    const listed = await api('GET', '/api/todos');
    for (const todo of listed) {
      if (ownIds.has(todo.id) || own.has(todo.description)) await api('DELETE', `/api/todos/${encodeURIComponent(todo.id)}`);
    }
  } catch (error) {
    console.error(`perf:actions: clean-up incomplete: ${error.message}`);
  }
}

if (aborted) fail(aborted.message);

const ms = (v) => v.toFixed(1);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const runHeads = Array.from({ length: runs }, (_, i) => i + 1);
const failures = [];
for (const [profile, byAction] of Object.entries(results)) {
  for (const [key, title] of [
    ['dom', 'input → change in the DOM'],
    ['frame', `input → painted frame (bar: every run < ${BAR_MS} ms)`],
  ]) {
    console.log(`\n### ${profile}: ${title} (ms)\n`);
    console.log(`| Action | ${runHeads.join(' | ')} | Median | Max |`);
    console.log(`|---|${runHeads.map(() => '---|').join('')}---|---|`);
    for (const action of ACTIONS) {
      const values = byAction[action].map((r) => r[key]);
      console.log(`| ${action} | ${values.map(ms).join(' | ')} | ${ms(median(values))} | ${ms(Math.max(...values))} |`);
      if (key === 'frame') {
        values.forEach((v, i) => {
          if (v >= BAR_MS) failures.push(`${action}, ${profile}, run ${i + 1}: ${ms(v)} ms to the painted frame`);
        });
      }
    }
  }
}
if (failures.length > 0) fail(`at or over ${BAR_MS} ms: ${failures.join('; ')}`);
console.log(`\nEvery run of every action showed within ${BAR_MS} ms.`);
