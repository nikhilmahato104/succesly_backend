import { studentPaths, studentSchemas }  from '../routes/student/student.swagger';
import { marksPaths,   marksSchemas }    from '../routes/marks/marks.swagger';
import { modulePaths,  moduleSchemas }   from '../routes/module/module.swagger';
import { rolePaths,    roleSchemas }     from '../routes/role/role.swagger';
import { userPaths,    userSchemas }     from '../routes/user/user.swagger';
import { authPaths,    authSchemas }     from '../routes/auth/auth.swagger';
import { apiKeyPaths,  apiKeySchemas }   from '../routes/api-key/api-key.swagger';
import { bookingPaths, bookingSchemas }  from '../routes/booking/booking.swagger';
import { boardPaths,   boardSchemas }    from '../routes/board/board.swagger';
import { projectPaths,      projectSchemas }     from '../routes/project/project.swagger';
import { activityLogPaths, activityLogSchemas }  from '../routes/activity-log/activity-log.swagger';
import { deviceInfoPaths, deviceInfoSchemas }    from '../routes/device-info/device-info.swagger';

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title:       'Backend API',
    version:     '1.0.0',
    description: [
      'Clean-architecture Node.js + Express.js + TypeScript API.',
      '',
      '**Architecture:** `Controller → Use-Case → IDataServices → MongoGenericRepository → MongoDB`',
      '',
      '**Auth:** All protected routes require **both** a valid JWT (`Authorization: Bearer <token>`) and a valid API key (`x-api-key: <key>`).',
      '',
      '**CSRF:** State-changing routes (POST / PATCH / DELETE) additionally require the `x-csrf-token` header. Get the token from the `csrf_token` field in the `POST /auth/login` response, then click **Authorize** and paste it into the `csrfToken` field.',
      '',
      '**Swagger structure:** Each module owns its own `module.swagger.ts` file. Adding a new resource = add one file + spread below.',
    ].join('\n'),
  },
  servers: [
    { url: 'https://api.succesly.in/api/v1', description: 'Production server' },
    { url: 'http://localhost:7000/api/v1',        description: 'Development server' },
  ],
  tags: [
    { name: 'Auth',      description: 'Login and profile' },
    { name: 'Users',     description: 'User management CRUD' },
    { name: 'Roles',     description: 'Role management CRUD' },
    { name: 'Modules',   description: 'Module/permission slug management' },
    { name: 'API Keys',  description: 'API key CRUD — keys are shown only on creation' },
    { name: 'Students',  description: 'Student management' },
    { name: 'Marks',     description: 'Subject-wise marks with student info via $lookup' },
    { name: 'Bookings',  description: 'Booking CRUD — auto-generated reference_id, conditional auth per route/field' },
    { name: 'Boards',    description: 'FigJam-style whiteboard boards — open routes, no auth required' },
    { name: 'Projects',  description: 'Freelancer project management — clients, billing, payment terms, deployment info' },
    { name: 'Projects — Payment Terms', description: 'Add installment terms and mark individual payments as paid' },
    { name: 'Projects — Maintenance Terms', description: 'Maintenance contract billing — add terms with coverage period and mark as paid' },
    { name: 'Activity Logs', description: 'Audit trail — who did what, when, on which record, with field-level diff and API metrics' },
    { name: 'Device Info',   description: 'Website visitor device tracking — public tracking endpoint, upsert-by-frontend_generated_uuid, per-URL hit counters' },
  ],
  paths: {
    ...authPaths,
    ...userPaths,
    ...rolePaths,
    ...modulePaths,
    ...apiKeyPaths,
    ...studentPaths,
    ...marksPaths,
    ...bookingPaths,
    ...boardPaths,
    ...projectPaths,
    ...activityLogPaths,
    ...deviceInfoPaths,
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type:         'http',
        scheme:       'bearer',
        bearerFormat: 'JWT',
        description:  'JWT token obtained from POST /auth/login',
      },
      apiKeyAuth: {
        type:        'apiKey',
        in:          'header',
        name:        'x-api-key',
        description: 'API key created via POST /api-keys (stored in DB)',
      },
      csrfToken: {
        type:        'apiKey',
        in:          'header',
        name:        'x-csrf-token',
        description: 'CSRF token — copy the `csrf_token` value returned in the POST /auth/login response and paste it here. Required on all state-changing requests (POST, PATCH, DELETE).',
      },
      bootstrapApiKey: {
        type:        'apiKey',
        in:          'header',
        name:        'x-api-key',
        description: 'Bootstrap key — value of FOR_API_KEY_CREATE_KEY in .env. Used ONLY for POST /api-keys to create your first DB key.',
      },
    },
    schemas: {
      ...authSchemas,
      ...userSchemas,
      ...roleSchemas,
      ...moduleSchemas,
      ...apiKeySchemas,
      ...studentSchemas,
      ...marksSchemas,
      ...bookingSchemas,
      ...boardSchemas,
      ...projectSchemas,
      ...activityLogSchemas,
      ...deviceInfoSchemas,
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string',  example: 'Validation failed' },
          errors:  { type: 'array',   items: { type: 'string' } },
        },
      },
    },
  },
};
