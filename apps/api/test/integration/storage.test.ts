import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { todos } from '../../src/db/schema.ts';
import { UnavailableError } from '../../src/errors.ts';
import { createTodoRepository } from '../../src/todos/repository.ts';
import { expectDocumented } from '../openapi-schema.ts';
import { startHarness, type Harness } from './harness.ts';

/** One past the largest epoch ms a Date holds: `toTodo` throws a RangeError, not a storage error. */
const INVALID_CREATED_AT = 8.64e15 + 1;

let harness: Harness;

// Failures are caused in-process through the harness, never by app code (AD-20).
beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.db.delete(todos).run();
});

function post(payload: object): Promise<LightMyRequestResponse> {
  return harness.app.inject({ method: 'POST', url: '/api/todos', payload });
}

/** Runs `run` with SQLite refusing writes, then lets writes through again. */
async function withWritesRefused<T>(run: () => T | Promise<T>): Promise<T> {
  harness.db.$client.pragma('query_only = ON');
  try {
    return await run();
  } finally {
    harness.db.$client.pragma('query_only = OFF');
  }
}

/** Stores a row that storage accepts but the API can't map to a todo. */
function insertUnmappableRow(id: string): void {
  harness.db
    .insert(todos)
    .values({ id, description: 'Unmappable', completed: false, createdAt: INVALID_CREATED_AT })
    .run();
}

function expectProblem(response: LightMyRequestResponse, method: 'get' | 'post', status: number, type: string): void {
  expect(response.statusCode).toBe(status);
  const body = response.json();
  expectDocumented('/api/todos', method, status, response.headers['content-type'], body);
  expect(body).toEqual({ type, title: expect.any(String), status, detail: expect.any(String) });
  expect(response.body).not.toMatch(/stack|sqlite|select |insert |\bat \//i);
}

describe('storage failures on /api/todos', () => {
  it('I9 answers a create that storage refuses to write with 503 unavailable, and stores nothing', async () => {
    const id = randomUUID();
    const description = 'Call the plumber';

    const response = await withWritesRefused(() => post({ id, description }));

    expectProblem(response, 'post', 503, '/problems/unavailable');
    expect(response.body).not.toContain(description);
    const list = await harness.app.inject({ method: 'GET', url: '/api/todos' });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((todo: { id: string }) => todo.id)).not.toContain(id);
  });

  it('I9 answers a list that fails outside storage with a 500 internal problem', async () => {
    insertUnmappableRow(randomUUID());

    const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });

    expectProblem(response, 'get', 500, '/problems/internal');
  });

  it('I9 answers a create that fails outside storage with a 500 internal problem', async () => {
    const id = randomUUID();
    insertUnmappableRow(id);

    const response = await post({ id, description: 'Unmappable' });

    expectProblem(response, 'post', 500, '/problems/internal');
  });

  it('keeps the submitted text out of the unavailable error and its cause', async () => {
    const description = 'Secret birthday present';
    const repository = createTodoRepository(harness.db);

    const error = await withWritesRefused(() => {
      try {
        repository.create({ id: randomUUID(), description });
      } catch (caught) {
        return caught;
      }
      return undefined;
    });

    expect(error).toBeInstanceOf(UnavailableError);
    const unavailable = error as UnavailableError;
    expect(unavailable.message).toEqual(expect.any(String));
    expect(unavailable.message).not.toContain(description);
    expect(unavailable.cause).toBeInstanceOf(Error);
    const cause = unavailable.cause as Error;
    expect(cause.message).not.toContain(description);
    expect(cause.stack ?? '').not.toContain(description);
  });
});
