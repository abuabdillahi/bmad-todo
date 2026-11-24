import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Health } from '@todo/contract';
import type { TodoRepository } from '../todos/repository.ts';

export interface HealthRoutesOptions {
  repository: TodoRepository;
}

export const healthRoutes: FastifyPluginAsyncTypebox<HealthRoutesOptions> = async (app, { repository }) => {
  app.get(
    '/health',
    {
      schema: {
        operationId: 'getHealth',
        summary: 'Report whether the API can reach its storage',
        response: { 200: Health },
      },
    },
    async () => {
      repository.ping();
      return { status: 'ok' as const };
    },
  );
};
