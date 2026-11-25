import type { CreateTodoBody, Todo, UpdateTodoBody } from '@todo/contract';
import { ConflictError, NotFoundError } from '../errors.ts';
import type { TodoRepository } from './repository.ts';

/** Newest first: `createdAt` desc, then `id` desc (AD-6). */
export function sortNewestFirst(list: readonly Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (byTime !== 0) return byTime;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** The outcome of a create: `created` is false for an idempotent replay (AD-6). */
export interface CreateResult {
  todo: Todo;
  created: boolean;
}

export interface TodoService {
  list(): Todo[];
  /** Throws `ConflictError` when the id exists with a different description. */
  create(input: CreateTodoBody): CreateResult;
  /** Sets the given fields. Throws `NotFoundError` when no todo has this id. */
  update(id: string, changes: UpdateTodoBody): Todo;
  /** Throws `NotFoundError` when no todo has this id. */
  remove(id: string): void;
}

/** Domain rules for todos; knows nothing about HTTP (AD-10). */
export function createTodoService(repository: TodoRepository): TodoService {
  return {
    list() {
      return sortNewestFirst(repository.list());
    },

    // Find, then insert: better-sqlite3 is synchronous and the API is the only
    // writer (AD-2), so nothing runs between the two, and the insert stays one
    // statement (AD-15). `input.description` is already trimmed (AD-8).
    create(input) {
      const existing = repository.findById(input.id);
      if (existing !== undefined) {
        if (existing.description === input.description) return { todo: existing, created: false };
        throw new ConflictError('a todo with this id already exists with a different description');
      }
      return { todo: repository.create({ id: input.id, description: input.description }), created: true };
    },

    // Existence comes from the one write's result, not a read first (AD-15).
    // `changes.description` is already trimmed (AD-8).
    update(id, changes) {
      const todo = repository.update(id, changes);
      if (todo === undefined) throw new NotFoundError('no todo has this id');
      return todo;
    },

    remove(id) {
      if (!repository.remove(id)) throw new NotFoundError('no todo has this id');
    },
  };
}
