import { Request, Response, NextFunction } from 'express';
import { BookingVia }     from '../core/entities/booking.entity';
import { apiKeyMiddleware } from './api-key.middleware';
import { API_KEY_HEADER }   from '../utils/constants';

/**
 * POST /bookings — API key is required ONLY when booking_via = "whatsapp_to_crm"
 * (CRM agent creating a booking on behalf of a WhatsApp customer).
 * App / website / laptop / call bookings are self-service; no API key needed.
 */
export function conditionalBookingCreateApiKey(
  req: Request, res: Response, next: NextFunction,
): Promise<void> | void {
  if (req.body?.booking_via === BookingVia.WHATSAPP_TO_CRM) {
    return apiKeyMiddleware(req, res, next);
  }
  next();
}

/**
 * PATCH /bookings/:id — API key is required when ANY field OTHER THAN
 * booking_status / cancellation_reason is being updated.
 *
 * Why: Normal users can cancel their own booking (status + reason) without an API key.
 *      Only CRM admins (who hold an API key) may change operational fields like
 *      branch, user_phone, address, booking_via, etc.
 */
const USER_ONLY_FIELDS = new Set(['booking_status', 'cancellation_reason']);

export function conditionalBookingPatchApiKey(
  req: Request, res: Response, next: NextFunction,
): Promise<void> | void {
  const bodyKeys    = Object.keys(req.body ?? {});
  const needsApiKey = bodyKeys.some(k => !USER_ONLY_FIELDS.has(k));
  if (needsApiKey) {
    return apiKeyMiddleware(req, res, next);
  }
  next();
}

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
