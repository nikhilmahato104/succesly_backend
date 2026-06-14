import { Schema, model } from 'mongoose';
import { IActivityLogDocument } from '../../../core/entities/activity-log.entity';

const fieldChangeSchema = new Schema(
  {
    field: { type: String, required: true },
    from:  { type: Schema.Types.Mixed, default: null },
    to:    { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const activityLogSchema = new Schema<IActivityLogDocument>(
  {
    user_id:          { type: String, required: true, index: true },
    user_email:       { type: String, required: true, index: true },
    action:           { type: String, enum: ['create', 'update', 'delete', 'view', 'list', 'mark_paid', 'add_term'], required: true, index: true },
    module:           { type: String, required: true, index: true },
    entity_id:        { type: String, default: null, index: true },
    entity_ref:       { type: String, default: null },
    description:      { type: String, required: true },
    changes:          { type: [fieldChangeSchema], default: [] },
    method:           { type: String, enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], required: true },
    endpoint:         { type: String, required: true },
    status_code:      { type: Number, required: true },
    is_success:       { type: Boolean, required: true, default: true },
    response_time_ms: { type: Number, required: true },
    ip_address:       { type: String, default: null },
  },
  {
    timestamps:  true,
    versionKey:  false,
    collection:  'activity_logs',
  }
);

// Compound index for the most common query pattern: by user over time
activityLogSchema.index({ user_id: 1, createdAt: -1 });
// Compound index for module-level audit queries
activityLogSchema.index({ module: 1, action: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLogDocument>('ActivityLog', activityLogSchema);
