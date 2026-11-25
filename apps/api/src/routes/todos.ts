import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateTodoBody, Todo, TodoList } from '@todo/contract';
import type { TodoService } from '../todos/service.ts';
import { problemResponses } from './problem-responses.ts';

/** A `Todo` response with its own description in openapi.json. */
function todoResponse(description: string) {
  return { description, content: { 'application/json': { schema: Todo } } };
}

export interface TodosRoutesOptions {
  service: TodoService;
}

export const todosRoutes: FastifyPluginAsyncTypebox<TodosRoutesOptions> = async (app, { service }) => {
  app.get(
    '/todos',
    {
      schema: {
        operationId: 'listTodos',
        summary: 'List every todo, newest first',
        response: {
          200: TodoList,
          500: problemResponses[500],
          503: problemResponses[503],
        },
      },
    },
    async () => service.list(),
  );

  app.post(
    '/todos',
    {
      schema: {
        operationId: 'createTodo',
        summary: 'Create a todo with a client-minted id; a replay of the same create answers 200',
        body: CreateTodoBody,
        response: {
          200: todoResponse('A replay: the id already exists with the same trimmed description (AD-6).'),
          201: todoResponse('The todo was created.'),
          400: problemResponses[400],
          409: problemResponses[409],
          500: problemResponses[500],
          503: problemResponses[503],
        },
      },
      // Trim before the schema runs, so the rule applies to the trimmed value,
      // which is what gets stored (AD-8). Anything else is left to the schema.
      preValidation: async (request) => {
        const body: unknown = request.body;
        if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'description' in body) {
          const { description } = body as { description: unknown };
          if (typeof description === 'string') {
            (body as { description: string }).description = description.trim();
          }
        }
      },
    },
    async (request, reply) => {
      const { todo, created } = service.create(request.body);
      return reply.code(created ? 201 : 200).send(todo);
    },
  );
};
