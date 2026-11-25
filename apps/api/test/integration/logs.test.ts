import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

/**
 * No line the API logs holds todo text, on a successful, refused or failed
 * create, update or delete too (AD-19). The cases run against the real API process, started from server.ts
 * at the `info` level the test and prod profiles use, and read everything it
 * writes to stdout and stderr: the lines the `api` container's log driver keeps.
 * The in-process harness can't capture pino's output without a test-only
 * switch in app code (AD-20).
 */

const serverPath = fileURLToPath(new URL('../../src/server.ts', import.meta.url));
const START_WAIT_MS = 10_000;
const LOG_WAIT_MS = 5_000;
// A write the API makes (insert, update or delete) waits out better-sqlite3's
// 5 s busy timeout before it fails.
const STORAGE_FAILURE_TEST_MS = 20_000;

let dir: string;
let databasePath: string;
let baseUrl: string;
let server: ChildProcess;
let output = '';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => (typeof address === 'object' && address !== null ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

/** Resolves once the output holds `count` lines matching `pattern`. */
async function waitForOutput(pattern: RegExp, count: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((output.match(new RegExp(pattern.source, 'g')) ?? []).length < count) {
    if (Date.now() > deadline) throw new Error(`the API did not log ${pattern} in time; it logged:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function lines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '');
}

/** Sends a request and returns its status and the lines logged while it ran, once the request's completion is logged. */
async function send(method: string, path: string, body?: unknown): Promise<{ status: number; logged: string[] }> {
  const from = output.length;
  const completed = (output.match(/"request completed"/g) ?? []).length;
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await response.arrayBuffer();
  await waitForOutput(/"request completed"/, completed + 1, LOG_WAIT_MS);
  return { status: response.status, logged: lines(output.slice(from)) };
}

function create(id: string, description: string): Promise<{ status: number; logged: string[] }> {
  return send('POST', '/api/todos', { id, description });
}

/** Creates a todo and returns its id. */
async function created(description: string): Promise<string> {
  const id = randomUUID();
  expect((await create(id, description)).status).toBe(201);
  return id;
}

/**
 * Runs `run` while another connection holds the write lock, so the API still
 * reads (WAL) but any write it makes fails once the busy timeout runs out.
 */
async function withWriteLock<T>(run: () => Promise<T>): Promise<T> {
  const lock = new Database(databasePath);
  try {
    lock.exec('BEGIN EXCLUSIVE');
    return await run();
  } finally {
    if (lock.inTransaction) lock.exec('ROLLBACK');
    lock.close();
  }
}

/** Some line among `logged` carries an error. */
function expectErrorLogged(logged: string[]): void {
  expect(logged.some((line) => (JSON.parse(line) as Record<string, unknown>).err !== undefined)).toBe(true);
}

/** No line the API has logged so far holds `marker`. */
function expectNoLineHolds(marker: string): void {
  const all = lines(output);
  expect(all.length).toBeGreaterThan(0);
  for (const line of all) expect(line).not.toContain(marker);
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'todo-logs-'));
  databasePath = join(dir, 'todos.db');
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [serverPath], {
    // Only what the server needs: no inherited APP_ENV, PORT or LOG_LEVEL.
    env: { PATH: process.env.PATH ?? '', APP_ENV: 'test', PORT: String(port), DATABASE_PATH: databasePath, LOG_LEVEL: 'info' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream?.setEncoding('utf8');
    stream?.on('data', (chunk: string) => {
      output += chunk;
    });
  }
  await waitForOutput(/Server listening/, 1, START_WAIT_MS);
}, START_WAIT_MS + 5_000);

afterAll(async () => {
  if (server.exitCode === null && server.signalCode === null) {
    const closed = new Promise((resolve) => server.once('close', resolve));
    server.kill('SIGTERM');
    await closed;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('the API logs no todo text when a create is refused or fails', () => {
  it('I13 a create refused for validation leaves its description out of every log line', async () => {
    const marker = randomUUID();

    const { status } = await create(randomUUID(), `${marker} ${'x'.repeat(200)}`);

    expect(status).toBe(400);
    expectNoLineHolds(marker);
  });

  it('I13 a create refused as a conflict leaves its description out of every log line', async () => {
    const id = randomUUID();
    expect((await create(id, 'Buy milk')).status).toBe(201);
    const marker = randomUUID();

    const { status } = await create(id, `Sell milk ${marker}`);

    expect(status).toBe(409);
    expectNoLineHolds(marker);
  });

  it(
    'I13 a create that fails because storage refuses the write leaves its description out of every log line',
    async () => {
      const marker = randomUUID();
      // The API's lookup still reads, but its insert, which carries the description, fails.
      const result = await withWriteLock(() => create(randomUUID(), `Call mum ${marker}`));

      expect(result.status).toBe(503);
      expectErrorLogged(result.logged);
      expectNoLineHolds(marker);
    },
    STORAGE_FAILURE_TEST_MS,
  );
});

describe('the API logs no todo text when an update or delete succeeds, is refused or fails', () => {
  it('I13 a successful update leaves its description out of every log line', async () => {
    const id = await created('Buy milk');
    const marker = randomUUID();

    const { status } = await send('PATCH', `/api/todos/${id}`, { description: `Buy milk ${marker}`, completed: true });

    expect(status).toBe(200);
    expectNoLineHolds(marker);
  });

  it('I13 an update refused for validation leaves its description out of every log line', async () => {
    const id = await created('Buy milk');
    const marker = randomUUID();

    const { status } = await send('PATCH', `/api/todos/${id}`, { description: `${marker} ${'x'.repeat(200)}` });

    expect(status).toBe(400);
    expectNoLineHolds(marker);
  });

  it('I13 an update to an unknown id leaves its description out of every log line', async () => {
    const marker = randomUUID();

    const { status } = await send('PATCH', `/api/todos/${randomUUID()}`, { description: `Buy milk ${marker}` });

    expect(status).toBe(404);
    expectNoLineHolds(marker);
  });

  it(
    'I13 an update that fails because storage refuses the write leaves its description out of every log line',
    async () => {
      const id = await created('Buy milk');
      const marker = randomUUID();

      const result = await withWriteLock(() => send('PATCH', `/api/todos/${id}`, { description: `Buy milk ${marker}` }));

      expect(result.status).toBe(503);
      expectErrorLogged(result.logged);
      expectNoLineHolds(marker);
    },
    STORAGE_FAILURE_TEST_MS,
  );

  it('I13 a successful delete of a todo whose description holds the marker leaves it out of every log line', async () => {
    const marker = randomUUID();
    const id = await created(`Call mum ${marker}`);

    const { status } = await send('DELETE', `/api/todos/${id}`);

    expect(status).toBe(204);
    expectNoLineHolds(marker);
  });

  it(
    'I13 a delete that fails because storage refuses the write leaves the description of its todo out of every log line',
    async () => {
      const marker = randomUUID();
      const id = await created(`Call mum ${marker}`);

      const result = await withWriteLock(() => send('DELETE', `/api/todos/${id}`));

      expect(result.status).toBe(503);
      expectErrorLogged(result.logged);
      expectNoLineHolds(marker);
    },
    STORAGE_FAILURE_TEST_MS,
  );
});
