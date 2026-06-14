import { IDataServices }          from '../../core/abstracts/data-service.abstract';
import { AppError }               from '../../utils/app-error.util';
import { ListQuery, parsePagination, buildPageResult } from '../../utils/pagination.util';

export class ActivityLogUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  /**
   * List activity logs — full-featured query with:
   *   - text search (description, endpoint, user_email)
   *   - filters: module, action, method, is_success, entity_id, user_id/user_email
   *   - date range (date_from / date_to on createdAt)
   *   - pagination (page + limit)
   *   - default sort: newest first
   */
  async getAllLogs(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    const match: Record<string, unknown> = {};

    // ── Direct equality filters ───────────────────────────────────────────────
    if (query['module'])     match['module']     = query['module'];
    if (query['action'])     match['action']     = query['action'];
    if (query['method'])     match['method']     = query['method'];
    if (query['entity_id'])  match['entity_id']  = query['entity_id'];
    if (query['user_id'])    match['user_id']    = query['user_id'];

    if (query['is_success'] !== undefined) {
      match['is_success'] = query['is_success'] === 'true';
    }

    // ── Partial match on user_email ───────────────────────────────────────────
    if (query['user_email']) {
      match['user_email'] = { $regex: query['user_email'], $options: 'i' };
    }

    // ── Date range on createdAt ───────────────────────────────────────────────
    if (query['date_from'] || query['date_to']) {
      const range: Record<string, Date> = {};
      if (query['date_from']) {
        range['$gte'] = new Date(query['date_from']);
      }
      if (query['date_to']) {
        const to = new Date(query['date_to']);
        to.setHours(23, 59, 59, 999);
        range['$lte'] = to;
      }
      match['createdAt'] = range;
    }

    // ── Free-text search across description, endpoint, entity_ref ────────────
    if (query['search']) {
      const regex = { $regex: query['search'], $options: 'i' };
      match['$or'] = [
        { description: regex },
        { endpoint:    regex },
        { entity_ref:  regex },
        { user_email:  regex },
      ];
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
    ];

    if (hasPagination) {
      return this.dataServices.activityLogs.aggregateWithPagination(pipeline, pageNum, limitNum);
    }

    const data = await this.dataServices.activityLogs.aggregate(pipeline) as Record<string, unknown>[];
    return buildPageResult(data, data.length, 1, data.length || 1);
  }

  async getLogById(id: string) {
    const log = await this.dataServices.activityLogs.get(id);
    if (!log) throw new AppError('Activity log not found', 404);
    return log;
  }

  /**
   * Summary stats: total logs, breakdown by action and module.
   * Useful for an admin dashboard chart.
   */
  async getSummary(query: ListQuery = {}) {
    const match: Record<string, unknown> = {};

    if (query['user_id'])   match['user_id']   = query['user_id'];
    if (query['module'])    match['module']     = query['module'];
    if (query['date_from'] || query['date_to']) {
      const range: Record<string, Date> = {};
      if (query['date_from']) range['$gte'] = new Date(query['date_from']);
      if (query['date_to']) {
        const to = new Date(query['date_to']);
        to.setHours(23, 59, 59, 999);
        range['$lte'] = to;
      }
      match['createdAt'] = range;
    }

    const [byAction, byModule] = await Promise.all([
      this.dataServices.activityLogs.aggregate([
        { $match: match },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.dataServices.activityLogs.aggregate([
        { $match: match },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const total = (byAction as { count: number }[]).reduce((s, r) => s + r.count, 0);

    return { total, by_action: byAction, by_module: byModule };
  }
}
