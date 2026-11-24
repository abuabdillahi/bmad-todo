import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { openApiPath } from '../../scripts/gen-openapi.ts';

/**
 * C9's contract suite (AD-20): every response from the running test profile,
 * reached through web-test's origin, is validated against the committed
 * openapi.json with Ajv2020 and ajv-formats.
 */

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) throw new Error('E2E_BASE_URL must point at web-test, e.g. http://127.0.0.1:8081');

type Method = 'get' | 'post';

const document = JSON.parse(readFileSync(openApiPath, 'utf8'));
// ajv-formats is CommonJS: under ESM its plugin is the `default` property.
const addFormats = ajvFormats.default;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

function contractSchema(path: string, method: Method, part: 'request' | number): object {
  const operation = document.paths?.[path]?.[method];
  if (!operation) throw new Error(`openapi.json has no ${method.toUpperCase()} ${path}`);
  const content =
    part === 'request' ? operation.requestBody?.content : operation.responses?.[String(part)]?.content;
  const schema = content?.['application/json']?.schema;
  if (!schema) throw new Error(`openapi.json has no JSON schema for ${method.toUpperCase()} ${path} ${part}`);
  return schema;
}

function expectValid(validate: ValidateFunction, value: unknown): void {
  const valid = validate(value);
  expect(validate.errors ?? [], JSON.stringify(value)).toEqual([]);
  expect(valid).toBe(true);
}

async function call(method: Method, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const response = await fetch(new URL(path, baseUrl), {
    method: method.toUpperCase(),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  return { status: response.status, json: await response.json() };
}

describe('contract: /api through web-test', () => {
  it('I9 GET /api/health answers 200 as the contract says', async () => {
    const response = await call('get', '/api/health');

    expect(response.status).toBe(200);
    expectValid(ajv.compile(contractSchema('/api/health', 'get', 200)), response.json);
  });

  it('I9 POST /api/todos answers 201 as the contract says', async () => {
    const body = { id: randomUUID(), description: `I9 contract ${Date.now()}` };
    expectValid(ajv.compile(contractSchema('/api/todos', 'post', 'request')), body);

    const response = await call('post', '/api/todos', body);

    expect(response.status).toBe(201);
    expectValid(ajv.compile(contractSchema('/api/todos', 'post', 201)), response.json);
    expect(response.json).toMatchObject({ ...body, completed: false });
  });

  it('I9 GET /api/todos answers 200 as the contract says', async () => {
    const id = randomUUID();
    await call('post', '/api/todos', { id, description: `I9 contract list ${Date.now()}` });

    const response = await call('get', '/api/todos');

    expect(response.status).toBe(200);
    expectValid(ajv.compile(contractSchema('/api/todos', 'get', 200)), response.json);
    expect(response.json).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });
});
