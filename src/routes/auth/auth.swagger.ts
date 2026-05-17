export const authPaths = {

  // ── POST /auth/login ────────────────────────────────────────────────────────
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login — returns access token + CSRF token; sets HTTP-only refresh cookie',
      description:
        'Validates email + password. On success returns a **short-lived access token (15 min)** ' +
        'and a **CSRF token** in the response body, and sets an **HTTP-only `rt` cookie** ' +
        'containing the refresh token (7 days). ' +
        'Store `accessToken` and `csrfToken` **in memory only** (never localStorage or a readable cookie). ' +
        'The `rt` cookie is managed by the browser automatically.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } } },
      },
      responses: {
        200: {
          description: 'Login successful',
          headers: {
            'Set-Cookie': {
              description:
                'HTTP-only refresh token cookie: `rt=<token>; Path=/api/v1/auth; HttpOnly; SameSite=None; Secure`',
              schema: { type: 'string' },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginResponse' },
            },
          },
        },
        400: { description: 'Validation error — missing or invalid fields' },
        401: { description: 'Invalid email or password / account deactivated' },
      },
    },
  },

  // ── POST /auth/refresh ──────────────────────────────────────────────────────
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh — silently issues a new access token using the HTTP-only rt cookie',
      description:
        '**No request body needed.** The browser automatically sends the `rt` HTTP-only cookie. ' +
        'Returns a new `accessToken` and `csrfToken`, and rotates the `rt` cookie (old session is immediately invalidated). ' +
        '\n\n**To test in Swagger:** Call `/auth/login` first — the browser will store the `rt` cookie. ' +
        'Then call this endpoint; the cookie is sent automatically because both are on the same domain. ' +
        '\n\n**In frontend code:** Call this when any protected API returns `401 "Token has expired"`, ' +
        'update tokens in memory, then retry the failed request.',
      requestBody: {
        required: false,
        content: { 'application/json': { schema: { type: 'object' }, example: {} } },
      },
      parameters: [
        {
          name: 'rt',
          in: 'cookie',
          required: true,
          description:
            'HTTP-only refresh token cookie set by `/auth/login`. ' +
            'The browser sends it automatically — you cannot set it manually in Swagger. ' +
            'Login first via `/auth/login` to populate the cookie.',
          schema: { type: 'string', example: 'a3f9bc84d2e1...(128 hex chars)' },
        },
      ],
      responses: {
        200: {
          description: 'Token refreshed successfully',
          headers: {
            'Set-Cookie': {
              description: 'New rotated `rt` cookie (old one is invalidated)',
              schema: { type: 'string' },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshResponse' },
            },
          },
        },
        401: {
          description:
            'No `rt` cookie present / cookie is invalid or expired / session was revoked. ' +
            'User must login again.',
        },
      },
    },
  },

  // ── POST /auth/logout ───────────────────────────────────────────────────────
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout — invalidates the server-side session and clears the rt cookie',
      description:
        'Requires a valid **Bearer access token** and the **`x-csrf-token` header**. ' +
        'Immediately sets `is_valid = false` on the session in the database — ' +
        'any subsequent requests with the old access token will be rejected at Step 2 of the auth middleware chain, ' +
        'even before the 15-minute access token window closes. ' +
        'Also clears the `rt` cookie.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'x-csrf-token',
          in: 'header',
          required: true,
          description: 'CSRF token received from `/auth/login` or `/auth/refresh` response body.',
          schema: { type: 'string', example: 'b7c2d4e6f8...(64 hex chars)' },
        },
      ],
      requestBody: {
        required: false,
        content: { 'application/json': { schema: { type: 'object' }, example: {} } },
      },
      responses: {
        200: {
          description: 'Logged out successfully — rt cookie is cleared',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Logged out successfully' },
                  data:    { type: 'object', nullable: true, example: null },
                },
              },
            },
          },
        },
        401: { description: 'Missing / expired / invalid access token' },
        403: { description: 'Missing or invalid x-csrf-token header' },
      },
    },
  },

  // ── GET /auth/profile ───────────────────────────────────────────────────────
  '/auth/profile': {
    get: {
      tags: ['Auth'],
      summary: 'Get current user profile (requires Bearer token)',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Profile fetched successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProfileResponse' },
            },
          },
        },
        401: { description: 'Unauthorized — missing or invalid access token' },
      },
    },
  },
};

export const authSchemas = {

  LoginDto: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email:    { type: 'string', format: 'email', example: 'admin@example.com' },
      password: { type: 'string', format: 'password', example: 'Admin@1234' },
    },
  },

  LoginResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Login successful' },
      data: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'Short-lived JWT (15 min). Store in JS memory ONLY — never localStorage or a cookie.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          csrfToken: {
            type: 'string',
            description:
              'Per-session CSRF token (64 hex chars). Store in JS memory. ' +
              'Send as `x-csrf-token` header on every POST / PUT / PATCH / DELETE request.',
            example: 'a3f9bc84d2e1c7f05b96d43a8e2f1c70d9b84e3a1f7c2d5e6a9b0c4d8e1f3a2b',
          },
          user: { $ref: '#/components/schemas/JwtPayload' },
        },
      },
    },
  },

  RefreshResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Token refreshed' },
      data: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'New short-lived JWT (15 min). Replace the old one in memory.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          csrfToken: {
            type: 'string',
            description: 'New CSRF token. Replace the old one in memory.',
            example: 'c8d1e4f7a2b5c9d0e3f6a1b4c7d0e3f6a1b4c7d0e3f6a1b4c7d0e3f6a1b4c7d0',
          },
        },
      },
    },
  },

  JwtPayload: {
    type: 'object',
    properties: {
      user_id:    { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' },
      email:      { type: 'string', example: 'admin@example.com' },
      role_id:    { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0e' },
    },
  },

  ProfileResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Profile fetched successfully' },
      data:    { type: 'object',  description: 'Full user document with role details (password excluded)' },
    },
  },
};
