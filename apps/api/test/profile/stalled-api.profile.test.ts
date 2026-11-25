import { randomUUID } from 'node:crypto';
import { PROBLEM_MEDIA_TYPE, UNAVAILABLE_BODY } from '../openapi-schema.ts';
import { expectSecurityHeaders } from '../security-headers.ts';
import { call, compose, listTodos, waitForHealth } from './stack.ts';

/**
 * A stalled API (AD-4): with the api container paused, the kernel still
 * accepts nginx's connection but nothing answers, so only nginx's 10 s read
 * timeout ends the request, as AD-4's literal 503. A create sent during the
 * stall may still be stored once the api resumes; the same id sent again is
 * replayed (AD-6), so the todo is stored once.
 */

const STALL_MIN_MS = 9_000;
const STALL_MAX_MS = 13_000;

const id = randomUUID();
const description = `I10 stalled add ${randomUUID()}`;

function unpause(): void {
  compose('unpause', 'api');
}

afterAll(() => {
  // A safety net if a test failed before its own unpause: the api must not stay paused.
  try {
    unpause();
  } catch {
    // Not paused.
  }
});

describe('profile: the api container stalls', () => {
  it('I9 every /api route answers the unavailable problem from nginx after about 10 s while the api is paused', async () => {
    const routes = [
      { method: 'GET', path: '/api/todos' },
      { method: 'POST', path: '/api/todos', body: { id, description } },
      { method: 'GET', path: '/api/health' },
    ];

    compose('pause', 'api');
    try {
      const answers = await Promise.all(
        routes.map(async ({ method, path, body }) => {
          const started = performance.now();
          const response = await call(method, path, body);
          const text = await response.text();
          return { route: `${method} ${path}`, response, text, elapsed: performance.now() - started };
        }),
      );

      for (const { route, response, text, elapsed } of answers) {
        expect(response.status, route).toBe(503);
        expect(response.headers.get('content-type'), route).toBe(PROBLEM_MEDIA_TYPE);
        expect(text, route).toBe(UNAVAILABLE_BODY);
        expectSecurityHeaders(response);
        expect(elapsed, route).toBeGreaterThanOrEqual(STALL_MIN_MS);
        expect(elapsed, route).toBeLessThanOrEqual(STALL_MAX_MS);
      }
    } finally {
      unpause();
    }
  });

  it('I10 the stalled create sent again with the same id once the api resumes is stored exactly once', async () => {
    await waitForHealth();

    const response = await call('POST', '/api/todos', { id, description });
    const body = (await response.json()) as { id: string; description: string };

    expect([200, 201]).toContain(response.status);
    expect(body).toMatchObject({ id, description });
    expect((await listTodos()).filter((todo) => todo.id === id)).toHaveLength(1);
  });
});
