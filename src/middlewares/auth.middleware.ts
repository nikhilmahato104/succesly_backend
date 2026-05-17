import { Request, Response, NextFunction } from 'express';
import jwt             from 'jsonwebtoken';
import { User }        from '../frameworks/mongo/model/user.model';
import { Session }     from '../frameworks/mongo/model/session.model';
import { IJwtPayload } from '../core/entities/user.entity';

/**
 * authMiddleware — THREE-STEP verification chain.
 *
 *  Step 1 — JWT signature & expiry (stateless)
 *    Extract Bearer token → verify signature with JWT_SECRET → check not expired.
 *
 *  Step 2 — Server-side session check (DB lookup)
 *    The JWT carries a session_id claim.  We verify that session still exists,
 *    is marked valid, and has not passed its expiry date.  This lets us
 *    invalidate all active tokens immediately on logout — even before the
 *    15-minute access token window closes.
 *    The session's csrf_token is attached to req.sessionCsrfToken for the
 *    csrfMiddleware that runs after this one on state-changing routes.
 *
 *  Step 3 — Live user status check (DB lookup)
 *    Catch accounts deactivated by an admin after the token was issued.
 */
export async function authMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {

  // ── Step 1: Extract and verify JWT ─────────────────────────────────────────
  const authHeader = req.headers['authorization'];
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Authorization token is required. Pass it as: Authorization: Bearer <token>',
    });
    return;
  }

  let decoded: IJwtPayload;
  try {
    const secret = process.env['JWT_SECRET'] ?? 'change_me';
    decoded      = jwt.verify(token, secret) as IJwtPayload;
  } catch (err) {
    const isExpired = (err as Error).name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      message: isExpired
        ? 'Unauthorized: Token has expired. Use /auth/refresh to get a new access token.'
        : 'Unauthorized: Invalid token.',
    });
    return;
  }

  // ── Step 2: Verify the server-side session ──────────────────────────────────
  if (!decoded.session_id) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Malformed token — missing session context.',
    });
    return;
  }

  const session = await Session.findById(decoded.session_id).select('is_valid expires_at csrf_token');

  if (!session || !session.is_valid || session.expires_at < new Date()) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Session has expired or been revoked. Please login again.',
    });
    return;
  }

  // Attach CSRF token so csrfMiddleware can compare without a second DB hit
  req.sessionCsrfToken = session.csrf_token;

  // ── Step 3: Check the user is still active ──────────────────────────────────
  const user = await User.findById(decoded.user_id).select('is_active');

  if (!user) {
    res.status(401).json({ success: false, message: 'Unauthorized: User account not found.' });
    return;
  }

  if (!user.is_active) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Your account has been deactivated. Please contact the administrator.',
    });
    return;
  }

  req.user = decoded;
  next();
}
