import { randomUUID } from 'node:crypto';
import { call, compose, createTodo, docker, listTodos } from './stack.ts';

/** I6 (R11, AD-2): todos live on the `data` volume, so an API restart keeps them. */

const HEALTH_WAIT_MS = 30_000;

function apiStartedAt(): string {
  const id = compose('ps', '-q', 'api').trim();
  if (!id) throw new Error('the api container is not running');
  return docker('inspect', '-f', '{{.State.StartedAt}}', id).trim();
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_WAIT_MS;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const response = await call('GET', '/api/health');
      await response.arrayBuffer();
      if (response.status === 200) return;
      last = String(response.status);
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`/api/health did not answer 200 within ${HEALTH_WAIT_MS / 1000} s (last: ${last})`);
}

describe('profile: the api container restarts', () => {
  it('I6 a todo created before an API restart is listed unchanged after it', async () => {
    const created = await createTodo(randomUUID(), `I6 survives a restart ${randomUUID()}`);
    const before = apiStartedAt();

    compose('restart', 'api');
    await waitForHealth();

    expect(apiStartedAt()).not.toBe(before);
    const after = (await listTodos()).find((todo) => todo.id === created.id);
    expect(after).toEqual(created);
  });
});
