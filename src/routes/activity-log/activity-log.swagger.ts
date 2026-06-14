const readOnly = [{ bearerAuth: [], apiKeyAuth: [] }];

export const activityLogPaths = {

  '/activity-logs/summary': {
    get: {
      tags: ['Activity Logs'],
      summary: 'Summary stats — total logs grouped by action and module',
      description: [
        '## Activity Log Summary',
        '',
        'Returns aggregate counts useful for admin dashboard charts.',
        '',
        '**Auth:** JWT + API key + role permission `activity_log:view`',
        '',
        '### Response shape',
        '```json',
        '{',
        '  "data": {',
        '    "total": 284,',
        '    "by_action": [',
        '      { "_id": "create", "count": 92 },',
        '      { "_id": "update", "count": 110 },',
        '      { "_id": "delete", "count": 18 },',
        '      { "_id": "mark_paid", "count": 64 }',
        '    ],',
        '    "by_module": [',
        '      { "_id": "project", "count": 220 },',
        '      { "_id": "booking", "count": 64 }',
        '    ]',
        '  }',
        '}',
        '```',
      ].join('\n'),
      security: readOnly,
      parameters: [
        { in: 'query', name: 'user_id',   schema: { type: 'string' }, description: 'Scope stats to a single user' },
        { in: 'query', name: 'module',    schema: { type: 'string', example: 'project' }, description: 'Scope stats to one module' },
        { in: 'query', name: 'date_from', schema: { type: 'string', format: 'date', example: '2026-06-01' } },
        { in: 'query', name: 'date_to',   schema: { type: 'string', format: 'date', example: '2026-06-30' } },
      ],
      responses: {
        200: { description: 'Summary object', content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityLogSummaryResponse' } } } },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — missing activity_log:view permission' },
      },
    },
  },

  '/activity-logs': {
    get: {
      tags: ['Activity Logs'],
      summary: 'List all activity logs — paginated, searchable, multi-filter',
      description: [
        '## Get All Activity Logs',
        '',
        'Returns a paginated audit trail. Every create / update / delete / mark_paid action on every module is recorded here with:',
        '- **Who** did it (user_id, user_email)',
        '- **What** happened (action, module, entity_ref)',
        '- **Full sentence** description (e.g. "nikhil updated project \'Salon CRM\' — changed project_status from \'lead\' to \'in_progress\'")',
        '- **Field-level diff** for updates (changes array)',
        '- **API metrics** (method, endpoint, status_code, response_time_ms)',
        '',
        '**Auth:** JWT + API key + role permission `activity_log:view`',
        '',
        '### Search',
        '`search` param does case-insensitive match across: `description`, `endpoint`, `entity_ref`, `user_email`',
        '',
        '### Filters',
        '| Param | Description |',
        '|-------|-------------|',
        '| `module` | e.g. `project`, `booking`, `user` |',
        '| `action` | `create`, `update`, `delete`, `view`, `list`, `mark_paid`, `add_term` |',
        '| `method` | `GET`, `POST`, `PATCH`, `DELETE` |',
        '| `is_success` | `true` = successful API calls only |',
        '| `user_id` | Filter by a specific user\'s ObjectId |',
        '| `user_email` | Partial match on email |',
        '| `entity_id` | All logs for a specific document (e.g. a project\'s _id) |',
        '| `date_from` + `date_to` | Date range filter on `createdAt` |',
        '',
        '### Pagination',
        'Pass `page` + `limit`. Default: page 1, limit 20. Omit both to get all records.',
      ].join('\n'),
      security: readOnly,
      parameters: [
        { in: 'query', name: 'page',       schema: { type: 'integer', example: 1 } },
        { in: 'query', name: 'limit',      schema: { type: 'integer', example: 20 } },
        { in: 'query', name: 'search',     schema: { type: 'string',  example: 'nikhil updated' }, description: 'Free-text search on description, endpoint, entity_ref, user_email' },
        { in: 'query', name: 'module',     schema: { type: 'string',  example: 'project' },        description: 'Filter by module name' },
        { in: 'query', name: 'action',     schema: { type: 'string',  enum: ['create', 'update', 'delete', 'view', 'list', 'mark_paid', 'add_term'] } },
        { in: 'query', name: 'method',     schema: { type: 'string',  enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] } },
        { in: 'query', name: 'is_success', schema: { type: 'boolean', example: true },             description: 'true = only successful calls | false = only failed calls' },
        { in: 'query', name: 'user_id',    schema: { type: 'string' },                             description: 'Filter by user ObjectId' },
        { in: 'query', name: 'user_email', schema: { type: 'string',  example: 'nikhil' },         description: 'Partial match on user email' },
        { in: 'query', name: 'entity_id',  schema: { type: 'string' },                             description: 'All logs touching a specific document (e.g. project _id)' },
        { in: 'query', name: 'date_from',  schema: { type: 'string',  format: 'date', example: '2026-06-01' }, description: 'createdAt >= date_from' },
        { in: 'query', name: 'date_to',    schema: { type: 'string',  format: 'date', example: '2026-06-30' }, description: 'createdAt <= date_to (end of day: 23:59:59)' },
      ],
      responses: {
        200: { description: 'Paginated log list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedActivityLogResponse' } } } },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — missing activity_log:view permission' },
      },
    },
  },

  '/activity-logs/{id}': {
    get: {
      tags: ['Activity Logs'],
      summary: 'Get a single activity log by ID',
      description: [
        '## Get Activity Log by ID',
        '',
        'Returns the full log record including the `changes` array (field-level diff for update actions).',
        '',
        '**Auth:** JWT + API key + role permission `activity_log:view`',
      ].join('\n'),
      security: readOnly,
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' }, description: 'MongoDB ObjectId of the log entry' },
      ],
      responses: {
        200: { description: 'Full log entry with changes array', content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityLogSuccessResponse' } } } },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Log not found' },
      },
    },
  },
};

