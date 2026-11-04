import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError';
import { getStore } from '../stores';
import { bearerToken, signToken, TokenPayload, verifyToken } from '../utils/jwt';
import { APP_VERSION, TOKEN_TTL_SECONDS } from '../config/env';
import { Gate, HealthResponse, LoginResponse, Role, Staff } from '../models/types';
import { StaffRecord } from '../stores/Store';

/** Roles permitted to change clearance state (docs/API.md role matrix). */
const CLEARANCE_ROLES: Role[] = ['SUPERVISOR', 'ADMIN'];

export function canUpdateClearance(role: Role): boolean {
  return CLEARANCE_ROLES.includes(role);
}

/** Strips the credential hash before a staff record leaves the server. */
export function publicStaff(record: StaffRecord): Staff {
  const { passwordHash: _hash, ...staff } = record;
  return staff;
}

export async function health(): Promise<HealthResponse> {
  const store = getStore();
  const reachable = await store.ping();
  return {
    status: 'ok',
    version: APP_VERSION,
    time: new Date().toISOString(),
    database: reachable ? 'connected' : 'unavailable',
  };
}

export async function login(input: {
  staffId: string;
  password: string;
  gateCode: string;
}): Promise<LoginResponse> {
  const store = getStore();

  const staff = await store.findStaffByStaffId(input.staffId.trim());
  if (!staff) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Officer ID or access code is incorrect.');
  }

  const matches = await bcrypt.compare(input.password, staff.passwordHash);
  if (!matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Officer ID or access code is incorrect.');
  }

  const gate = await store.findGateByCode(input.gateCode);
  if (!gate) {
    throw new ApiError(400, 'GATE_NOT_FOUND', 'The selected gate terminal is not recognised.');
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);
  const token = signToken({
    sub: staff.id,
    staffId: staff.staffId,
    role: staff.role,
    gateCode: input.gateCode,
  });

  return {
    token,
    staff: publicStaff({
      ...staff,
      gateCode: input.gateCode,
      authExpiresAt: expiresAt.toISOString(),
    }),
  };
}

export async function me(payload: TokenPayload): Promise<{ staff: Staff }> {
  const staff = await getStore().findStaffById(payload.sub);
  if (!staff) throw ApiError.unauthorized('Session no longer valid.');
  return { staff: publicStaff(staff) };
}

export async function listGates(): Promise<Gate[]> {
  return getStore().listGates();
}

export interface AuthenticatedRequest extends Request {
  auth?: TokenPayload;
  staff?: StaffRecord;
}

/** Attaches `auth` + `staff` after verifying the bearer token. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header) throw ApiError.unauthorized('Missing Authorization header.');

    const token = bearerToken(header);
    if (!token) throw ApiError.unauthorized('Missing bearer token.');

    let payload: TokenPayload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.');
    }

    const staff = await getStore().findStaffById(payload.sub);
    if (!staff) throw ApiError.unauthorized('Session no longer valid.');

    (req as AuthenticatedRequest).auth = payload;
    (req as AuthenticatedRequest).staff = staff;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role guard — `requireRole('SUPERVISOR', 'ADMIN')`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const staff = (req as AuthenticatedRequest).staff;
    if (!staff) return next(ApiError.unauthorized());
    if (!roles.includes(staff.role)) {
      return next(
        new ApiError(403, 'FORBIDDEN', 'Your role is not permitted to perform this action.'),
      );
    }
    next();
  };
}
