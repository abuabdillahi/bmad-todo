#!/usr/bin/env node
// `pnpm a11y:pass` (R14, EXPERIENCE Key Flows › Flow 2): the keyboard-only and
// accessibility-tree pass of every core action, against a local stack.
//
// Chromium at desktop 1280x720, light, reduced motion. Every input is a key
// (`page.keyboard`), never a click. After each key it prints what a screen
// reader is given: the focused element's role, name, description and states
// from Chromium's accessibility tree (CDP `Accessibility.getPartialAXTree`),
// and every change of text in a live region (`role="status"` or `aria-live`),
// recorded by a MutationObserver from before the app's first script runs. At
// each state of the card it prints the card's aria snapshot.
//
// It walks Flow 2 steps 1–6 and its failure path, and checks each expected
// focus target, state and message as it goes (wording from e2e/helpers.ts
// MESSAGES and EXPERIENCE Voice and Tone). It exits non-zero when focus is on
// <body> after a key, when an expected focus target, state or message does not
// appear, when an Announcer message that Flow 2 does not expect appears (or an
// expected one twice), or when the server does not hold what the keys saved
// (read back after step 5 and, after 2 s of quiet, at the end).
// The transcript is the evidence for the accessibility report; a real screen
// reader's speech is not checked (no agent can drive one).
//
// It writes todos, so it refuses any host but a local one (todo-test by
// default). It adds a todo of its own below the one Flow 2 adds, so the delete
// in step 6 never empties the list, and deletes its own todos at the end.
//
// Env: BASE_URL (default http://127.0.0.1:8081).
import { chromium } from '@playwright/test';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const WAIT_MS = 5_000;

function fail(message) {
  console.error(`a11y:pass: ${message}`);
  process.exit(1);
}

const baseUrl = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8081');
// Refuse before any request: this script writes todos, and production data is real.
if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  fail(`refusing ${baseUrl.origin}: only 127.0.0.1, localhost or [::1] (todo-test, todo-dev) may be checked`);
}

/** One API call; throws (never exits) on failure, so the clean-up still runs. */
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

/** `{t}`: cut at 40 code points with "…" inside the quote (EXPERIENCE Voice and Tone; e2e/helpers.ts quoteText). */
function quoteText(description) {
  const points = [...description];
  return points.length <= 40 ? description : `${points.slice(0, 40).join('').trimEnd()}…`;
}

/** The copy this pass expects (e2e/helpers.ts MESSAGES, EXPERIENCE Voice and Tone). */
const MESSAGES = {
  added: (d) => `Added “${quoteText(d)}”.`,
  deleted: (d) => `Deleted “${quoteText(d)}”.`,
  overLimit: 'over the character limit',
  hintAdd: 'Press Enter to add.',
  hintEdit: 'Press Enter to save.',
};

/**
 * Runs in the page before its scripts: records every text change of every live
 * region (`role` status, alert or log, or `aria-live`), labelled by which one
 * it is (EXPERIENCE IA: the Announcer, the Loading status, and each text
 * field's Field status). Any other live region is labelled by its role and
 * counts as an outcome message, so nothing the pass does not expect is missed.
 */
function recordLiveRegions() {
  const log = [];
  window.__live = log;
  const last = new WeakMap();
  const label = (el) => {
    if (el.hasAttribute('data-loading-status')) return 'Loading status';
    if (el.closest('form')) return el.closest('li') ? 'Field status (edit)' : 'Field status (add)';
    if (el.getAttribute('role') === 'status' && el.getAttribute('aria-live') === 'polite') return 'Announcer';
    return `Other live region (${el.getAttribute('role') ?? 'aria-live'})`;
  };
  const scan = () => {
    for (const el of document.querySelectorAll('[role="status"], [role="alert"], [role="log"], [aria-live]')) {
      const text = el.textContent;
      if (!last.has(el)) {
        last.set(el, text);
        if (text === '') continue;
      } else if (last.get(el) === text) continue;
      last.set(el, text);
      log.push({ region: label(el), text, at: performance.now() });
    }
  };
  new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true });
}

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const first = `Send invoice ${stamp}`;
const renamed = `Send March invoice ${stamp}`;
const anchorText = `Pay rent ${stamp}`;
const ownIds = new Set();

let browser;
let page;
let cdp;
let anchor;

