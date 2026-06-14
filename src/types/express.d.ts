import { IJwtPayload } from '../core/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?:                  IJwtPayload;
      isApiKeyAuthenticated?: boolean;
      /** CSRF token for the current session — set by authMiddleware, read by csrfMiddleware */
      sessionCsrfToken?:      string;
      /** Unix epoch ms stamped by requestTimerMiddleware — used to compute response_time_ms in logs */
      startTime?:             number;
    }
  }
}
