// Deliberate failure for story 1.2's Verify (a red push to main deploys nothing). Reverted next.
import { expect, it } from 'vitest';

it('U0 deliberate failure: a red push to main must not deploy', () => {
  expect(1).toBe(2);
});
