import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.ts';
import { openDatabase } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';

/** The committed contract file (AD-5). */
export const openApiPath = fileURLToPath(
  new URL('../../../packages/contract/openapi.json', import.meta.url),
);

/** Builds the app on a throwaway database and renders its OpenAPI 3.1 document. */
export async function renderOpenApi(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'todo-openapi-'));
  const db = openDatabase(join(dir, 'openapi.db'));
  try {
    runMigrations(db);
    const app = await buildApp({
      config: { appEnv: 'test', port: 3000, databasePath: join(dir, 'openapi.db'), logLevel: 'silent' },
      db,
    });
    await app.ready();
    const document = app.swagger();
    await app.close();
    return `${JSON.stringify(document, null, 2)}\n`;
  } finally {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  writeFileSync(openApiPath, await renderOpenApi());
  console.log(`Wrote ${openApiPath}`);
}
