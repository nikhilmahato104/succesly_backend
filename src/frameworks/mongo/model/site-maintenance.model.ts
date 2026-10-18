import { Schema, model } from 'mongoose';
import {
  ISiteMaintenanceDocument,
  DEFAULT_MAINTENANCE_MESSAGE,
} from '../../../core/entities/site-maintenance.entity';

const siteMaintenanceSchema = new Schema<ISiteMaintenanceDocument>(
  {
    reference_id:        { type: String, required: true, unique: true, index: true },
    site_name:           { type: String, required: [true, 'site_name is required'], trim: true },
    site_url:            { type: String, required: [true, 'site_url is required'], trim: true },
    // unique → the same site can never be registered twice under two spellings
    // ('abc.com' and 'https://www.abc.com/' both normalise to 'abc.com')
    normalized_url:      { type: String, required: true, unique: true, index: true },
    site_host:           { type: String, required: true, index: true },
    is_maintenance_mode: { type: Boolean, default: false },
    maintenance_message: { type: String, trim: true, default: DEFAULT_MAINTENANCE_MESSAGE },
    created_by:          { type: String, required: [true, 'created_by is required'] },
    is_active:           { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const SiteMaintenance = model<ISiteMaintenanceDocument>('SiteMaintenance', siteMaintenanceSchema);
