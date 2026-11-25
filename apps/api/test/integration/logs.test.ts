import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

/**
 * No line the API logs holds todo text, on a refused or failed create too
 * (AD-19). The cases run against the real API process, started from server.ts
 * at the `info` level the test and prod profiles use, and read everything it
 * writes to stdout and stderr: the lines the `api` container's log driver keeps.
 * The in-process harness can't capture pino's output without a test-only
 * switch in app code (AD-20).
 */

const serverPath = fileURLToPath(new URL('../../src/server.ts', import.meta.url));
const START_WAIT_MS = 10_000;
const LOG_WAIT_MS = 5_000;
// The API's insert waits out better-sqlite3's 5 s busy timeout before it fails.
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

/** Sends a create and returns its status and the lines logged while it ran, once the request's completion is logged. */
async function create(id: string, description: string): Promise<{ status: number; logged: string[] }> {
  const from = output.length;
  const completed = (output.match(/"request completed"/g) ?? []).length;
  const response = await fetch(new URL('/api/todos', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, description }),
  });
  await response.arrayBuffer();
  await waitForOutput(/"request completed"/, completed + 1, LOG_WAIT_MS);
  return { status: response.status, logged: lines(output.slice(from)) };
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
  it('I2 a create refused for validation leaves its description out of every log line', async () => {
    const marker = randomUUID();

    const { status } = await create(randomUUID(), `${marker} ${'x'.repeat(200)}`);

    expect(status).toBe(400);
    expectNoLineHolds(marker);
  });

  it('I10 a create refused as a conflict leaves its description out of every log line', async () => {
    const id = randomUUID();
    expect((await create(id, 'Buy milk')).status).toBe(201);
    const marker = randomUUID();

    const { status } = await create(id, `Sell milk ${marker}`);

    expect(status).toBe(409);
    expectNoLineHolds(marker);
  });

  it(
    'I7 a create that fails because storage refuses the write leaves its description out of every log line',
    async () => {
      const marker = randomUUID();
      // Another connection holds the write lock, so the API's lookup still
      // reads (WAL) but its insert, which carries the description, fails.
      const lock = new Database(databasePath);
      let result: { status: number; logged: string[] };
      try {
        lock.exec('BEGIN EXCLUSIVE');
        result = await create(randomUUID(), `Call mum ${marker}`);
      } finally {
        if (lock.inTransaction) lock.exec('ROLLBACK');
        lock.close();
      }

      // Not the exact status: #32 answers this failure 503 instead of 500.
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(result.logged.some((line) => (JSON.parse(line) as Record<string, unknown>).err !== undefined)).toBe(true);
      expectNoLineHolds(marker);
    },
    STORAGE_FAILURE_TEST_MS,
  );
});
