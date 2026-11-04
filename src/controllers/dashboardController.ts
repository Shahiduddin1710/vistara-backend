import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { validatedQuery } from '../middleware/validate';
import * as dashboardService from '../services/dashboardService';

/** `GET /api/dashboard` — auth. */
export async function dashboard(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<{ gateCode?: string }>(req);
  ok(res, await dashboardService.get(query.gateCode));
}