let inflight = 0;
/** Waits until no request has been in flight for 250 ms: a person's pace, and every refetch landed. */
async function settle() {
  let quietSince = Date.now();
  while (Date.now() - quietSince < 250) {
    await page.waitForTimeout(25);
    if (inflight > 0) quietSince = Date.now();
  }
}

/** The accessibility-tree node of the element `expression` evaluates to, as a screen reader is given it. */
async function axOf(expression) {
  const { result } = await cdp.send('Runtime.evaluate', { expression });
  if (!result.objectId) return null;
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
  await cdp.send('Runtime.releaseObject', { objectId: result.objectId });
  const node = nodes.find((n) => !n.ignored) ?? nodes[0];
  if (!node) return null;
  const states = {};
  for (const { name, value } of node.properties ?? []) {
    if (['checked', 'invalid', 'expanded', 'disabled', 'multiline', 'focused', 'readonly', 'required'].includes(name)) {
      states[name] = value.value;
    }
  }
  return { role: node.role?.value, name: node.name?.value ?? '', description: node.description?.value ?? '', states };
}

const focused = () => axOf('document.activeElement');
const describe = (ax) => {
  if (ax === null) return '(nothing)';
  const states = Object.entries(ax.states)
    // Every state that is set, plus `checked` either way; `focused` is true of every line.
    .filter(([k, v]) => k === 'checked' || (k !== 'focused' && v !== false && v !== 'false'))
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `${ax.role} "${ax.name}"${ax.description ? `, description "${ax.description}"` : ''}${states ? ` [${states}]` : ''}`;
};

let liveSeen = 0;
/** Live-region changes since the last call. */
async function drainLive() {
  const log = await page.evaluate(() => window.__live);
  const fresh = log.slice(liveSeen);
  liveSeen = log.length;
  return fresh;
}

const transcript = [];
let stepLabel = '';
const out = (line) => {
  transcript.push(line);
  console.log(line);
};

/** Expected Announcer messages not heard yet; `awaitAnnouncements` waits for them. */
const pending = [];

/** Fails the pass, after printing what it was given. */
function failPass(message) {
  throw new Error(`${stepLabel}: ${message}`);
}

/**
 * Presses one key, lets the page settle, then records focus and live-region
 * changes. Fails if focus is on <body>, or if `expect` (role, name, states,
 * description parts) does not match the focused element.
 */
async function key(keys, expect = {}) {
  await page.keyboard.press(keys);
  await settle();
  const onBody = await page.evaluate(() => document.activeElement === document.body || document.activeElement === null);
  const ax = onBody ? null : await focused();
  const live = await drainLive();
  out(`  ${keys.padEnd(11)} → focus: ${onBody ? '<body>' : describe(ax)}`);
  for (const { region, text } of live) out(`  ${''.padEnd(11)}   live, ${region}: ${text === '' ? '(emptied)' : `"${text}"`}`);
  if (onBody) failPass(`focus dropped to <body> after ${keys}`);
  if (expect.role && ax.role !== expect.role) failPass(`expected focus on a ${expect.role}, got ${describe(ax)}`);
  if (expect.name !== undefined && ax.name !== expect.name) failPass(`expected focus on "${expect.name}", got ${describe(ax)}`);
  for (const part of expect.description ?? []) {
    if (!ax.description.includes(part)) failPass(`expected the description to include "${part}", got "${ax.description}"`);
  }
  for (const [state, value] of Object.entries(expect.states ?? {})) {
    if (String(ax.states[state] ?? 'false') !== String(value)) failPass(`expected ${state}=${value}, got ${describe(ax)}`);
  }
  checkAnnouncer(live, expect.announce);
  return { ax, live };
}

/** Text typed or inserted, not a key that moves focus: records the live changes it causes. */
async function input(label, act, { announce } = {}) {
  await act();
  await settle();
  const live = await drainLive();
  out(`  ${label}`);
  for (const { region, text } of live) out(`  ${''.padEnd(11)}   live, ${region}: ${text === '' ? '(emptied)' : `"${text}"`}`);
  checkAnnouncer(live, announce);
  return live;
}

/** Outcome messages: the Announcer's, and any other live region's that is not a field's or the Loading status. */
const outcomes = (live) =>
  live.filter((e) => (e.region === 'Announcer' || e.region.startsWith('Other')) && e.text !== '').map((e) => e.text);

/**
 * The Announcer must say `expected` exactly once (waiting up to 5 s for it if
 * it has not come yet), and nothing else; with no `expected`, it must stay silent.
 */
