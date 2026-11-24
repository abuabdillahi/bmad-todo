import Type from 'typebox';

/** Response of `GET /api/health` when storage is reachable. */
export const Health = Type.Object(
  { status: Type.Literal('ok') },
  { additionalProperties: false },
);
export type Health = Type.Static<typeof Health>;
