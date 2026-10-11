import { Request, Response, NextFunction } from 'express';
import { apiKeyMiddleware } from './api-key.middleware';
import { API_KEY_HEADER }   from '../utils/constants';

/**
 * POST /device-info — the tracking snippet runs in an anonymous visitor's
 * browser, so it can never carry a JWT. API key stays OPTIONAL here:
 *   - No key supplied            → anonymous tracking is allowed.
 *   - Key supplied (x-api-key or api_key in body) → it MUST be valid,
 *     so a site that chooses to identify itself can't be spoofed with a
 *     garbage key.
 */
export function conditionalDeviceTrackApiKey(
  req: Request, res: Response, next: NextFunction,
): Promise<void> | void {
  const hasKey = !!(req.headers[API_KEY_HEADER] || req.body?.api_key);
  if (hasKey) {
    return apiKeyMiddleware(req, res, next);
  }
  next();
}
