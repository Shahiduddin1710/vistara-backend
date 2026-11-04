import { Request, Response } from 'express';
import { ok } from '../utils/respond';
import * as authService from '../services/authService';
import { AuthenticatedRequest } from '../services/authService';

/** `GET /api/health` — public liveness probe. */
export async function health(_req: Request, res: Response): Promise<void> {
  ok(res, await authService.health());
}

/** `POST /api/auth/login` — public. */
export async function login(req: Request, res: Response): Promise<void> {
  const { staffId, password, gateCode } = req.body as {
    staffId: string;
    password: string;
    gateCode: string;
  };
  ok(res, await authService.login({ staffId, password, gateCode }));
}

/** `GET /api/auth/me` — auth. */
export async function me(req: Request, res: Response): Promise<void> {
  const payload = (req as AuthenticatedRequest).auth;
  if (!payload) throw new Error('authenticate() must run before me()');
  ok(res, await authService.me(payload));
}

/** `GET /api/gates` — auth. */
export async function listGates(_req: Request, res: Response): Promise<void> {
  ok(res, await authService.listGates());
}
