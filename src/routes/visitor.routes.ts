import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import * as visitors from '../controllers/visitorController';
import {
  createVisitorSchema,
  visitorIdParamSchema,
  visitorQuerySchema,
} from '../validators';

/** `/api/visitors` — registration, search and dossiers. */
export const visitorRoutes = Router();

visitorRoutes.get(
  '/',
  validate({ query: visitorQuerySchema }),
  asyncHandler(visitors.list),
);

visitorRoutes.post(
  '/',
  validate({ body: createVisitorSchema }),
  asyncHandler(visitors.create),
);

visitorRoutes.get(
  '/:id',
  validate({ params: visitorIdParamSchema }),
  asyncHandler(visitors.detail),
);

visitorRoutes.get(
  '/:id/history',
  validate({ params: visitorIdParamSchema }),
  asyncHandler(visitors.history),
);
