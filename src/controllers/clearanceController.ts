import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { AuthenticatedRequest } from '../services/authService';
import * as clearanceService from '../services/clearanceService';
import { ClearanceStatus, ClearanceSubjectType } from '../models/types';

function actor(req: Request): string {
  const staff = (req as AuthenticatedRequest).staff;
  if (!staff) throw new Error('authenticate() must run before clearance handlers');
  return staff.staffId;
}

function subject(req: Request): { subjectType: ClearanceSubjectType; subjectId: string } {
  return {
    subjectType: req.params.subjectType as ClearanceSubjectType,
    subjectId: req.params.subjectId,
  };
}

/** `GET /api/clearances/:subjectType/:subjectId` — auth. */
export async function get(req: Request, res: Response): Promise<void> {
  const { subjectType, subjectId } = subject(req);
  ok(res, await clearanceService.getClearance(subjectType, subjectId));
}

/** `PUT /api/clearances/:subjectType/:subjectId/items/:itemId` — SUPERVISOR | ADMIN. */
export async function updateItem(req: Request, res: Response): Promise<void> {
  const { subjectType, subjectId } = subject(req);
  const { status, remarks } = req.body as { status: ClearanceStatus; remarks?: string | null };
  ok(
    res,
    await clearanceService.updateItem({
      subjectType,
      subjectId,
      itemId: req.params.itemId,
      status,
      remarks,
      updatedBy: actor(req),
    }),
  );
}

/** `PUT /api/clearances/:subjectType/:subjectId/overall` — SUPERVISOR | ADMIN. */
export async function updateOverall(req: Request, res: Response): Promise<void> {
  const { subjectType, subjectId } = subject(req);
  const { status } = req.body as { status: ClearanceStatus };
  ok(
    res,
    await clearanceService.updateOverall({
      subjectType,
      subjectId,
      status,
      updatedBy: actor(req),
    }),
  );
}
