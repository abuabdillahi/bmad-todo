import { readFileSync } from 'node:fs';
import { Problem } from '@todo/contract';
import { openApiPath, renderOpenApi } from '../../scripts/gen-openapi.ts';

describe('packages/contract/openapi.json', () => {
  it('I9 the committed contract equals the one the API generates', async () => {
    // If this fails, run `pnpm gen:openapi` and commit the result (AD-5).
    expect(readFileSync(openApiPath, 'utf8')).toBe(await renderOpenApi());
  });

  it('I9 documents every route under /api as OpenAPI 3.1', async () => {
    const document = JSON.parse(await renderOpenApi());

    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths).sort()).toEqual(['/api/health', '/api/todos']);
    expect(Object.keys(document.paths['/api/todos']).sort()).toEqual(['get', 'post']);
  });

  it('I9 documents a 503 application/problem+json Problem on every operation (AD-6)', async () => {
    const document = JSON.parse(await renderOpenApi());
    const problemProperties = Object.keys(Problem.properties).sort();

    for (const [path, operations] of Object.entries<Record<string, { responses: Record<string, unknown> }>>(
      document.paths,
    )) {
      for (const [method, operation] of Object.entries(operations)) {
        const response = operation.responses['503'] as
          | { content?: Record<string, { schema?: { properties?: object } }> }
          | undefined;
        const schema = response?.content?.['application/problem+json']?.schema;
        expect(schema, `${method.toUpperCase()} ${path} 503`).toBeDefined();
        expect(Object.keys(schema?.properties ?? {}).sort(), `${method.toUpperCase()} ${path} 503`).toEqual(
          problemProperties,
        );
      }
    }
  });

  it('I9 documents every error of POST /api/todos as a problem and both create answers as a Todo', async () => {
    const document = JSON.parse(await renderOpenApi());
    const responses = document.paths['/api/todos'].post.responses;

    expect(Object.keys(responses).sort()).toEqual(['200', '201', '400', '409', '500', '503']);
    for (const status of ['400', '409', '500', '503']) {
      expect(Object.keys(responses[status].content), status).toEqual(['application/problem+json']);
    }
    for (const status of ['200', '201']) {
      expect(Object.keys(responses[status].content), status).toEqual(['application/json']);
    }
  });
});
