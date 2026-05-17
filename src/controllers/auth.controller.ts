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

/** Shared cookie options for the HTTP-only refresh token */
const refreshCookieOptions = {
  httpOnly: true,                                          // JS cannot read this cookie
  secure:   process.env['NODE_ENV'] === 'production',      // HTTPS-only in production
  sameSite: 'strict' as const,                            // Never sent on cross-site requests
  maxAge:   REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path:     '/api/v1/auth',                                // Scope cookie to auth endpoints only
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip ?? req.socket?.remoteAddress;

  const { accessToken, refreshToken, csrfToken, user } =
    await authUseCase.login(value, userAgent, ipAddress);

  // Refresh token goes into an HTTP-only cookie — JavaScript (and cookie editor
  // extensions) cannot read it.  Access token and CSRF token go into the body
  // so the frontend stores them in memory only (never localStorage / cookies).
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

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

  // Rotate the refresh token cookie
  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions);

  sendSuccess(res, 'Token refreshed', { accessToken, csrfToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Try to invalidate the server-side session — use whichever identifier is available
  const sessionId    = req.user?.session_id;
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  await authUseCase.logout(sessionId, refreshToken);

  // Clear the refresh token cookie
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions, maxAge: 0 });

  sendSuccess(res, 'Logged out successfully', null);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.user_id;
  const result = await authUseCase.getProfile(userId);
  sendSuccess(res, 'Profile fetched successfully', result);
});
