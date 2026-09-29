import type { Server } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectToDatabase, disconnectFromDatabase } from './config/database';
import { logger } from './utils/logger';

/**
 * Process entrypoint: connect dependencies, start listening, and shut down
 * gracefully so in-flight requests are not dropped on deploy or Ctrl-C.
 */
async function bootstrap(): Promise<void> {
  await connectToDatabase();

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    logger.info(
      `API listening on http://localhost:${env.port}${env.apiPrefix} (env=${env.nodeEnv})`,
    );
  });

  registerShutdownHandlers(server);
}

function registerShutdownHandlers(server: Server): void {
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'Error while closing HTTP server');
        process.exitCode = 1;
      }
      await disconnectFromDatabase();
      process.exit();
    });

    // Do not hang forever if a connection refuses to drain.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception; exiting');
    process.exit(1);
  });
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start the API');
  process.exit(1);
});
