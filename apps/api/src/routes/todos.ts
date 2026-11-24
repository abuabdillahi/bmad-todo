import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateTodoBody, Todo, TodoList } from '@todo/contract';
import type { TodoService } from '../todos/service.ts';

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
        response: { 200: TodoList },
      },
    },
    async () => service.list(),
  );

  app.post(
    '/todos',
    {
      schema: {
        operationId: 'createTodo',
        summary: 'Create a todo with a client-minted id',
        body: CreateTodoBody,
        response: { 201: Todo },
      },
    },
    async (request, reply) => {
      const todo = service.create(request.body);
      return reply.code(201).send(todo);
    },
  );
};
