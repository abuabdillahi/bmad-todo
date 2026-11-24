import type { Todo } from '@todo/contract';
import { createTodoService, sortNewestFirst } from './service.ts';
import type { TodoRepository } from './repository.ts';

function todo(id: string, createdAt: string): Todo {
  return { id, description: `todo ${id}`, completed: false, createdAt };
}

describe('sortNewestFirst', () => {
  it('U2 sorts todos newest first by creation time', () => {
    const oldest = todo('a0000000-0000-4000-8000-000000000001', '2026-11-23T09:00:00.000Z');
    const middle = todo('a0000000-0000-4000-8000-000000000002', '2026-11-23T10:00:00.000Z');
    const newest = todo('a0000000-0000-4000-8000-000000000003', '2026-11-23T10:00:00.001Z');

    expect(sortNewestFirst([middle, oldest, newest])).toEqual([newest, middle, oldest]);
  });

  it('U2 breaks a tie in creation time by id, highest first', () => {
    const at = '2026-11-23T10:00:00.000Z';
    const low = todo('a0000000-0000-4000-8000-00000000000a', at);
    const high = todo('f0000000-0000-4000-8000-00000000000b', at);

    expect(sortNewestFirst([low, high])).toEqual([high, low]);
  });

  it('U2 leaves the input list untouched', () => {
    const list = [
      todo('a0000000-0000-4000-8000-000000000001', '2026-11-23T09:00:00.000Z'),
      todo('a0000000-0000-4000-8000-000000000002', '2026-11-23T10:00:00.000Z'),
    ];
    const copy = [...list];
    sortNewestFirst(list);
    expect(list).toEqual(copy);
  });
});

describe('createTodoService', () => {
  it('U2 lists what the repository holds, newest first', () => {
    const older = todo('a0000000-0000-4000-8000-000000000001', '2026-11-23T09:00:00.000Z');
    const newer = todo('a0000000-0000-4000-8000-000000000002', '2026-11-23T10:00:00.000Z');
    const repository: TodoRepository = {
      list: () => [older, newer],
      create: () => {
        throw new Error('not used');
      },
      ping: () => {},
    };

    expect(createTodoService(repository).list()).toEqual([newer, older]);
  });
});
