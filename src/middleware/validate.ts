import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodSchema } from 'zod';

export interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validates the three places a request can carry data and replaces the parsed
 * values in place, so handlers always receive typed, trimmed input. Failures
 * become `ZodError`, which `errorHandler` turns into a `VALIDATION_ERROR`.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) throw parsed.error;
        req.params = parsed.data as typeof req.params;
      }
      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) throw parsed.error;
        // Express 5 freezes `req.query`; store the typed copy alongside it.
        (req as Request & { validatedQuery?: unknown }).validatedQuery = parsed.data;
      }
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body ?? {});
        if (!parsed.success) throw parsed.error;
        req.body = parsed.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Typed query produced by `validate({ query })`. */
export function validatedQuery<T>(req: Request): T {
  const value = (req as Request & { validatedQuery?: T }).validatedQuery;
  if (value === undefined) return {} as T;
  return value;
}
