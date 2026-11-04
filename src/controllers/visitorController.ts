import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { validatedQuery } from '../middleware/validate';
import * as visitorService from '../services/visitorService';
import { NewVisitorInput, VisitorFilter } from '../models/types';

/** `GET /api/visitors` — auth. */
export async function list(req: Request, res: Response): Promise<void> {
  const filter = validatedQuery<VisitorFilter>(req);
  ok(res, await visitorService.list(filter));
}

/** `POST /api/visitors` — auth. */
export async function create(req: Request, res: Response): Promise<void> {
  const visitor = await visitorService.create(req.body as NewVisitorInput);
  ok(res, visitor, 201);
}

/** `GET /api/visitors/:id` — auth. */
export async function detail(req: Request, res: Response): Promise<void> {
  ok(res, await visitorService.getDetail(req.params.id));
}

/** `GET /api/visitors/:id/history` — auth. */
export async function history(req: Request, res: Response): Promise<void> {
  ok(res, await visitorService.history(req.params.id));
}
