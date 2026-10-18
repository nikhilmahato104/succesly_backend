import { IDataServices }                  from '../../core/abstracts/data-service.abstract';
import { CreateSiteMaintenanceDto }        from '../../core/dtos/site-maintenance/create-site-maintenance.dto';
import { UpdateSiteMaintenanceDto }        from '../../core/dtos/site-maintenance/update-site-maintenance.dto';
import {
  ISiteMaintenance,
  DEFAULT_MAINTENANCE_MESSAGE,
} from '../../core/entities/site-maintenance.entity';
import { AppError }                        from '../../utils/app-error.util';
import { normalizeSiteUrl }                from '../../utils/site-url.util';
import { ListQuery, parsePagination, buildPageResult } from '../../utils/pagination.util';
import { Counter }                         from '../../frameworks/mongo/model/counter.model';

// ─── Reference ID helpers ────────────────────────────────────────────────────

/** 1-99999 → 5-digit zero-padded, then letter + 4-digit overflow buckets. */
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
    { _id: 'site_maintenance_reference' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `SITE-${dd}-${mm}-${yyyy}-${formatCounter(counter!.seq)}`;
}

// ─── Status check result ─────────────────────────────────────────────────────

export interface SiteMaintenanceStatus {
  /** The url exactly as the caller sent it */
  requested_url:        string;
  /** What that url was matched on after normalisation */
  normalized_url:       string;
  /** false → no record exists for this url, so the site is treated as live */
  registered:           boolean;
  /** 'exact' → matched the stored url; 'host' → matched the site root record */
  matched_by:           'exact' | 'host' | null;
  is_maintenance_mode:  boolean;
  maintenance_message:  string | null;
  site_name:            string | null;
  site_url:             string | null;
  reference_id:         string | null;
}

// ─── Use-case ────────────────────────────────────────────────────────────────

export class SiteMaintenanceUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  async getAllSites(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    const match: Record<string, unknown> = {};

    match['is_active'] = query['is_active'] !== undefined
      ? query['is_active'] === 'true'
      : true;

    if (query['is_maintenance_mode'] !== undefined) {
      match['is_maintenance_mode'] = query['is_maintenance_mode'] === 'true';
    }

    if (query['search']) {
      const regex = { $regex: query['search'], $options: 'i' };
      match['$or'] = [
        { site_name:      regex },
        { site_url:       regex },
        { normalized_url: regex },
        { reference_id:   regex },
      ];
    }

    const pipeline = [{ $match: match }, { $sort: { createdAt: -1 } }];

    if (hasPagination) {
      return this.dataServices.siteMaintenances.aggregateWithPagination(pipeline, pageNum, limitNum);
    }

    const data = await this.dataServices.siteMaintenances.aggregate(pipeline) as Record<string, unknown>[];
    return buildPageResult(data, data.length, 1, data.length || 1);
  }

  async getSiteById(id: string) {
    const site = await this.dataServices.siteMaintenances.get(id);
    if (!site) throw new AppError('Site not found', 404);
    return site;
  }

  async createSite(dto: CreateSiteMaintenanceDto, createdBy: string) {
    const { host, normalized } = normalizeSiteUrl(dto.site_url);

    const duplicate = await this.dataServices.siteMaintenances.findOne({ normalized_url: normalized });
    if (duplicate) {
      throw new AppError(
        `Site '${normalized}' is already registered — update that record instead`,
        409,
        true,
        { normalized_url: normalized, existing_id: String((duplicate as unknown as { _id: unknown })._id) },
      );
    }

    const reference_id = await generateReferenceId();

    return this.dataServices.siteMaintenances.create({
      reference_id,
      site_name:           dto.site_name,
      site_url:            dto.site_url.trim(),
      normalized_url:      normalized,
      site_host:           host,
      is_maintenance_mode: dto.is_maintenance_mode ?? false,
      maintenance_message: dto.maintenance_message ?? DEFAULT_MAINTENANCE_MESSAGE,
      created_by:          createdBy,
      is_active:           true,
    });
  }

  async updateSite(id: string, dto: UpdateSiteMaintenanceDto) {
    const existing = await this.dataServices.siteMaintenances.get(id);
    if (!existing) throw new AppError('Site not found', 404);

    const update: Record<string, unknown> = {};

    if (dto.site_name           !== undefined) update['site_name']           = dto.site_name;
    if (dto.is_maintenance_mode !== undefined) update['is_maintenance_mode'] = dto.is_maintenance_mode;
    if (dto.is_active           !== undefined) update['is_active']           = dto.is_active;

    // An empty message resets the site back to the default wording
    if (dto.maintenance_message !== undefined) {
      update['maintenance_message'] = dto.maintenance_message.trim() || DEFAULT_MAINTENANCE_MESSAGE;
    }

    // Changing the url re-derives the match keys and must not collide with another record
    if (dto.site_url !== undefined) {
      const { host, normalized } = normalizeSiteUrl(dto.site_url);

      const clash = await this.dataServices.siteMaintenances.findOne({ normalized_url: normalized });
      if (clash && String((clash as unknown as { _id: unknown })._id) !== id) {
        throw new AppError(`Site '${normalized}' is already registered under another record`, 409);
      }

      update['site_url']       = dto.site_url.trim();
      update['normalized_url'] = normalized;
      update['site_host']      = host;
    }

    return this.dataServices.siteMaintenances.update(id, update);
  }

  async deleteSite(id: string) {
    const site = await this.dataServices.siteMaintenances.get(id);
    if (!site) throw new AppError('Site not found', 404);
    await this.dataServices.siteMaintenances.delete(id);
  }

  /**
   * The public gate check.
   *
   * Lookup order:
   *   1. exact match on the normalised url   — 'abc.com/shop' hits the record
   *                                            registered for that exact path
   *   2. host match on the site root record  — so one record for 'abc.com'
   *                                            also covers 'abc.com/shop/item/1'
   *
   * Nothing found → the site is reported as live (`registered: false`) with a
   * 200, never a 404. A gate check must fail OPEN: an unregistered or mistyped
   * url should not take a working site down.
   *
   * Only `is_active: true` records are considered — deactivating a record is
   * the same as removing the site from maintenance control.
   */
  async getStatusByUrl(rawUrl: string): Promise<SiteMaintenanceStatus> {
    const { host, normalized } = normalizeSiteUrl(rawUrl);

    let matched_by: 'exact' | 'host' | null = 'exact';
    let site = await this.dataServices.siteMaintenances.findOne({
      normalized_url: normalized,
      is_active:      true,
    });

    if (!site && normalized !== host) {
      matched_by = 'host';
      site = await this.dataServices.siteMaintenances.findOne({
        normalized_url: host,
        is_active:      true,
      });
    }

    if (!site) {
      return {
        requested_url:       rawUrl,
        normalized_url:      normalized,
        registered:          false,
        matched_by:          null,
        is_maintenance_mode: false,
        maintenance_message: null,
        site_name:           null,
        site_url:            null,
        reference_id:        null,
      };
    }

    const doc = site as unknown as ISiteMaintenance;

    return {
      requested_url:       rawUrl,
      normalized_url:      normalized,
      registered:          true,
      matched_by,
      is_maintenance_mode: doc.is_maintenance_mode,
      maintenance_message: doc.is_maintenance_mode
        ? (doc.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE)
        : null,
      site_name:           doc.site_name,
      site_url:            doc.site_url,
      reference_id:        doc.reference_id,
    };
  }
}
