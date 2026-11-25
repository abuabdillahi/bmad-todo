import { randomUUID } from 'node:crypto';
import { expectDocumented, PROBLEM_MEDIA_TYPE, UNAVAILABLE_BODY, type Method } from '../openapi-schema.ts';
import { expectSecurityHeaders } from '../security-headers.ts';

/**
 * The `contract-unavailable` project: runs from `pnpm test:all` after e2e, with
 * the test profile's `api` container stopped and `web-test` still up. nginx
 * must answer every /api route with AD-4's literal 503 problem, never HTML.
 */

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) throw new Error('E2E_BASE_URL must point at web-test, e.g. http://127.0.0.1:8081');

const WAIT_MS = 30_000;

async function call(method: Method, path: string, body?: unknown): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: method.toUpperCase(),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  // nginx re-resolves `api` within 5 s (AD-4); wait for it to notice the API is gone.
  const deadline = Date.now() + WAIT_MS;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const response = await call('get', '/api/health');
      await response.arrayBuffer();
      if (response.status === 503) return;
      last = String(response.status);
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`/api/health did not answer 503 within ${WAIT_MS / 1000} s (last: ${last})`);
}, WAIT_MS + 5_000);

const todoId = randomUUID();

/** Each route: the URL called, and the path template openapi.json documents it under. */
const routes: { method: Method; url: string; path: string; body?: unknown }[] = [
  { method: 'get', url: '/api/todos', path: '/api/todos' },
  { method: 'post', url: '/api/todos', path: '/api/todos', body: { id: todoId, description: 'I9 api down' } },
  { method: 'patch', url: `/api/todos/${todoId}`, path: '/api/todos/{id}', body: { completed: true } },
  { method: 'delete', url: `/api/todos/${todoId}`, path: '/api/todos/{id}' },
  { method: 'get', url: '/api/health', path: '/api/health' },
];

describe('contract: /api through web-test with the api container stopped', () => {
  it.each(routes)('I9 $method $path answers the unavailable problem from nginx, as the contract says', async ({
    method,
    url,
    path,
    body,
  }) => {
    const response = await call(method, url, body);
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe(PROBLEM_MEDIA_TYPE);
    expect(text).toBe(UNAVAILABLE_BODY);
    expectDocumented(path, method, 503, response.headers.get('content-type'), JSON.parse(text));
  });

  it.each(routes)("I12 $method $path's unavailable problem from nginx carries the AD-19 security headers", async ({
    method,
    url,
    body,
  }) => {
    const response = await call(method, url, body);
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toBe(UNAVAILABLE_BODY);
    expectSecurityHeaders(response);
  });
});
