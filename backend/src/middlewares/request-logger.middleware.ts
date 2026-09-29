import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a correlation id to every request and logs one line on completion.
 *
 * Clients may supply `x-request-id`; otherwise one is generated, so a single
 * request can be traced through every log line it produced.
 */
export const requestLogger: RequestHandler = (request, response, next) => {
  const incomingId = request.headers[REQUEST_ID_HEADER];
  const requestId = (Array.isArray(incomingId) ? incomingId[0] : incomingId) || randomUUID();

  request.id = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info(
      {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userId: request.user?.id,
      },
      'Request completed',
    );
  });

  next();
};

/** Terminal 404 handler for unmatched routes. */
export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    success: false,
    message: `Route ${request.method} ${request.originalUrl} does not exist`,
    errorCode: 'ROUTE_NOT_FOUND',
  });
};
