const jwtAndKey = [{ bearerAuth: [], apiKeyAuth: [] }];

// Reused by every write endpoint — the url-matching rules are the thing callers
// get wrong most often, so they are spelled out wherever a url is accepted.
const urlMatchingRules = [
  '### How a url is matched',
  'Every url — the one saved here and the one sent to `GET /site-maintenance/status`',
  '— is **normalised** before it is compared, so the same site is recognised no',
  'matter how it is written:',
  '',
  '| You send | Stored / matched as |',
  '|---|---|',
  '| `abc.com` | `abc.com` |',
  '| `https://abc.com` | `abc.com` |',
  '| `https://abc.com/` | `abc.com` |',
  '| `http://www.abc.com` | `abc.com` |',
  '| `https://abc.com/?utm_source=x#top` | `abc.com` |',
  '| `https://abc.com/shop/` | `abc.com/shop` |',
  '',
  'Normalisation drops the protocol, a leading `www.`, the query string, the hash',
  'and any trailing slash, and lower-cases the rest. **The port is kept**, so',
  '`localhost:7000` and `localhost:3000` stay separate sites in development.',
  '',
  'Lookup runs in two steps: **exact match first, then the host record**. So a',
  'record registered at the bare host (`abc.com`) covers every path on that host',
  '— `abc.com/shop/item/1` resolves to it.',
  '',
  'Register a url *with* a path (`abc.com/shop`) only to give that one page its',
  'own switch. It matches **that exact path and nothing below it**: `/shop` wins',
  'for `abc.com/shop`, while `abc.com/shop/item/1` finds no exact record and so',
  'falls back to the `abc.com` host record. To control a whole section',
  'independently, use the host record for the section and keep paths out of it.',
].join('\n');

