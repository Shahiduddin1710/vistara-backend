import cors from 'cors';
import express, { Express } from 'express';
import { CORS_ORIGIN } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Express application factory.
 *
 * Middleware order matters: body parsing → CORS-preflight-safe routing →
 * `/api` routes → 404 → central error handler. Nothing writes to the
 * response outside those layers, so every answer uses the envelope from
 * docs/API.md.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Visitor photographs are posted as base64 data URLs — keep the ceiling high.
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Simple request log for the terminal.
  app.use((req, _res, next) => {
    // eslint-disable-next-line no-console
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`→ ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  app.use('/api', apiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
