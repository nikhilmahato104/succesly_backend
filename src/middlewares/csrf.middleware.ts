import { Request, Response, NextFunction } from 'express';
import { CSRF_HEADER } from '../utils/constants';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * csrfMiddleware — validates the X-CSRF-Token header on every state-changing
 * request (POST / PUT / PATCH / DELETE).
 *
 * MUST run AFTER authMiddleware, which sets req.sessionCsrfToken by reading
 * the csrf_token stored in the server-side session document.
 *
 * Attack this prevents:
 *   A malicious site tricks the user's browser into making a cross-origin
 *   request.  Even though the HTTP-only refresh token cookie would be sent
 *   automatically, the attacker cannot read the CSRF token from memory
 *   (it was never in a cookie or localStorage) and therefore cannot set the
 *   X-CSRF-Token header — the request is rejected.
 */
export function csrfMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  if (!STATE_CHANGING.has(req.method)) {
    next();
    return;
  }

  // No authenticated session → let authMiddleware handle it (already ran)
  if (!req.sessionCsrfToken) {
    next();
    return;
  }

  const clientToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!clientToken) {
    res.status(403).json({
      success: false,
      message: `Forbidden: CSRF token required. Send your session's csrf_token in the '${CSRF_HEADER}' header.`,
    });
    return;
  }

  // Constant-time comparison to resist timing attacks
  const expected = Buffer.from(req.sessionCsrfToken, 'utf8');
  const received = Buffer.from(clientToken,           'utf8');

  const match =
    expected.length === received.length &&
    // timingSafeEqual throws if buffers differ in length — guard above covers that
    require('crypto').timingSafeEqual(expected, received);

  if (!match) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid CSRF token.',
    });
    return;
  }

  next();
}
