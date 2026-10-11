import { Request, Response }                     from 'express';
import { nanoid }                                from 'nanoid';
import asyncHandler                              from '../utils/async-handler.util';
import { sendSuccess, sendError }                from '../utils/response.util';
import { MongoDataServices }                     from '../frameworks/mongo';
import { CampaignUseCase }                       from '../use-cases/campaign/campaign.use-case';
import { createCampaignSchema, updateCampaignSchema } from '../core/dtos';
import { IndustryType }                          from '../core/entities/campaign.entity';
import { ClickAccessType }                       from '../core/entities/campaign-click.entity';
import { getShortLinkConfig }                    from '../utils/short-link.util';
import { activityLogService, computeFieldChanges } from '../services/activity-log.service';

const dataServices    = new MongoDataServices();
const campaignUseCase = new CampaignUseCase(dataServices);

const TRACKED_FIELDS = [
  'name', 'industry_type', 'destination_url', 'slug', 'status', 'fallback_url', 'start_date', 'expires_at',
];

/** Anonymous visitor id cookie — lets us count unique clicks without any login */
const VISITOR_COOKIE      = '_cvid';
const VISITOR_COOKIE_DAYS = 730;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function elapsed(req: Request): number {
  return req.startTime ? Date.now() - req.startTime : 0;
}

function header(req: Request, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = req.headers[name];
    if (typeof value === 'string' && value && value !== 'XX') {
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return undefined;
}

function logActivity(
  req: Request, action: 'create' | 'update' | 'delete', status: number,
  entityId: string, entityRef: string, description: string,
  changes?: ReturnType<typeof computeFieldChanges>,
) {
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action,
    module:           'campaign',
    entity_id:        entityId,
    entity_ref:       entityRef,
    description,
    changes,
    method:           req.method as 'POST' | 'PATCH' | 'DELETE',
    endpoint:         req.originalUrl,
    status_code:      status,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
}

const shortLinkPage = (title: string, message: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f5f7;color:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;text-align:center}
div{background:#fff;padding:32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:420px}h1{font-size:22px;margin:0 0 8px}p{margin:0;color:#555}</style>
</head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export const getIndustryTypes = asyncHandler(async (_req: Request, res: Response) => {
  const data = Object.values(IndustryType).map(value => ({
    value,
    label: value.split('_').map(w => w[0]!.toUpperCase() + w.slice(1)).join(' '),
  }));
  sendSuccess(res, 'Industry types fetched successfully', data);
});

export const checkSlug = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.checkSlug(
    req.query['slug'] as string | undefined,
    req.query['exclude_id'] as string | undefined,
  );
  sendSuccess(res, result.available ? 'Short URL name is available' : 'Short URL name is not available', result);
});

export const getAllCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.getAllCampaigns(req.query as Record<string, string>);
  sendSuccess(res, 'Campaigns fetched successfully', result);
});

export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.getCampaignById(req.params['id']!);
  sendSuccess(res, 'Campaign fetched successfully', result);
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createCampaignSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await campaignUseCase.createCampaign(value, req.user!.user_id);
  sendSuccess(res, 'Campaign created successfully', result, 201);

  const ref = `${result.name} (${result.reference_id})`;
  logActivity(req, 'create', 201, String(result._id), ref, activityLogService.describe.create(
    activityLogService.who(req.user!.email), 'campaign', ref, `short url: ${result.short_url}`,
  ));
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateCampaignSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const before = await campaignUseCase.getCampaignById(req.params['id']!);
  const result = await campaignUseCase.updateCampaign(req.params['id']!, value);
  sendSuccess(res, 'Campaign updated successfully', result);

  const ref     = `${before.name} (${before.reference_id})`;
  const changes = computeFieldChanges(
    before as unknown as Record<string, unknown>, value as Record<string, unknown>, TRACKED_FIELDS,
  );
  if (value.utm !== undefined)           changes.push({ field: 'utm', from: before.utm, to: value.utm });
  if (value.custom_params !== undefined) changes.push({ field: 'custom_params', from: before.custom_params, to: value.custom_params });

  logActivity(req, 'update', 200, req.params['id']!, ref, activityLogService.describe.update(
    activityLogService.who(req.user!.email), 'campaign', ref, changes,
  ), changes);
});

