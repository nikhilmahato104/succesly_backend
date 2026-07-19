import { Router }                        from 'express';
import { authMiddleware }                from '../../middlewares/auth.middleware';
import { csrfMiddleware }                from '../../middlewares/csrf.middleware';
import { apiKeyMiddleware }              from '../../middlewares/api-key.middleware';
import { conditionalDeviceTrackApiKey }  from '../../middlewares/conditional-api-key.middleware';
import {
  getAllDeviceInfos,
  getDeviceInfoById,
  trackDeviceInfo,
  updateDeviceInfo,
  deleteDeviceInfo,
} from '../../controllers/device-info.controller';

const router = Router();

// POST /device-info      → PUBLIC (anonymous website visitor's browser). API key
//                           validated only if the calling site chose to send one.
router.post('/',    conditionalDeviceTrackApiKey,                              trackDeviceInfo);

// GET  /device-info      → JWT + API key (admin dashboard list)
router.get('/',     authMiddleware, apiKeyMiddleware,                          getAllDeviceInfos);

// GET  /device-info/:id  → JWT only
router.get('/:id',  authMiddleware,                                           getDeviceInfoById);

// PATCH /device-info/:id → JWT + CSRF + API key (admin correction only)
router.patch('/:id', authMiddleware, csrfMiddleware, apiKeyMiddleware,        updateDeviceInfo);

// DELETE /device-info/:id → JWT + CSRF + API key (admin only)
router.delete('/:id', authMiddleware, csrfMiddleware, apiKeyMiddleware,       deleteDeviceInfo);

export default router;
