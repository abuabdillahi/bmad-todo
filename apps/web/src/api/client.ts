import type { CreateTodoBody, ProblemType, Todo, TodoList } from '@todo/contract';

/**
 * The kind name of each problem type (AD-9). Local literals, because the web
 * never imports `@todo/contract` at runtime; `satisfies` checks them against
 * `ProblemType`, so a type added there fails the typecheck here.
 */
const PROBLEM_KINDS = {
  '/problems/validation': 'validation',
  '/problems/not-found': 'not-found',
  '/problems/conflict': 'conflict',
  '/problems/unavailable': 'unavailable',
  '/problems/internal': 'internal',
} as const satisfies { [T in ProblemType]: T extends `/problems/${infer Name}` ? Name : never };

type ProblemKind = (typeof PROBLEM_KINDS)[ProblemType];

/** Every failure is exactly one kind (AD-9): a problem's type name, `network`, or `generic`. */
export type FailureKind = ProblemKind | 'network' | 'generic';

/** A failed request, classified (AD-9). A cancellation is never one of these. */
export class RequestFailure extends Error {
  readonly kind: FailureKind;
  /** True only for a `validation` problem whose `errors` names `description` (AD-14). */
  readonly namesDescription: boolean;

  constructor(kind: FailureKind, message: string, namesDescription = false) {
    super(message);
    this.name = 'RequestFailure';
    this.kind = kind;
    this.namesDescription = namesDescription;
  }
}

/**
 * A request that ends with the caller's own signal aborted is a cancellation,
 * never a failure (AD-11), whatever it threw: an AbortError, the signal's
 * reason, or a classification that lost the race with the abort.
 */
export function isCancellation(_error: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

const PROBLEM_MEDIA_TYPE = 'application/problem+json';

function isProblemMediaType(contentType: string | null): boolean {
  // The API appends `; charset=utf-8` and nginx doesn't; media types are case-insensitive.
  return contentType !== null && contentType.trim().toLowerCase().startsWith(PROBLEM_MEDIA_TYPE);
}

function problemKind(type: unknown): ProblemKind | null {
  return typeof type === 'string' && Object.hasOwn(PROBLEM_KINDS, type)
    ? PROBLEM_KINDS[type as ProblemType]
    : null;
}

function namesDescription(errors: unknown): boolean {
  return (
    Array.isArray(errors) &&
    errors.some((entry) => typeof entry === 'object' && entry !== null && (entry as { field?: unknown }).field === 'description')
  );
}

/** Classifies a non-2xx response: a problem by its `type`, anything else generic (AD-9). */
async function classify(response: Response, label: string, signal: AbortSignal | undefined): Promise<RequestFailure> {
  const message = `${label} answered ${response.status}`;
  if (!isProblemMediaType(response.headers.get('Content-Type'))) {
    return new RequestFailure('generic', message);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    return new RequestFailure('generic', message);
  }
  const problem = typeof body === 'object' && body !== null ? (body as { type?: unknown; errors?: unknown }) : {};
  const kind = problemKind(problem.type);
  if (kind === null) return new RequestFailure('generic', message);
  return new RequestFailure(kind, message, kind === 'validation' && namesDescription(problem.errors));
}

/**
 * How long a write waits for its response before the client gives up, as `network`.
 * nginx answers a stalled API with the unavailable problem after 10 s; this is
 * the backstop for when nginx itself doesn't answer.
 */
export const WRITE_TIMEOUT_MS = 15_000;

async function send<T>(path: string, init: RequestInit, signal: AbortSignal | undefined, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch (error) {
    // The caller's own abort is a cancellation; any other rejection means no response arrived.
    if (isCancellation(error, signal)) throw error;
    throw new RequestFailure('network', `${label} got no response`);
  }
  if (!response.ok) throw await classify(response, label, signal);
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (isCancellation(error, signal)) throw error;
    throw new RequestFailure('generic', `${label} answered ${response.status} with an unreadable body`);
  }
}

/**
 * Sends one request and classifies its failure (AD-9). Every write (any method
 * but GET) is aborted once `WRITE_TIMEOUT_MS` passes before its body is read,
 * and fails as `network` from whatever stage it reached, unless the caller's
 * own signal aborted first: that stays a cancellation. A GET has no timeout.
 */
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const signal = init.signal ?? undefined;
  const method = init.method ?? 'GET';
  const label = `${method} ${path}`;
  if (method === 'GET') return send<T>(path, init, signal, label);

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), WRITE_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  try {
    return await send<T>(path, { ...init, signal: combined }, signal, label);
  } catch (error) {
    if (timeout.signal.aborted && !isCancellation(error, signal)) {
      throw new RequestFailure('network', `${label} got no complete response within ${WRITE_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
