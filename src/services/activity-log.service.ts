import { ActivityLog }   from '../frameworks/mongo/model/activity-log.model';
import { ActivityAction, HttpMethod, IFieldChange } from '../core/entities/activity-log.entity';

// ─── Input shape accepted by every .log() call ───────────────────────────────
export interface LogInput {
  user_id:          string;
  user_email:       string;
  action:           ActivityAction;
  module:           string;
  entity_id?:       string;
  entity_ref?:      string;
  description:      string;
  changes?:         IFieldChange[];
  method:           HttpMethod;
  endpoint:         string;
  status_code:      number;
  is_success:       boolean;
  response_time_ms: number;
  ip_address?:      string;
}

// ─── Helpers exposed so controllers can build rich descriptions ───────────────
export interface DescribeHelpers {
  create(who: string, module: string, entityRef: string, extra?: string): string;
  update(who: string, module: string, entityRef: string, changes: IFieldChange[]): string;
  delete(who: string, module: string, entityRef: string): string;
  markPaid(who: string, entityRef: string, termNo: number, amount: number, mode?: string): string;
  addTerm(who: string, entityRef: string, termNo: number, amount: number, dueDate?: string): string;
  custom(sentence: string): string;
}

// ─── Field diff helper ────────────────────────────────────────────────────────
export function computeFieldChanges(
  oldDoc:  Record<string, unknown>,
  updates: Record<string, unknown>,
  fields:  string[],
): IFieldChange[] {
  const changes: IFieldChange[] = [];
  for (const field of fields) {
    if (updates[field] === undefined) continue;
    const from = oldDoc[field];
    const to   = updates[field];
    if (String(from) !== String(to)) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

// ─── Singleton service ────────────────────────────────────────────────────────
class ActivityLogService {

  /**
   * Extract a display name from an email address.
   * "nikhil.sharma@wesoftek.com" → "nikhil.sharma"
   */
  who(email: string): string {
    return email.split('@')[0] ?? email;
  }

  /**
   * Human-readable description builders — call these in your controller
   * before calling .log() so descriptions are consistent across the app.
   */
  readonly describe: DescribeHelpers = {
    create(who, module, entityRef, extra) {
      return extra
        ? `${who} created a new ${module} '${entityRef}' — ${extra}`
        : `${who} created a new ${module} '${entityRef}'`;
    },

    update(who, module, entityRef, changes) {
      if (!changes.length) {
        return `${who} updated ${module} '${entityRef}'`;
      }
      const list = changes
        .map(c => `${c.field} from '${c.from}' to '${c.to}'`)
        .join(', ');
      return `${who} updated ${module} '${entityRef}' — changed ${list}`;
    },

    delete(who, module, entityRef) {
      return `${who} permanently deleted ${module} '${entityRef}'`;
    },

    markPaid(who, entityRef, termNo, amount, mode) {
      const modeStr = mode ? ` via ${mode.replace('_', ' ')}` : '';
      return `${who} marked payment term #${termNo} as paid (₹${amount.toLocaleString()}${modeStr}) on project '${entityRef}'`;
    },

    addTerm(who, entityRef, termNo, amount, dueDate) {
      const dateStr = dueDate ? `, due ${new Date(dueDate).toDateString()}` : '';
      return `${who} added payment term #${termNo} (₹${amount.toLocaleString()}${dateStr}) to project '${entityRef}'`;
    },

    custom(sentence) {
      return sentence;
    },
  };

  /**
   * Persist an activity log record.
   *
   * FIRE-AND-FORGET — uses setImmediate so the HTTP response is sent first.
   * Errors are swallowed with a console warning so logging never crashes an API.
   */
  log(input: LogInput): void {
    setImmediate(async () => {
      try {
        await ActivityLog.create(input);
      } catch (err) {
        console.warn('[ActivityLog] Failed to persist log entry:', (err as Error).message);
      }
    });
  }
}

// Export a single shared instance — instantiated once on startup
export const activityLogService = new ActivityLogService();
