import { Response } from 'express';
import { getStore } from '../stores';
import { ApiMode } from '../models/types';

/** Serving mode of the store backing the current request. */
export function modeOf(res: Response): ApiMode {
  return getStore().mode;
}

/**
 * Success envelope — `{ success, mode, data }` (see docs/API.md).
 */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, mode: modeOf(res), data });
}

/**
 * Error envelope — `{ success, mode, error: { code, message, details } }`.
 */
export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json({
    success: false,
    mode: modeOf(res),
    error: details === undefined ? { code, message } : { code, message, details },
  });
}
