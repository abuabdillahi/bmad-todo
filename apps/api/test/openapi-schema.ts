import { readFileSync } from 'node:fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { expect } from 'vitest';
import { openApiPath } from '../scripts/gen-openapi.ts';

/**
 * Validates values against the committed openapi.json with Ajv2020 and
 * ajv-formats (I9, AD-20). Shared by the contract and integration suites.
 */

export type Method = 'get' | 'post';
export type MediaType = 'application/json' | 'application/problem+json';

export const PROBLEM_MEDIA_TYPE: MediaType = 'application/problem+json';

/** AD-4's literal body, which nginx answers with when the API can't be reached. */
export const UNAVAILABLE_BODY =
  '{"type":"/problems/unavailable","title":"Service unavailable","status":503,"detail":"The service is unavailable. Try again shortly."}';

export const document = JSON.parse(readFileSync(openApiPath, 'utf8'));

// ajv-formats is CommonJS: under ESM its plugin is the `default` property.
const addFormats = ajvFormats.default;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const compiled = new Map<string, ValidateFunction>();

/** The schema openapi.json documents for a request body or a response status, by media type. */
export function contractSchema(
  path: string,
  method: Method,
  part: 'request' | number,
  mediaType: MediaType = 'application/json',
): object {
  const operation = document.paths?.[path]?.[method];
  if (!operation) throw new Error(`openapi.json has no ${method.toUpperCase()} ${path}`);
  const content =
    part === 'request' ? operation.requestBody?.content : operation.responses?.[String(part)]?.content;
  const schema = content?.[mediaType]?.schema;
  if (!schema) {
    throw new Error(`openapi.json has no ${mediaType} schema for ${method.toUpperCase()} ${path} ${part}`);
  }
  return schema;
}

/** A compiled validator for `contractSchema(...)`, cached per schema. */
export function contractValidator(
  path: string,
  method: Method,
  part: 'request' | number,
  mediaType: MediaType = 'application/json',
): ValidateFunction {
  const key = `${method} ${path} ${part} ${mediaType}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(contractSchema(path, method, part, mediaType));
    compiled.set(key, validate);
  }
  return validate;
}

export function expectValid(validate: ValidateFunction, value: unknown): void {
  const valid = validate(value);
  expect(validate.errors ?? [], JSON.stringify(value)).toEqual([]);
  expect(valid).toBe(true);
}

/** Asserts a response is documented: its status and media type exist in openapi.json and the body validates. */
export function expectDocumented(
  path: string,
  method: Method,
  status: number,
  contentType: string | null | undefined,
  body: unknown,
): void {
  const mediaType: MediaType = contentType?.startsWith(PROBLEM_MEDIA_TYPE) ? PROBLEM_MEDIA_TYPE : 'application/json';
  expect(contentType ?? '').toMatch(new RegExp(`^${mediaType.replace('+', '\\+')}`));
  expectValid(contractValidator(path, method, status, mediaType), body);
}
