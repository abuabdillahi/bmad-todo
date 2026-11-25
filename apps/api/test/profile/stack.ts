import { execFileSync } from 'node:child_process';
import type { Todo } from '@todo/contract';

/**
 * Helpers for the `profile` project: runs from `pnpm test:all` against the
 * running todo-test project, after e2e and before the api container is
 * stopped. It reaches the API only through web-test's origin (AD-20) and
 * inspects the containers with the docker CLI.
 */

const url = process.env.E2E_BASE_URL;
if (!url) throw new Error('E2E_BASE_URL must point at web-test, e.g. http://127.0.0.1:8081');
export const baseUrl: string = url;

const project = process.env.COMPOSE_PROJECT ?? 'todo-test';
const profile = process.env.COMPOSE_PROFILE ?? 'test';

export function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function compose(...args: string[]): string {
  return docker('compose', '-p', project, '--profile', profile, ...args);
}

export function call(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function createTodo(id: string, description: string): Promise<Todo> {
  const response = await call('POST', '/api/todos', { id, description });
  if (response.status !== 201) throw new Error(`POST /api/todos answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as Todo;
}

export async function listTodos(): Promise<Todo[]> {
  const response = await call('GET', '/api/todos');
  if (response.status !== 200) throw new Error(`GET /api/todos answered ${response.status}`);
  return (await response.json()) as Todo[];
}
