import { Router }            from 'express';
import { authMiddleware }    from '../../middlewares/auth.middleware';
import { csrfMiddleware }    from '../../middlewares/csrf.middleware';
import { apiKeyMiddleware }  from '../../middlewares/api-key.middleware';
import {
  getSiteMaintenanceStatus,
  getAllSiteMaintenances,
  getSiteMaintenanceById,
  createSiteMaintenance,
  updateSiteMaintenance,
  deleteSiteMaintenance,
} from '../../controllers/site-maintenance.controller';

const router = Router();

// Static paths first — otherwise '/:id' would swallow '/status'

// GET /site-maintenance/status?url=abc.com  → PUBLIC (the site itself asks)
router.get('/status',                                                        getSiteMaintenanceStatus);

// GET /site-maintenance           → JWT + API key (admin list)
router.get('/',       authMiddleware, apiKeyMiddleware,                      getAllSiteMaintenances);

// POST /site-maintenance          → JWT + CSRF + API key
router.post('/',      authMiddleware, csrfMiddleware, apiKeyMiddleware,      createSiteMaintenance);

// GET /site-maintenance/:id       → JWT + API key
router.get('/:id',    authMiddleware, apiKeyMiddleware,                      getSiteMaintenanceById);

// PATCH /site-maintenance/:id     → JWT + CSRF + API key (flip the switch here)
router.patch('/:id',  authMiddleware, csrfMiddleware, apiKeyMiddleware,      updateSiteMaintenance);

// DELETE /site-maintenance/:id    → JWT + CSRF + API key (hard delete)
router.delete('/:id', authMiddleware, csrfMiddleware, apiKeyMiddleware,      deleteSiteMaintenance);

export default router;
