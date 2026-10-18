import { Request, Response }           from 'express';
import asyncHandler                    from '../utils/async-handler.util';
import { sendSuccess, sendError }      from '../utils/response.util';
import { MongoDataServices }           from '../frameworks/mongo';
import { SiteMaintenanceUseCase }      from '../use-cases/site-maintenance/site-maintenance.use-case';
import { createSiteMaintenanceSchema } from '../core/dtos/site-maintenance/create-site-maintenance.dto';
import { updateSiteMaintenanceSchema } from '../core/dtos/site-maintenance/update-site-maintenance.dto';
import { activityLogService, computeFieldChanges } from '../services/activity-log.service';
import { ISiteMaintenance }            from '../core/entities/site-maintenance.entity';

const dataServices           = new MongoDataServices();
const siteMaintenanceUseCase = new SiteMaintenanceUseCase(dataServices);

// Fields tracked in the update diff — these produce meaningful log sentences
const TRACKED_FIELDS: (keyof ISiteMaintenance)[] = [
  'site_name', 'site_url', 'is_maintenance_mode', 'maintenance_message', 'is_active',
];

// ─── Helper — resolve client IP through proxies ───────────────────────────────
function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}

// ─── Helper — ms elapsed since request was stamped by requestTimerMiddleware ──
function elapsed(req: Request): number {
  return req.startTime ? Date.now() - req.startTime : 0;
}

type SiteDoc = ISiteMaintenance & { _id: string };

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /site-maintenance/status?url=...  — PUBLIC, no JWT.
 *
 * Called by the site itself (or its CDN/edge worker) before rendering, so it
 * can never carry a login session. Always answers 200 unless the url is
 * unparseable: an unknown site is reported as live, not as an error.
 */
export const getSiteMaintenanceStatus = asyncHandler(async (req: Request, res: Response) => {
  const url = (req.query['url'] ?? req.query['site_url']) as string | undefined;
  if (!url) return sendError(res, 'Query parameter `url` is required', 400);

  const status = await siteMaintenanceUseCase.getStatusByUrl(url);

  const message = status.is_maintenance_mode
    ? (status.maintenance_message ?? 'This site is currently under maintenance.')
    : status.registered
      ? 'Site is live'
      : 'Site is not registered for maintenance control — treated as live';

  sendSuccess(res, message, status);
});

export const getAllSiteMaintenances = asyncHandler(async (req: Request, res: Response) => {
  const result = await siteMaintenanceUseCase.getAllSites(req.query as Record<string, string>);
  sendSuccess(res, 'Sites fetched successfully', result);

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'list',
    module:           'site_maintenance',
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} listed maintenance sites`
    ),
    method:           'GET',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const getSiteMaintenanceById = asyncHandler(async (req: Request, res: Response) => {
  const result = await siteMaintenanceUseCase.getSiteById(req.params['id']!);
  sendSuccess(res, 'Site fetched successfully', result);

  const site = result as unknown as SiteDoc;
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'view',
    module:           'site_maintenance',
    entity_id:        req.params['id'],
    entity_ref:       `${site.site_name} (${site.normalized_url})`,
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} viewed maintenance site '${site.site_name} (${site.normalized_url})'`
    ),
    method:           'GET',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const createSiteMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createSiteMaintenanceSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await siteMaintenanceUseCase.createSite(value, req.user!.user_id);
  sendSuccess(res, 'Site registered successfully', result, 201);

  const created = result as unknown as SiteDoc;
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'create',
    module:           'site_maintenance',
    entity_id:        String(created._id),
    entity_ref:       `${created.site_name} (${created.normalized_url})`,
    description:      activityLogService.describe.create(
      activityLogService.who(req.user!.email),
      'maintenance site',
      `${created.site_name} (${created.normalized_url})`,
      `maintenance mode: ${created.is_maintenance_mode ? 'ON' : 'OFF'}`,
    ),
    method:           'POST',
    endpoint:         req.originalUrl,
    status_code:      201,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const updateSiteMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateSiteMaintenanceSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  // Fetch before update so we can build a meaningful field-level diff
  const before = await siteMaintenanceUseCase.getSiteById(req.params['id']!);
  const result = await siteMaintenanceUseCase.updateSite(req.params['id']!, value);
  sendSuccess(res, 'Site updated successfully', result);

  const beforeDoc = before as unknown as SiteDoc;
  const changes   = computeFieldChanges(
    beforeDoc as unknown as Record<string, unknown>,
    value as Record<string, unknown>,
    TRACKED_FIELDS as string[],
  );

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'update',
    module:           'site_maintenance',
    entity_id:        req.params['id'],
    entity_ref:       `${beforeDoc.site_name} (${beforeDoc.normalized_url})`,
    description:      activityLogService.describe.update(
      activityLogService.who(req.user!.email),
      'maintenance site',
      `${beforeDoc.site_name} (${beforeDoc.normalized_url})`,
      changes,
    ),
    changes,
    method:           'PATCH',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const deleteSiteMaintenance = asyncHandler(async (req: Request, res: Response) => {
  // Fetch before delete so we can log which site was removed
  const existing = await siteMaintenanceUseCase.getSiteById(req.params['id']!);
  await siteMaintenanceUseCase.deleteSite(req.params['id']!);
  sendSuccess(res, 'Site deleted successfully', null);

  const doc = existing as unknown as SiteDoc;
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'delete',
    module:           'site_maintenance',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.site_name} (${doc.normalized_url})`,
    description:      activityLogService.describe.delete(
      activityLogService.who(req.user!.email),
      'maintenance site',
      `${doc.site_name} (${doc.normalized_url})`,
    ),
    method:           'DELETE',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});