function checkAnnouncer(live, expected) {
  const said = outcomes(live);
  const unexpected = said.filter((text) => text !== expected);
  if (unexpected.length > 0) failPass(`the Announcer said ${unexpected.map((t) => `"${t}"`).join(', ')}, which Flow 2 does not expect here`);
  const times = said.filter((text) => text === expected).length;
  if (times > 1) failPass(`the Announcer said "${expected}" ${times} times`);
  if (expected !== undefined && times === 0) pending.push(expected);
}

/** Waits for each expected Announcer message that has not come yet. */
async function awaitAnnouncements() {
  while (pending.length > 0) {
    const expected = pending.shift();
    const deadline = Date.now() + WAIT_MS;
    let found = false;
    while (!found && Date.now() < deadline) {
      await page.waitForTimeout(50);
      const live = await drainLive();
      for (const { region, text } of live) out(`  ${''.padEnd(11)}   live, ${region}: ${text === '' ? '(emptied)' : `"${text}"`}`);
      const said = outcomes(live);
      if (said.some((t) => t !== expected)) failPass(`the Announcer said "${said.find((t) => t !== expected)}" while "${expected}" was due`);
      const times = said.filter((t) => t === expected).length;
      if (times > 1) failPass(`the Announcer said "${expected}" ${times} times`);
      found = times === 1;
    }
    if (!found) failPass(`the Announcer never said "${expected}" within ${WAIT_MS / 1000} s`);
  }
}

/** The live card for `id`, not a Leaving copy. */
const card = (id) => page.locator(`ul[aria-label="Todos"] > li[data-todo-id="${id}"]:not([data-leaving])`);

async function snapshot(id, label) {
  const yaml = await card(id).ariaSnapshot();
  out(`  card (${label}):`);
  for (const line of yaml.split('\n')) out(`      ${line}`);
}

function step(label) {
  stepLabel = label;
  out(`\n${label}`);
}

/** The stored todo with this id, read back through the API. */
async function stored(todoId) {
  return (await api('GET', '/api/todos')).find((todo) => todo.id === todoId) ?? null;
}

