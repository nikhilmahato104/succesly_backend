import { IndustryType, CampaignStatus } from '../../core/entities/campaign.entity';
import { DeviceType, ClickAccessType } from '../../core/entities/campaign-click.entity';

const jwtOnly       = [{ bearerAuth: [] }];
const jwtAndKey     = [{ bearerAuth: [], apiKeyAuth: [] }];
const jwtKeyAndCsrf = [{ bearerAuth: [], apiKeyAuth: [], csrfToken: [] }];

const idParam = { in: 'path', name: 'id', required: true, schema: { type: 'string', example: '6718a2f4c1e2b3a4d5e6f789' }, description: 'Campaign `_id`' };

const analyticsParams = [
  { in: 'query', name: 'from',         schema: { type: 'string', example: '2026-10-01' }, description: 'Start date (inclusive), ISO. Omit for all-time.' },
  { in: 'query', name: 'to',           schema: { type: 'string', example: '2026-10-31' }, description: 'End date (inclusive when a bare date is given), ISO.' },
  { in: 'query', name: 'interval',     schema: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' }, description: 'Bucket size of `timeline`' },
  { in: 'query', name: 'tz',           schema: { type: 'string', example: 'Asia/Kolkata' }, description: 'IANA timezone for timeline / hour-of-day buckets (default `ANALYTICS_TIMEZONE` env or Asia/Kolkata)' },
  { in: 'query', name: 'include_bots', schema: { type: 'boolean', default: false }, description: 'Include link-preview bots / crawlers in the numbers' },
];

const breakdownItem = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      key:           { type: 'string',  example: 'mobile' },
      clicks:        { type: 'integer', example: 812 },
      unique_clicks: { type: 'integer', example: 640 },
    },
  },
};

const ok = (description: string, schema: object) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: schema } } } },
});

