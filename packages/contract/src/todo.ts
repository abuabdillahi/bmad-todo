import Type from 'typebox';
import { DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH, DESCRIPTION_PATTERN } from './description.ts';

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

/**
 * A todo description as the API accepts it, after trimming (AD-8): 1–200
 * code points and no forbidden character. Ajv counts code points for the
 * lengths and compiles the pattern with the `u` flag.
 */
export const Description = Type.String({
  minLength: DESCRIPTION_MIN_LENGTH,
  maxLength: DESCRIPTION_MAX_LENGTH,
  pattern: DESCRIPTION_PATTERN,
});
export type Description = Type.Static<typeof Description>;

/** Body of `POST /api/todos`. The client mints `id` (AD-7). */
export const CreateTodoBody = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    description: Description,
  },
  { additionalProperties: false },
);
export type CreateTodoBody = Type.Static<typeof CreateTodoBody>;

/**
 * Body of `PATCH /api/todos/{id}`: at least one of the two fields (AD-6). The
 * description is held to the same rule as on create, after trimming (AD-8).
 */
export const UpdateTodoBody = Type.Object(
  {
    description: Type.Optional(Description),
    completed: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false, minProperties: 1 },
);
export type UpdateTodoBody = Type.Static<typeof UpdateTodoBody>;

/** Response of `GET /api/todos`: newest first (AD-6). */
export const TodoList = Type.Array(Todo);
export type TodoList = Type.Static<typeof TodoList>;
