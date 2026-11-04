import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { fail } from '../utils/respond';
import { isApiError } from '../utils/ApiError';

/** 404 for any request that matched no route. */
export function notFoundHandler(req: Request, res: Response): void {
  fail(res, 404, 'NOT_FOUND', `No route matches ${req.method} ${req.path}`);
}

/**
 * Central error handler — every thrown value funnels here so the wire format
 * always matches the `{ success: false, mode, error }` envelope from
 * docs/API.md, and unexpected failures are logged with a stack trace while
 * the client only ever sees a generic message.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  // Zod schema failures raised by `validate()`.
  if (err instanceof ZodError) {
    fail(
      res,
      400,
      'VALIDATION_ERROR',
      'One or more fields are invalid.',
      err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
    return;
  }

  if (isApiError(err)) {
    if (err.status >= 500) {
      logger.error(`${req.method} ${req.path} → ${err.code}: ${err.message}`, err);
    } else {
      logger.debug(`${req.method} ${req.path} → ${err.code}: ${err.message}`);
    }
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }

  // Malformed JSON body.
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    fail(res, 400, 'INVALID_JSON', 'Request body is not valid JSON.');
    return;
  }
  if (type === 'entity.too.large') {
    fail(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    return;
  }

  logger.error(`${req.method} ${req.path} → unhandled error`, err);
  fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
}