export const campaignPaths = {
  '/campaigns/industry-types': {
    get: {
      tags: ['Campaigns'],
      summary: 'Industry type options for the create-form dropdown',
      security: jwtOnly,
      responses: {
        200: ok('List of { value, label }', {
          type: 'array',
          items: { type: 'object', properties: { value: { type: 'string', example: 'ecommerce' }, label: { type: 'string', example: 'Ecommerce' } } },
        }),
      },
    },
  },

  '/campaigns/check-slug': {
    get: {
      tags: ['Campaigns'],
      summary: 'Live check — is this short URL name free?',
      description: [
        'Call while the user types the short URL name (debounce ~400 ms).',
        '',
        '- `available: true`  → show a green tick.',
        '- `available: false` → show `reason` under the input and the `suggestions` as clickable chips.',
        '',
        'This is advisory only — `POST /campaigns` checks again and returns **409** if the name was taken in the meantime.',
        'When editing an existing campaign pass `exclude_id` so its own current slug counts as available.',
      ].join('\n'),
      security: jwtAndKey,
      parameters: [
        { in: 'query', name: 'slug',       required: true, schema: { type: 'string', example: 'iphone17-diwali' } },
        { in: 'query', name: 'exclude_id', schema: { type: 'string' }, description: 'Campaign `_id` being edited' },
      ],
      responses: {
        200: ok('Availability result', { $ref: '#/components/schemas/SlugCheckResult' }),
        400: { description: '`slug` missing' },
      },
    },
  },

  '/campaigns': {
    post: {
      tags: ['Campaigns'],
      summary: 'Create a campaign + short link',
      description: [
        'Creates the campaign, builds `final_url` (destination + UTM + custom params) and reserves the short URL name.',
        '',
        '### Short URL name (`slug`)',
        '- Optional. Omit it and a random 6-character name is generated (e.g. `k7m2qx`).',
        '- 3–40 chars, lowercase letters / numbers / single hyphens, no hyphen at start/end (it becomes a sub-domain).',
        '- Reserved names (`www`, `api`, `admin`, ...) are rejected with **400**.',
        '- Already used (by any campaign, even archived) → **409** with `errors.suggestions`:',
        '```json',
        '{ "success": false,',
        '  "message": "Short URL name \'iphone17\' is already taken — please change the short URL name",',
        '  "errors": { "slug": "iphone17", "suggestions": ["iphone17-1", "iphone17-2", "iphone17-x4k"] } }',
        '```',
        '',
        '### UTM values',
        'No spaces or `& = # ?` — use `_` or `-` (`diwali_sale_2026`). `utm_source`, `utm_medium`, `utm_campaign` are required;',
        '`utm_term`, `utm_content`, `utm_id`, `utm_source_platform` are optional. Up to 5 extra `custom_params` (e.g. `ref`).',
        '',
        'Response contains `short_url` (`https://<slug>.<domain>`) and `short_url_path` (`https://<api>/r/<slug>`) — show `short_url` to the user.',
      ].join('\n'),
      security: jwtKeyAndCsrf,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateCampaignDto' },
            examples: {
              full: {
                summary: 'Instagram story ad with custom short name',
                value: {
                  name:            'iPhone 17 Diwali — Instagram stories',
                  description:     'Lavender 256GB push for Diwali week',
                  industry_type:   'electronics',
                  destination_url: 'https://www.flipkart.com/apple-iphone-17-lavender-256-gb/p/itm123',
                  utm: {
                    utm_source:          'instagram',
                    utm_medium:          'social',
                    utm_campaign:        'diwali_sale_2026',
                    utm_term:            'iphone17',
                    utm_content:         'story_ad_v2',
                    utm_id:              'cmp_2026_101',
                    utm_source_platform: 'meta_ads',
                  },
                  custom_params: [{ key: 'ref', value: 'influencer_puja' }],
                  slug:          'iphone17-diwali',
                  tags:          ['diwali', 'iphone'],
                  start_date:    '2026-10-15T00:00:00.000Z',
                  expires_at:    '2026-11-05T23:59:59.000Z',
                  fallback_url:  'https://www.flipkart.com/apple-iphone-17',
                },
              },
              minimal: {
                summary: 'Minimal — random short name',
                value: {
                  name:            'Newsletter October',
                  industry_type:   'ecommerce',
                  destination_url: 'https://example.com/sale',
                  utm: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'october_2026' },
                },
              },
            },
          },
        },
      },
      responses: {
        201: ok('Campaign created', { $ref: '#/components/schemas/Campaign' }),
        400: { description: 'Validation failed / invalid or reserved short URL name' },
        409: { description: 'Short URL name already taken — see `errors.suggestions`' },
      },
    },
    get: {
      tags: ['Campaigns'],
      summary: 'List campaigns — search, filter, sort, pagination',
      description: 'Without `page`/`limit` all matching campaigns are returned. Each item includes `short_url`, `short_url_path` and live click counters.',
      security: jwtAndKey,
      parameters: [
        { in: 'query', name: 'page',          schema: { type: 'integer', example: 1 } },
        { in: 'query', name: 'limit',         schema: { type: 'integer', example: 10 } },
        { in: 'query', name: 'search',        schema: { type: 'string', example: 'diwali' }, description: 'name, slug, reference_id, utm_campaign, destination_url, tags' },
        { in: 'query', name: 'industry_type', schema: { type: 'string', enum: Object.values(IndustryType) } },
        { in: 'query', name: 'status',        schema: { type: 'string', enum: Object.values(CampaignStatus) } },
        { in: 'query', name: 'utm_source',    schema: { type: 'string', example: 'instagram' } },
        { in: 'query', name: 'utm_medium',    schema: { type: 'string', example: 'social' } },
        { in: 'query', name: 'utm_campaign',  schema: { type: 'string', example: 'diwali_sale_2026' } },
        { in: 'query', name: 'tag',           schema: { type: 'string', example: 'diwali' } },
        { in: 'query', name: 'from',          schema: { type: 'string', example: '2026-10-01' }, description: 'Created on/after' },
        { in: 'query', name: 'to',            schema: { type: 'string', example: '2026-10-31' }, description: 'Created on/before' },
        { in: 'query', name: 'sort_by',       schema: { type: 'string', enum: ['createdAt', 'name', 'total_clicks', 'unique_clicks', 'last_clicked_at'], default: 'createdAt' } },
        { in: 'query', name: 'sort_order',    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        { in: 'query', name: 'is_active',     schema: { type: 'boolean', default: true }, description: '`false` → archived campaigns' },
      ],
      responses: { 200: ok('Paginated campaigns', { $ref: '#/components/schemas/PaginatedCampaigns' }) },
    },
  },

  '/campaigns/analytics/overview': {
    get: {
      tags: ['Campaign Analytics'],
      summary: 'Cross-campaign analytics — industry, UTM source / medium / campaign comparisons',
      description: [
        'One call powers the main analytics dashboard. Filter by date, industry and UTM values.',
        '',
        '| Field | Chart idea |',
        '|---|---|',
        '| `summary` | KPI tiles (clicks, unique clicks, unique visitors) |',
        '| `timeline` | Line chart of clicks over time |',
        '| `campaigns_by_industry` | Table: campaigns, active, clicks, avg clicks / campaign per industry |',
        '| `by_industry` / `by_utm_source` / `by_utm_medium` / `by_utm_campaign` | Bar charts — which channel performs best |',
        '| `by_device` / `by_browser` / `by_os` / `by_country` | Donut / bar charts |',
        '| `by_hour_of_day` | Heat strip — best time to post |',
        '| `top_campaigns` | Leaderboard |',
      ].join('\n'),
      security: jwtAndKey,
      parameters: [
        ...analyticsParams,
        { in: 'query', name: 'industry_type', schema: { type: 'string', enum: Object.values(IndustryType) } },
        { in: 'query', name: 'utm_source',    schema: { type: 'string' } },
        { in: 'query', name: 'utm_medium',    schema: { type: 'string' } },
        { in: 'query', name: 'utm_campaign',  schema: { type: 'string' } },
      ],
      responses: { 200: ok('Overview analytics', { $ref: '#/components/schemas/OverviewAnalytics' }), 400: { description: 'Invalid date / interval / timezone' } },
    },
  },

  '/campaigns/{id}': {
    get: {
      tags: ['Campaigns'],
      summary: 'Get one campaign',
      security: jwtAndKey,
      parameters: [idParam],
      responses: { 200: ok('Campaign', { $ref: '#/components/schemas/Campaign' }), 404: { description: 'Not found' } },
    },
    patch: {
      tags: ['Campaigns'],
      summary: 'Update a campaign (partial)',
      description: [
        'Send only the fields that change. `final_url` is rebuilt automatically when `destination_url`, `utm` or `custom_params` change.',
        '- `utm` and `custom_params` **replace** the stored value — send the full object / array.',
        '- Pause / resume with `{ "status": "paused" }` / `{ "status": "active" }`. A paused link sends visitors to `fallback_url` (or an "inactive" page) and is not counted.',
        '- Changing `slug` makes the old short link stop working — confirm with the user first. Same 400/409 rules as create.',
        '- Send `null` for `start_date`, `expires_at` or `fallback_url` to clear them.',
      ].join('\n'),
      security: jwtKeyAndCsrf,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateCampaignDto' },
            examples: {
              pause:  { summary: 'Pause the link',              value: { status: 'paused' } },
              utm:    { summary: 'Change the creative variant', value: { utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'diwali_sale_2026', utm_content: 'reel_v3' } } },
              expiry: { summary: 'Extend the campaign',         value: { expires_at: '2026-11-15T23:59:59.000Z' } },
            },
          },
        },
      },
      responses: {
        200: ok('Updated campaign', { $ref: '#/components/schemas/Campaign' }),
        400: { description: 'Validation failed / archived campaign' },
        404: { description: 'Not found' },
        409: { description: 'New short URL name already taken' },
      },
    },
    delete: {
      tags: ['Campaigns'],
      summary: 'Archive a campaign (soft delete)',
      description: 'Sets `status: archived`, `is_active: false`. The short link stops working (404) but the name stays reserved forever and click history is kept for analytics.',
      security: jwtKeyAndCsrf,
      parameters: [idParam],
      responses: { 200: { description: 'Archived' }, 404: { description: 'Not found' } },
    },
  },

  '/campaigns/{id}/analytics': {
    get: {
      tags: ['Campaign Analytics'],
      summary: 'Analytics for one campaign',
      description: 'Everything for a campaign detail page in one request: KPIs, timeline, device / browser / OS / country / city / referrer / language breakdowns, hour-of-day and day-of-week patterns.',
      security: jwtAndKey,
      parameters: [idParam, ...analyticsParams],
      responses: { 200: ok('Campaign analytics', { $ref: '#/components/schemas/CampaignAnalytics' }), 404: { description: 'Not found' } },
    },
  },

  '/campaigns/{id}/clicks': {
    get: {
      tags: ['Campaign Analytics'],
      summary: 'Raw click log for one campaign (paginated, newest first)',
      security: jwtAndKey,
      parameters: [
        idParam,
        { in: 'query', name: 'page',        schema: { type: 'integer', example: 1 } },
        { in: 'query', name: 'limit',       schema: { type: 'integer', example: 20, maximum: 100 } },
        { in: 'query', name: 'from',        schema: { type: 'string' } },
        { in: 'query', name: 'to',          schema: { type: 'string' } },
        { in: 'query', name: 'device_type', schema: { type: 'string', enum: Object.values(DeviceType) } },
        { in: 'query', name: 'browser',     schema: { type: 'string', example: 'Instagram' } },
        { in: 'query', name: 'os',          schema: { type: 'string', example: 'iOS' } },
        { in: 'query', name: 'country',     schema: { type: 'string', example: 'IN' } },
        { in: 'query', name: 'is_bot',      schema: { type: 'boolean' } },
        { in: 'query', name: 'is_unique',   schema: { type: 'boolean' } },
      ],
      responses: { 200: ok('Paginated clicks', { $ref: '#/components/schemas/PaginatedClicks' }) },
    },
  },

  '/r/{slug}': {
    get: {
      tags: ['Short Link Redirect'],
      summary: 'PUBLIC — open a short link (path form)',
      description: [
        '**Open this in a browser tab, not with "Try it out"** — the response is a 302 redirect to another site, which',
        'Swagger\'s fetch cannot follow (CORS).',
        '',
        'Same behaviour as the sub-domain form `https://<slug>.<SHORT_LINK_DOMAIN>/`:',
        '- active → **302** to `final_url`, click recorded',
        '- paused / not started / expired → **302** to `fallback_url` if set, else **410** HTML page (not counted)',
        '- unknown / archived → **404** HTML page',
      ].join('\n'),
      servers: [
        { url: 'http://localhost:7000',      description: 'Development' },
        { url: 'https://api.succesly.in',    description: 'Production' },
      ],
      security: [],
      parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string', example: 'iphone17-diwali' } }],
      responses: {
        302: { description: 'Redirect to the campaign URL (Location header)' },
        404: { description: 'Short link does not exist' },
        410: { description: 'Short link paused / expired / not started and no fallback_url' },
      },
    },
  },
};

