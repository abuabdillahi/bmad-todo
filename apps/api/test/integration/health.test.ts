import { expectDocumented } from '../openapi-schema.ts';
import { startHarness, type Harness } from './harness.ts';

describe('GET /api/health', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('I7 reports healthy when storage is reachable', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expectDocumented('/api/health', 'get', 200, response.headers['content-type'], response.json());
  });
});

describe('GET /api/health with storage unreachable', () => {
  let harness: Harness;

  // A separate harness whose db handle is closed (AD-20).
  beforeAll(async () => {
    harness = await startHarness();
    harness.db.$client.close();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('I7 reports unhealthy with a 503 unavailable problem, as the contract says', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    const body = response.json();
    expectDocumented('/api/health', 'get', 503, response.headers['content-type'], body);
    expect(body).toEqual({
      type: '/problems/unavailable',
      title: 'Service unavailable',
      status: 503,
      detail: 'The service is unavailable. Try again shortly.',
    });
  });

  it('I9 answers a storage failure on list with a 500 internal problem, with no stack or SQL', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/todos' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expectDocumented('/api/todos', 'get', 500, response.headers['content-type'], body);
    expect(body).toEqual({
      type: '/problems/internal',
      title: expect.any(String),
      status: 500,
      detail: expect.any(String),
    });
    expect(response.body).not.toMatch(/stack|sqlite|database|select /i);
  });
});
