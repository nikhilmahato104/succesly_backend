import { Router }               from 'express';
import { authMiddleware }        from '../../middlewares/auth.middleware';
import { csrfMiddleware }        from '../../middlewares/csrf.middleware';
import { apiKeyMiddleware }      from '../../middlewares/api-key.middleware';
import { requirePermission }     from '../../middlewares/permission.middleware';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addPaymentTerm,
  markTermPaid,
  addMaintenanceTerm,
  markMaintenanceTermPaid,
} from '../../controllers/project.controller';

const router = Router();

const MODULE_ID = 'project_management';

// GET /projects          — list all (JWT + API key + view permission)
router.get(
  '/',
  authMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'view'),
  getAllProjects,
);

// GET /projects/:id      — single project (JWT + view permission)
router.get(
  '/:id',
  authMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'view'),
  getProjectById,
);

// POST /projects         — create (JWT + CSRF + API key + create permission)
router.post(
  '/',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'create'),
  createProject,
);

// PATCH /projects/:id    — update (JWT + CSRF + API key + edit permission)
router.patch(
  '/:id',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'edit'),
  updateProject,
);

// DELETE /projects/:id   — hard delete (JWT + CSRF + API key + delete permission)
router.delete(
  '/:id',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'delete'),
  deleteProject,
);

// POST /projects/:id/payment-terms       — add a new payment term
router.post(
  '/:id/payment-terms',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'edit'),
  addPaymentTerm,
);

// PATCH /projects/:id/payment-terms/:term_number/pay  — mark term as paid
router.patch(
  '/:id/payment-terms/:term_number/pay',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'edit'),
  markTermPaid,
);

// POST /projects/:id/maintenance-terms       — add a new maintenance billing term
router.post(
  '/:id/maintenance-terms',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'edit'),
  addMaintenanceTerm,
);

// PATCH /projects/:id/maintenance-terms/:term_number/pay  — mark maintenance term as paid
router.patch(
  '/:id/maintenance-terms/:term_number/pay',
  authMiddleware,
  csrfMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'edit'),
  markMaintenanceTermPaid,
);

export default router;
