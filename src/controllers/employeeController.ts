import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { validatedQuery } from '../middleware/validate';
import * as employeeService from '../services/employeeService';
import { CardType } from '../models/types';

/** `GET /api/employees/search` — auth. */
export async function search(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<{ q?: string; cardType?: CardType }>(req);
  ok(res, await employeeService.search(query.q ?? '', query.cardType));
}

/** `GET /api/employees/:id` — auth. */
export async function detail(req: Request, res: Response): Promise<void> {
  ok(res, await employeeService.detail(req.params.id));
}

/** `POST /api/employees/:id/verify` — auth. */
export async function verify(req: Request, res: Response): Promise<void> {
  const { gateCode } = req.body as { gateCode: string };
  ok(res, await employeeService.verify(req.params.id, gateCode));
}
