import { randomUUID } from 'node:crypto';
import { compose, createTodo, docker, listTodos, waitForHealth } from './stack.ts';

/** I6 (R11, AD-2): todos live on the `data` volume, so an API restart keeps them. */

function apiStartedAt(): string {
  const id = compose('ps', '-q', 'api').trim();
  if (!id) throw new Error('the api container is not running');
  return docker('inspect', '-f', '{{.State.StartedAt}}', id).trim();
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
