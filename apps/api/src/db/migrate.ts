import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client.ts';

export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Applies the committed migrations; the server calls it before it listens (AD-15). */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder });
}
