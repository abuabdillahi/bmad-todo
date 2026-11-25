import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyRequest } from 'fastify';
import Type from 'typebox';
import { CreateTodoBody, Todo, TodoList, UpdateTodoBody } from '@todo/contract';
import type { TodoService } from '../todos/service.ts';
import { problemResponses } from './problem-responses.ts';

/** A `Todo` response with its own description in openapi.json. */
function todoResponse(description: string) {
  return { description, content: { 'application/json': { schema: Todo } } };
}

/**
 * The `:id` of a single todo. Not held to the UUID format: an id that is not
 * stored, a non-UUID included, is simply not found (404), and the query is
 * parameterised. One longer than Fastify's `maxParamLength` (100) never reaches
 * the route: Fastify refuses it (its own 414), and the one error handler answers
 * it with the validation problem (400), as it does a malformed percent-encoding.
 */
const TodoParams = Type.Object(
  {
    id: Type.String({
      description: 'The id the client minted when it created the todo. Any id that is not stored answers 404.',
    }),
  },
  { additionalProperties: false },
);

/**
 * Trims a string `description` in the body before the schema runs, so the rule
 * applies to the trimmed value, which is what gets stored (AD-8). Anything
 * else is left to the schema. Shared by create and update.
 */
async function trimDescription(request: FastifyRequest): Promise<void> {
  const body: unknown = request.body;
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'description' in body) {
    const { description } = body as { description: unknown };
    if (typeof description === 'string') {
      (body as { description: string }).description = description.trim();
    }
  }
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
      preValidation: trimDescription,
    },
    async (request, reply) => {
      const { todo, created } = service.create(request.body);
      return reply.code(created ? 201 : 200).send(todo);
    },
  );

  app.patch(
    '/todos/:id',
    {
      schema: {
        operationId: 'updateTodo',
        summary: "Set a todo's description, its completion, or both",
        params: TodoParams,
        body: UpdateTodoBody,
        response: {
          200: todoResponse('The todo was updated.'),
          400: problemResponses[400],
          404: problemResponses[404],
          500: problemResponses[500],
          503: problemResponses[503],
        },
      },
      preValidation: trimDescription,
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    '/todos/:id',
    {
      schema: {
        operationId: 'deleteTodo',
        summary: 'Delete a todo',
        params: TodoParams,
        response: {
          204: Type.Null({ description: 'The todo was deleted.' }),
          400: problemResponses[400],
          404: problemResponses[404],
          500: problemResponses[500],
          503: problemResponses[503],
        },
      },
    },
    async (request, reply) => {
      service.remove(request.params.id);
      return reply.code(204).send(null);
    },
  );
};
