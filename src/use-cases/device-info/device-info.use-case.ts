import { IDataServices }        from '../../core/abstracts/data-service.abstract';
import { TrackDeviceInfoDto }   from '../../core/dtos/device-info/create-device-info.dto';
import { UpdateDeviceInfoDto }  from '../../core/dtos/device-info/update-device-info.dto';
import { AppError }             from '../../utils/app-error.util';
import { ListQuery, parsePagination, buildPageResult } from '../../utils/pagination.util';
import { Counter }              from '../../frameworks/mongo/model/counter.model';

// ─── Reference ID helpers ────────────────────────────────────────────────────

/**
 * Same encoding scheme as Booking's reference_id (see booking.use-case.ts):
 * 1-99999 → 5-digit zero-padded, then letter + 4-digit overflow buckets.
 */
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
    { _id: 'device_info_reference' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `DEV-${dd}-${mm}-${yyyy}-${formatCounter(counter!.seq)}`;
}

// ─── Use-case ────────────────────────────────────────────────────────────────

export class DeviceInfoUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  async getAllDeviceInfos(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    const match: Record<string, unknown> = {};

    match['is_active'] = query['is_active'] !== undefined
      ? query['is_active'] === 'true'
      : true;

    if (query['country'])      match['country']      = query['country'];
    if (query['website_name']) match['website_name']  = query['website_name'];

    if (query['search']) {
      const regex = { $regex: query['search'], $options: 'i' };
      match['$or'] = [
        { device_name:             regex },
        { device_number:           regex },
        { reference_id:           regex },
        { frontend_generated_uuid: regex },
      ];
    }

    const pipeline = [{ $match: match }];

    if (hasPagination) {
      return this.dataServices.deviceInfos.aggregateWithPagination(pipeline, pageNum, limitNum);
    }

    const data = await this.dataServices.deviceInfos.aggregate(pipeline) as Record<string, unknown>[];
    return buildPageResult(data, data.length, 1, data.length || 1);
  }

  async getDeviceInfoById(id: string) {
    const deviceInfo = await this.dataServices.deviceInfos.get(id);
    if (!deviceInfo) throw new AppError('Device info not found', 404);
    return deviceInfo;
  }

  /**
   * Records one page-hit from the frontend tracking snippet.
   *
   * Upsert-by-uuid: `frontend_generated_uuid` is the identity key the frontend
   * generates once (e.g. localStorage) and resends on every call.
   *   - Unknown uuid  → create a new DeviceInfo document.
   *   - Known uuid    → update device/location fields in place, bump
   *                     `device_change` only if device_name actually differs,
   *                     and update `website_all_url_route`:
   *                       - url already present → $inc its hit_count, refresh last_hit_at
   *                       - url not present     → $push a new entry
   * Never creates a second document for the same uuid.
   */
  async trackDevice(dto: TrackDeviceInfoDto, deviceIp: string) {
    const existing = await this.dataServices.deviceInfos.findOne({
      frontend_generated_uuid: dto.frontend_generated_uuid,
    });

    const now = new Date();

    if (!existing) {
      const reference_id = await generateReferenceId();
      return this.dataServices.deviceInfos.create({
        reference_id,
        frontend_generated_uuid: dto.frontend_generated_uuid,
        device_number:           dto.device_number,
        device_name:             dto.device_name,
        device_change:           0,
        device_ip:               deviceIp,
        country:                 dto.country,
        lat:                     dto.lat,
        long:                    dto.long,
        website_name:            dto.website_name,
        website_all_url_route: [{
          url:         dto.url,
          hit_count:   1,
          created_at:  now,
          last_hit_at: now,
        }],
        is_active: true,
      });
    }

    const deviceNameChanged = dto.device_name !== existing.device_name;

    const fieldUpdate: Record<string, unknown> = {
      device_number: dto.device_number,
      device_name:   dto.device_name,
      device_ip:     deviceIp,
      website_name:  dto.website_name,
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.lat     !== undefined && { lat: dto.lat }),
      ...(dto.long    !== undefined && { long: dto.long }),
    };

    const urlExists = existing.website_all_url_route.some(entry => entry.url === dto.url);

    if (urlExists) {
      // Positional $ operator increments the matching array element in place
      await this.dataServices.deviceInfos.updateMany(
        { frontend_generated_uuid: dto.frontend_generated_uuid, 'website_all_url_route.url': dto.url },
        {
          $set: { ...fieldUpdate, 'website_all_url_route.$.last_hit_at': now },
          $inc: { 'website_all_url_route.$.hit_count': 1, ...(deviceNameChanged && { device_change: 1 }) },
        },
      );
    } else {
      await this.dataServices.deviceInfos.updateMany(
        { frontend_generated_uuid: dto.frontend_generated_uuid },
        {
          $set:  fieldUpdate,
          $push: { website_all_url_route: { url: dto.url, hit_count: 1, created_at: now, last_hit_at: now } },
          ...(deviceNameChanged && { $inc: { device_change: 1 } }),
        },
      );
    }

    return this.dataServices.deviceInfos.findOne({ frontend_generated_uuid: dto.frontend_generated_uuid });
  }

  async updateDeviceInfo(id: string, dto: UpdateDeviceInfoDto) {
    const deviceInfo = await this.dataServices.deviceInfos.get(id);
    if (!deviceInfo) throw new AppError('Device info not found', 404);
    return this.dataServices.deviceInfos.update(id, dto);
  }

  async deleteDeviceInfo(id: string) {
    const deviceInfo = await this.dataServices.deviceInfos.get(id);
    if (!deviceInfo) throw new AppError('Device info not found', 404);
    await this.dataServices.deviceInfos.delete(id);
  }
}
