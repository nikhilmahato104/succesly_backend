import mongoose, { Schema } from 'mongoose';
import { IDeviceInfoDocument } from '../../../core/entities/device-info.entity';

const WebsiteUrlHitSchema = new Schema({
  url:         { type: String, required: true },
  hit_count:   { type: Number, default: 1 },
  created_at:  { type: Date,   default: Date.now },
  last_hit_at: { type: Date,   default: Date.now },
}, { _id: false });

const DeviceInfoSchema = new Schema<IDeviceInfoDocument>({
  reference_id:             { type: String, unique: true, required: true, index: true },
  frontend_generated_uuid:  { type: String, unique: true, required: true, index: true },
  device_number:            { type: String, required: true },
  device_name:              { type: String, required: true },
  device_change:            { type: Number, default: 0 },
  device_ip:                { type: String },
  country:                  { type: String },
  lat:                      { type: Number },
  long:                     { type: Number },
  website_name:             { type: String, required: true },
  website_all_url_route:    { type: [WebsiteUrlHitSchema], default: [] },
  is_active:                { type: Boolean, default: true },
}, { timestamps: true });

export const DeviceInfo = mongoose.model<IDeviceInfoDocument>('DeviceInfo', DeviceInfoSchema);
