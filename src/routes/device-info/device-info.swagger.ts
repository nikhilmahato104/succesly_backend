const jwtOnly   = [{ bearerAuth: [] }];
const jwtAndKey = [{ bearerAuth: [], apiKeyAuth: [] }];

export const deviceInfoPaths = {
  '/device-info': {
    post: {
      tags: ['Device Info'],
      summary: 'Track a device/page-hit — PUBLIC, no JWT required',
      description: [
        'Called directly from the tracking snippet embedded in the client website — the',
        'visitor\'s browser has no login session, so **no JWT is required** on this route.',
        '',
        '**API key is OPTIONAL, not conditional on a field:** if the embedding site chooses',
        'to send `x-api-key` (header) or `api_key` (body) to identify itself, the key MUST',
        'be valid or the request is rejected with 401. If no key is sent at all, the hit is',
        'still recorded anonymously.',
        '',
        '### `frontend_generated_uuid` — the identity key',
        'Generate this ONCE per device on the frontend (e.g. `crypto.randomUUID()`), persist',
        'it in `localStorage`, and send the **same value on every call** for that device.',
        '- **First time seen** → a brand-new `DeviceInfo` document is created.',
        '- **Already seen**    → the SAME document is updated in place. A second document is',
        '  **never** created for a uuid that already exists.',
        '',
        '### `url` and `website_all_url_route`',
        'Send the current page URL as `url` on every call. The server maintains',
        '`website_all_url_route`, an array of `{ url, hit_count, created_at, last_hit_at }`:',
        '- If `url` is **new** for this device → a new entry is pushed with `hit_count: 1`.',
        '- If `url` was **already hit before** → that entry\'s `hit_count` is incremented and',
        '  `last_hit_at` is refreshed to now. `created_at` on that entry never changes.',
        '',
        '### `device_change`',
        'A counter on the document, incremented automatically only when an existing device',
        '(matched by `frontend_generated_uuid`) sends a `device_name` different from what is',
        'already stored — i.e. it counts how many times the device identity itself changed,',
        'not how many times the device was seen.',
        '',
        '### `device_ip`',
        'Never trust a client-sent IP. The server always derives `device_ip` itself from',
        '`X-Forwarded-For` / the socket address — any `device_ip` in the request body is ignored.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TrackDeviceInfoDto' },
            examples: {
              firstVisit: {
                summary: 'First time this device is seen',
                value: {
                  frontend_generated_uuid: '2f6a2b3a-8e11-4c0a-9d3e-1a2b3c4d5e6f',
                  device_number: 'WEB-CHROME-135',
                  device_name:   'Chrome on Windows',
                  country:       'IN',
                  lat:           31.326,
                  long:          75.576,
                  website_name:  'succesly.in',
                  url:           'https://succesly.in/pricing',
                },
              },
              repeatVisitSamePage: {
                summary: 'Same device, same page again → hit_count++',
                value: {
                  frontend_generated_uuid: '2f6a2b3a-8e11-4c0a-9d3e-1a2b3c4d5e6f',
                  device_number: 'WEB-CHROME-135',
                  device_name:   'Chrome on Windows',
                  website_name:  'succesly.in',
                  url:           'https://succesly.in/pricing',
                },
              },
              repeatVisitNewPage: {
                summary: 'Same device, new page → new entry pushed',
                value: {
                  frontend_generated_uuid: '2f6a2b3a-8e11-4c0a-9d3e-1a2b3c4d5e6f',
                  device_number: 'WEB-CHROME-135',
                  device_name:   'Chrome on Windows',
                  website_name:  'succesly.in',
                  url:           'https://succesly.in/contact',
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Device info created or updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceInfo' } } } },
        400: { description: 'Validation error' },
        401: { description: 'Invalid API key (only if one was supplied)' },
      },
    },
    get: {
      tags: ['Device Info'],
      summary: 'Get all device-info records — search, filter, pagination (JWT + API key, admin)',
      security: jwtAndKey,
      parameters: [
        { in: 'query', name: 'page',          schema: { type: 'integer', example: 1 },  description: 'Page number' },
        { in: 'query', name: 'limit',         schema: { type: 'integer', example: 10 }, description: 'Items per page' },
        { in: 'query', name: 'search',        schema: { type: 'string', example: 'chrome' }, description: 'Search by device_name, device_number, reference_id or frontend_generated_uuid (case-insensitive)' },
        { in: 'query', name: 'country',       schema: { type: 'string', example: 'IN' }, description: 'Filter by exact country' },
        { in: 'query', name: 'website_name',  schema: { type: 'string', example: 'succesly.in' }, description: 'Filter by exact website_name' },
        { in: 'query', name: 'is_active',     schema: { type: 'boolean', example: true }, description: 'Include inactive records (default: true = active only)' },
      ],
      responses: {
        200: { description: 'Device info list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedDeviceInfoResponse' } } } },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/device-info/{id}': {
    get: {
      tags: ['Device Info'],
      summary: 'Get device-info by ID — JWT only',
      security: jwtOnly,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Device info found' }, 404: { description: 'Not found' } },
    },
    patch: {
      tags: ['Device Info'],
      summary: 'Correct a device-info record — JWT + CSRF + API key (admin only)',
      description: 'Manual admin correction of device_name, country, lat/long, or is_active. Does not touch website_all_url_route or device_change — those are only ever managed by POST /device-info.',
      security: jwtAndKey,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateDeviceInfoDto' } } } },
      responses: {
        200: { description: 'Device info updated' },
        404: { description: 'Not found' },
      },
    },
    delete: {
      tags: ['Device Info'],
      summary: 'Delete device-info record — JWT + CSRF + API key (admin only)',
      security: jwtAndKey,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Device info deleted' }, 404: { description: 'Not found' } },
    },
  },
};

export const deviceInfoSchemas = {
  WebsiteUrlHit: {
    type: 'object',
    properties: {
      url:         { type: 'string', example: 'https://succesly.in/pricing' },
      hit_count:   { type: 'integer', example: 3 },
      created_at:  { type: 'string', format: 'date-time', description: 'When this URL was first hit by this device' },
      last_hit_at: { type: 'string', format: 'date-time', description: 'When this URL was most recently hit' },
    },
  },
  DeviceInfo: {
    type: 'object',
    properties: {
      _id:                      { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' },
      reference_id:             { type: 'string', example: 'DEV-19-07-2026-00001' },
      frontend_generated_uuid:  { type: 'string', example: '2f6a2b3a-8e11-4c0a-9d3e-1a2b3c4d5e6f' },
      device_number:            { type: 'string', example: 'WEB-CHROME-135' },
      device_name:              { type: 'string', example: 'Chrome on Windows' },
      device_change:            { type: 'integer', example: 0, description: 'Increments only when device_name changes for an existing uuid' },
      device_ip:                { type: 'string', example: '49.36.12.87', description: 'Always server-derived, never trusted from the request body' },
      country:                  { type: 'string', example: 'IN' },
      lat:                      { type: 'number', example: 31.326 },
      long:                     { type: 'number', example: 75.576 },
      website_name:             { type: 'string', example: 'succesly.in' },
      website_all_url_route:    { type: 'array', items: { $ref: '#/components/schemas/WebsiteUrlHit' } },
      is_active:                { type: 'boolean', example: true },
      createdAt:                { type: 'string', format: 'date-time' },
      updatedAt:                { type: 'string', format: 'date-time' },
    },
  },
  TrackDeviceInfoDto: {
    type: 'object',
    required: ['frontend_generated_uuid', 'device_number', 'device_name', 'website_name', 'url'],
    properties: {
      frontend_generated_uuid: { type: 'string', example: '2f6a2b3a-8e11-4c0a-9d3e-1a2b3c4d5e6f', description: 'Generate once on the frontend (e.g. crypto.randomUUID()) and persist in localStorage. Same value on every call = same device.' },
      device_number:            { type: 'string', example: 'WEB-CHROME-135' },
      device_name:              { type: 'string', example: 'Chrome on Windows' },
      country:                  { type: 'string', example: 'IN' },
      lat:                      { type: 'number', example: 31.326 },
      long:                     { type: 'number', example: 75.576 },
      website_name:             { type: 'string', example: 'succesly.in' },
      url:                      { type: 'string', example: 'https://succesly.in/pricing', description: 'Current page URL. Same url on repeat calls increments its hit_count instead of creating a new entry.' },
    },
  },
  UpdateDeviceInfoDto: {
    type: 'object',
    properties: {
      device_name: { type: 'string' },
      country:     { type: 'string' },
      lat:         { type: 'number' },
      long:        { type: 'number' },
      is_active:   { type: 'boolean' },
    },
  },
  PaginatedDeviceInfoResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          data:       { type: 'array', items: { $ref: '#/components/schemas/DeviceInfo' } },
          total:      { type: 'integer', example: 100 },
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 10 },
          totalPages: { type: 'integer', example: 10 },
        },
      },
    },
  },
};