let failure = null;
try {
  // The todo below Flow 2's own: step 6's delete moves focus to its check.
  anchor = await api('POST', '/api/todos', { id: crypto.randomUUID(), description: anchorText });
  ownIds.add(anchor.id);

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
  await page.addInitScript(recordLiveRegions);
  cdp = await context.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  page.on('request', () => inflight++);
  page.on('requestfinished', () => inflight--);
  page.on('requestfailed', () => inflight--);

  out(`Keyboard and accessibility-tree pass (Flow 2), Chromium ${browser.version()}, 1280x720, light, reduced motion, against ${baseUrl.origin}`);

  step('Step 1: load the page; Tab to the "New todo" field');
  await page.goto(baseUrl.href, { waitUntil: 'load' });
  await page.getByRole('list', { name: 'Todos' }).getByText(anchorText, { exact: true }).waitFor();
  await settle();
  const heading = await axOf('document.querySelector("h1")');
  const title = await page.title();
  out(`  page: title "${title}", heading: ${describe(heading)}`);
  if (heading === null || heading.role !== 'heading' || heading.name !== 'BMad Todos') failPass(`expected the heading "BMad Todos", got ${describe(heading)}`);
  for (const { region, text } of await drainLive()) out(`  live on load, ${region}: "${text}"`);
  await key('Tab', { role: 'textbox', name: 'New todo', description: ['0/200', MESSAGES.hintAdd] });

  step(`Step 2: type "${first}", Enter`);
  await input(`typed "${first}"`, () => page.keyboard.type(first));
  await key('Enter', { role: 'textbox', name: 'New todo', description: ['0/200'], announce: MESSAGES.added(first) });
  await awaitAnnouncements();
  const value = await page.getByRole('textbox', { name: 'New todo' }).inputValue();
  if (value !== '') failPass(`the add field still holds "${value}"`);
  const top = page.locator('ul[aria-label="Todos"] > li:not([data-leaving])').first();
  const id = await top.getAttribute('data-todo-id');
  if (!(await top.textContent()).includes(first)) failPass('the new card is not on top');
  ownIds.add(id);
  out('  the card is on top, and the field is empty ("0/200")');
  await snapshot(id, 'added');

  step('Step 3: Tab, Tab to the check; Space, Space, Space');
  await key('Tab', { role: 'button', name: 'Add' });
  await key('Tab', { role: 'checkbox', name: first, states: { checked: 'false' } });
  await key('Space', { role: 'checkbox', name: first, states: { checked: 'true' } });
  await snapshot(id, 'done');
  await key('Space', { role: 'checkbox', name: first, states: { checked: 'false' } });
  await snapshot(id, 'open');
  await key('Space', { role: 'checkbox', name: first, states: { checked: 'true' } });
  await snapshot(id, 'done');

  step(`Step 4: Tab to Edit; Enter; type "${renamed}"; Enter`);
  await key('Tab', { role: 'button', name: `Edit “${first}”` });
  await key('Enter', { role: 'textbox', name: 'Edit description', description: [`${[...first].length}/200`, MESSAGES.hintEdit] });
  const selected = await page.evaluate(() => {
    const el = document.activeElement;
    return { all: el.selectionStart === 0 && el.selectionEnd === el.value.length, value: el.value };
  });
  out(`  the field holds "${selected.value}", ${selected.all ? 'all of it selected' : 'NOT all selected'}`);
  if (!selected.all || selected.value !== first) failPass('the edit field did not open with the whole text selected');
  await snapshot(id, 'edit mode');
  await input(`typed "${renamed}" over the selection`, () => page.keyboard.type(renamed));
  await key('Enter', { role: 'button', name: `Edit “${renamed}”` });
  await snapshot(id, 'saved');

  step('Step 5: Enter on Edit again; Escape');
  await key('Enter', { role: 'textbox', name: 'Edit description' });
  await key('Escape', { role: 'button', name: `Edit “${renamed}”` });
  await snapshot(id, 'edit cancelled');
  // What steps 3 and 4 saved, read back from the server.
  const afterEdit = await stored(id);
  out(`  stored: ${afterEdit === null ? 'nothing' : `"${afterEdit.description}", completed=${afterEdit.completed}`}`);
  if (afterEdit?.description !== renamed || afterEdit.completed !== true) failPass(`expected "${renamed}" stored as done`);

  step('Step 6: Tab to Delete; Enter; Escape; Enter; Shift+Tab; Enter');
  await key('Tab', { role: 'button', name: `Delete “${renamed}”` });
  await key('Enter', { role: 'button', name: 'Cancel' });
  const group = await axOf('document.activeElement.closest("[role=group]")');
  out(`  the focused Cancel is in: ${group === null ? 'no group' : describe(group)}`);
  if (group?.role !== 'group' || group.name !== `Delete this todo? ${renamed}`) {
    failPass(`expected Cancel inside the group "Delete this todo? ${renamed}"`);
  }
  await snapshot(id, 'Delete confirm');
  await key('Escape', { role: 'button', name: `Delete “${renamed}”` });
  await snapshot(id, 'confirm closed');
  await key('Enter', { role: 'button', name: 'Cancel' });
  await key('Shift+Tab', { role: 'button', name: `Delete “${renamed}”` });
  const inGroup = await page.evaluate(() => document.activeElement.closest('[role=group]') !== null);
  out(`  ${inGroup ? 'this is the Confirm delete button, inside the group' : 'NOT inside the group'}`);
  if (!inGroup) failPass('Shift+Tab did not reach the Confirm delete button');
  // The after-delete rule: the next todo's check, else the previous one's, else the add field.
  const next = await page.evaluate((rowId) => {
    const rows = [...document.querySelectorAll('ul[aria-label="Todos"] > li:not([data-leaving])')];
    const at = rows.findIndex((li) => li.dataset.todoId === rowId);
    if (at === -1) return null;
    const target = rows[at + 1] ?? rows[at - 1];
    return target ? target.querySelector('span[id]')?.textContent ?? null : null;
  }, id);
  if (next === null) failPass('no row follows or precedes this one (or the row is gone), which this pass never expects');
  await key('Enter', { role: 'checkbox', name: next, announce: MESSAGES.deleted(renamed) });
  await awaitAnnouncements();
  const gone = (await card(id).count()) === 0;
  out(`  the row is ${gone ? 'gone' : 'STILL THERE'}; focus is on the next todo's check ("${next}")`);
  if (!gone) failPass('the deleted row is still in the list');

  step('Failure path: Edit the next todo, paste 230 characters, Enter; trim to 200; Enter');
  // Focus is on the next todo's check, this pass's own todo below; its Edit button is the next tab stop.
  if (next !== anchorText) failPass(`the next todo is "${next}", not this pass's own "${anchorText}"`);
  const nextId = anchor.id;
  await key('Tab', { role: 'button', name: `Edit “${next}”` });
  await key('Enter', { role: 'textbox', name: 'Edit description' });
  const long = `${stamp} ${'long text '.repeat(30)}`.slice(0, 230);
  await page.evaluate((text) => navigator.clipboard.writeText(text), long);
  const pasted = await input('pasted 230 characters (ControlOrMeta+V)', () => page.keyboard.press('ControlOrMeta+V'));
  const afterPaste = await focused();
  out(`  focus: ${describe(afterPaste)}`);
  const fieldValue = await page.evaluate(() => document.activeElement.value);
  if ([...fieldValue].length !== 230) failPass(`the paste did not land: the field holds ${[...fieldValue].length} characters`);
  const spokenOnPaste = pasted.filter((e) => e.region === 'Field status (edit)' && e.text === MESSAGES.overLimit).length;
  if (spokenOnPaste !== 1) failPass(`expected "${MESSAGES.overLimit}" once on crossing the limit, heard it ${spokenOnPaste} times`);
  if (afterPaste.states.invalid !== 'true') failPass('the field is not aria-invalid while over the limit');
  if (!afterPaste.description.includes('230/200') || !afterPaste.description.includes(MESSAGES.overLimit)) {
    failPass(`expected the description to give "230/200, over the character limit", got "${afterPaste.description}"`);
  }
  const blocked = await key('Enter', { role: 'textbox', name: 'Edit description', states: { invalid: 'true' } });
  const spokenOnEnter = blocked.live.filter((e) => e.region === 'Field status (edit)' && e.text === MESSAGES.overLimit).length;
  if (spokenOnEnter !== 1) failPass(`expected "${MESSAGES.overLimit}" again on the blocked Enter, heard it ${spokenOnEnter} times`);
  const still = await page.evaluate(() => [...document.activeElement.value].length);
  out(`  nothing saved: the field still holds ${still} characters`);
  // Trim back to 200 with Backspace, one key at a time.
  for (let i = 0; i < 30; i++) await page.keyboard.press('Backspace');
  const trimmed = await input('Backspace ×30 (230 → 200 characters)', () => settle());
  const afterTrim = await focused();
  out(`  focus: ${describe(afterTrim)}`);
  if (afterTrim.states.invalid === 'true') failPass('the field is still aria-invalid at 200 characters');
  if (trimmed.some((e) => e.region === 'Field status (edit)' && e.text !== '')) failPass('the trim was spoken; it should clear silently');
  // The save trims, as every description is (AD-8).
  const saved = long.slice(0, 200).trim();
  await key('Enter', { role: 'button', name: `Edit “${saved}”` });
  await snapshot(nextId, 'saved at 200 characters');

  step('After the pass: 2 s of quiet, then what the server holds');
  // A late failure or rollback would be announced now: nothing may be.
  await page.waitForTimeout(2_000);
  await settle();
  const late = await drainLive();
  for (const { region, text } of late) out(`  live, ${region}: ${text === '' ? '(emptied)' : `"${text}"`}`);
  checkAnnouncer(late, undefined);
  const deletedRow = await stored(id);
  const savedRow = await stored(nextId);
  out(`  stored: the deleted todo ${deletedRow === null ? 'is gone' : 'IS STILL STORED'}; "${anchorText}" is now ${savedRow === null ? 'missing' : `${[...savedRow.description].length} characters, completed=${savedRow.completed}`}`);
  if (deletedRow !== null) failPass('the deleted todo is still stored');
  if (savedRow?.description !== saved) failPass('the 200-character edit was not stored');
} catch (error) {
  failure = error;
} finally {
  await browser?.close().catch(() => {});
  // Clean up every todo of this run: its ids, and any description carrying its stamp
  // (the todo Flow 2 adds through the page). A clean-up error never replaces the pass's own.
  try {
    for (const todo of await api('GET', '/api/todos')) {
      if (ownIds.has(todo.id) || todo.description.includes(stamp)) await api('DELETE', `/api/todos/${encodeURIComponent(todo.id)}`);
    }
  } catch (error) {
    console.error(`a11y:pass: clean-up incomplete: ${error.message}`);
  }
}
if (failure) fail(failure.message);
out('\nEvery step of Flow 2 and its failure path passed: focus never fell to <body>, and every expected focus target, state and message appeared.');
