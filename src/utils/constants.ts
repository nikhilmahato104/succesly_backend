/** Bcrypt salt rounds — 12 is the industry standard (secure yet fast enough) */
export const SALT_ROUNDS = 12;

/** API key length in bytes → 64-char hex string */
export const API_KEY_BYTES = 32;

/** Header name for API key */
export const API_KEY_HEADER = 'x-api-key';

/** Default JWT expiry when not set in .env */
export const DEFAULT_JWT_EXPIRY = '7d';

// ─── Auth token constants ────────────────────────────────────────────────────

/** Short-lived access token lifetime (15 minutes) */
export const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token session lifetime in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** Random bytes for refresh token → 128-char hex string */
export const REFRESH_TOKEN_BYTES = 64;

/** Random bytes for CSRF token → 64-char hex string */
export const CSRF_TOKEN_BYTES = 32;

/** HTTP-only cookie name that holds the refresh token */
export const REFRESH_COOKIE_NAME = 'rt';

/** Header name the client sends the CSRF token in */
export const CSRF_HEADER = 'x-csrf-token';
