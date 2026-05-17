import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware, requirePermission } from '../../middlewares';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../../controllers/role.controller';

const router = Router();

router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);

router.get('/',    requirePermission('role_management', 'view'),   getAllRoles);
router.get('/:id', requirePermission('role_management', 'view'),   getRoleById);
router.post('/',   requirePermission('role_management', 'create'), createRole);
router.patch('/:id', requirePermission('role_management', 'edit'), updateRole);
router.delete('/:id', requirePermission('role_management', 'delete'), deleteRole);

export default router;
