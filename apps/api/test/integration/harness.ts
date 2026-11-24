import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';
import { openDatabase, type Db } from '../../src/db/client.ts';
import { runMigrations } from '../../src/db/migrate.ts';

export interface Harness {
  app: FastifyInstance;
  db: Db;
  close(): Promise<void>;
}

/** The API in-process on a temp SQLite file with the committed migrations (AD-20). */
export async function startHarness(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'todo-integration-'));
  const databasePath = join(dir, 'todos.db');
  const db = openDatabase(databasePath);
  runMigrations(db);
  const app = await buildApp({
    config: { appEnv: 'test', port: 3000, databasePath, logLevel: 'silent' },
    db,
  });
  await app.ready();

  return {
    app,
    db,
    async close() {
      await app.close();
      db.$client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
