import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import {
  contractValidator,
  expectDocumented,
  expectDocumentedNoContent,
  expectValid,
  PROBLEM_MEDIA_TYPE,
  VALIDATION_BODY,
  type Method,
} from '../openapi-schema.ts';
import { expectSecurityHeaders } from '../security-headers.ts';

/**
 * C9's contract suite (AD-20): every response from the running test profile,
 * reached through web-test's origin, is validated against the committed
 * openapi.json with Ajv2020 and ajv-formats, by its status and media type.
 */

/** The documented path template of a single todo. */
const TODO_PATH = '/api/todos/{id}';

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) throw new Error('E2E_BASE_URL must point at web-test, e.g. http://127.0.0.1:8081');

interface CallResult {
  status: number;
  contentType: string | null;
  json: unknown;
}

function send(method: Method, path: string, body?: unknown): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: method.toUpperCase(),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(method: Method, path: string, body?: unknown): Promise<CallResult> {
  const response = await send(method, path, body);
  const contentType = response.headers.get('content-type');
  expect(contentType).toMatch(/^application\/(problem\+)?json/);
  return { status: response.status, contentType, json: await response.json() };
}

describe('contract: /api through web-test', () => {
  it('I9 GET /api/health answers 200 as the contract says', async () => {
    const response = await call('get', '/api/health');

    expect(response.status).toBe(200);
    expectDocumented('/api/health', 'get', 200, response.contentType, response.json);
  });

  it('I9 POST /api/todos answers 201 as the contract says', async () => {
    const body = { id: randomUUID(), description: `I9 contract ${Date.now()}` };
    expectValid(contractValidator('/api/todos', 'post', 'request'), body);

    const response = await call('post', '/api/todos', body);

    expect(response.status).toBe(201);
    expectDocumented('/api/todos', 'post', 201, response.contentType, response.json);
    expect(response.json).toMatchObject({ ...body, completed: false });
  });

  it('I9 GET /api/todos answers 200 as the contract says', async () => {
    const id = randomUUID();
    await call('post', '/api/todos', { id, description: `I9 contract list ${Date.now()}` });

    const response = await call('get', '/api/todos');

    expect(response.status).toBe(200);
    expectDocumented('/api/todos', 'get', 200, response.contentType, response.json);
    expect(response.json).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it('I9 POST /api/todos answers a replay 200 with the stored todo, as the contract says', async () => {
    const body = { id: randomUUID(), description: `I9 contract replay ${Date.now()}` };
    const first = await call('post', '/api/todos', body);
    expect(first.status).toBe(201);

    const replay = await call('post', '/api/todos', { ...body, description: `  ${body.description}  ` });

    expect(replay.status).toBe(200);
    expectDocumented('/api/todos', 'post', 200, replay.contentType, replay.json);
    expect(replay.json).toEqual(first.json);
  });

  it('I9 POST /api/todos answers an invalid body 400 with a validation problem, as the contract says', async () => {
    const response = await call('post', '/api/todos', { id: randomUUID(), description: 'a\nb', extra: 1 });

    expect(response.status).toBe(400);
    expectDocumented('/api/todos', 'post', 400, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/validation', status: 400 });
  });

  it('I9 POST /api/todos answers a conflicting create 409 with a conflict problem, as the contract says', async () => {
    const id = randomUUID();
    await call('post', '/api/todos', { id, description: `I9 contract conflict ${Date.now()}` });

    const response = await call('post', '/api/todos', { id, description: 'Something else' });

    expect(response.status).toBe(409);
    expectDocumented('/api/todos', 'post', 409, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/conflict', status: 409 });
  });

  /** Creates a todo through the stack and returns its id. */
  async function created(label: string): Promise<string> {
    const id = randomUUID();
    const response = await call('post', '/api/todos', { id, description: `I9 contract ${label} ${Date.now()}` });
    expect(response.status).toBe(201);
    return id;
  }

  it('I9 PATCH /api/todos/{id} answers 200 with the completed todo, as the contract says', async () => {
    const id = await created('patch');
    const body = { completed: true };
    expectValid(contractValidator(TODO_PATH, 'patch', 'request'), body);

    const response = await call('patch', `/api/todos/${id}`, body);

    expect(response.status).toBe(200);
    expectDocumented(TODO_PATH, 'patch', 200, response.contentType, response.json);
    expect(response.json).toMatchObject({ id, completed: true });
  });

  it('I9 PATCH /api/todos/{id} answers an empty body 400 with a validation problem, as the contract says', async () => {
    const id = await created('patch empty');

    const response = await call('patch', `/api/todos/${id}`, {});

    expect(response.status).toBe(400);
    expectDocumented(TODO_PATH, 'patch', 400, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/validation', status: 400 });
    // The API's own problem passes through nginx untouched: its media type keeps Fastify's charset.
    expect(response.contentType).toBe(`${PROBLEM_MEDIA_TYPE}; charset=utf-8`);
  });

  it('I9 PATCH /api/todos/{id} answers an unknown id 404 with a not-found problem, as the contract says', async () => {
    const response = await call('patch', `/api/todos/${randomUUID()}`, { completed: true });

    expect(response.status).toBe(404);
    expectDocumented(TODO_PATH, 'patch', 404, response.contentType, response.json);
    expect(response.json).toMatchObject({ type: '/problems/not-found', status: 404 });
  });

  it('I9 DELETE /api/todos/{id} answers 204 with no content, then 404 with a not-found problem, as the contract says', async () => {
    const id = await created('delete');

    const deleted = await send('delete', `/api/todos/${id}`);

    expect(deleted.status).toBe(204);
    expectDocumentedNoContent(TODO_PATH, 'delete', 204, deleted.headers.get('content-type'), await deleted.text());

    const repeat = await call('delete', `/api/todos/${id}`);

    expect(repeat.status).toBe(404);
    expectDocumented(TODO_PATH, 'delete', 404, repeat.contentType, repeat.json);
    expect(repeat.json).toMatchObject({ type: '/problems/not-found', status: 404 });
  });

  /**
   * nginx's own 400 and 413 under /api/ (#28): AD-9's validation problem, byte
   * for byte the API's, as application/problem+json with the AD-19 headers.
   * Returns the parsed body for the caller to validate against the contract.
   */
  async function expectNginxValidationProblem(response: Response): Promise<unknown> {
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(PROBLEM_MEDIA_TYPE);
    const text = await response.text();
    expect(text).toBe(VALIDATION_BODY);
    expectSecurityHeaders(response);
    return JSON.parse(text);
  }

  it('I9 I12 POST /api/todos with a body over 1 MiB answers 400 with the validation problem from nginx, as the contract says', async () => {
    const id = randomUUID();
    const body = JSON.stringify({ id, description: 'x' }).padEnd(1024 * 1024 + 1, ' ');
    expect(Buffer.byteLength(body)).toBe(1024 * 1024 + 1);

    const response = await fetch(new URL('/api/todos', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const json = await expectNginxValidationProblem(response);
    expectDocumented('/api/todos', 'post', 400, response.headers.get('content-type'), json);
    const listed = await call('get', '/api/todos');
    expect(listed.json).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it.each(['patch', 'delete'] as const)(
    'I9 I12 %s of /api/todos/%%zz, a malformed percent-encoding, answers 400 with the validation problem from nginx, as the contract says',
    async (method) => {
      const response = await send(method, '/api/todos/%zz', method === 'patch' ? { completed: true } : undefined);

      const json = await expectNginxValidationProblem(response);
      expectDocumented(TODO_PATH, method, 400, response.headers.get('content-type'), json);
    },
  );

  it('I9 I12 GET /api/todos/%zz answers 400 with the validation problem from nginx, not an HTML page', async () => {
    // GET of one todo is not a route, so the contract documents no 400 for it: the body and headers are the check.
    const response = await send('get', '/api/todos/%zz');

    expect(await expectNginxValidationProblem(response)).toEqual(JSON.parse(VALIDATION_BODY));
  });

  it('I9 DELETE /api/todos/{id} with a JSON content type and an empty body answers 400 with a validation problem, as the contract says, and deletes nothing', async () => {
    const id = await created('delete json empty');

    const response = await fetch(new URL(`/api/todos/${id}`, baseUrl), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expectDocumented(TODO_PATH, 'delete', 400, response.headers.get('content-type'), json);
    expect(json).toMatchObject({ type: '/problems/validation', status: 400 });
    const listed = await call('get', '/api/todos');
    expect(listed.json).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  /** Sends `request` as raw bytes to web-test and returns its answer, read until nginx closes the connection. */
  function rawExchange(request: string): Promise<Response> {
    const url = new URL(baseUrl!);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = connect({ host: url.hostname, port: Number(url.port || 80) }, () => socket.end(request));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('error', reject);
      socket.on('close', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const split = raw.indexOf('\r\n\r\n');
        if (split < 0) return reject(new Error(`no complete response head:\n${raw}`));
        const [statusLine, ...headerLines] = raw.slice(0, split).split('\r\n');
        const status = Number(/^HTTP\/1\.[01] (\d{3})/.exec(statusLine ?? '')?.[1]);
        const headers = new Headers();
        for (const line of headerLines) {
          const colon = line.indexOf(':');
          headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
        }
        let body = raw.slice(split + 4);
        const length = headers.get('content-length');
        if (length !== null) body = Buffer.from(body, 'utf8').subarray(0, Number(length)).toString('utf8');
        resolve(new Response(body, { status, headers }));
      });
    });
  }

  it("I9 I12 POST /api/todos with an invalid chunk size answers 400 with the validation problem from location /api/'s own error page", async () => {
    // nginx raises this 400 while reading the body inside location /api/, so only that location's error_page sees it.
    const url = new URL(baseUrl!);
    const response = await rawExchange(
      [
        'POST /api/todos HTTP/1.1',
        `Host: ${url.host}`,
        'Content-Type: application/json',
        'Transfer-Encoding: chunked',
        'Connection: close',
        '',
        'zz',
        '{}',
        '0',
        '',
        '',
      ].join('\r\n'),
    );

    const json = await expectNginxValidationProblem(response);
    expectDocumented('/api/todos', 'post', 400, response.headers.get('content-type'), json);
  });
});
