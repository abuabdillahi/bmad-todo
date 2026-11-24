import { readFileSync } from 'node:fs';
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
});
