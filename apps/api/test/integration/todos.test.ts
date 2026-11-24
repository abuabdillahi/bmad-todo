import { randomUUID } from 'node:crypto';
import { todos } from '../../src/db/schema.ts';
import { startHarness, type Harness } from './harness.ts';

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
