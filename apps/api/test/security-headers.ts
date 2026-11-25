import { expect } from 'vitest';

/**
 * The security headers nginx sends on every response (AD-19), as the profile
 * and contract-unavailable suites check them against web-test.
 */
export const SECURITY_HEADERS: Record<string, string | RegExp> = {
  'content-security-policy': /(^|;\s*)default-src 'self'(;|$)/,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': /camera=\(\)/,
  'strict-transport-security': /^max-age=\d+$/,
};

/** Asserts that `response` carries every AD-19 header with an expected value. */
export function expectSecurityHeaders(response: Response): void {
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    const value = response.headers.get(name);
    expect(value, name).not.toBeNull();
    if (typeof expected === 'string') expect(value, name).toBe(expected);
    else expect(value, name).toMatch(expected);
  }
}
