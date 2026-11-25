import { randomUUID } from 'node:crypto';
import { expectSecurityHeaders, SECURITY_HEADERS } from '../security-headers.ts';
import { call, createTodo } from './stack.ts';

/**
 * nginx sends a strict CSP and the standard security headers on every response
 * (AD-19), in every location: an `add_header` inside one would drop them there.
 */

/** The served index.html, and the first content-hashed asset it links to. */
async function servedPage(): Promise<{ response: Response; html: string; asset: string }> {
  const response = await call('GET', '/');
  const html = await response.text();
  const asset = /(?:src|href)="(\/assets\/[^"]+)"/.exec(html)?.[1];
  if (!asset) throw new Error(`index.html links no /assets/ file:\n${html}`);
  return { response, html, asset };
}

describe('profile: web-test security headers', () => {
  it.each(['/', '/api/health'])('I12 GET %s carries the AD-19 security headers', async (path) => {
    const response = await call('GET', path);
    await response.arrayBuffer();

    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it('I12 GET / is revalidated on every load (Cache-Control: no-cache)', async () => {
    const { response } = await servedPage();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expectSecurityHeaders(response);
  });

  it("I12 a hashed asset index.html links to carries the AD-19 headers that / carries, and a year's cache", async () => {
    const page = await servedPage();
    const response = await call('GET', page.asset);
    await response.arrayBuffer();

    expect(response.status, page.asset).toBe(200);
    expect(response.headers.get('cache-control')).toBe('max-age=31536000');
    expectSecurityHeaders(response);
    for (const name of Object.keys(SECURITY_HEADERS)) {
      expect(response.headers.get(name), name).toBe(page.response.headers.get(name));
    }
  });

  it('I12 a missing asset under /assets/ is a 404 with the AD-19 headers, never index.html', async () => {
    const { html } = await servedPage();
    const response = await call('GET', `/assets/missing-${randomUUID()}.js`);
    const body = await response.text();

    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
    expect(body).not.toBe(html);
    expect(body).not.toContain('<div id="root">');
  });

  it('I12 a PATCH answered 200, 400 and 404 through web-test carries the AD-19 security headers', async () => {
    const todo = await createTodo(randomUUID(), `I12 headers patch ${Date.now()}`);
    const answers: { path: string; body: unknown; status: number }[] = [
      { path: `/api/todos/${todo.id}`, body: { completed: true }, status: 200 },
      { path: `/api/todos/${todo.id}`, body: {}, status: 400 },
      { path: `/api/todos/${randomUUID()}`, body: { completed: true }, status: 404 },
    ];

    for (const { path, body, status } of answers) {
      const response = await call('PATCH', path, body);
      await response.arrayBuffer();

      expect(response.status, `${status}`).toBe(status);
      expectSecurityHeaders(response);
    }
  });

  it('I12 a DELETE answered 204, and a repeat answered 404, through web-test carry the AD-19 security headers', async () => {
    const todo = await createTodo(randomUUID(), `I12 headers delete ${Date.now()}`);

    const deleted = await call('DELETE', `/api/todos/${todo.id}`);
    await deleted.arrayBuffer();
    expect(deleted.status).toBe(204);
    expectSecurityHeaders(deleted);

    const missing = await call('DELETE', `/api/todos/${todo.id}`);
    await missing.arrayBuffer();
    expect(missing.status).toBe(404);
    expectSecurityHeaders(missing);
  });
});
