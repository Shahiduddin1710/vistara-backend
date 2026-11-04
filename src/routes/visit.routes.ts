import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import * as visits from '../controllers/visitController';
import {
  activeQuerySchema,
  entrySchema,
  exitSchema,
  recentQuerySchema,
  todayQuerySchema,
} from '../validators';

/** `/api/visits` — gate entry / exit transactions and queries. */
export const visitRoutes = Router();

visitRoutes.post('/entry', validate({ body: entrySchema }), asyncHandler(visits.entry));
visitRoutes.post('/exit', validate({ body: exitSchema }), asyncHandler(visits.exit));
visitRoutes.get('/active', validate({ query: activeQuerySchema }), asyncHandler(visits.active));
visitRoutes.get('/today', validate({ query: todayQuerySchema }), asyncHandler(visits.today));
visitRoutes.get('/recent', validate({ query: recentQuerySchema }), asyncHandler(visits.recent));
