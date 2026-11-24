import Type from 'typebox';

/** A todo on the wire (AD-7). */
export const Todo = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    description: Type.String(),
    completed: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type Todo = Type.Static<typeof Todo>;

/** Body of `POST /api/todos`. The client mints `id` (AD-7). */
export const CreateTodoBody = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    description: Type.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);
export type CreateTodoBody = Type.Static<typeof CreateTodoBody>;

/** Response of `GET /api/todos`: newest first (AD-6). */
export const TodoList = Type.Array(Todo);
export type TodoList = Type.Static<typeof TodoList>;