const utmProps = {
  utm_source:          { type: 'string', example: 'instagram',        description: 'Required. Traffic source' },
  utm_medium:          { type: 'string', example: 'social',           description: 'Required. Marketing medium' },
  utm_campaign:        { type: 'string', example: 'diwali_sale_2026', description: 'Required. Campaign name' },
  utm_term:            { type: 'string', example: 'iphone17',         description: 'Paid keyword' },
  utm_content:         { type: 'string', example: 'story_ad_v2',      description: 'Creative / A-B variant' },
  utm_id:              { type: 'string', example: 'cmp_2026_101',     description: 'Ad-platform campaign id' },
  utm_source_platform: { type: 'string', example: 'meta_ads',         description: 'Buying platform' },
};

const campaignInputProps = {
  name:            { type: 'string', example: 'iPhone 17 Diwali — Instagram stories' },
  description:     { type: 'string' },
  industry_type:   { type: 'string', enum: Object.values(IndustryType) },
  destination_url: { type: 'string', format: 'uri', example: 'https://www.flipkart.com/apple-iphone-17-lavender-256-gb/p/itm123' },
  utm:             { $ref: '#/components/schemas/UtmParams' },
  custom_params:   { type: 'array', maxItems: 5, items: { $ref: '#/components/schemas/CustomParam' } },
  slug:            { type: 'string', minLength: 3, maxLength: 40, pattern: '^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$', example: 'iphone17-diwali', description: 'Short URL name. Omit for a random one.' },
  tags:            { type: 'array', items: { type: 'string' }, example: ['diwali', 'iphone'] },
  status:          { type: 'string', enum: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED], default: CampaignStatus.ACTIVE },
  start_date:      { type: 'string', format: 'date-time', nullable: true },
  expires_at:      { type: 'string', format: 'date-time', nullable: true },
  fallback_url:    { type: 'string', format: 'uri', nullable: true, description: 'Where paused / expired / not-started links go' },
};

