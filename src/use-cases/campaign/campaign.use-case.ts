import { Types }               from 'mongoose';
import { IDataServices }       from '../../core/abstracts/data-service.abstract';
import { CreateCampaignDto }   from '../../core/dtos/campaign/create-campaign.dto';
import { UpdateCampaignDto }   from '../../core/dtos/campaign/update-campaign.dto';
import { ICampaign, ICampaignDocument, CampaignStatus } from '../../core/entities/campaign.entity';
import { ClickAccessType }     from '../../core/entities/campaign-click.entity';
import { AppError }            from '../../utils/app-error.util';
import { ListQuery, parsePagination, buildPageResult } from '../../utils/pagination.util';
import { generateSlug }        from '../../utils/slug.util';
import { parseUserAgent }      from '../../utils/user-agent.util';
import {
  SLUG_MAX_LENGTH, SLUG_MIN_LENGTH,
  normalizeSlug, validateSlugFormat, generateRandomSlug,
  buildShortUrls, buildFinalUrl,
} from '../../utils/short-link.util';
import { Counter }             from '../../frameworks/mongo/model/counter.model';

// ─── Reference ID ────────────────────────────────────────────────────────────

/** Same encoding as device-info: 1-99999 → 5 digits, then letter + 4-digit buckets */
function formatCounter(seq: number): string {
  if (seq <= 99999) return seq.toString().padStart(5, '0');
  const adjusted    = seq - 99999;
  const letterIndex = Math.floor((adjusted - 1) / 9999);
  const num         = ((adjusted - 1) % 9999) + 1;
  return String.fromCharCode(65 + letterIndex) + num.toString().padStart(4, '0');
}

