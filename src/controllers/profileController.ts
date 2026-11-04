import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import { AuthenticatedRequest, publicStaff } from '../services/authService';
import * as profileService from '../services/profileService';

/** `GET /api/profile` — auth. */
export async function profile(req: Request, res: Response): Promise<void> {
  const staff = (req as AuthenticatedRequest).staff;
  if (!staff) throw new Error('authenticate() must run before profile()');
  ok(res, await profileService.get(publicStaff(staff)));
}
