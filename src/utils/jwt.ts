import jwt from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../config/env';

export interface TokenPayload {
  sub: string; // staff.id
  staffId: string;
  role: string;
  gateCode: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: 'vistara-api',
  });
}

/** @throws when the token is missing, malformed or expired. */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'vistara-api' });
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Malformed token payload');
  }
  const { sub, staffId, role, gateCode } = decoded as jwt.JwtPayload;
  if (typeof sub !== 'string' || typeof staffId !== 'string') {
    throw new Error('Malformed token payload');
  }
  return {
    sub,
    staffId,
    role: typeof role === 'string' ? role : '',
    gateCode: typeof gateCode === 'string' ? gateCode : '',
  };
}

/** Extracts the bearer token from an `Authorization` header. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim();
}
