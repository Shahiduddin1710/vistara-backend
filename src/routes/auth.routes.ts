import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../services/authService';
import * as auth from '../controllers/authController';
import { loginSchema } from '../validators';

/** Public: health probe + credential exchange. */
export const publicRoutes = Router();

publicRoutes.get('/health', asyncHandler(auth.health));
publicRoutes.post('/auth/login', validate({ body: loginSchema }), asyncHandler(auth.login));

/** Everything below requires a valid bearer token. */
export const protectedRoutes = Router();
protectedRoutes.use(authenticate);

protectedRoutes.get('/auth/me', asyncHandler(auth.me));
protectedRoutes.get('/gates', asyncHandler(auth.listGates));
