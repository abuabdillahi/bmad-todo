import type { CreateTodoBody, Todo } from '@todo/contract';
import type { TodoRepository } from './repository.ts';

/** Newest first: `createdAt` desc, then `id` desc (AD-6). */
export function sortNewestFirst(list: readonly Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (byTime !== 0) return byTime;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

export interface TodoService {
  list(): Todo[];
  create(input: CreateTodoBody): Todo;
}

/** Domain rules for todos; knows nothing about HTTP (AD-10). */
export function createTodoService(repository: TodoRepository): TodoService {
  return {
    list() {
      return sortNewestFirst(repository.list());
    },

    create(input) {
      return repository.create({ id: input.id, description: input.description });
    },
  };
}
