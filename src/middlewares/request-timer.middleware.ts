import { Request, Response, NextFunction } from 'express';

/**
 * requestTimerMiddleware — stamps every incoming request with a high-resolution
 * start timestamp so downstream code can calculate response time in milliseconds.
 *
 * Mount this FIRST in app.ts (before routes) so all request paths are covered.
 * Controllers read req.startTime and pass it to activityLogService.log().
 */
export function requestTimerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.startTime = Date.now();
  next();
}
