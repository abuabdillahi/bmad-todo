import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Problem, ProblemFieldError } from '@todo/contract';
import { ConflictError, NotFoundError, UnavailableError } from './errors.ts';

/** The media type of every problem (RFC 9457, AD-9). */
export const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/**
 * The fixed part of each problem. Titles and details are fixed strings, so no
 * problem carries a stack, SQL or todo text (AD-9). The unavailable detail is
 * the one nginx answers with when the API can't be reached (AD-4).
 */
const PROBLEMS = {
  validation: {
    type: '/problems/validation',
    title: 'Invalid request',
    status: 400,
    detail: 'The request is not valid.',
  },
  notFound: {
    type: '/problems/not-found',
    title: 'Not found',
    status: 404,
    detail: 'The requested resource does not exist.',
  },
  conflict: {
    type: '/problems/conflict',
    title: 'Conflict',
    status: 409,
    detail: 'A todo with this id already exists with a different description.',
  },
  unavailable: {
    type: '/problems/unavailable',
    title: 'Service unavailable',
    status: 503,
    detail: 'The service is unavailable. Try again shortly.',
  },
  internal: {
    type: '/problems/internal',
    title: 'Internal error',
    status: 500,
    detail: 'Something went wrong on the server.',
  },
} as const satisfies Record<string, Problem>;

/** Fixed messages per Ajv keyword: never Ajv's own text, never the submitted value. */
const FIELD_MESSAGES: Record<string, string> = {
  required: 'is required',
  additionalProperties: 'is not allowed',
  type: 'has the wrong type',
  minLength: 'is too short',
  maxLength: 'is too long',
  pattern: 'contains a character that is not allowed',
  format: 'is not in the expected format',
};

type ValidationIssue = NonNullable<FastifyError['validation']>[number];

/** The bare property name an Ajv error is about, or `undefined` when it names none. */
function fieldOf(issue: ValidationIssue): string | undefined {
  const { missingProperty, additionalProperty } = issue.params;
  if (issue.keyword === 'required' && typeof missingProperty === 'string') return missingProperty;
  if (issue.keyword === 'additionalProperties' && typeof additionalProperty === 'string') return additionalProperty;
  const segments = issue.instancePath.split('/').filter((segment) => segment !== '' && !/^\d+$/.test(segment));
  const last = segments.at(-1);
  return last === undefined ? undefined : last.replaceAll('~1', '/').replaceAll('~0', '~');
}

function fieldErrors(validation: FastifyError['validation']): ProblemFieldError[] {
  const errors: ProblemFieldError[] = [];
  for (const issue of validation ?? []) {
    const field = fieldOf(issue);
    if (field === undefined) continue;
    errors.push({ field, message: FIELD_MESSAGES[issue.keyword] ?? 'is not valid' });
  }
  return errors;
}

function isClientError(error: FastifyError): boolean {
  return typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500;
}

function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.code(problem.status).type(PROBLEM_MEDIA_TYPE).send(problem);
}

/** The one error handler: every non-2xx API response is a problem (AD-9). */
export function problemErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (error.validation) {
    const errors = fieldErrors(error.validation);
    return sendProblem(reply, errors.length > 0 ? { ...PROBLEMS.validation, errors } : PROBLEMS.validation);
  }
  if (error instanceof ConflictError) return sendProblem(reply, PROBLEMS.conflict);
  if (error instanceof NotFoundError) return sendProblem(reply, PROBLEMS.notFound);
  if (error instanceof UnavailableError) {
    request.log.warn({ err: error }, 'service unavailable');
    return sendProblem(reply, PROBLEMS.unavailable);
  }
  // Bad JSON, an empty body, a wrong media type and other client errors Fastify raises.
  if (isClientError(error)) return sendProblem(reply, PROBLEMS.validation);

  request.log.error({ err: error }, 'unhandled error');
  return sendProblem(reply, PROBLEMS.internal);
}

/** Registers the error handler and a not-found handler that goes through it. */
export function registerProblemHandlers(app: FastifyInstance): void {
  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler(async () => {
    throw new NotFoundError();
  });
}
