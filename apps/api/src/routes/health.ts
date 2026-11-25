import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Health } from '@todo/contract';
import { UnavailableError } from '../errors.ts';
import type { TodoRepository } from '../todos/repository.ts';
import { problemResponses } from './problem-responses.ts';

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
        response: {
          200: Health,
          500: problemResponses[500],
          503: problemResponses[503],
        },
      },
    },
    async () => {
      try {
        repository.ping();
      } catch (cause) {
        throw new UnavailableError('storage is unreachable', { cause });
      }
      return { status: 'ok' as const };
    },
  );
};