export const activityLogSchemas = {

  FieldChange: {
    type: 'object',
    description: 'A single field-level change recorded during an update action',
    properties: {
      field: { type: 'string', example: 'project_status',  description: 'Name of the field that changed' },
      from:  { type: 'string', example: 'lead',            description: 'Previous value' },
      to:    { type: 'string', example: 'in_progress',     description: 'New value' },
    },
  },

  ActivityLog: {
    type: 'object',
    description: 'A single audit log entry',
    properties: {
      _id:              { type: 'string',  example: '664f1a2b3c4d5e6f7a8b9c0d' },
      user_id:          { type: 'string',  example: '664f1a2b3c4d5e6f7a8b9c01',  description: 'MongoDB ObjectId of the user who performed the action' },
      user_email:       { type: 'string',  example: 'nikhil@wesoftek.com',        description: 'Email of the user — extracted from JWT' },
      action:           { type: 'string',  enum: ['create', 'update', 'delete', 'view', 'list', 'mark_paid', 'add_term'], example: 'update' },
      module:           { type: 'string',  example: 'project',                    description: 'Module/domain the action was performed on' },
      entity_id:        { type: 'string',  example: '664f1a2b3c4d5e6f7a8b9c0f',  description: 'MongoDB ObjectId of the affected document' },
      entity_ref:       { type: 'string',  example: 'Salon CRM (PRJ-15062026-00001)', description: 'Human-readable label for the affected document' },
      description:      { type: 'string',  example: "nikhil updated project 'Salon CRM' — changed project_status from 'lead' to 'in_progress', payment_total_amount from '20000' to '25000'", description: 'Full meaningful sentence describing the action' },
      changes: {
        type: 'array',
        description: 'Field-level diff — only present for update actions',
        items: { $ref: '#/components/schemas/FieldChange' },
        example: [
          { field: 'project_status',      from: 'lead',  to: 'in_progress' },
          { field: 'payment_total_amount', from: 20000,   to: 25000 },
        ],
      },
      method:           { type: 'string',  enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], example: 'PATCH' },
      endpoint:         { type: 'string',  example: '/api/v1/projects/664f1a2b3c4d5e6f7a8b9c0f', description: 'Full API endpoint path' },
      status_code:      { type: 'integer', example: 200,   description: 'HTTP response status code' },
      is_success:       { type: 'boolean', example: true,  description: 'true if status_code < 400' },
      response_time_ms: { type: 'integer', example: 42,    description: 'Total time the API took to respond in milliseconds' },
      ip_address:       { type: 'string',  example: '192.168.1.100', description: 'Client IP address' },
      createdAt:        { type: 'string',  format: 'date-time' },
    },
  },

  ActivityLogSuccessResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Activity log fetched successfully' },
      data:    { $ref: '#/components/schemas/ActivityLog' },
    },
  },

  PaginatedActivityLogResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Activity logs fetched successfully' },
      data: {
        type: 'object',
        properties: {
          data:       { type: 'array', items: { $ref: '#/components/schemas/ActivityLog' } },
          total:      { type: 'integer', example: 284 },
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 15 },
        },
      },
    },
  },

  ActivityLogSummaryResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Activity log summary fetched successfully' },
      data: {
        type: 'object',
        properties: {
          total:     { type: 'integer', example: 284 },
          by_action: { type: 'array', items: { type: 'object', properties: { _id: { type: 'string' }, count: { type: 'integer' } } } },
          by_module: { type: 'array', items: { type: 'object', properties: { _id: { type: 'string' }, count: { type: 'integer' } } } },
        },
      },
    },
  },
};
