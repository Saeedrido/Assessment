import pino from 'pino';
import { env } from '../config/env';

/**
 * Application-wide structured logger.
 *
 * In production we emit newline-delimited JSON (log aggregators expect it); in
 * development we pretty-print so the terminal stays readable.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 't-world-module-service' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-user-id"]',
      'req.headers.cookie',
      'password',
      'apiKey',
      'apiSecret',
      'secretAccessKey',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
});

export type Logger = typeof logger;
