import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { todos } from '../../src/db/schema.ts';
import { expectDocumented, expectDocumentedNoContent } from '../openapi-schema.ts';
import { startHarness, type Harness } from './harness.ts';
import { expectNothingLeaked, expectValidationProblem } from './todo-checks.ts';

/** The documented path template of a single todo (I9). */
const TODO_PATH = '/api/todos/{id}';
const CREATED_AT = Date.parse('2026-11-24T08:30:00.000Z');

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.db.delete(todos).run();
});

/** Stores a todo directly, with a fixed creation time, and returns its row. */
function seed(description = 'Buy milk', completed = false, id: string = randomUUID()) {
  const row = { id, description, completed, createdAt: CREATED_AT };
  harness.db.insert(todos).values(row).run();
  return row;
}

function storedRows() {
  return harness.db.select().from(todos).all();
}

function todoUrl(id: string): string {
  return `/api/todos/${encodeURIComponent(id)}`;
}

function patch(id: string, payload?: unknown, headers?: Record<string, string>): Promise<LightMyRequestResponse> {
  return harness.app.inject({
    method: 'PATCH',
    url: todoUrl(id),
    headers,
    ...(payload === undefined ? {} : typeof payload === 'string' ? { payload } : { payload: payload as object }),
  });
}

function remove(id: string): Promise<LightMyRequestResponse> {
  return harness.app.inject({ method: 'DELETE', url: todoUrl(id) });
}

async function listed(): Promise<unknown[]> {
  const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });
  expect(response.statusCode).toBe(200);
  expectDocumented('/api/todos', 'get', 200, response.headers['content-type'], response.json());
  return response.json();
}

/** A PATCH answered 200, documented (I9), whose body is the stored todo. */
function expectUpdated(response: LightMyRequestResponse) {
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expectDocumented(TODO_PATH, 'patch', 200, response.headers['content-type'], body);
  return body;
}

/** A not-found problem, documented for the method (I9). */
function expectNotFound(response: LightMyRequestResponse, method: 'patch' | 'delete'): void {
  expect(response.statusCode).toBe(404);
  const body = response.json();
  expectDocumented(TODO_PATH, method, 404, response.headers['content-type'], body);
  expect(body).toEqual({ type: '/problems/not-found', title: expect.any(String), status: 404, detail: expect.any(String) });
}

describe('PATCH /api/todos/{id} updates a todo', () => {
  it('I4 completes a todo, returns it whole, and stores it, leaving its description and creation time unchanged', async () => {
    const row = seed('Buy milk');

    const response = await patch(row.id, { completed: true });

    expect(expectUpdated(response)).toEqual({
      id: row.id,
      description: 'Buy milk',
      completed: true,
      createdAt: new Date(CREATED_AT).toISOString(),
    });
    expect(storedRows()).toEqual([{ ...row, completed: true }]);
  });

  it('I4 reactivates a completed todo', async () => {
    const row = seed('Buy milk', true);

    const response = await patch(row.id, { completed: false });

    expect(expectUpdated(response)).toMatchObject({ id: row.id, completed: false });
    expect(storedRows()).toEqual([{ ...row, completed: false }]);
  });

  it('I4 stores and returns an edited description trimmed, leaving completion and creation time unchanged', async () => {
    const row = seed('Buy milk', true);

    const response = await patch(row.id, { description: '  New  ' });

    expect(expectUpdated(response)).toEqual({
      id: row.id,
      description: 'New',
      completed: true,
      createdAt: new Date(CREATED_AT).toISOString(),
    });
    expect(storedRows()).toEqual([{ ...row, description: 'New' }]);
  });

  it('I4 trims a padded description of 200 code points before the length rule, and stores it', async () => {
    const row = seed('Buy milk');
    const description = 'x'.repeat(200);

    const response = await patch(row.id, { description: `  ${description}  ` });

    expect(expectUpdated(response)).toMatchObject({ id: row.id, description });
    expect(storedRows()).toEqual([{ ...row, description }]);
  });

  it('I4 stores both fields when a PATCH sends both', async () => {
    const row = seed('Buy milk');

    const response = await patch(row.id, { description: 'Buy oat milk', completed: true });

    expect(expectUpdated(response)).toMatchObject({ id: row.id, description: 'Buy oat milk', completed: true });
    expect(storedRows()).toEqual([{ ...row, description: 'Buy oat milk', completed: true }]);
  });

  it('I4 changes only the todo it names', async () => {
    const target = seed('Buy milk');
    const other = seed('Call mum');

    expectUpdated(await patch(target.id, { completed: true }));

    expect(storedRows()).toEqual(expect.arrayContaining([{ ...target, completed: true }, other]));
  });

  it('I4 lists an updated todo as stored', async () => {
    const row = seed('Buy milk');
    expectUpdated(await patch(row.id, { description: 'Buy bread', completed: true }));

    expect(await listed()).toEqual([expect.objectContaining({ id: row.id, description: 'Buy bread', completed: true })]);
  });
});

