/**
 * Route composition — everything is mounted under `/api` by `app.ts`.
 *
 * Public endpoints come first so the liveness probe and login never depend on
 * a token; everything else sits behind `authenticate` (applied in
 * `auth.routes.ts` and re-used here through `protectedRoutes`).
 */
import { Router } from 'express';
import { protectedRoutes, publicRoutes } from './auth.routes';
import { visitorRoutes } from './visitor.routes';
import { visitRoutes } from './visit.routes';
import { employeeRoutes } from './employee.routes';
import { clearanceRoutes } from './clearance.routes';
import { dashboardRoutes, profileRoutes } from './dashboard.routes';

export function apiRouter(): Router {
  const router = Router();

  router.use(publicRoutes);
  router.use(protectedRoutes);

  router.use('/visitors', visitorRoutes);
  router.use('/visits', visitRoutes);
  router.use('/employees', employeeRoutes);
  router.use('/clearances', clearanceRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/profile', profileRoutes);

  return router;
}
