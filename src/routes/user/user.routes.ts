import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware, requirePermission } from '../../middlewares';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../../controllers/user.controller';

const router = Router();

router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);

router.get('/',    requirePermission('user_management', 'view'),   getAllUsers);
router.get('/:id', requirePermission('user_management', 'view'),   getUserById);
router.post('/',   requirePermission('user_management', 'create'), createUser);
router.patch('/:id', requirePermission('user_management', 'edit'), updateUser);
router.delete('/:id', requirePermission('user_management', 'delete'), deleteUser);

export default router;
