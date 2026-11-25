import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { todos } from '../../src/db/schema.ts';
import { expectDocumented } from '../openapi-schema.ts';
import { startHarness, type Harness } from './harness.ts';
import { expectNothingLeaked, expectValidationProblem } from './todo-checks.ts';

const ISO_MS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

describe('POST /api/todos', () => {
  it('I1 creates a valid todo, returns it with server fields, and stores it', async () => {
    const id = randomUUID();
    const before = Date.now();

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { id, description: 'Buy milk' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id,
      description: 'Buy milk',
      completed: false,
      createdAt: expect.stringMatching(ISO_MS_UTC),
    });
    const createdAt = Date.parse(body.createdAt);
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(Date.now());

    const rows = harness.db.select().from(todos).all();
    expect(rows).toEqual([{ id, description: 'Buy milk', completed: false, createdAt }]);
  });
});

function post(payload: unknown, headers?: Record<string, string>): Promise<LightMyRequestResponse> {
  return harness.app.inject({
    method: 'POST',
    url: '/api/todos',
    headers,
    ...(typeof payload === 'string' ? { payload } : { payload: payload as object }),
  });
}

function storedRows() {
  return harness.db.select().from(todos).all();
}

describe('POST /api/todos refuses an invalid create', () => {
  const id = 'c0000000-0000-4000-8000-000000000001';

  const invalid: { name: string; payload: unknown; field?: string; headers?: Record<string, string> }[] = [
    { name: 'an empty description', payload: { id, description: '' }, field: 'description' },
    { name: 'a whitespace-only description', payload: { id, description: ' \t\n ' }, field: 'description' },
    { name: 'a spaces-only description', payload: { id, description: '   ' }, field: 'description' },
    { name: 'a description of 201 code points', payload: { id, description: 'x'.repeat(201) }, field: 'description' },
    { name: 'a missing description', payload: { id }, field: 'description' },
    { name: 'a missing id', payload: { description: 'Buy milk' }, field: 'id' },
    { name: 'a malformed id', payload: { id: 'not-a-uuid', description: 'Buy milk' }, field: 'id' },
    { name: 'an array body', payload: [{ id, description: 'Buy milk' }] },
    {
      name: 'malformed JSON',
      payload: '{"id": "c0000000-0000-4000-8000-000000000001", "description": "Buy milk"',
      headers: { 'content-type': 'application/json' },
    },
    { name: 'an empty JSON body', payload: '', headers: { 'content-type': 'application/json' } },
    { name: 'a non-JSON media type', payload: 'Buy milk', headers: { 'content-type': 'application/xml' } },
  ];

  it.each(invalid)('I2 refuses $name with a validation problem and stores nothing', async ({ payload, field, headers }) => {
    const response = await post(payload, headers);

    expectValidationProblem(response, '/api/todos', 'post', field);
    expectNothingLeaked(response, 'Buy milk');
    expect(storedRows()).toEqual([]);
  });

  const strict: { name: string; payload: unknown; field: string }[] = [
    { name: 'an unknown field', payload: { id, description: 'Buy milk', completed: true }, field: 'completed' },
    { name: 'a null description', payload: { id, description: null }, field: 'description' },
    { name: 'a numeric description', payload: { id, description: 123 }, field: 'description' },
    { name: 'a boolean description', payload: { id, description: true }, field: 'description' },
    { name: 'a null id', payload: { id: null, description: 'Buy milk' }, field: 'id' },
  ];

  it.each(strict)('I11 refuses $name instead of coercing or stripping it, and stores nothing', async ({ payload, field }) => {
    const response = await post(payload);

    expectValidationProblem(response, '/api/todos', 'post', field);
    expect(storedRows()).toEqual([]);
  });

  const controls: { name: string; description: string }[] = [
    { name: 'a line feed', description: 'Buy\nmilk' },
    { name: 'a carriage return', description: 'Buy\rmilk' },
    { name: 'a tab', description: 'Buy\tmilk' },
    { name: 'NUL', description: 'Buy\u0000milk' },
    { name: 'DEL (U+007F)', description: 'Buy\u007fmilk' },
    { name: 'NEL (U+0085)', description: 'Buy\u0085milk' },
    { name: 'U+2028', description: 'Buy\u2028milk' },
    { name: 'U+2029', description: 'Buy\u2029milk' },
  ];

  it.each(controls)('I11 refuses a trimmed description still holding $name, never normalising it', async ({ description }) => {
    const response = await post({ id, description: `  ${description}  ` });

    expectValidationProblem(response, '/api/todos', 'post', 'description');
    expectNothingLeaked(response, 'Buy', 'milk');
    expect(storedRows()).toEqual([]);
  });
});

