import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { validatedQuery } from '../middleware/validate';
import * as visitService from '../services/visitService';
import { EntryInput, ExitInput } from '../services/visitService';

/** `POST /api/visits/entry` — auth. */
export async function entry(req: Request, res: Response): Promise<void> {
  ok(res, await visitService.recordEntry(req.body as EntryInput), 201);
}

/** `POST /api/visits/exit` — auth. */
export async function exit(req: Request, res: Response): Promise<void> {
  ok(res, await visitService.recordExit(req.body as ExitInput));
}

/** `GET /api/visits/active` — auth. */
export async function active(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<{ gateCode?: string; search?: string }>(req);
  ok(res, await visitService.active(query));
}

/** `GET /api/visits/today` — auth. */
export async function today(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<{ gateCode?: string }>(req);
  ok(res, await visitService.today(query.gateCode));
}

/** `GET /api/visits/recent` — auth. */
export async function recent(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<{ limit: number }>(req);
  ok(res, await visitService.recent(query.limit));
}