async function generateReferenceId(): Promise<string> {
  const now  = new Date();
  const dd   = now.getDate().toString().padStart(2, '0');
  const mm   = (now.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = now.getFullYear().toString();

  const counter = await Counter.findOneAndUpdate(
    { _id: 'campaign_reference' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `CMP-${dd}-${mm}-${yyyy}-${formatCounter(counter!.seq)}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlugCheckResult {
  slug:        string;
  available:   boolean;
  reason?:     string;
  suggestions: string[];
}

export type RedirectOutcome = 'ok' | 'not_found' | 'paused' | 'not_started' | 'expired';

export interface RedirectResolution {
  outcome:   RedirectOutcome;
  target:    string | null;          // where to send the visitor, null → show an error page
  campaign?: ICampaignDocument;
}

/** Request facts the controller collects for a click — never trusted from a body */
export interface ClickContext {
  visitor_id:  string;
  ip?:         string;
  user_agent?: string;
  referrer?:   string;
  country?:    string;
  region?:     string;
  city?:       string;
  language?:   string;
  access_type: ClickAccessType;
}

type AnalyticsInterval = 'hour' | 'day' | 'week' | 'month';

const INTERVAL_FORMATS: Record<AnalyticsInterval, string> = {
  hour:  '%Y-%m-%d %H:00',
  day:   '%Y-%m-%d',
  week:  '%G-W%V',
  month: '%Y-%m',
};

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const SORTABLE_FIELDS  = new Set(['createdAt', 'name', 'total_clicks', 'unique_clicks', 'last_clicked_at']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toObjectId(id: string, label = 'Campaign'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new AppError(`${label} not found`, 404);
  return new Types.ObjectId(id);
}

export type CampaignView = ICampaign & {
  _id:            Types.ObjectId;
  createdAt?:     Date;
  updatedAt?:     Date;
  short_url:      string;
  short_url_path: string;
};

/** Adds short_url / short_url_path — computed, never stored, so a domain change needs no migration */
function withShortUrls(doc: unknown): CampaignView {
  const maybeDoc = doc as { toObject?: () => unknown };
  const plain    = (typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : doc) as Omit<CampaignView, 'short_url' | 'short_url_path'>;
  return { ...plain, ...buildShortUrls(plain.slug) };
}

function parseDate(value: string | undefined, label: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`Invalid '${label}' date — use ISO format, e.g. 2026-10-01`, 400);
  // A bare date for `to` should include that whole day
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function parseTimezone(tz: string | undefined): string {
  const timezone = tz || process.env['ANALYTICS_TIMEZONE'] || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new AppError(`Invalid timezone '${timezone}' — use an IANA name like Asia/Kolkata`, 400);
  }
  return timezone;
}

function parseInterval(value: string | undefined): AnalyticsInterval {
  const interval = (value || 'day') as AnalyticsInterval;
  if (!INTERVAL_FORMATS[interval]) throw new AppError(`interval must be one of: ${Object.keys(INTERVAL_FORMATS).join(', ')}`, 400);
  return interval;
}

function clickedAtRange(query: ListQuery): Record<string, Date> | undefined {
  const from = parseDate(query['from'], 'from');
  const to   = parseDate(query['to'],   'to', true);
  if (!from && !to) return undefined;
  return { ...(from && { $gte: from }), ...(to && { $lt: to }) };
}

const uniqueSum = { $sum: { $cond: ['$is_unique', 1, 0] } };

/** $facet branch: top-N breakdown of clicks by one field */
function breakdown(field: string, limit = 10): object[] {
  return [
    { $group: { _id: `$${field}`, clicks: { $sum: 1 }, unique_clicks: uniqueSum } },
    { $sort: { clicks: -1 } },
    { $limit: limit },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, clicks: 1, unique_clicks: 1 } },
  ];
}

function summaryFacet(): object[] {
  return [
    {
      $group: {
        _id:             null,
        total_clicks:    { $sum: 1 },
        unique_clicks:   uniqueSum,
        visitors:        { $addToSet: '$visitor_id' },
        first_click_at:  { $min: '$clicked_at' },
        last_click_at:   { $max: '$clicked_at' },
      },
    },
    {
      $project: {
        _id: 0, total_clicks: 1, unique_clicks: 1, first_click_at: 1, last_click_at: 1,
        unique_visitors: { $size: '$visitors' },
      },
    },
  ];
}

function timelineFacet(interval: AnalyticsInterval, timezone: string): object[] {
  return [
    {
      $group: {
        _id:           { $dateToString: { format: INTERVAL_FORMATS[interval], date: '$clicked_at', timezone } },
        clicks:        { $sum: 1 },
        unique_clicks: uniqueSum,
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: '$_id', clicks: 1, unique_clicks: 1 } },
  ];
}

function hourOfDayFacet(timezone: string): object[] {
  return [
    { $group: { _id: { $hour: { date: '$clicked_at', timezone } }, clicks: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, hour: '$_id', clicks: 1 } },
  ];
}

function dayOfWeekFacet(timezone: string): object[] {
  const names = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return [
    { $group: { _id: { $dayOfWeek: { date: '$clicked_at', timezone } }, clicks: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, day_number: '$_id', day: { $arrayElemAt: [names, '$_id'] }, clicks: 1 } },
  ];
}

const EMPTY_SUMMARY = { total_clicks: 0, unique_clicks: 0, unique_visitors: 0, first_click_at: null, last_click_at: null };

// ─── Use-case ────────────────────────────────────────────────────────────────

export class CampaignUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  // ── Slugs ──────────────────────────────────────────────────────────────────

  private async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    // Archived campaigns still own their slug — old printed/shared links must never point elsewhere
    const existing = await this.dataServices.campaigns.findOne({ slug });
    return !!existing && String(existing._id) !== excludeId;
  }

  /** Up to 3 free alternatives close to what the user typed */
  private async suggestSlugs(input: string): Promise<string[]> {
    let base = generateSlug(input).replace(/-{2,}/g, '-').slice(0, SLUG_MAX_LENGTH - 4).replace(/-+$/, '');
    if (base.length < SLUG_MIN_LENGTH) base = generateRandomSlug();

    const candidates = [
      ...[1, 2, 3, 4, 5].map(n => `${base}-${n}`),
      ...Array.from({ length: 3 }, () => `${base}-${generateRandomSlug().slice(0, 3)}`),
      generateRandomSlug(),
    ].filter(c => c.length <= SLUG_MAX_LENGTH && !validateSlugFormat(c));

    const taken = new Set(
      (await this.dataServices.campaigns.find({ slug: { $in: candidates } })).map(c => c.slug),
    );
    return candidates.filter(c => !taken.has(c)).slice(0, 3);
  }

  async checkSlug(rawSlug: string | undefined, excludeId?: string): Promise<SlugCheckResult> {
    if (!rawSlug) throw new AppError("Query param 'slug' is required", 400);
    const slug = normalizeSlug(rawSlug);

    const formatError = validateSlugFormat(slug);
    if (formatError) {
      return { slug, available: false, reason: formatError, suggestions: await this.suggestSlugs(slug) };
    }
    if (await this.isSlugTaken(slug, excludeId)) {
      return {
        slug,
        available:   false,
        reason:      `Short URL name '${slug}' is already taken — please change the short URL name`,
        suggestions: await this.suggestSlugs(slug),
      };
    }
    return { slug, available: true, suggestions: [] };
  }

  /** Throws 400 / 409 (with suggestions in `errors`) when the slug cannot be used */
  private async assertSlugUsable(slug: string, excludeId?: string): Promise<void> {
    const check = await this.checkSlug(slug, excludeId);
    if (check.available) return;
    const status = validateSlugFormat(check.slug) ? 400 : 409;
    throw new AppError(check.reason!, status, true, { slug: check.slug, suggestions: check.suggestions });
  }

  private async generateUniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = generateRandomSlug();
      if (!validateSlugFormat(slug) && !(await this.isSlugTaken(slug))) return slug;
    }
    throw new AppError('Could not generate a unique short URL name — please try again', 500, false);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async createCampaign(dto: CreateCampaignDto, userId?: string) {
    let slug: string;
    if (dto.slug) {
      slug = normalizeSlug(dto.slug);
      await this.assertSlugUsable(slug);
    } else {
      slug = await this.generateUniqueSlug();
    }

    const custom_params = dto.custom_params ?? [];
    const campaign = await this.dataServices.campaigns.create({
      reference_id:    await generateReferenceId(),
      name:            dto.name,
      description:     dto.description,
      industry_type:   dto.industry_type,
      destination_url: dto.destination_url,
      utm:             dto.utm,
      custom_params,
      final_url:       buildFinalUrl(dto.destination_url, dto.utm, custom_params),
      slug,
      tags:            dto.tags ?? [],
      status:          dto.status ?? CampaignStatus.ACTIVE,
      start_date:      dto.start_date,
      expires_at:      dto.expires_at,
      fallback_url:    dto.fallback_url,
      created_by:      userId,
      is_active:       true,
    });

    return withShortUrls(campaign);
  }

  async getAllCampaigns(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    const match: Record<string, unknown> = {
      is_active: query['is_active'] !== undefined ? query['is_active'] === 'true' : true,
    };
    if (query['industry_type']) match['industry_type']    = query['industry_type'];
    if (query['status'])        match['status']           = query['status'];
    if (query['utm_source'])    match['utm.utm_source']   = query['utm_source'];
    if (query['utm_medium'])    match['utm.utm_medium']   = query['utm_medium'];
    if (query['utm_campaign'])  match['utm.utm_campaign'] = query['utm_campaign'];
    if (query['tag'])           match['tags']             = query['tag'].toLowerCase();

    const createdAt = (() => {
      const from = parseDate(query['from'], 'from');
      const to   = parseDate(query['to'], 'to', true);
      return from || to ? { ...(from && { $gte: from }), ...(to && { $lt: to }) } : undefined;
    })();
    if (createdAt) match['createdAt'] = createdAt;

    if (query['search']) {
      const regex = { $regex: query['search'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      match['$or'] = [
        { name: regex }, { slug: regex }, { reference_id: regex },
        { 'utm.utm_campaign': regex }, { destination_url: regex }, { tags: regex },
      ];
    }

    const sortBy    = SORTABLE_FIELDS.has(query['sort_by'] ?? '') ? query['sort_by']! : 'createdAt';
    const sortOrder = query['sort_order'] === 'asc' ? 1 : -1;
    const pipeline  = [{ $match: match }, { $sort: { [sortBy]: sortOrder, _id: -1 } }];

    const result = hasPagination
      ? await this.dataServices.campaigns.aggregateWithPagination(pipeline, pageNum, limitNum)
      : await (async () => {
          const data = await this.dataServices.campaigns.aggregate(pipeline);
          return buildPageResult(data, data.length, 1, data.length || 1);
        })();

    return { ...result, data: result.data.map(withShortUrls) };
  }

  private async findCampaignOrThrow(id: string): Promise<ICampaignDocument> {
    toObjectId(id);
    const campaign = await this.dataServices.campaigns.get(id);
    if (!campaign) throw new AppError('Campaign not found', 404);
    return campaign;
  }

  async getCampaignById(id: string) {
    return withShortUrls(await this.findCampaignOrThrow(id));
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    const existing = await this.findCampaignOrThrow(id);
    if (!existing.is_active) throw new AppError('Archived campaigns cannot be edited', 400);

    const update: Record<string, unknown> = { ...dto };

    if (dto.slug !== undefined) {
      const slug = normalizeSlug(dto.slug);
      if (slug !== existing.slug) await this.assertSlugUsable(slug, id);
      update['slug'] = slug;
    }

    // Recompute the tracked URL whenever any of its inputs change
    if (dto.destination_url !== undefined || dto.utm !== undefined || dto.custom_params !== undefined) {
      update['final_url'] = buildFinalUrl(
        dto.destination_url ?? existing.destination_url,
        dto.utm             ?? existing.utm,
        dto.custom_params   ?? existing.custom_params,
      );
    }

    const startDate = dto.start_date !== undefined ? dto.start_date : existing.start_date;
    const expiresAt = dto.expires_at !== undefined ? dto.expires_at : existing.expires_at;
    if (startDate && expiresAt && new Date(expiresAt) <= new Date(startDate)) {
      throw new AppError('expires_at must be after start_date', 400);
    }

    const updated = await this.dataServices.campaigns.update(id, update);
    return withShortUrls(updated!);
  }

  /** Soft delete — the slug stays reserved and click history is kept for analytics */
  async deleteCampaign(id: string) {
    await this.findCampaignOrThrow(id);
    await this.dataServices.campaigns.update(id, { is_active: false, status: CampaignStatus.ARCHIVED });
  }

  // ── Redirect + tracking ────────────────────────────────────────────────────

  async resolveSlug(rawSlug: string): Promise<RedirectResolution> {
    const slug = normalizeSlug(rawSlug);
    if (validateSlugFormat(slug)) return { outcome: 'not_found', target: null };

    const campaign = await this.dataServices.campaigns.findOne({ slug, is_active: true });
    if (!campaign) return { outcome: 'not_found', target: null };

    const now      = new Date();
    const fallback = campaign.fallback_url ?? null;

    if (campaign.status === CampaignStatus.PAUSED)               return { outcome: 'paused',      target: fallback, campaign };
    if (campaign.start_date && campaign.start_date > now)        return { outcome: 'not_started', target: fallback, campaign };
    if (campaign.expires_at && campaign.expires_at <= now)       return { outcome: 'expired',     target: fallback, campaign };

    return { outcome: 'ok', target: campaign.final_url, campaign };
  }

  /** Stores one click and bumps the campaign counters. Called fire-and-forget after the redirect. */
  async recordClick(campaign: ICampaignDocument, ctx: ClickContext): Promise<void> {
    const ua        = parseUserAgent(ctx.user_agent);
    const seenBefore = ua.is_bot
      ? true
      : !!(await this.dataServices.campaignClicks.findOne({ campaign_id: campaign._id, visitor_id: ctx.visitor_id }));
    const isUnique  = !seenBefore;

    let referrerDomain: string | undefined;
    if (ctx.referrer) {
      try { referrerDomain = new URL(ctx.referrer).hostname.replace(/^www\./, ''); } catch { /* malformed header */ }
    }

    const now = new Date();
    await this.dataServices.campaignClicks.create({
      campaign_id:     campaign._id as Types.ObjectId,
      slug:            campaign.slug,
      industry_type:   campaign.industry_type,
      utm_source:      campaign.utm.utm_source,
      utm_medium:      campaign.utm.utm_medium,
      utm_campaign:    campaign.utm.utm_campaign,
      visitor_id:      ctx.visitor_id,
      is_unique:       isUnique,
      is_bot:          ua.is_bot,
      ip:              ctx.ip,
      user_agent:      ctx.user_agent,
      device_type:     ua.device_type,
      browser:         ua.browser,
      browser_version: ua.browser_version,
      os:              ua.os,
      os_version:      ua.os_version,
      referrer:        ctx.referrer,
      referrer_domain: referrerDomain ?? (ctx.referrer ? undefined : 'direct'),
      country:         ctx.country,
      region:          ctx.region,
      city:            ctx.city,
      language:        ctx.language,
      access_type:     ctx.access_type,
      clicked_at:      now,
    });

    await this.dataServices.campaigns.updateMany(
      { _id: campaign._id },
      ua.is_bot
        ? { $inc: { bot_clicks: 1 } }
        : { $inc: { total_clicks: 1, unique_clicks: isUnique ? 1 : 0 }, $set: { last_clicked_at: now } },
    );
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async getCampaignAnalytics(id: string, query: ListQuery = {}) {
    const campaign = await this.findCampaignOrThrow(id);
    const timezone = parseTimezone(query['tz']);
    const interval = parseInterval(query['interval']);
    const range    = clickedAtRange(query);
    const humans   = query['include_bots'] === 'true' ? {} : { is_bot: false };

    const match: Record<string, unknown> = { campaign_id: toObjectId(id) };
    if (range) match['clicked_at'] = range;

    const human = { $match: humans };
    const [facets] = await this.dataServices.campaignClicks.aggregate([
      { $match: match },
      {
        $facet: {
          summary:          [human, ...summaryFacet()],
          bot_clicks:       [{ $match: { is_bot: true } }, { $count: 'count' }],
          timeline:         [human, ...timelineFacet(interval, timezone)],
          by_device:        [human, ...breakdown('device_type')],
          by_browser:       [human, ...breakdown('browser')],
          by_os:            [human, ...breakdown('os')],
          by_country:       [human, ...breakdown('country')],
          by_city:          [human, ...breakdown('city')],
          by_referrer:      [human, ...breakdown('referrer_domain')],
          by_language:      [human, ...breakdown('language')],
          by_access_type:   [human, ...breakdown('access_type')],
          by_hour_of_day:   [human, ...hourOfDayFacet(timezone)],
          by_day_of_week:   [human, ...dayOfWeekFacet(timezone)],
        },
      },
    ]) as Record<string, Record<string, unknown>[]>[];

    const f = facets!;
    return {
      campaign: {
        _id: campaign._id, name: campaign.name, slug: campaign.slug, reference_id: campaign.reference_id,
        industry_type: campaign.industry_type, status: campaign.status, utm: campaign.utm,
        final_url: campaign.final_url, ...buildShortUrls(campaign.slug),
      },
      filters: { from: query['from'] ?? null, to: query['to'] ?? null, interval, timezone, include_bots: query['include_bots'] === 'true' },
      summary:        { ...(f['summary']![0] ?? EMPTY_SUMMARY), bot_clicks: (f['bot_clicks']![0]?.['count'] as number) ?? 0 },
      timeline:       f['timeline'],
      by_device:      f['by_device'],
      by_browser:     f['by_browser'],
      by_os:          f['by_os'],
      by_country:     f['by_country'],
      by_city:        f['by_city'],
      by_referrer:    f['by_referrer'],
      by_language:    f['by_language'],
      by_access_type: f['by_access_type'],
      by_hour_of_day: f['by_hour_of_day'],
      by_day_of_week: f['by_day_of_week'],
    };
  }

  /** Cross-campaign analytics — industry / UTM source / medium comparisons */
  async getOverviewAnalytics(query: ListQuery = {}) {
    const timezone = parseTimezone(query['tz']);
    const interval = parseInterval(query['interval']);
    const range    = clickedAtRange(query);

    const match: Record<string, unknown> = query['include_bots'] === 'true' ? {} : { is_bot: false };
    if (range)                  match['clicked_at']    = range;
    if (query['industry_type']) match['industry_type'] = query['industry_type'];
    if (query['utm_source'])    match['utm_source']    = query['utm_source'];
    if (query['utm_medium'])    match['utm_medium']    = query['utm_medium'];
    if (query['utm_campaign'])  match['utm_campaign']  = query['utm_campaign'];

    const campaignMatch: Record<string, unknown> = { is_active: true };
    if (query['industry_type']) campaignMatch['industry_type'] = query['industry_type'];

    const [[facets], campaignsByIndustry] = await Promise.all([
      this.dataServices.campaignClicks.aggregate([
        { $match: match },
        {
          $facet: {
            summary:        summaryFacet(),
            timeline:       timelineFacet(interval, timezone),
            by_industry:    breakdown('industry_type', 50),
            by_utm_source:  breakdown('utm_source', 20),
            by_utm_medium:  breakdown('utm_medium', 20),
            by_utm_campaign: breakdown('utm_campaign', 20),
            by_device:      breakdown('device_type'),
            by_browser:     breakdown('browser'),
            by_os:          breakdown('os'),
            by_country:     breakdown('country'),
            by_hour_of_day: hourOfDayFacet(timezone),
            top_campaigns: [
              { $group: { _id: '$campaign_id', clicks: { $sum: 1 }, unique_clicks: uniqueSum } },
              { $sort: { clicks: -1 } },
              { $limit: 10 },
              { $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'campaign' } },
              { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 0, campaign_id: '$_id', clicks: 1, unique_clicks: 1,
                  name: '$campaign.name', slug: '$campaign.slug', industry_type: '$campaign.industry_type',
                  utm_source: '$campaign.utm.utm_source', utm_medium: '$campaign.utm.utm_medium',
                },
              },
            ],
          },
        },
      ]) as Promise<Record<string, Record<string, unknown>[]>[]>,
      this.dataServices.campaigns.aggregate([
        { $match: campaignMatch },
        {
          $group: {
            _id:             '$industry_type',
            campaigns:       { $sum: 1 },
            active:          { $sum: { $cond: [{ $eq: ['$status', CampaignStatus.ACTIVE] }, 1, 0] } },
            total_clicks:    { $sum: '$total_clicks' },
            unique_clicks:   { $sum: '$unique_clicks' },
          },
        },
        { $sort: { total_clicks: -1 } },
        {
          $project: {
            _id: 0, industry_type: '$_id', campaigns: 1, active: 1, total_clicks: 1, unique_clicks: 1,
            avg_clicks_per_campaign: { $round: [{ $divide: ['$total_clicks', '$campaigns'] }, 1] },
          },
        },
      ]),
    ]);

    const f = facets!;
    return {
      filters: {
        from: query['from'] ?? null, to: query['to'] ?? null, interval, timezone,
        industry_type: query['industry_type'] ?? null, utm_source: query['utm_source'] ?? null,
        utm_medium: query['utm_medium'] ?? null, utm_campaign: query['utm_campaign'] ?? null,
        include_bots: query['include_bots'] === 'true',
      },
      summary:               f['summary']![0] ?? EMPTY_SUMMARY,
      campaigns_by_industry: campaignsByIndustry,
      timeline:              f['timeline'],
      by_industry:           f['by_industry'],
      by_utm_source:         f['by_utm_source'],
      by_utm_medium:         f['by_utm_medium'],
      by_utm_campaign:       f['by_utm_campaign'],
      by_device:             f['by_device'],
      by_browser:            f['by_browser'],
      by_os:                 f['by_os'],
      by_country:            f['by_country'],
      by_hour_of_day:        f['by_hour_of_day'],
      top_campaigns:         f['top_campaigns'],
    };
  }

  /** Raw click log for one campaign — always paginated (default 20, max 100 per page) */
  async getCampaignClicks(id: string, query: ListQuery = {}) {
    await this.findCampaignOrThrow(id);
    const { pageNum } = parsePagination(query);
    const limitNum    = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

    const match: Record<string, unknown> = { campaign_id: toObjectId(id) };
    const range = clickedAtRange(query);
    if (range)                 match['clicked_at']  = range;
    if (query['device_type'])  match['device_type'] = query['device_type'];
    if (query['browser'])      match['browser']     = query['browser'];
    if (query['os'])           match['os']          = query['os'];
    if (query['country'])      match['country']     = query['country'];
    if (query['is_bot'])       match['is_bot']      = query['is_bot'] === 'true';
    if (query['is_unique'])    match['is_unique']   = query['is_unique'] === 'true';

    return this.dataServices.campaignClicks.aggregateWithPagination(
      [{ $match: match }, { $sort: { clicked_at: -1 } }],
      pageNum,
      limitNum,
    );
  }
}
