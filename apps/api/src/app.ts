import fastifySwagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import { healthRoutes } from './routes/health.ts';
import { todosRoutes } from './routes/todos.ts';
import { createTodoRepository } from './todos/repository.ts';
import { createTodoService } from './todos/service.ts';

export interface BuildAppOptions {
  config: Config;
  db: Db;
}

/** Builds the API from its config and database handle (AD-10). It does not listen. */
export async function buildApp({ config, db }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: config.logLevel } });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'BMad Todos API',
        version: '1.0.0',
        description: 'The REST API behind BMad Todos. Every route lives under /api.',
      },
    },
  });

  const repository = createTodoRepository(db);
  const service = createTodoService(repository);

  await app.register(
    async (api) => {
      await api.register(todosRoutes, { service });
      await api.register(healthRoutes, { repository });
    },
    { prefix: '/api' },
  );

  return app;
}
