import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import * as employees from '../controllers/employeeController';
import {
  employeeIdParamSchema,
  employeeSearchQuerySchema,
  verifySchema,
} from '../validators';

/** `/api/employees` — Green / White card verification. */
export const employeeRoutes = Router();

employeeRoutes.get(
  '/search',
  validate({ query: employeeSearchQuerySchema }),
  asyncHandler(employees.search),
);

employeeRoutes.get(
  '/:id',
  validate({ params: employeeIdParamSchema }),
  asyncHandler(employees.detail),
);

employeeRoutes.post(
  '/:id/verify',
  validate({ params: employeeIdParamSchema, body: verifySchema }),
  asyncHandler(employees.verify),
);
