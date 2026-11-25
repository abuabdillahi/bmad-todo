/**
 * Domain errors the service and routes throw. They know nothing about HTTP or
 * Fastify (AD-10); the one error handler in `problems.ts` maps them to problems.
 */

/** A create reused an existing id with a different description (AD-6). */
export class ConflictError extends Error {
  override name = 'ConflictError';
}

/** The service can't serve the request now, e.g. storage is unreachable. */
export class UnavailableError extends Error {
  override name = 'UnavailableError';
}

/** The requested route or resource does not exist. */
export class NotFoundError extends Error {
  override name = 'NotFoundError';
}