describe('PATCH /api/todos/{id} refuses an invalid update', () => {
  const descriptions: { name: string; description: string }[] = [
    { name: 'an empty description', description: '' },
    { name: 'a whitespace-only description', description: ' \t\n ' },
    { name: 'a spaces-only description', description: '   ' },
    { name: 'a description of 201 code points', description: 'x'.repeat(201) },
  ];

  it.each(descriptions)('I4 a PATCH carrying $name is refused with a validation problem naming description, and changes nothing', async ({ description }) => {
    const row = seed();

    const response = await patch(row.id, { description });

    expectValidationProblem(response, TODO_PATH, 'patch', 'description');
    expectNothingLeaked(response, 'Buy milk');
    expect(storedRows()).toEqual([row]);
  });

  it.each(descriptions)('I4 a PATCH carrying $name beside a valid completed is refused, and changes nothing', async ({ description }) => {
    const row = seed();

    const response = await patch(row.id, { completed: true, description });

    expectValidationProblem(response, TODO_PATH, 'patch', 'description');
    expect(storedRows()).toEqual([row]);
  });

  const empty: { name: string; payload?: unknown; headers?: Record<string, string> }[] = [
    { name: 'an empty object', payload: {} },
    { name: 'no body' },
    { name: 'an empty JSON body', payload: '', headers: { 'content-type': 'application/json' } },
    { name: 'a null body', payload: 'null', headers: { 'content-type': 'application/json' } },
    { name: 'an array body', payload: [{ completed: true }] },
    { name: 'malformed JSON', payload: '{"completed": true', headers: { 'content-type': 'application/json' } },
    { name: 'a non-JSON media type', payload: 'completed', headers: { 'content-type': 'application/xml' } },
  ];

  it.each(empty)('I11 a PATCH carrying $name is refused with a validation problem naming no field, and changes nothing', async ({ payload, headers }) => {
    const row = seed();

    const response = await patch(row.id, payload, headers);

    expectValidationProblem(response, TODO_PATH, 'patch');
    expect(storedRows()).toEqual([row]);
  });

  const strict: { name: string; payload: unknown; field: string }[] = [
    { name: 'an unknown field', payload: { completed: true, title: 'x' }, field: 'title' },
    { name: 'an id in the body', payload: { id: randomUUID(), completed: true }, field: 'id' },
    { name: 'a null completed', payload: { completed: null }, field: 'completed' },
    { name: 'a null description', payload: { description: null }, field: 'description' },
    { name: 'a string completed', payload: { completed: 'true' }, field: 'completed' },
    { name: 'a numeric completed', payload: { completed: 1 }, field: 'completed' },
    { name: 'a numeric description', payload: { description: 123 }, field: 'description' },
    { name: 'a boolean description', payload: { description: true }, field: 'description' },
  ];

  it.each(strict)('I11 a PATCH carrying $name is refused instead of coerced or stripped, and changes nothing', async ({ payload, field }) => {
    const row = seed();

    const response = await patch(row.id, payload);

    expectValidationProblem(response, TODO_PATH, 'patch', field);
    expect(storedRows()).toEqual([row]);
  });

  const controls: { name: string; description: string }[] = [
    { name: 'a line feed', description: 'Buy\nbread' },
    { name: 'a carriage return', description: 'Buy\rbread' },
    { name: 'a tab', description: 'Buy\tbread' },
    { name: 'NUL', description: 'Buy\u0000bread' },
    { name: 'DEL (U+007F)', description: 'Buy\u007fbread' },
    { name: 'NEL (U+0085)', description: 'Buy\u0085bread' },
    { name: 'U+2028', description: 'Buy\u2028bread' },
    { name: 'U+2029', description: 'Buy\u2029bread' },
  ];

  it.each(controls)('I11 a PATCH whose trimmed description still holds $name, beside a valid completed, is refused, never normalised', async ({
    description,
  }) => {
    const row = seed();

    const response = await patch(row.id, { completed: true, description: `  ${description}  ` });

    expectValidationProblem(response, TODO_PATH, 'patch', 'description');
    expectNothingLeaked(response, 'Buy', 'bread');
    expect(storedRows()).toEqual([row]);
  });
});

