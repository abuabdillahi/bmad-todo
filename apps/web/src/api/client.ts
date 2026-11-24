import type { CreateTodoBody, Todo, TodoList } from '@todo/contract';

/** A non-2xx answer from the API. Failure classification (AD-9) arrives with story 5. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `${init.method ?? 'GET'} ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The only web code that sends HTTP (AD-5). Paths are relative `/api/*` (AD-4). */
export function listTodos(signal?: AbortSignal): Promise<TodoList> {
  return request<TodoList>('/api/todos', { method: 'GET', signal });
}

export function createTodo(body: CreateTodoBody): Promise<Todo> {
  return request<Todo>('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
