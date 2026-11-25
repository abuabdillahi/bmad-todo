import { randomUUID } from 'node:crypto';
import { contractValidator, expectDocumented, expectValid, type Method } from '../openapi-schema.ts';

/**
 * C9's contract suite (AD-20): every response from the running test profile,
 * reached through web-test's origin, is validated against the committed
 * openapi.json with Ajv2020 and ajv-formats, by its status and media type.
 */

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) throw new Error('E2E_BASE_URL must point at web-test, e.g. http://127.0.0.1:8081');

interface CallResult {
  status: number;
  contentType: string | null;
  json: unknown;
}

async function call(method: Method, path: string, body?: unknown): Promise<CallResult> {
  const response = await fetch(new URL(path, baseUrl), {
    method: method.toUpperCase(),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type');
  expect(contentType).toMatch(/^application\/(problem\+)?json/);
  return { status: response.status, contentType, json: await response.json() };
}

describe('contract: /api through web-test', () => {
  it('I9 GET /api/health answers 200 as the contract says', async () => {
    const response = await call('get', '/api/health');

    expect(response.status).toBe(200);
    expectDocumented('/api/health', 'get', 200, response.contentType, response.json);
  });

  it('I9 POST /api/todos answers 201 as the contract says', async () => {
    const body = { id: randomUUID(), description: `I9 contract ${Date.now()}` };
    expectValid(contractValidator('/api/todos', 'post', 'request'), body);

    const response = await call('post', '/api/todos', body);

    expect(response.status).toBe(201);
    expectDocumented('/api/todos', 'post', 201, response.contentType, response.json);
    expect(response.json).toMatchObject({ ...body, completed: false });
  });

  it('I9 GET /api/todos answers 200 as the contract says', async () => {
    const id = randomUUID();
    await call('post', '/api/todos', { id, description: `I9 contract list ${Date.now()}` });

    const response = await call('get', '/api/todos');

    expect(response.status).toBe(200);
    expectDocumented('/api/todos', 'get', 200, response.contentType, response.json);
    expect(response.json).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it('I9 POST /api/todos answers a replay 200 with the stored todo, as the contract says', async () => {
    const body = { id: randomUUID(), description: `I9 contract replay ${Date.now()}` };
    const first = await call('post', '/api/todos', body);
    expect(first.status).toBe(201);

    const replay = await call('post', '/api/todos', { ...body, description: `  ${body.description}  ` });

    expect(replay.status).toBe(200);
    expectDocumented('/api/todos', 'post', 200, replay.contentType, replay.json);
    expect(replay.json).toEqual(first.json);
  });

  it('I9 POST /api/todos answers an invalid body 400 with a validation problem, as the contract says', async () => {
    const response = await call('post', '/api/todos', { id: randomUUID(), description: 'a\nb', extra: 1 });

    expect(response.status).toBe(400);
    expectDocumented('/api/todos', 'post', 400, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/validation', status: 400 });
  });

  it('I9 POST /api/todos answers a conflicting create 409 with a conflict problem, as the contract says', async () => {
    const id = randomUUID();
    await call('post', '/api/todos', { id, description: `I9 contract conflict ${Date.now()}` });

    const response = await call('post', '/api/todos', { id, description: 'Something else' });

    expect(response.status).toBe(409);
    expectDocumented('/api/todos', 'post', 409, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/conflict', status: 409 });
  });
});
