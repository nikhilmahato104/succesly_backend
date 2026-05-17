import { Router }      from 'express';
import { authMiddleware, csrfMiddleware } from '../../middlewares';
import { login, refresh, logout, getProfile } from '../../controllers/auth.controller';

const router = Router();

// Public — no auth required
router.post('/login',   login);
router.post('/refresh', refresh);   // uses HTTP-only refresh token cookie

// Protected — access token + session + CSRF required
router.post('/logout',  authMiddleware, csrfMiddleware, logout);
router.get('/profile',  authMiddleware, getProfile);

export default router;
