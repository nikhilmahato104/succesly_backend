import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware, envApiKeyMiddleware } from '../../middlewares';
import {
  getAllApiKeys,
  getApiKeyById,
  createApiKey,
  updateApiKey,
  deleteApiKey,
} from '../../controllers/api-key.controller';

const router = Router();

// POST /api-keys — JWT + .env bootstrap key (no DB key exists yet on first run)
router.post('/', authMiddleware, csrfMiddleware, envApiKeyMiddleware, createApiKey);

// All other routes — JWT + CSRF + valid DB API key
router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);
router.get('/',       getAllApiKeys);
router.get('/:id',    getApiKeyById);
router.patch('/:id',  updateApiKey);
router.delete('/:id', deleteApiKey);

export default router;
