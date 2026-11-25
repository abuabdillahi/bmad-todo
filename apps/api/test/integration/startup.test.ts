import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Startup validation (AD-16): an invalid variable stops the API before it listens. */

const serverPath = fileURLToPath(new URL('../../src/server.ts', import.meta.url));
const EXIT_WAIT_MS = 10_000;

interface Exit {
  code: number | null;
  stderr: string;
}

function startServer(env: Record<string, string>): Promise<Exit> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      // Only what the server needs: no inherited APP_ENV, PORT or LOG_LEVEL.
      env: { PATH: process.env.PATH ?? '', ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`the server did not exit within ${EXIT_WAIT_MS / 1000} s; stderr: ${stderr}`));
    }, EXIT_WAIT_MS);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

describe('API startup', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-startup-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each(['abc', '0', '70000'])(
    'exits 1 and names PORT when PORT is %j',
    async (port) => {
      const { code, stderr } = await startServer({
        APP_ENV: 'test',
        PORT: port,
        DATABASE_PATH: join(dir, 'todos.db'),
        LOG_LEVEL: 'silent',
      });

      expect(code).toBe(1);
      expect(stderr).toContain('PORT');
    },
    EXIT_WAIT_MS + 5_000,
  );

  it(
    'names every invalid variable before exiting',
    async () => {
      const { code, stderr } = await startServer({
        APP_ENV: 'staging',
        PORT: 'abc',
        DATABASE_PATH: '',
        LOG_LEVEL: 'loud',
      });

      expect(code).toBe(1);
      for (const name of ['APP_ENV', 'PORT', 'DATABASE_PATH', 'LOG_LEVEL']) expect(stderr).toContain(name);
    },
    EXIT_WAIT_MS + 5_000,
  );
});
