import { call } from './stack.ts';

/** nginx sends a strict CSP and the standard security headers on every response (AD-19). */

const HEADERS: Record<string, string | RegExp> = {
  'content-security-policy': /(^|;\s*)default-src 'self'(;|$)/,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': /camera=\(\)/,
};

describe('profile: web-test security headers', () => {
  it.each(['/', '/api/health'])('GET %s carries the AD-19 security headers', async (path) => {
    const response = await call('GET', path);
    await response.arrayBuffer();

    expect(response.status).toBe(200);
    for (const [name, expected] of Object.entries(HEADERS)) {
      const value = response.headers.get(name);
      expect(value, name).not.toBeNull();
      if (typeof expected === 'string') expect(value, name).toBe(expected);
      else expect(value, name).toMatch(expected);
    }
  });
});