export const siteMaintenancePaths = {
  '/site-maintenance/status': {
    get: {
      tags: ['Site Maintenance'],
      summary: 'Is this site under maintenance? — PUBLIC, no JWT required',
      description: [
        'The endpoint the website itself calls. Point it at your own url and it',
        'answers whether that site should currently show its maintenance page.',
        '',
        'It runs in an anonymous visitor\'s browser (or in an edge worker / CDN',
        'function) before the app renders, so it carries **no JWT, no API key and',
        'no CSRF token**.',
        '',
        '### Reading the answer',
        'Only one field decides what you render: **`data.is_maintenance_mode`**.',
        '',
        '- `true`  → show the maintenance screen, and use `data.maintenance_message`',
        '  as the text on it. The top-level `message` is that same wording, so a',
        '  very simple client can just print `message`.',
        '- `false` → render the site normally.',
        '',
        '### Unknown sites are reported as LIVE, not as an error',
        'If no record matches the url, the response is still **200** with',
        '`registered: false` and `is_maintenance_mode: false`. This check fails',
        '**open** on purpose: a url that was never registered, or one with a typo,',
        'must never be able to take a working site down. The only 400 you can get',
        'here is a missing or unparseable `url`.',
        '',
        'A record whose `is_active` is `false` is ignored by this lookup — switching',
        'a record off is the same as removing that site from maintenance control.',
        '',
        urlMatchingRules,
        '',
        '### Frontend usage',
        '```js',
        'const { data } = await axios.get(',
        "  'https://api.succesly.in/api/v1/site-maintenance/status',",
        '  { params: { url: window.location.href } },   // the full url is fine',
        ');',
        '',
        'if (data.data.is_maintenance_mode) {',
        '  renderMaintenancePage(data.data.maintenance_message);',
        '} else {',
        '  renderApp();',
        '}',
        '```',
        '',
        'Poll it every 30-60s if you want a live site to drop into maintenance',
        'without a reload. Note that the browser origin calling this must be in the',
        'server\'s CORS allow-list (`src/app.ts`), otherwise the request is blocked',
        'before it reaches this route.',
      ].join('\n'),
      parameters: [
        {
          in: 'query',
          name: 'url',
          required: true,
          schema: { type: 'string', example: 'https://abc.com/' },
          description: 'The site url to check. Any form works — `abc.com`, `https://abc.com`, `https://abc.com/`, or a full page url such as `https://abc.com/shop/item/1`. `site_url` is accepted as an alias.',
        },
      ],
      responses: {
        200: {
          description: 'Status resolved — check `data.is_maintenance_mode`. Returned for registered and unregistered sites alike.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SiteMaintenanceStatusResponse' },
              examples: {
                underMaintenance: {
                  summary: 'Site IS under maintenance → show the maintenance page',
                  value: {
                    success: true,
                    message: 'We are upgrading our booking system. Back by 6 PM IST.',
                    data: {
                      requested_url:       'https://abc.com/',
                      normalized_url:      'abc.com',
                      registered:          true,
                      matched_by:          'exact',
                      is_maintenance_mode: true,
                      maintenance_message: 'We are upgrading our booking system. Back by 6 PM IST.',
                      site_name:           'ABC Storefront',
                      site_url:            'https://abc.com',
                      reference_id:        'SITE-18-10-2026-00001',
                    },
                  },
                },
                live: {
                  summary: 'Registered but switched off → render the site',
                  value: {
                    success: true,
                    message: 'Site is live',
                    data: {
                      requested_url:       'abc.com',
                      normalized_url:      'abc.com',
                      registered:          true,
                      matched_by:          'exact',
                      is_maintenance_mode: false,
                      maintenance_message: null,
                      site_name:           'ABC Storefront',
                      site_url:            'https://abc.com',
                      reference_id:        'SITE-18-10-2026-00001',
                    },
                  },
                },
                matchedByHost: {
                  summary: 'Deep page matched the host-level record for abc.com',
                  value: {
                    success: true,
                    message: 'Scheduled maintenance in progress.',
                    data: {
                      requested_url:       'https://abc.com/shop/item/1?ref=ig',
                      normalized_url:      'abc.com/shop/item/1',
                      registered:          true,
                      matched_by:          'host',
                      is_maintenance_mode: true,
                      maintenance_message: 'Scheduled maintenance in progress.',
                      site_name:           'ABC Storefront',
                      site_url:            'https://abc.com',
                      reference_id:        'SITE-18-10-2026-00001',
                    },
                  },
                },
                notRegistered: {
                  summary: 'No record for this url → treated as live (fails open)',
                  value: {
                    success: true,
                    message: 'Site is not registered for maintenance control — treated as live',
                    data: {
                      requested_url:       'https://unknown-site.com',
                      normalized_url:      'unknown-site.com',
                      registered:          false,
                      matched_by:          null,
                      is_maintenance_mode: false,
                      maintenance_message: null,
                      site_name:           null,
                      site_url:            null,
                      reference_id:        null,
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: '`url` was missing, empty, or not a parseable http/https url',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
      },
    },
  },

  '/site-maintenance': {
    post: {
      tags: ['Site Maintenance'],
      summary: 'Register a site — JWT + CSRF + API key',
      description: [
        'Adds a site to maintenance control. You normally do this **once per site**',
        'with `is_maintenance_mode: false`, then flip the switch later with',
        '`PATCH /site-maintenance/{id}` whenever you deploy.',
        '',
        '`site_url` is stored exactly as you type it (that is what the dashboard',
        'shows), alongside the normalised `normalized_url` the status lookup',
        'actually matches on.',
        '',
        '**One record per site.** `normalized_url` is unique, so registering',
        '`abc.com` and then `https://www.abc.com/` returns **409** — both are the',
        'same site. The 409 body carries the existing record\'s id in',
        '`errors.existing_id` so the UI can offer "edit the existing one instead".',
        '',
        urlMatchingRules,
      ].join('\n'),
      security: jwtAndKey,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateSiteMaintenanceDto' },
            examples: {
              registerLive: {
                summary: 'Register a site that is currently live',
                value: {
                  site_name: 'ABC Storefront',
                  site_url:  'https://abc.com',
                },
              },
              registerAlreadyDown: {
                summary: 'Register a site and put it straight into maintenance',
                value: {
                  site_name:           'ABC Storefront',
                  site_url:            'abc.com',
                  is_maintenance_mode: true,
                  maintenance_message: 'We are upgrading our booking system. Back by 6 PM IST.',
                },
              },
              sectionOnly: {
                summary: 'Give one section of a site its own switch',
                value: {
                  site_name: 'ABC Shop',
                  site_url:  'https://abc.com/shop',
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Site registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/SiteMaintenanceResponse' } } } },
        400: { description: 'Validation failed, or site_url is not a parseable http/https url', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        401: { description: 'Missing / invalid JWT or API key' },
        403: { description: 'Missing or invalid x-csrf-token' },
        409: {
          description: 'This site is already registered — `errors.existing_id` points at the record to edit',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
              example: {
                success: false,
                message: "Site 'abc.com' is already registered — update that record instead",
                errors:  { normalized_url: 'abc.com', existing_id: '664f1a2b3c4d5e6f7a8b9c0d' },
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Site Maintenance'],
      summary: 'List registered sites — search, filter, pagination (JWT + API key)',
      description: [
        'The admin dashboard list. Every row carries `is_maintenance_mode`, so the',
        'on/off toggle can be rendered straight from this response with no extra call.',
        '',
        'Pagination is applied **only when `page` or `limit` is sent**. Without',
        'either, every matching record is returned in one page.',
        '',
        'By default only active records are returned (`is_active: true`). Pass',
        '`is_active=false` to see the deactivated ones.',
      ].join('\n'),
      security: jwtAndKey,
      parameters: [
        { in: 'query', name: 'page',   schema: { type: 'integer', example: 1 },  description: 'Page number. Sending page or limit switches pagination on.' },
        { in: 'query', name: 'limit',  schema: { type: 'integer', example: 10 }, description: 'Items per page' },
        { in: 'query', name: 'search', schema: { type: 'string', example: 'abc' }, description: 'Case-insensitive search over site_name, site_url, normalized_url and reference_id' },
        { in: 'query', name: 'is_maintenance_mode', schema: { type: 'boolean', example: true }, description: 'Show only the sites that are currently down (true) or only the live ones (false)' },
        { in: 'query', name: 'is_active', schema: { type: 'boolean', example: true }, description: 'Default true — only active records. Pass false to list deactivated records.' },
      ],
      responses: {
        200: { description: 'Site list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedSiteMaintenanceResponse' } } } },
        401: { description: 'Missing / invalid JWT or API key' },
      },
    },
  },

  '/site-maintenance/{id}': {
    get: {
      tags: ['Site Maintenance'],
      summary: 'Get one registered site by its Mongo _id — JWT + API key',
      description: 'Looks up a record by its database id. To look a site up **by its url** use the public `GET /site-maintenance/status` instead.',
      security: jwtAndKey,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' } }],
      responses: {
        200: { description: 'Site found', content: { 'application/json': { schema: { $ref: '#/components/schemas/SiteMaintenanceResponse' } } } },
        401: { description: 'Missing / invalid JWT or API key' },
        404: { description: 'Site not found' },
      },
    },
    patch: {
      tags: ['Site Maintenance'],
      summary: 'Turn maintenance mode on / off, or edit the site — JWT + CSRF + API key',
      description: [
        '**This is the switch.** Send `{ "is_maintenance_mode": true }` to take the',
        'site down and `{ "is_maintenance_mode": false }` to bring it back. The',
        'change is live on the very next `GET /site-maintenance/status` call — there',
        'is no cache and no deploy involved.',
        '',
        'Every field is optional, but **at least one must be sent** or you get a 400.',
        'Only the fields present in the body are touched.',
        '',
        '- `maintenance_message` — the text visitors see. Send `""` to reset it back',
        '  to the default wording.',
        '- `is_active: false` — retires the record without deleting it. The status',
        '  lookup then ignores it, so the site reports as live.',
        '- `site_url` — re-derives the match keys. Returns **409** if the new url',
        '  normalises onto a site that another record already owns.',
        '',
        urlMatchingRules,
      ].join('\n'),
      security: jwtAndKey,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateSiteMaintenanceDto' },
            examples: {
              turnOn: {
                summary: 'Maintenance ON, with a custom message',
                value: { is_maintenance_mode: true, maintenance_message: 'We are upgrading our booking system. Back by 6 PM IST.' },
              },
              turnOff: {
                summary: 'Maintenance OFF — site goes live again',
                value: { is_maintenance_mode: false },
              },
              renameAndRepoint: {
                summary: 'Rename the site and point it at a new url',
                value: { site_name: 'ABC Storefront (EU)', site_url: 'https://eu.abc.com/' },
              },
              deactivate: {
                summary: 'Retire the record without deleting it',
                value: { is_active: false },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Site updated — the response body is the record as it now stands', content: { 'application/json': { schema: { $ref: '#/components/schemas/SiteMaintenanceResponse' } } } },
        400: { description: 'Validation failed, or an empty body was sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        401: { description: 'Missing / invalid JWT or API key' },
        403: { description: 'Missing or invalid x-csrf-token' },
        404: { description: 'Site not found' },
        409: { description: 'The new site_url is already registered under another record' },
      },
    },
    delete: {
      tags: ['Site Maintenance'],
      summary: 'Delete a registered site — JWT + CSRF + API key',
      description: [
        'Hard delete — the record is removed from the database, not flagged. Once it',
        'is gone the status check reports that url as unregistered, i.e. **live**.',
        '',
        'If you only want to stop using a site for a while, `PATCH` it with',
        '`{ "is_active": false }` instead: that keeps the record and its history.',
      ].join('\n'),
      security: jwtAndKey,
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' } }],
      responses: {
        200: { description: 'Site deleted' },
        401: { description: 'Missing / invalid JWT or API key' },
        403: { description: 'Missing or invalid x-csrf-token' },
        404: { description: 'Site not found' },
      },
    },
  },
};

export const siteMaintenanceSchemas = {
  SiteMaintenance: {
    type: 'object',
    properties: {
      _id:                 { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' },
      reference_id:        { type: 'string', example: 'SITE-18-10-2026-00001', description: 'Auto-generated, human-readable id' },
      site_name:           { type: 'string', example: 'ABC Storefront' },
      site_url:            { type: 'string', example: 'https://abc.com', description: 'The url exactly as it was entered' },
      normalized_url:      { type: 'string', example: 'abc.com', description: 'Derived match key — unique across all records. Protocol, www., query, hash and trailing slash removed.' },
      site_host:           { type: 'string', example: 'abc.com', description: 'Host portion of normalized_url. Lets the root record cover every sub-path.' },
      is_maintenance_mode: { type: 'boolean', example: false, description: 'true = the site should show its maintenance page' },
      maintenance_message: { type: 'string', example: 'This site is currently under maintenance. Please check back shortly.', description: 'Text shown to visitors while the site is down' },
      created_by:          { type: 'string', example: '664f0a1b2c3d4e5f6a7b8c9d', description: 'user_id of whoever registered the site' },
      is_active:           { type: 'boolean', example: true, description: 'false = record retired; the status lookup ignores it' },
      createdAt:           { type: 'string', format: 'date-time' },
      updatedAt:           { type: 'string', format: 'date-time' },
    },
  },

  CreateSiteMaintenanceDto: {
    type: 'object',
    required: ['site_name', 'site_url'],
    properties: {
      site_name:           { type: 'string', maxLength: 120, example: 'ABC Storefront', description: 'Display name for the dashboard' },
      site_url:            { type: 'string', maxLength: 500, example: 'https://abc.com', description: 'Any form is accepted — `abc.com`, `https://abc.com` and `https://abc.com/` all register the same site. Add a path (`abc.com/shop`) only to give that section its own switch.' },
      is_maintenance_mode: { type: 'boolean', default: false, example: false, description: 'Start the site in maintenance. Omit it to register the site as live.' },
      maintenance_message: { type: 'string', maxLength: 1000, example: 'We are upgrading our booking system. Back by 6 PM IST.', description: 'Optional. Falls back to a default message when omitted.' },
    },
  },

  UpdateSiteMaintenanceDto: {
    type: 'object',
    description: 'Every field is optional, but at least one must be sent.',
    minProperties: 1,
    properties: {
      site_name:           { type: 'string', maxLength: 120, example: 'ABC Storefront' },
      site_url:            { type: 'string', maxLength: 500, example: 'https://abc.com/', description: 'Re-derives the match keys. 409 if it collides with another record.' },
      is_maintenance_mode: { type: 'boolean', example: true, description: 'The on/off switch — true takes the site down, false brings it back' },
      maintenance_message: { type: 'string', maxLength: 1000, example: 'Back by 6 PM IST.', description: 'Send "" to reset to the default message' },
      is_active:           { type: 'boolean', example: true, description: 'false retires the record without deleting it' },
    },
  },

  SiteMaintenanceStatus: {
    type: 'object',
    properties: {
      requested_url:       { type: 'string', example: 'https://abc.com/', description: 'The url exactly as it was sent' },
      normalized_url:      { type: 'string', example: 'abc.com', description: 'What that url was reduced to before matching' },
      registered:          { type: 'boolean', example: true, description: 'false = no active record for this url, so the site is treated as live' },
      matched_by:          { type: 'string', nullable: true, enum: ['exact', 'host', null], example: 'exact', description: '`exact` = matched the stored url; `host` = fell back to the site root record; `null` = no match' },
      is_maintenance_mode: { type: 'boolean', example: true, description: 'THE field to branch on — true means render the maintenance page' },
      maintenance_message: { type: 'string', nullable: true, example: 'We are upgrading our booking system. Back by 6 PM IST.', description: 'The text to display. null whenever is_maintenance_mode is false.' },
      site_name:           { type: 'string', nullable: true, example: 'ABC Storefront' },
      site_url:            { type: 'string', nullable: true, example: 'https://abc.com' },
      reference_id:        { type: 'string', nullable: true, example: 'SITE-18-10-2026-00001' },
    },
  },

  SiteMaintenanceStatusResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'We are upgrading our booking system. Back by 6 PM IST.', description: 'The maintenance message when the site is down, otherwise a plain status line' },
      data:    { $ref: '#/components/schemas/SiteMaintenanceStatus' },
    },
  },

  SiteMaintenanceResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Site registered successfully' },
      data:    { $ref: '#/components/schemas/SiteMaintenance' },
    },
  },

  PaginatedSiteMaintenanceResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string', example: 'Sites fetched successfully' },
      data: {
        type: 'object',
        properties: {
          data:       { type: 'array', items: { $ref: '#/components/schemas/SiteMaintenance' } },
          total:      { type: 'integer', example: 12 },
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 10 },
          totalPages: { type: 'integer', example: 2 },
        },
      },
    },
  },
};
