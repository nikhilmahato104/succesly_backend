export const boardPaths = {
  '/boards': {
    get: {
      tags:    ['Boards'],
      summary: 'Get all boards — paginated, searchable, sortable. objects array excluded (metadata only).',
      parameters: [
        { in: 'query', name: 'page',   schema: { type: 'integer', example: 1 },          description: 'Page number (default: 1)' },
        { in: 'query', name: 'limit',  schema: { type: 'integer', example: 20 },         description: 'Items per page (default: 20, max: 50)' },
        { in: 'query', name: 'search', schema: { type: 'string',  example: 'project' },  description: 'Search by name (case-insensitive)' },
        { in: 'query', name: 'sort',   schema: { type: 'string',  enum: ['updatedAt', 'createdAt', 'name'] }, description: 'Sort field (default: updatedAt)' },
        { in: 'query', name: 'order',  schema: { type: 'string',  enum: ['asc', 'desc'] },                   description: 'Sort direction (default: desc)' },
      ],
      responses: {
        200: { description: 'Board list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedBoardResponse' } } } },
      },
    },
    post: {
      tags:    ['Boards'],
      summary: 'Create a new board',
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBoardDto' } } } },
      responses: {
        201: { description: 'Board created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BoardResponse' } } } },
        400: { description: 'Validation error' },
      },
    },
  },

  '/boards/{id}': {
    get: {
      tags:    ['Boards'],
      summary: 'Get board by ID — returns full objects array and cameraState',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', example: 'Vj6MwrLmGALjG0TQPkv5Ab' } }],
      responses: {
        200: { description: 'Full board', content: { 'application/json': { schema: { $ref: '#/components/schemas/BoardResponse' } } } },
        404: { description: 'Board not found' },
      },
    },
    patch: {
      tags:    ['Boards'],
      summary: 'Update board name — slug is auto-regenerated',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateBoardDto' } } } },
      responses: {
        200: { description: 'Board updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateBoardResponse' } } } },
        400: { description: 'Validation error' },
        404: { description: 'Board not found' },
      },
    },
    delete: {
      tags:    ['Boards'],
      summary: 'Soft-delete board (sets deletedAt — never hard-deleted)',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Board deleted' },
        404: { description: 'Board not found or already deleted' },
      },
    },
  },

  '/boards/{id}/save': {
    put: {
      tags:    ['Boards'],
      summary: 'Autosave — called every 3s while editing. Increments version and writes a BoardHistory snapshot. Max 20 snapshots per board.',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SaveBoardDto' } } } },
      responses: {
        200: { description: 'Saved', content: { 'application/json': { schema: { $ref: '#/components/schemas/SaveBoardResponse' } } } },
        400: { description: 'Validation error' },
        404: { description: 'Board not found' },
        422: { description: 'Board object limit reached (> 10 000 objects)' },
      },
    },
  },

  '/boards/{id}/duplicate': {
    post: {
      tags:    ['Boards'],
      summary: 'Duplicate board — creates "Copy of {name}" with fresh version history',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      responses: {
        201: { description: 'Duplicate created', content: { 'application/json': { schema: { $ref: '#/components/schemas/DuplicateBoardResponse' } } } },
        404: { description: 'Board not found' },
      },
    },
  },

  '/boards/{id}/history': {
    get: {
      tags:    ['Boards'],
      summary: 'Get version history metadata (no objects — lightweight)',
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'History list', content: { 'application/json': { schema: { $ref: '#/components/schemas/BoardHistoryResponse' } } } },
        404: { description: 'Board not found' },
      },
    },
  },

  '/boards/{id}/history/{version}': {
    get: {
      tags:    ['Boards'],
      summary: 'Get full objects array for a specific version',
      parameters: [
        { in: 'path', name: 'id',      required: true, schema: { type: 'string' } },
        { in: 'path', name: 'version', required: true, schema: { type: 'integer', example: 10 } },
      ],
      responses: {
        200: { description: 'Version snapshot', content: { 'application/json': { schema: { $ref: '#/components/schemas/BoardVersionResponse' } } } },
        404: { description: 'Board or version not found' },
      },
    },
  },

  '/boards/{id}/history/{version}/restore': {
    post: {
      tags:    ['Boards'],
      summary: 'Restore board to a previous version — runs autosave logic, increments version',
      parameters: [
        { in: 'path', name: 'id',      required: true, schema: { type: 'string' } },
        { in: 'path', name: 'version', required: true, schema: { type: 'integer', example: 10 } },
      ],
      responses: {
        200: { description: 'Version restored', content: { 'application/json': { schema: { $ref: '#/components/schemas/RestoreVersionResponse' } } } },
        404: { description: 'Board or version not found' },
      },
    },
  },
};

