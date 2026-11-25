import { Problem } from '@todo/contract';

/**
 * Problem responses for route schemas, keyed by media type, so the generated
 * openapi.json documents them as `application/problem+json` and Fastify
 * serializes them with the `Problem` schema (AD-5, AD-9).
 */
function problemResponse(description: string) {
  return { description, content: { 'application/problem+json': { schema: Problem } } };
}

export const problemResponses = {
  400: problemResponse('The request is not valid (/problems/validation).'),
  409: problemResponse('The id already exists with a different description (/problems/conflict).'),
  500: problemResponse('An unexpected server error (/problems/internal).'),
  503: problemResponse('The service is unavailable, from the API or from nginx (/problems/unavailable).'),
} as const;
