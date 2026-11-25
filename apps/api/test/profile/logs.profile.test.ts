import { randomUUID } from 'node:crypto';
import { call, compose, createTodo, listTodos } from './stack.ts';

/** The API logs JSON through pino with a UUID request id (AD-17), and never todo text (AD-19). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('profile: the api container logs', () => {
  it('I13 every api log line is JSON, request lines carry a UUID reqId, and no line holds todo text', async () => {
    const marker = randomUUID();
    const todo = await createTodo(randomUUID(), `logs marker ${marker}`);
    await listTodos();
    const updated = await call('PATCH', `/api/todos/${todo.id}`, { description: `logs marker ${marker} edited`, completed: true });
    expect(updated.status).toBe(200);
    await updated.arrayBuffer();
    const deleted = await call('DELETE', `/api/todos/${todo.id}`);
    expect(deleted.status).toBe(204);
    await deleted.arrayBuffer();

    const lines = compose('logs', '--no-color', '--no-log-prefix', 'api')
      .split('\n')
      .filter((line) => line.trim() !== '');
    expect(lines.length).toBeGreaterThan(0);

    const entries = lines.map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new Error(`api log line is not JSON: ${line}`);
      }
    });

    const requestEntries = entries.filter((entry) => 'req' in entry || 'res' in entry);
    expect(requestEntries.length).toBeGreaterThan(0);
    for (const entry of requestEntries) expect(entry.reqId).toMatch(UUID);

    for (const line of lines) expect(line).not.toContain(marker);
  });
});