export const campaignSchemas = {
  UtmParams: { type: 'object', required: ['utm_source', 'utm_medium', 'utm_campaign'], properties: utmProps },
  CustomParam: {
    type: 'object', required: ['key', 'value'],
    properties: { key: { type: 'string', example: 'ref' }, value: { type: 'string', example: 'influencer_puja' } },
  },
  CreateCampaignDto: {
    type: 'object',
    required: ['name', 'industry_type', 'destination_url', 'utm'],
    properties: campaignInputProps,
  },
  UpdateCampaignDto: { type: 'object', minProperties: 1, properties: campaignInputProps },
  SlugCheckResult: {
    type: 'object',
    properties: {
      slug:        { type: 'string',  example: 'iphone17' },
      available:   { type: 'boolean', example: false },
      reason:      { type: 'string',  example: "Short URL name 'iphone17' is already taken — please change the short URL name" },
      suggestions: { type: 'array', items: { type: 'string' }, example: ['iphone17-1', 'iphone17-2', 'iphone17-x4k'] },
    },
  },
  Campaign: {
    type: 'object',
    properties: {
      _id:             { type: 'string', example: '6718a2f4c1e2b3a4d5e6f789' },
      reference_id:    { type: 'string', example: 'CMP-11-10-2026-00001' },
      ...campaignInputProps,
      status:          { type: 'string', enum: Object.values(CampaignStatus) },
      final_url:       { type: 'string', example: 'https://www.flipkart.com/apple-iphone-17-lavender-256-gb/p/itm123?utm_source=instagram&utm_medium=social&utm_campaign=diwali_sale_2026&utm_term=iphone17&utm_content=story_ad_v2&utm_id=cmp_2026_101&utm_source_platform=meta_ads&ref=influencer_puja' },
      short_url:       { type: 'string', example: 'https://iphone17-diwali.succesly.in' },
      short_url_path:  { type: 'string', example: 'https://api.succesly.in/r/iphone17-diwali' },
      total_clicks:    { type: 'integer', example: 1240 },
      unique_clicks:   { type: 'integer', example: 980 },
      bot_clicks:      { type: 'integer', example: 37 },
      last_clicked_at: { type: 'string', format: 'date-time' },
      created_by:      { type: 'string' },
      is_active:       { type: 'boolean' },
      createdAt:       { type: 'string', format: 'date-time' },
      updatedAt:       { type: 'string', format: 'date-time' },
    },
  },
  PaginatedCampaigns: {
    type: 'object',
    properties: {
      data:       { type: 'array', items: { $ref: '#/components/schemas/Campaign' } },
      total:      { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' },
    },
  },
  CampaignClick: {
    type: 'object',
    properties: {
      _id:             { type: 'string' },
      campaign_id:     { type: 'string' },
      slug:            { type: 'string' },
      industry_type:   { type: 'string' },
      utm_source:      { type: 'string' }, utm_medium: { type: 'string' }, utm_campaign: { type: 'string' },
      visitor_id:      { type: 'string' },
      is_unique:       { type: 'boolean' },
      is_bot:          { type: 'boolean' },
      ip:              { type: 'string' },
      user_agent:      { type: 'string' },
      device_type:     { type: 'string', enum: Object.values(DeviceType) },
      browser:         { type: 'string', example: 'Instagram' },
      browser_version: { type: 'string' },
      os:              { type: 'string', example: 'iOS' },
      os_version:      { type: 'string', example: '18.1' },
      referrer:        { type: 'string' },
      referrer_domain: { type: 'string', example: 'l.instagram.com' },
      country:         { type: 'string', example: 'IN' },
      region:          { type: 'string' },
      city:            { type: 'string' },
      language:        { type: 'string', example: 'en-IN' },
      access_type:     { type: 'string', enum: Object.values(ClickAccessType) },
      clicked_at:      { type: 'string', format: 'date-time' },
    },
  },
  PaginatedClicks: {
    type: 'object',
    properties: {
      data:       { type: 'array', items: { $ref: '#/components/schemas/CampaignClick' } },
      total:      { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' },
    },
  },
  AnalyticsSummary: {
    type: 'object',
    properties: {
      total_clicks:    { type: 'integer', example: 1240 },
      unique_clicks:   { type: 'integer', example: 980 },
      unique_visitors: { type: 'integer', example: 980 },
      bot_clicks:      { type: 'integer', example: 37, description: 'Campaign analytics only' },
      first_click_at:  { type: 'string', format: 'date-time', nullable: true },
      last_click_at:   { type: 'string', format: 'date-time', nullable: true },
    },
  },
  TimelinePoint: {
    type: 'object',
    properties: { period: { type: 'string', example: '2026-10-15' }, clicks: { type: 'integer' }, unique_clicks: { type: 'integer' } },
  },
  CampaignAnalytics: {
    type: 'object',
    properties: {
      campaign:       { type: 'object', description: 'Campaign header info incl. short_url' },
      filters:        { type: 'object' },
      summary:        { $ref: '#/components/schemas/AnalyticsSummary' },
      timeline:       { type: 'array', items: { $ref: '#/components/schemas/TimelinePoint' } },
      by_device:      breakdownItem,
      by_browser:     breakdownItem,
      by_os:          breakdownItem,
      by_country:     breakdownItem,
      by_city:        breakdownItem,
      by_referrer:    breakdownItem,
      by_language:    breakdownItem,
      by_access_type: breakdownItem,
      by_hour_of_day: { type: 'array', items: { type: 'object', properties: { hour: { type: 'integer', example: 21 }, clicks: { type: 'integer' } } } },
      by_day_of_week: { type: 'array', items: { type: 'object', properties: { day_number: { type: 'integer' }, day: { type: 'string', example: 'Saturday' }, clicks: { type: 'integer' } } } },
    },
  },
  OverviewAnalytics: {
    type: 'object',
    properties: {
      filters:               { type: 'object' },
      summary:               { $ref: '#/components/schemas/AnalyticsSummary' },
      campaigns_by_industry: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            industry_type: { type: 'string' }, campaigns: { type: 'integer' }, active: { type: 'integer' },
            total_clicks: { type: 'integer' }, unique_clicks: { type: 'integer' }, avg_clicks_per_campaign: { type: 'number' },
          },
        },
      },
      timeline:        { type: 'array', items: { $ref: '#/components/schemas/TimelinePoint' } },
      by_industry:     breakdownItem,
      by_utm_source:   breakdownItem,
      by_utm_medium:   breakdownItem,
      by_utm_campaign: breakdownItem,
      by_device:       breakdownItem,
      by_browser:      breakdownItem,
      by_os:           breakdownItem,
      by_country:      breakdownItem,
      by_hour_of_day:  { type: 'array', items: { type: 'object', properties: { hour: { type: 'integer' }, clicks: { type: 'integer' } } } },
      top_campaigns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' }, industry_type: { type: 'string' },
            utm_source: { type: 'string' }, utm_medium: { type: 'string' }, clicks: { type: 'integer' }, unique_clicks: { type: 'integer' },
          },
        },
      },
    },
  },
};
