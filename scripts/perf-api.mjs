#!/usr/bin/env node
// `pnpm perf:api` (R19, AD-20): one user's API timing against a local stack.
// Sequential requests, a short warm-up, then at least 100 timed requests per
// endpoint (GET /api/health, GET /api/todos with a seeded list, POST
// /api/todos). Prints n, p50, p95, p99 and max per endpoint and exits non-zero
// unless every request succeeded and every p95 is under 300 ms (C4).
//
// It creates todos, so it refuses any host but a local one: run it against
// todo-test (default http://127.0.0.1:8081) or todo-dev (http://127.0.0.1:5173),
// never against production.
//
// Env: BASE_URL (default http://127.0.0.1:8081), PERF_N timed requests per
// endpoint (default 200, minimum 100), PERF_WARMUP (default 20), PERF_SEED list
// size to reach before timing GET /api/todos (default 50). The pass bar is
// fixed at p95 < 300 ms (C4) and cannot be changed from the environment.
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function fail(message) {
  console.error(`perf:api: ${message}`);
  process.exit(1);
}

function intEnv(name, fallback, min) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min) fail(`${name} must be an integer >= ${min} (got ${raw})`);
  return value;
}

const baseUrl = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8081');
// Refuse before any request: this script POSTs, and production data is real.
if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  fail(`refusing ${baseUrl.origin}: only 127.0.0.1 or localhost (todo-test, todo-dev) may be measured`);
}
const n = intEnv('PERF_N', 200, 100);
const warmup = intEnv('PERF_WARMUP', 20, 0);
const seed = intEnv('PERF_SEED', 50, 0);
const p95Bar = 300;

/** One request, body read in full; returns its duration in ms. Exits on failure. */
async function timed(label, method, path, body) {
  const init = {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  const start = performance.now();
  let response;
  let text;
  try {
    response = await fetch(new URL(path, baseUrl), init);
    text = await response.text();
  } catch (error) {
    fail(`${label}: ${baseUrl.origin} unreachable (${error.cause?.code ?? error.message})`);
  }
  const ms = performance.now() - start;
  if (!response.ok) fail(`${label}: answered ${response.status}: ${text.slice(0, 200)}`);
  return { ms, text };
}

function createBody(i) {
  return { id: randomUUID(), description: `perf ${Date.now().toString(36)} ${i}` };
}

/** Nearest-rank percentile of sorted samples. */
function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const endpoints = [
  { label: 'GET /api/health', request: () => ['GET', '/api/health'] },
  { label: 'GET /api/todos', request: () => ['GET', '/api/todos'] },
  { label: 'POST /api/todos', request: (i) => ['POST', '/api/todos', createBody(i)] },
];

// Seed the list so GET /api/todos returns a realistic one. Epic 1 has no
// DELETE, so the list only grows: the size used is measured and printed.
const { text: before } = await timed('GET /api/todos', 'GET', '/api/todos');
for (let i = JSON.parse(before).length; i < seed; i++) {
  await timed('POST /api/todos (seed)', 'POST', '/api/todos', createBody(`seed ${i}`));
}

const results = [];
for (const { label, request } of endpoints) {
  for (let i = 0; i < warmup; i++) await timed(label, ...request(`warm ${i}`));
  let listSize;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const { ms, text } = await timed(label, ...request(i));
    samples.push(ms);
    if (label === 'GET /api/todos' && i === 0) listSize = JSON.parse(text).length;
  }
  samples.sort((a, b) => a - b);
  results.push({
    label,
    n: samples.length,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: samples.at(-1),
    note: listSize === undefined ? '' : `list of ${listSize}`,
  });
}

const fmt = (ms) => ms.toFixed(1).padStart(7);
console.log(`API timing, one user, sequential, against ${baseUrl.origin} (${new Date().toISOString()})`);
console.log(`warm-up ${warmup} per endpoint; ms; pass bar p95 < ${p95Bar} ms\n`);
console.log('| Endpoint         |   n |     p50 |     p95 |     p99 |     max | Result | Note');
console.log('|------------------|-----|---------|---------|---------|---------|--------|-----');
let ok = true;
for (const r of results) {
  const pass = r.p95 < p95Bar;
  ok &&= pass;
  console.log(
    `| ${r.label.padEnd(16)} | ${String(r.n).padStart(3)} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.max)} | ${pass ? 'pass  ' : 'FAIL  '} | ${r.note}`,
  );
}
if (!ok) fail(`a p95 is at or over ${p95Bar} ms`);
