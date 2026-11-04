import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import * as dashboard from '../controllers/dashboardController';
import * as profile from '../controllers/profileController';
import { dashboardQuerySchema } from '../validators';

/** `GET /api/dashboard` — auth. */
export const dashboardRoutes = Router();
dashboardRoutes.get(
  '/',
  validate({ query: dashboardQuerySchema }),
  asyncHandler(dashboard.dashboard),
);

/** `GET /api/profile` — auth. */
export const profileRoutes = Router();
profileRoutes.get('/', asyncHandler(profile.profile));
