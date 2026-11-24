import { buildApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { openDatabase } from './db/client.ts';
import { runMigrations } from './db/migrate.ts';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const db = openDatabase(config.databasePath);
  runMigrations(db);

  const app = await buildApp({ config, db });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    db.$client.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
