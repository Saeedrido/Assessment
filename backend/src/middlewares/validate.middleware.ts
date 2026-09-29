import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { Request, RequestHandler } from 'express';
import type { ValidatedRequestData } from '../types/validation';

/** A single validation problem, shaped for the API error response. */
export interface FieldIssue {
  field: string;
  message: string;
}

export function formatZodError(error: ZodError): { message: string; details: FieldIssue[] } {
  const details: FieldIssue[] = error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  const summary = details.length === 1 ? details[0].message : `${details.length} validation errors`;

  return { message: `Request validation failed: ${summary}`, details };
}

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Builds an Express middleware that validates and *replaces* the given request
 * segments with their parsed output.
 *
 * Replacing rather than merely checking matters: Zod can coerce types and apply
 * defaults, so controllers receive values that already match the schema.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (request, _response, next) => {
    try {
      const validated: ValidatedRequestData = {
        body: schemas.body ? schemas.body.parse(request.body ?? {}) : undefined,
        params: schemas.params ? schemas.params.parse(request.params ?? {}) : undefined,
        query: schemas.query ? schemas.query.parse(request.query ?? {}) : undefined,
      };

      request.validated = validated;

      // Mutating `request.body` keeps downstream code readable (`request.body.title`)
      // instead of forcing every handler to know about `request.validated`.
      if (schemas.body) request.body = request.validated.body;
      if (schemas.params) request.params = request.validated.params as Request['params'];
      if (schemas.query) {
        // Express 5 exposes `query` as a getter, so it is assigned defensively.
        Object.defineProperty(request, 'query', {
          value: request.validated.query,
          writable: true,
          configurable: true,
        });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, details } = formatZodError(error);
        logger.debug({ issues: details }, 'Request validation failed');
        next(new ValidationError(message, details));
        return;
      }
      next(error);
    }
  };
}
