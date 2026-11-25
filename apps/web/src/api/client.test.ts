import { createTodo, deleteTodo, isCancellation, listTodos, RequestFailure, updateTodo, WRITE_TIMEOUT_MS, type FailureKind } from './client.ts';

/** AD-9 classification, with `fetch` stubbed. */
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body: string, contentType?: string): Response {
  return new Response(body, { status, headers: contentType ? { 'Content-Type': contentType } : {} });
}

function problem(type: string, status: number, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type, title: 'Title', status, detail: 'Detail', ...extra });
}

async function failureOf(promise: Promise<unknown>): Promise<RequestFailure> {
  const error = await promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(RequestFailure);
  return error as RequestFailure;
}

describe('API client failure classification', () => {
  it.each<[string, number, FailureKind]>([
    ['/problems/validation', 400, 'validation'],
    ['/problems/not-found', 404, 'not-found'],
    ['/problems/conflict', 409, 'conflict'],
    ['/problems/unavailable', 503, 'unavailable'],
    ['/problems/internal', 500, 'internal'],
  ])('K7 classifies a %s problem with a charset as its type name', async (type, status, kind) => {
    fetchMock.mockResolvedValue(answer(status, problem(type, status), 'application/problem+json; charset=utf-8'));
    const failure = await failureOf(listTodos());
    expect(failure.kind).toBe(kind);
    expect(failure.namesDescription).toBe(false);
  });

  it('K7 classifies nginx\'s problem without a charset, and matches the media type case-insensitively', async () => {
    fetchMock.mockResolvedValueOnce(answer(503, problem('/problems/unavailable', 503), 'application/problem+json'));
    expect((await failureOf(listTodos())).kind).toBe('unavailable');
    fetchMock.mockResolvedValueOnce(answer(503, problem('/problems/unavailable', 503), 'Application/Problem+JSON'));
    expect((await failureOf(listTodos())).kind).toBe('unavailable');
  });

  it('K7 marks namesDescription only for a validation problem whose errors name description', async () => {
    const withField = problem('/problems/validation', 400, { errors: [{ field: 'description', message: 'too long' }] });
    fetchMock.mockResolvedValueOnce(answer(400, withField, 'application/problem+json; charset=utf-8'));
    const named = await failureOf(createTodo({ id: 'a0000000-0000-4000-8000-000000000001', description: 'x' }));
    expect(named).toMatchObject({ kind: 'validation', namesDescription: true });

    const otherField = problem('/problems/validation', 400, { errors: [{ field: 'id', message: 'bad' }] });
    fetchMock.mockResolvedValueOnce(answer(400, otherField, 'application/problem+json; charset=utf-8'));
    expect(await failureOf(listTodos())).toMatchObject({ kind: 'validation', namesDescription: false });

    const notFound = problem('/problems/not-found', 404, { errors: [{ field: 'description', message: 'x' }] });
    fetchMock.mockResolvedValueOnce(answer(404, notFound, 'application/problem+json; charset=utf-8'));
    expect(await failureOf(listTodos())).toMatchObject({ kind: 'not-found', namesDescription: false });
  });

  it.each([
    ['an HTML 502', answer(502, '<html>Bad gateway</html>', 'text/html')],
    ['a non-problem JSON 500', answer(500, problem('/problems/internal', 500), 'application/json')],
    ['an unknown problem type', answer(500, problem('/problems/teapot', 500), 'application/problem+json; charset=utf-8')],
    ['an inherited property as the type', answer(500, problem('constructor', 500), 'application/problem+json')],
    ['a problem with bad JSON', answer(500, '{not json', 'application/problem+json; charset=utf-8')],
    ['a problem body that is not an object', answer(500, '"text"', 'application/problem+json')],
    ['a response without a content type', new Response(null, { status: 500 })],
  ])('K7 classifies %s as generic', async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    expect((await failureOf(listTodos())).kind).toBe('generic');
  });

  it('K7 classifies a 2xx with an unreadable body as generic', async () => {
    fetchMock.mockResolvedValue(answer(200, '<html>', 'text/html'));
    expect((await failureOf(listTodos())).kind).toBe('generic');
  });

  it('K7 classifies an empty 200 on listTodos as generic, never resolving undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    expect((await failureOf(listTodos())).kind).toBe('generic');
  });

  it('K7 classifies a rejected fetch as network when the signal did not abort', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await failureOf(listTodos(new AbortController().signal))).kind).toBe('network');
    expect((await failureOf(listTodos())).kind).toBe('network');
  });

  it('K7 rethrows a fetch the caller aborted, never classifying it', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchMock.mockImplementation(() => {
      controller.abort();
      return Promise.reject(abortError);
    });
    const error = await listTodos(controller.signal).catch((reason: unknown) => reason);
    expect(error).toBe(abortError);
    expect(isCancellation(error, controller.signal)).toBe(true);
  });

  it('K7 rethrows when the signal aborts while a problem body is read', async () => {
    const controller = new AbortController();
    const response = answer(503, problem('/problems/unavailable', 503), 'application/problem+json');
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.spyOn(response, 'json').mockImplementation(() => {
      controller.abort();
      return Promise.reject(abortError);
    });
    fetchMock.mockResolvedValue(response);
    expect(await listTodos(controller.signal).catch((reason: unknown) => reason)).toBe(abortError);
  });

  it('K7 counts any error as a cancellation once the caller\'s signal has aborted, and none otherwise', () => {
    const controller = new AbortController();
    const failure = new RequestFailure('unavailable', 'x');
    expect(isCancellation(failure, controller.signal)).toBe(false);
    expect(isCancellation(new DOMException('Aborted', 'AbortError'), undefined)).toBe(false);
    controller.abort();
    expect(isCancellation(failure, controller.signal)).toBe(true);
  });

  it('K7 returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(answer(200, '[]', 'application/json; charset=utf-8'));
    expect(await listTodos()).toEqual([]);
  });
});

