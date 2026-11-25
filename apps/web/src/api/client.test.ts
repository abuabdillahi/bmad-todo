import { createTodo, isCancellation, listTodos, RequestFailure, type FailureKind } from './client.ts';

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
