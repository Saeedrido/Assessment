import { z } from 'zod';

/**
 * Treats an empty or whitespace-only query value as absent.
 *
 * Browsers, HTML forms and API clients routinely send `?tag=` for a filter the
 * user never touched, and rejecting that with 400 is a papercut: the field was
 * not actually set. Once a real value is present the inner schema still
 * validates it, so `min(1)`, `max` and enum checks are unchanged.
 */
export const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());