describe('PATCH and DELETE of an id with no stored todo', () => {
  // `also` adds a scenario id after the leading I4 or I5: the injection-string id is I8 too.
  const ids: { name: string; id: string; also: string }[] = [
    { name: 'an unknown UUID', id: randomUUID(), also: '' },
    { name: 'a non-UUID string', id: 'not-a-uuid', also: '' },
    { name: 'a query-injection string', id: "' OR 1=1 --", also: ' I8' },
  ];

  it.each(ids)('I4$also answers a PATCH to $name with a not-found problem and changes nothing', async ({ id }) => {
    const row = seed();

    const response = await patch(id, { description: 'Secret plan', completed: true });

    expectNotFound(response, 'patch');
    expectNothingLeaked(response, 'Secret plan');
    expect(storedRows()).toEqual([row]);
  });

  it.each(ids)('I5$also answers a DELETE of $name with a not-found problem and deletes nothing', async ({ id }) => {
    const row = seed();

    const response = await remove(id);

    expectNotFound(response, 'delete');
    expectNothingLeaked(response, 'Buy milk');
    expect(storedRows()).toEqual([row]);
  });
});

describe('DELETE /api/todos/{id} deletes a todo', () => {
  it('I5 answers 204 with no content, and the todo is no longer stored or listed', async () => {
    const row = seed('Buy milk');
    const other = seed('Call mum');

    const response = await remove(row.id);

    expect(response.statusCode).toBe(204);
    expectDocumentedNoContent(TODO_PATH, 'delete', 204, response.headers['content-type'], response.body);
    expect(storedRows()).toEqual([other]);
    expect(await listed()).toEqual([expect.objectContaining({ id: other.id })]);
  });

  it('I5 answers a second DELETE, and a PATCH, of a deleted todo with a not-found problem', async () => {
    const row = seed('Buy milk');
    expect((await remove(row.id)).statusCode).toBe(204);

    expectNotFound(await remove(row.id), 'delete');
    expectNotFound(await patch(row.id, { completed: true }), 'patch');
    expect(storedRows()).toEqual([]);
  });
});

describe('injection payloads are inert text on update', () => {
  const payloads = ['<script>alert(1)</script>', "'); DROP TABLE todos;--", '" OR 1=1 --', '<img src=x onerror=alert(1)>'];

  it.each(payloads)('I8 a PATCH stores, returns and lists %s exactly, with the table intact', async (description) => {
    const row = seed('Buy milk');
    const other = seed('Call mum');

    const response = await patch(row.id, { description });

    expect(expectUpdated(response)).toMatchObject({ id: row.id, description });
    expect(await listed()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: row.id, description }),
        expect.objectContaining({ id: other.id, description: 'Call mum' }),
      ]),
    );
    expect(storedRows()).toEqual(expect.arrayContaining([{ ...row, description }, other]));
    expect(storedRows()).toHaveLength(2);
  });
});