describe('API client write timeout', () => {
  const body = { id: 'a0000000-0000-4000-8000-000000000001', description: 'Buy milk' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A fetch that never answers, and rejects as fetch does once its signal aborts. */
  function stall(): void {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError')));
        }),
    );
  }

  it('U4 a create with no response for 15 s is aborted and rejects as network, and not before', async () => {
    expect(WRITE_TIMEOUT_MS).toBe(15_000);
    stall();
    let settled: unknown;
    const pending = createTodo(body).then(
      () => (settled = 'resolved'),
      (reason: unknown) => (settled = reason),
    );

    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init!.signal!.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(init!.signal!.aborted).toBe(true);
    expect(settled).toBeInstanceOf(RequestFailure);
    expect((settled as RequestFailure).kind).toBe('network');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('U4 a create whose body stalls past 15 s rejects as network', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const response = answer(201, JSON.stringify({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }), 'application/json');
      vi.spyOn(response, 'json').mockImplementation(
        () => new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))),
      );
      return response;
    });
    const pending = failureOf(createTodo(body));

    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);
    expect((await pending).kind).toBe('network');
  });

  it('U4 a create answered in time resolves and leaves no timer behind', async () => {
    fetchMock.mockResolvedValue(answer(201, JSON.stringify({ ...body, completed: false, createdAt: '2026-11-25T10:00:00.000Z' }), 'application/json'));

    await expect(createTodo(body)).resolves.toMatchObject(body);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('U4 a create failing in time keeps its own kind and leaves no timer behind', async () => {
    fetchMock.mockResolvedValue(answer(503, problem('/problems/unavailable', 503), 'application/problem+json'));

    expect((await failureOf(createTodo(body))).kind).toBe('unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('U4 a delete with no response for 15 s is aborted and rejects as network, and not before', async () => {
    stall();
    let settled: unknown;
    const pending = deleteTodo(body.id).then(
      () => (settled = 'resolved'),
      (reason: unknown) => (settled = reason),
    );

    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(settled).toBeInstanceOf(RequestFailure);
    expect((settled as RequestFailure).kind).toBe('network');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('U4 listTodos passes the caller\'s signal through untouched and arms no timer', async () => {
    stall();
    const controller = new AbortController();
    const pending = listTodos(controller.signal).catch((reason: unknown) => reason);

    expect(fetchMock.mock.calls[0]![1]!.signal).toBe(controller.signal);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS * 2);

    // The caller's own abort still rethrows, never classified.
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(RequestFailure);
    expect(isCancellation(error, controller.signal)).toBe(true);
  });
});

describe('API client update', () => {
  const todo = {
    id: 'a0000000-0000-4000-8000-000000000001',
    description: 'Buy milk',
    completed: true,
    createdAt: '2026-11-25T10:00:00.000Z',
  };

  it('U3 updateTodo sends PATCH to the encoded path with the JSON body and returns the todo', async () => {
    fetchMock.mockResolvedValue(answer(200, JSON.stringify(todo), 'application/json; charset=utf-8'));

    await expect(updateTodo('a/b c?', { completed: true })).resolves.toEqual(todo);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/todos/a%2Fb%20c%3F');
    expect(init!.method).toBe('PATCH');
    expect(init!.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(String(init!.body))).toEqual({ completed: true });
  });

  it('U3 updateTodo rejects a 404 problem as not-found', async () => {
    fetchMock.mockResolvedValue(answer(404, problem('/problems/not-found', 404), 'application/problem+json; charset=utf-8'));

    expect((await failureOf(updateTodo(todo.id, { completed: false }))).kind).toBe('not-found');
  });
});

describe('API client delete', () => {
  const id = 'a0000000-0000-4000-8000-000000000001';

  it('U3 deleteTodo sends DELETE to the encoded path with no body and no Content-Type, and a 204 resolves undefined', async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);

    await expect(deleteTodo('a/b c?')).resolves.toBeUndefined();

    expect(json).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/todos/a%2Fb%20c%3F');
    expect(init!.method).toBe('DELETE');
    expect(init!.body).toBeUndefined();
    expect(init!.headers).toEqual({ Accept: 'application/json' });
  });

  it('U3 deleteTodo resolves undefined on any 2xx without reading its body', async () => {
    const response = new Response('{"unexpected":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const json = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);

    await expect(deleteTodo(id)).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('U3 deleteTodo rejects a 404 problem as not-found', async () => {
    fetchMock.mockResolvedValue(answer(404, problem('/problems/not-found', 404), 'application/problem+json; charset=utf-8'));

    expect((await failureOf(deleteTodo(id))).kind).toBe('not-found');
  });

  it('U3 deleteTodo rejects a 503 problem as unavailable', async () => {
    fetchMock.mockResolvedValue(answer(503, problem('/problems/unavailable', 503), 'application/problem+json'));

    expect((await failureOf(deleteTodo(id))).kind).toBe('unavailable');
  });
});
