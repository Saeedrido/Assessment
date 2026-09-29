import type { Response } from 'express';

/**
 * Every response in the API uses one of these two shapes, so clients can
 * always check `success` before looking at `data`.
 */
export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponseBody {
  success: false;
  message: string;
  errorCode: string;
  details?: unknown;
  stack?: string;
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  message = 'OK',
  statusCode = 200,
): Response {
  const body: SuccessResponse<T> = { success: true, message, data };
  return response.status(statusCode).json(body);
}

export function sendCreated<T>(response: Response, data: T, message = 'Created'): Response {
  return sendSuccess(response, data, message, 201);
}

export function sendNoContent(response: Response): Response {
  return response.status(204).send();
}
