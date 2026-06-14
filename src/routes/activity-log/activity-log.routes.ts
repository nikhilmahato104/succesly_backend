import { Router }           from 'express';
import { authMiddleware }   from '../../middlewares/auth.middleware';
import { apiKeyMiddleware } from '../../middlewares/api-key.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import {
  getAllLogs,
  getLogById,
  getLogsSummary,
} from '../../controllers/activity-log.controller';

const router = Router();

const MODULE_ID = 'activity_log';

// GET /activity-logs/summary  — aggregated stats (admin dashboard chart)
router.get(
  '/summary',
  authMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'view'),
  getLogsSummary,
);

// GET /activity-logs          — paginated, searchable, filterable list
router.get(
  '/',
  authMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'view'),
  getAllLogs,
);

// GET /activity-logs/:id      — single log detail
router.get(
  '/:id',
  authMiddleware,
  apiKeyMiddleware,
  requirePermission(MODULE_ID, 'view'),
  getLogById,
);

export default router;
