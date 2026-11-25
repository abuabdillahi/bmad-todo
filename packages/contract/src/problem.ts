import Type from 'typebox';

/** The closed set of problem types (AD-9), relative URIs. */
export const PROBLEM_TYPES = [
  '/problems/validation',
  '/problems/not-found',
  '/problems/conflict',
  '/problems/unavailable',
  '/problems/internal',
] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

/** One invalid input: `field` is the bare property name, e.g. `description`. */
export const ProblemFieldError = Type.Object(
  {
    field: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
);
export type ProblemFieldError = Type.Static<typeof ProblemFieldError>;

/** Every non-2xx response under /api, as `application/problem+json` (RFC 9457, AD-9). */
export const Problem = Type.Object(
  {
    type: Type.Union([
      Type.Literal(PROBLEM_TYPES[0]),
      Type.Literal(PROBLEM_TYPES[1]),
      Type.Literal(PROBLEM_TYPES[2]),
      Type.Literal(PROBLEM_TYPES[3]),
      Type.Literal(PROBLEM_TYPES[4]),
    ]),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.String(),
    errors: Type.Optional(Type.Array(ProblemFieldError)),
  },
  { additionalProperties: false },
);
export type Problem = Type.Static<typeof Problem>;
