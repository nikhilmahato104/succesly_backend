/**
 * AppError — Custom error class for all business/operational errors.
 *
 * WHY:
 *   Plain `throw new Error('message')` has no HTTP status code attached.
 *   The global error middleware cannot know whether the error should be
 *   a 400, 401, 403, 404, or 409 — it has to guess from the message string,
 *   which is fragile and causes unhandled cases to fall through to 500.
 *
 *   With AppError every `throw` carries its own status code:
 *     throw new AppError('User not found', 404);
 *     throw new AppError('Invalid email or password', 401);
 *     throw new AppError('Email already exists', 409);
 *
 *   The error middleware just reads err.statusCode — no string matching needed.
 *
 * isOperational = true  → known, expected error (wrong password, not found, etc.)
 * isOperational = false → unexpected programming bug (default Error) — should page on-call
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  /** Optional structured payload returned to the client as `errors` (e.g. slug suggestions) */
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode    = statusCode;
    this.isOperational = isOperational;
    this.details       = details;

    // Maintain proper prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (Node.js V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
