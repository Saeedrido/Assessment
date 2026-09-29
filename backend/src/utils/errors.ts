import { HTTP_STATUS } from '../constants/http';
import { ERROR_CODES, type ErrorCode } from '../constants/error-codes';

/**
 * Base class for every expected failure.
 *
 * Anything thrown as an `AppError` is considered safe to describe to the
 * client. Anything else is treated as a bug and reported as a generic 500 so
 * internal details never leak.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    options: { details?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = options.details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.VALIDATION_ERROR, details?: unknown) {
    super(message, HTTP_STATUS.BAD_REQUEST, errorCode, { details });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.AUTH_USER_CONTEXT_MISSING) {
    super(message, HTTP_STATUS.UNAUTHORIZED, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.FORBIDDEN_ROLE) {
    super(message, HTTP_STATUS.FORBIDDEN, errorCode);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.CONTENT_NOT_FOUND) {
    super(message, HTTP_STATUS.NOT_FOUND, errorCode);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR) {
    super(message, HTTP_STATUS.CONFLICT, errorCode);
  }
}

/** A business rule was violated by an otherwise well-formed request. */
export class UnprocessableEntityError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errorCode);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: unknown) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, { cause });
  }
}

/** An upstream dependency (AI provider, storage provider, chain) failed. */
export class ProviderError extends AppError {
  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number = HTTP_STATUS.BAD_GATEWAY,
    options: { cause?: unknown; details?: unknown } = {},
  ) {
    super(message, statusCode, errorCode, options);
  }
}

export class TimeoutError extends ProviderError {
  constructor(message: string, errorCode: ErrorCode, cause?: unknown) {
    super(message, errorCode, HTTP_STATUS.GATEWAY_TIMEOUT, { cause });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string, errorCode: ErrorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, errorCode);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
