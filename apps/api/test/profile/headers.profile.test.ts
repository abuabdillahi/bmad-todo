import { randomUUID } from 'node:crypto';
import { expectSecurityHeaders, SECURITY_HEADERS } from '../security-headers.ts';
import { call } from './stack.ts';

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
  it.each(['/', '/api/health'])('GET %s carries the AD-19 security headers', async (path) => {
    const response = await call('GET', path);
    await response.arrayBuffer();

    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it('I8 GET / is revalidated on every load (Cache-Control: no-cache)', async () => {
    const { response } = await servedPage();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expectSecurityHeaders(response);
  });

  it("I8 a hashed asset index.html links to carries the AD-19 headers that / carries, and a year's cache", async () => {
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

  it('I8 a missing asset under /assets/ is a 404 with the AD-19 headers, never index.html', async () => {
    const { html } = await servedPage();
    const response = await call('GET', `/assets/missing-${randomUUID()}.js`);
    const body = await response.text();

    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
    expect(body).not.toBe(html);
    expect(body).not.toContain('<div id="root">');
  });
});
