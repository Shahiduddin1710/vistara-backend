import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import * as clearances from '../controllers/clearanceController';
import { requireRole } from '../services/authService';
import {
  clearanceItemParamSchema,
  clearanceItemSchema,
  clearanceOverallSchema,
  subjectParamSchema,
} from '../validators';

/** `/api/clearances` — safety clearance checklists. */
export const clearanceRoutes = Router();

clearanceRoutes.get(
  '/:subjectType/:subjectId',
  validate({ params: subjectParamSchema }),
  asyncHandler(clearances.get),
);

// Writes are restricted to SUPERVISOR / ADMIN (docs/API.md role matrix).
const supervisorOnly = requireRole('SUPERVISOR', 'ADMIN');

clearanceRoutes.put(
  '/:subjectType/:subjectId/items/:itemId',
  supervisorOnly,
  validate({ params: clearanceItemParamSchema, body: clearanceItemSchema }),
  asyncHandler(clearances.updateItem),
);

clearanceRoutes.put(
  '/:subjectType/:subjectId/overall',
  supervisorOnly,
  validate({ params: subjectParamSchema, body: clearanceOverallSchema }),
  asyncHandler(clearances.updateOverall),
);
