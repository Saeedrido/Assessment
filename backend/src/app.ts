import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger, notFoundHandler } from './middlewares/request-logger.middleware';
import { rateLimiter } from './middlewares/rate-limit.middleware';
import { userContext } from './middlewares/user-context.middleware';
import { apiRouter } from './routes';
import { devRouter } from './routes/dev.routes';
import { HTTP_STATUS } from './constants/http';

/**
 * Builds the Express application.
 *
 * Exported separately from `server.ts` so integration tests can mount the app
 * without binding a port or opening a database connection.
 */
export function createApp(): Express {
  const app = express();

  // Required for `request.ip` to reflect X-Forwarded-For behind a proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  applySecurityMiddleware(app);
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(rateLimiter);

  app.get('/health', healthCheck);
  app.get(`${env.apiPrefix}/health`, healthCheck);

  /**
   * Mounted before the user context: this is how a console discovers which
   * seeded account to act as, so it cannot require an identity itself. It
   * guards its own access — loopback only, and 404s in production.
   */
  app.use(`${env.apiPrefix}/dev`, devRouter);

  // Every other route below identifies the caller through the dev user context.
  app.use(env.apiPrefix, userContext, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function applySecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      // The API serves JSON only; CSP is configured by the frontend host.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(compression());

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/curl requests arrive without an Origin header.
        if (!origin) return callback(null, true);
        if (env.corsAllowsAnyOrigin || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Deny rather than throw: a disallowed origin is a browser-enforcement
        // concern, and answering without CORS headers is what the browser
        // expects. Throwing here would surface as a confusing 500.
        logger.warn({ origin }, 'Blocked request from disallowed CORS origin');
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-request-id'],
      exposedHeaders: ['x-request-id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 600,
    }),
  );
}

function healthCheck(_request: express.Request, response: express.Response): void {
  response.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'T-World Module Service is healthy',
    data: {
      service: 't-world-module-service',
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}
