import { Request, Response, NextFunction } from 'express';
import { sendError }  from '../utils/response.util';
import { AppError }   from '../utils/app-error.util';

interface MongoError extends Error {
  code?:     number;
  keyValue?: Record<string, unknown>;
  kind?:     string;
}

/**
 * Global error middleware — must have exactly 4 parameters.
 * Express identifies it as an error handler by the (err, req, res, next) signature.
 *
 * Error priority (first match wins):
 *  1. AppError        — our own operational errors with a status code attached
 *  2. Mongoose ValidationError — schema-level required/type failures
 *  3. MongoDB 11000   — duplicate unique index violation
 *  4. Mongoose CastError — invalid ObjectId in route params
 *  5. Everything else — unexpected 500 (programming bugs, network failures)
 */
export const errorMiddleware = (
  err:  MongoError,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void => {

  // ── Always log full details to terminal (Render logs / nodemon console) ──
  console.error(`\n[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(`  Status : ${(err as AppError).statusCode ?? 500}`);
  console.error(`  Message: ${err.message}`);
  console.error(`  Stack  : ${err.stack ?? 'no stack'}`);
  if (err.code)     console.error(`  Code   : ${err.code}`);
  if (err.keyValue) console.error(`  Key    : ${JSON.stringify(err.keyValue)}`);

  // ── 1. Our own AppError (business logic errors with known status codes) ─
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.details ?? null);
    return;
  }

  // ── 2. Mongoose schema validation (missing required fields, type errors) ─
  if (err.name === 'ValidationError') {
    const messages = Object.values(
      (err as unknown as { errors: Record<string, { message: string }> }).errors
    ).map(e => e.message);
    sendError(res, 'Validation failed', 400, messages);
    return;
  }

  // ── 3. MongoDB duplicate key (code 11000) ──────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    sendError(res, `Duplicate value: '${field}' already exists`, 409);
    return;
  }

  // ── 4. Mongoose CastError — invalid ObjectId in :id param ─────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    sendError(res, 'Invalid ID format — must be a valid MongoDB ObjectId', 400);
    return;
  }

  // ── 5. Unexpected error — do not leak internals to the client ──────────
  sendError(res, 'Internal server error', 500);
};
