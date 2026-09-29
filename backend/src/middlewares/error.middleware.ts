import type { ErrorRequestHandler } from 'express';
import { isAppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS } from '../constants/http';
import { env } from '../config/env';
import type { ErrorResponseBody } from '../utils/response';

/**
 * Centralised error handling.
 *
 * Rules enforced here:
 *  - Operational errors (`AppError`) are described to the client using their
 *    own message and `errorCode`.
 *  - Anything else is a bug: the client gets a generic 500, while the full
 *    error and stack trace go to the log only. Stack traces are never included
 *    in production responses.
 *  - Every error response uses the same envelope.
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const normalised = isAppError(error) ? error : mapUnknownError(error);

  const logPayload = {
    errorCode: normalised.errorCode,
    statusCode: normalised.statusCode,
    method: request.method,
    path: request.originalUrl,
    userId: request.user?.id,
    err: { message: normalised.message, stack: normalised.stack },
  };

  if (normalised.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error(logPayload, 'Request failed');
  } else {
    logger.warn(logPayload, 'Request rejected');
  }

  const body: ErrorResponseBody = {
    success: false,
    message: normalised.message,
    errorCode: normalised.errorCode,
  };

  if (normalised.details !== undefined) body.details = normalised.details;
  // Stack traces are a development affordance only.
  if (!env.isProduction && normalised.stack) body.stack = normalised.stack;

  response.status(normalised.statusCode).json(body);
};

/**
 * Turns anything that is not an `AppError` into a safe response shape.
 *
 * Mongoose/Mongo failures in particular are mapped to a database error rather
 * than being echoed back, because raw driver messages can reveal collection and
 * field names.
 */
function mapUnknownError(error: unknown): ReturnType<typeof toSafeError> {
  if (isDatabaseError(error)) {
    return toSafeError(
      'A database error occurred while processing the request',
      ERROR_CODES.DATABASE_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error,
    );
  }

  if (isBodyParserError(error)) {
    return toSafeError(
      'Request body could not be parsed. Expected valid JSON.',
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      error,
    );
  }

  if (isPayloadTooLargeError(error)) {
    return toSafeError(
      'Request payload is too large',
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      error,
    );
  }

  return toSafeError(
    'An unexpected error occurred',
    ERROR_CODES.INTERNAL_ERROR,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error,
  );
}

function toSafeError(message: string, errorCode: string, statusCode: number, cause: unknown) {
  return {
    message,
    errorCode,
    statusCode,
    details: undefined,
    stack: cause instanceof Error ? cause.stack : undefined,
  };
}

interface MongoErrorLike {
  name: string;
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function isDatabaseError(error: unknown): error is MongoErrorLike {
  const candidate = error as MongoErrorLike | null;
  if (!candidate || typeof candidate !== 'object') return false;
  return (
    candidate.name === 'MongoServerError' ||
    candidate.name === 'MongoNetworkError' ||
    candidate.name === 'MongooseServerSelectionError' ||
    typeof candidate.code === 'number'
  );
}

function isBodyParserError(error: unknown): boolean {
  const candidate = error as { type?: string; status?: number } | null;
  return candidate?.type === 'entity.parse.failed' || candidate?.status === HTTP_STATUS.BAD_REQUEST;
}

function isPayloadTooLargeError(error: unknown): boolean {
  const candidate = error as { type?: string } | null;
  return candidate?.type === 'entity.too.large';
}
