import type { RequestHandler } from 'express';
import { ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS } from '../constants/http';
import { env } from '../config/env';
import { TooManyRequestsError } from '../utils/errors';

/**
 * Fixed-window rate limiter.
 *
 * This is a dependency-free in-process limiter: appropriate for a single
 * instance and for demonstrating the operational concern, but a real
 * deployment behind more than one instance should use a shared store
 * (Redis) or terminate rate limiting at the gateway.
 *
 * Set `RATE_LIMIT_MAX=0` to disable it.
 */
export const rateLimiter: RequestHandler = (request, response, next) => {
  if (env.rateLimitMax === 0) {
    next();
    return;
  }

  const now = Date.now();
  const key = request.ip ?? 'unknown';
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + env.rateLimitWindowMs });
    next();
    return;
  }

  entry.count += 1;

  const remaining = Math.max(env.rateLimitMax - entry.count, 0);
  response.setHeader('RateLimit-Limit', String(env.rateLimitMax));
  response.setHeader('RateLimit-Remaining', String(remaining));
  response.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

  if (entry.count > env.rateLimitMax) {
    next(
      new TooManyRequestsError(
        'Too many requests. Please retry after the rate limit window resets.',
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
      ),
    );
    return;
  }

  next();
};

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

/** Prevents unbounded memory growth in a long-running process. */
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  Number(env.rateLimitWindowMs),
).unref();

export const RATE_LIMIT_STATUS = HTTP_STATUS.TOO_MANY_REQUESTS;
