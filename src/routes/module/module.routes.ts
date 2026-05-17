import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware, requirePermission } from '../../middlewares';
import {
  getAllModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
} from '../../controllers/module.controller';

const router = Router();

router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);

router.get('/',    requirePermission('module_management', 'view'),   getAllModules);
router.get('/:id', requirePermission('module_management', 'view'),   getModuleById);
router.post('/',   requirePermission('module_management', 'create'), createModule);
router.patch('/:id', requirePermission('module_management', 'edit'), updateModule);
router.delete('/:id', requirePermission('module_management', 'delete'), deleteModule);

export default router;