export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const existing = await campaignUseCase.getCampaignById(req.params['id']!);
  await campaignUseCase.deleteCampaign(req.params['id']!);
  sendSuccess(res, 'Campaign archived successfully', null);

  const ref = `${existing.name} (${existing.reference_id})`;
  logActivity(req, 'delete', 200, req.params['id']!, ref, activityLogService.describe.delete(
    activityLogService.who(req.user!.email), 'campaign', ref,
  ));
});

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getCampaignAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.getCampaignAnalytics(req.params['id']!, req.query as Record<string, string>);
  sendSuccess(res, 'Campaign analytics fetched successfully', result);
});

export const getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.getOverviewAnalytics(req.query as Record<string, string>);
  sendSuccess(res, 'Campaign overview analytics fetched successfully', result);
});

export const getCampaignClicks = asyncHandler(async (req: Request, res: Response) => {
  const result = await campaignUseCase.getCampaignClicks(req.params['id']!, req.query as Record<string, string>);
  sendSuccess(res, 'Campaign clicks fetched successfully', result);
});

// ─── Public redirect ─────────────────────────────────────────────────────────

/**
 * Resolves a slug and 302-redirects to the campaign's final URL.
 * 302 (not 301) + no-store so browsers never cache it — every click reaches us and is counted.
 * The click is recorded after the redirect is sent so tracking never slows the visitor down.
 */
export async function serveShortLink(req: Request, res: Response, slug: string, accessType: ClickAccessType) {
  const { outcome, target, campaign } = await campaignUseCase.resolveSlug(slug);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (!target) {
    if (outcome === 'not_found') {
      res.status(404).send(shortLinkPage('Link not found', 'This short link does not exist. Please check the URL.'));
    } else {
      const msg = outcome === 'not_started' ? 'This link is not live yet.' : 'This link is no longer active.';
      res.status(410).send(shortLinkPage('Link inactive', msg));
    }
    return;
  }

  let visitorId = req.cookies?.[VISITOR_COOKIE] as string | undefined;
  if (!visitorId) {
    visitorId = nanoid(21);
    const { hostname } = getShortLinkConfig();
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   req.secure,
      maxAge:   VISITOR_COOKIE_DAYS * 24 * 60 * 60 * 1000,
      // Shared by every <slug>.domain so one visitor is one visitor across all campaigns
      ...(accessType === ClickAccessType.SUBDOMAIN && hostname !== 'localhost' && { domain: `.${hostname}` }),
    });
  }

  res.redirect(302, target);

  // Only real visits count — HEAD requests and paused/expired fallbacks are not clicks
  if (outcome !== 'ok' || req.method !== 'GET' || !campaign) return;

  campaignUseCase.recordClick(campaign, {
    visitor_id:  visitorId,
    ip:          getIp(req),
    user_agent:  req.headers['user-agent'],
    referrer:    header(req, 'referer', 'referrer'),
    country:     header(req, 'cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-country-code'),
    region:      header(req, 'x-vercel-ip-country-region', 'cf-region', 'cloudfront-viewer-country-region'),
    city:        header(req, 'cf-ipcity', 'x-vercel-ip-city', 'cloudfront-viewer-city'),
    language:    req.headers['accept-language']?.split(',')[0]?.split(';')[0]?.trim() || undefined,
    access_type: accessType,
  }).catch(err => console.error(`[campaign] failed to record click for '${slug}':`, err));
}

export const redirectBySlug = asyncHandler(async (req: Request, res: Response) => {
  await serveShortLink(req, res, req.params['slug']!, ClickAccessType.PATH);
});
