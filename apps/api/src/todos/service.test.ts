import type { Todo } from '@todo/contract';
import { NotFoundError } from '../errors.ts';
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
      findById: () => undefined,
      create: () => {
        throw new Error('not used');
      },
      update: () => {
        throw new Error('not used');
      },
      remove: () => {
        throw new Error('not used');
      },
      ping: () => {},
    };

    expect(createTodoService(repository).list()).toEqual([newer, older]);
  });
});

/** A repository whose methods throw unless a test overrides them. */
function fakeRepository(overrides: Partial<TodoRepository>): TodoRepository {
  const unused = () => {
    throw new Error('not used');
  };
  return { list: unused, findById: unused, create: unused, update: unused, remove: unused, ping: () => {}, ...overrides };
}

describe('createTodoService update and remove', () => {
  const id = 'a0000000-0000-4000-8000-000000000001';

  it("I4 update passes the id and changes through and returns the repository's todo", () => {
    const updated = { ...todo(id, '2026-11-23T09:00:00.000Z'), completed: true };
    const calls: unknown[] = [];
    const service = createTodoService(
      fakeRepository({
        update: (...args) => {
          calls.push(args);
          return updated;
        },
      }),
    );

    expect(service.update(id, { completed: true })).toBe(updated);
    expect(calls).toEqual([[id, { completed: true }]]);
  });

  it('I4 update throws NotFoundError when the repository updated no row', () => {
    const service = createTodoService(fakeRepository({ update: () => undefined }));

    expect(() => service.update(id, { completed: true })).toThrow(NotFoundError);
  });

  it('I5 remove throws NotFoundError when the repository deleted no row', () => {
    const service = createTodoService(fakeRepository({ remove: () => false }));

    expect(() => service.remove(id)).toThrow(NotFoundError);
  });

  it('I5 remove returns normally when the repository deleted the row', () => {
    const removed: string[] = [];
    const service = createTodoService(
      fakeRepository({
        remove: (removedId) => {
          removed.push(removedId);
          return true;
        },
      }),
    );

    expect(service.remove(id)).toBeUndefined();
    expect(removed).toEqual([id]);
  });
});
