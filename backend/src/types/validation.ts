import type { ZodTypeAny } from 'zod';

/**
 * Shape `request.validated` takes after the `validate()` middleware runs.
 * Handlers read parsed data through the typed accessors in `./request.ts`.
 */
export interface ValidatedRequestData {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}

export type SchemaLike<T> = ZodTypeAny & { _output?: T };