describe('POST /api/todos trims and replays', () => {
  it('I2 stores and returns a padded description trimmed', async () => {
    const id = randomUUID();

    const response = await post({ id, description: '  Buy milk\n' });

    expect(response.statusCode).toBe(201);
    expectDocumented('/api/todos', 'post', 201, response.headers['content-type'], response.json());
    expect(response.json()).toMatchObject({ id, description: 'Buy milk' });
    expect(storedRows()).toEqual([expect.objectContaining({ id, description: 'Buy milk' })]);
  });

  it('I2 trims a padded description of 200 code points before the length rule, and stores it', async () => {
    const id = randomUUID();
    const description = 'x'.repeat(200);

    const response = await post({ id, description: `  ${description}  ` });

    expect(response.statusCode).toBe(201);
    expectDocumented('/api/todos', 'post', 201, response.headers['content-type'], response.json());
    expect(response.json()).toMatchObject({ id, description });
    expect(storedRows()).toEqual([expect.objectContaining({ id, description })]);
  });

  it('I10 answers a replay with the same trimmed description 200 and the stored todo, storing no duplicate', async () => {
    const id = randomUUID();
    const first = await post({ id, description: 'Buy milk' });
    expect(first.statusCode).toBe(201);

    const replay = await post({ id, description: '  Buy milk  ' });

    expect(replay.statusCode).toBe(200);
    expectDocumented('/api/todos', 'post', 200, replay.headers['content-type'], replay.json());
    expect(replay.json()).toEqual(first.json());
    expect(storedRows()).toHaveLength(1);
  });

  it('I10 answers the same id with a different description 409 conflict and leaves the stored todo unchanged', async () => {
    const id = randomUUID();
    await post({ id, description: 'Buy milk' });
    const before = storedRows();

    const response = await post({ id, description: 'Sell milk' });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expectDocumented('/api/todos', 'post', 409, response.headers['content-type'], body);
    expect(body).toEqual({
      type: '/problems/conflict',
      title: expect.any(String),
      status: 409,
      detail: expect.any(String),
    });
    expectNothingLeaked(response, 'Buy milk', 'Sell milk');
    expect(storedRows()).toEqual(before);
  });
});

describe('injection payloads are inert text', () => {
  const payloads = ['<script>alert(1)</script>', "'); DROP TABLE todos;--", '" OR 1=1 --', '<img src=x onerror=alert(1)>'];

  it.each(payloads)('I8 stores, returns and lists %s exactly, with the table intact', async (description) => {
    const id = randomUUID();

    const created = await post({ id, description });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id, description });
    const list = await harness.app.inject({ method: 'GET', url: '/api/todos' });
    expect(list.statusCode).toBe(200);
    expectDocumented('/api/todos', 'get', 200, list.headers['content-type'], list.json());
    expect(list.json()).toEqual([expect.objectContaining({ id, description })]);
    expect(storedRows()).toEqual([expect.objectContaining({ id, description })]);
  });
});

describe('unknown routes', () => {
  it('I9 answers an unknown /api route with a not-found problem', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: '/problems/not-found',
      title: expect.any(String),
      status: 404,
      detail: expect.any(String),
    });
  });
});

describe('malformed URLs', () => {
  it('I9 answers a malformed URL with a validation problem, not Fastify\'s own error', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/todos%E0%A4%A' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: '/problems/validation',
      title: expect.any(String),
      status: 400,
      detail: expect.any(String),
    });
    expect(response.body).not.toContain('%E0');
  });
});

describe('GET /api/todos', () => {
  it('I3 returns an empty list when there are no todos', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('I3 returns every stored todo, newest first, then by id', async () => {
    const at = Date.parse('2026-11-23T10:00:00.000Z');
    const rows = [
      { id: 'a0000000-0000-4000-8000-000000000001', description: 'oldest', completed: false, createdAt: at - 60_000 },
      { id: 'a0000000-0000-4000-8000-000000000002', description: 'tie, low id', completed: false, createdAt: at },
      { id: 'f0000000-0000-4000-8000-000000000003', description: 'tie, high id', completed: false, createdAt: at },
      { id: 'b0000000-0000-4000-8000-000000000004', description: 'newest', completed: true, createdAt: at + 1 },
    ];
    harness.db.insert(todos).values(rows).run();

    const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: rows[3]!.id, description: 'newest', completed: true, createdAt: '2026-11-23T10:00:00.001Z' },
      { id: rows[2]!.id, description: 'tie, high id', completed: false, createdAt: '2026-11-23T10:00:00.000Z' },
      { id: rows[1]!.id, description: 'tie, low id', completed: false, createdAt: '2026-11-23T10:00:00.000Z' },
      { id: rows[0]!.id, description: 'oldest', completed: false, createdAt: '2026-11-23T09:59:00.000Z' },
    ]);
  });

  it('I3 lists a todo created through the API', async () => {
    const id = randomUUID();
    await harness.app.inject({ method: 'POST', url: '/api/todos', payload: { id, description: 'Call mum' } });

    const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });

    expect(response.json()).toEqual([expect.objectContaining({ id, description: 'Call mum', completed: false })]);
  });
});
