import type { LightMyRequestResponse } from 'fastify';
import { expectDocumented, type Method } from '../openapi-schema.ts';

/** A validation problem, documented for `method` on `path` (I9), naming `field` when given. */
export function expectValidationProblem(response: LightMyRequestResponse, path: string, method: Method, field?: string): void {
  expect(response.statusCode).toBe(400);
  const body = response.json();
  expectDocumented(path, method, 400, response.headers['content-type'], body);
  expect(body).toMatchObject({ type: '/problems/validation', title: expect.any(String), status: 400 });
  if (field === undefined) {
    expect(body.errors ?? []).toEqual([]);
  } else {
    expect(body.errors).toEqual([{ field, message: expect.any(String) }]);
  }
}

/** No problem body carries the submitted text, a stack or SQL (AD-9). */
export function expectNothingLeaked(response: LightMyRequestResponse, ...texts: string[]): void {
  for (const text of texts) expect(response.body).not.toContain(text);
  expect(response.body).not.toMatch(/stack|sqlite|select |insert |update |delete |\bat \//i);
}
