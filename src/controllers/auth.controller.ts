import { Request, Response }     from 'express';
import asyncHandler               from '../utils/async-handler.util';
import { sendSuccess, sendError } from '../utils/response.util';
import { MongoDataServices }      from '../frameworks/mongo';
import { AuthUseCase }            from '../use-cases/auth/auth.use-case';
import { loginSchema }            from '../core/dtos';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../utils/constants';

const dataServices = new MongoDataServices();
const authUseCase  = new AuthUseCase(dataServices);

/**
 * Build refresh token cookie options per-request.
 *
 * WHY per-request (not module-level constant):
 *   - NODE_ENV can be "development" even on the deployed HTTPS server.
 *   - We detect HTTPS via req.secure (Express reads X-Forwarded-Proto after
 *     `app.set('trust proxy', 1)` is set in app.ts).
 *   - SameSite=None is required for cross-origin requests (e.g. localhost:5173
 *     dev frontend → api.succesly.in prod API). SameSite=None MUST pair with
 *     Secure=true — the browser rejects it otherwise.
 *   - SameSite=Lax is safe enough for plain-HTTP local dev (no cross-site POST).
 */
function buildCookieOptions(req: Request) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure:   isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    maxAge:   REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path:     '/api/v1/auth',
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip ?? req.socket?.remoteAddress;

  const { accessToken, refreshToken, csrfToken, user } =
    await authUseCase.login(value, userAgent, ipAddress);

  // Refresh token → HTTP-only cookie (unreadable by JS / extensions)
  // Access token + CSRF token → response body only (frontend stores in memory)
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions(req));

  sendSuccess(res, 'Login successful', { accessToken, csrfToken, user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  if (!refreshToken) {
    return sendError(res, 'Refresh token is required. Please login again.', 401);
  }

  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip ?? req.socket?.remoteAddress;

  const { accessToken, refreshToken: newRefreshToken, csrfToken } =
    await authUseCase.refresh(refreshToken, userAgent, ipAddress);

  // Rotate: set the new refresh token cookie, old session is already invalidated
  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, buildCookieOptions(req));

  sendSuccess(res, 'Token refreshed', { accessToken, csrfToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const sessionId    = req.user?.session_id;
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  await authUseCase.logout(sessionId, refreshToken);

  const cookieOpts = buildCookieOptions(req);
  res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieOpts, maxAge: 0 });

  sendSuccess(res, 'Logged out successfully', null);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.user_id;
  const result = await authUseCase.getProfile(userId);
  sendSuccess(res, 'Profile fetched successfully', result);
});