export const boardSchemas = {
  Board: {
    type: 'object',
    properties: {
      _id:         { type: 'string',  example: 'Vj6MwrLmGALjG0TQPkv5Ab', description: 'nanoid 21-char string' },
      name:        { type: 'string',  example: 'My Project Board' },
      slug:        { type: 'string',  example: 'my-project-board' },
      thumbnail:   { type: 'string',  nullable: true, description: 'base64 PNG', example: null },
      objectCount: { type: 'integer', example: 47 },
      version:     { type: 'integer', example: 12 },
      cameraState: { type: 'object',  properties: { x: { type: 'number' }, y: { type: 'number' }, scale: { type: 'number' } } },
      objects:     { type: 'array',   description: 'Only returned by GET /boards/:id' },
      createdAt:   { type: 'string',  format: 'date-time' },
      updatedAt:   { type: 'string',  format: 'date-time' },
    },
  },
  CreateBoardDto: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', maxLength: 100, example: 'My Project Board' },
    },
  },
  UpdateBoardDto: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', maxLength: 100, example: 'New Board Name' },
    },
  },
  SaveBoardDto: {
    type: 'object',
    required: ['objects', 'cameraState'],
    properties: {
      objects:     { type: 'array', description: 'CanvasObject[] — strokes, stickies, texts, shapes, arrows' },
      cameraState: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, scale: { type: 'number', minimum: 0 } } },
      thumbnail:   { type: 'string', nullable: true, description: 'base64 PNG — optional' },
    },
  },
  BoardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board fetched successfully' },
      data:    { $ref: '#/components/schemas/Board' },
    },
  },
  UpdateBoardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board updated successfully' },
      data: {
        type: 'object',
        properties: {
          id:        { type: 'string' },
          name:      { type: 'string',  example: 'New Board Name' },
          slug:      { type: 'string',  example: 'new-board-name' },
          updatedAt: { type: 'string',  format: 'date-time' },
        },
      },
    },
  },
  SaveBoardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board saved successfully' },
      data: {
        type: 'object',
        properties: {
          version:     { type: 'integer', example: 13 },
          objectCount: { type: 'integer', example: 48 },
          savedAt:     { type: 'string',  format: 'date-time' },
        },
      },
    },
  },
  DuplicateBoardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board duplicated successfully' },
      data: {
        type: 'object',
        properties: {
          id:   { type: 'string', example: 'newNanoid21charsHere_' },
          name: { type: 'string', example: 'Copy of My Project Board' },
          slug: { type: 'string', example: 'copy-of-my-project-board' },
        },
      },
    },
  },
  PaginatedBoardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Boards fetched successfully' },
      data: {
        type: 'object',
        properties: {
          boards:     { type: 'array', items: { $ref: '#/components/schemas/Board' } },
          pagination: {
            type: 'object',
            properties: {
              total:      { type: 'integer', example: 45 },
              page:       { type: 'integer', example: 1 },
              limit:      { type: 'integer', example: 20 },
              totalPages: { type: 'integer', example: 3 },
              hasNext:    { type: 'boolean', example: true },
              hasPrev:    { type: 'boolean', example: false },
            },
          },
        },
      },
    },
  },
  BoardHistoryResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board history fetched successfully' },
      data: {
        type: 'object',
        properties: {
          versions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                version:     { type: 'integer', example: 13 },
                objectCount: { type: 'integer', example: 48 },
                savedAt:     { type: 'string',  format: 'date-time' },
              },
            },
          },
        },
      },
    },
  },
  BoardVersionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board version fetched successfully' },
      data: {
        type: 'object',
        properties: {
          version: { type: 'integer', example: 10 },
          objects: { type: 'array' },
          savedAt: { type: 'string',  format: 'date-time' },
        },
      },
    },
  },
  RestoreVersionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string',  example: 'Board version restored successfully' },
      data: {
        type: 'object',
        properties: {
          version: { type: 'integer', example: 14 },
          savedAt: { type: 'string',  format: 'date-time' },
        },
      },
    },
  },
};
