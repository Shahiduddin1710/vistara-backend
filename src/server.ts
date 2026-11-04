/**
 * Server bootstrap.
 *
 * Order: resolve the store (live PostgreSQL when reachable, seeded demo store
 * otherwise) → build the app → listen. Without a database the API still runs
 * and every response is labelled `mode: "demo"`, so the client never presents
 * seeded figures as live data.
 */
import { createApp } from './app';
import { initStore, getStore } from './stores';
import { disconnectPrisma } from './config/prisma';
import { CORS_ORIGIN, DATABASE_URL, NEON_BRANCH, PORT } from './config/env';
import { logger } from './config/logger';

async function main(): Promise<void> {
  const store = await initStore();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`VISTARA API listening on http://localhost:${PORT}/api`);
    logger.info(`Store mode: ${store.mode.toUpperCase()} (${getStore().mode})`);
    logger.info(
      DATABASE_URL
        ? `Database: PostgreSQL${NEON_BRANCH ? ` — branch ${NEON_BRANCH}` : ''}`
        : 'Database: not configured — serving seeded demo data',
    );
    logger.info(`CORS origin: ${CORS_ORIGIN}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down.`);
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    // Hard exit if something keeps the loop alive.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
  });
}

main().catch((err) => {
  logger.error('Failed to start the VISTARA API', err);
  process.exit(1);
});
