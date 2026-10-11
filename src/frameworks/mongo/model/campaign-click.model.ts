import mongoose, { Schema } from 'mongoose';
import { ICampaignClickDocument, DeviceType, ClickAccessType } from '../../../core/entities/campaign-click.entity';
import { IndustryType } from '../../../core/entities/campaign.entity';

const CampaignClickSchema = new Schema<ICampaignClickDocument>({
  campaign_id:     { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
  slug:            { type: String, required: true },
  industry_type:   { type: String, enum: Object.values(IndustryType), required: true },
  utm_source:      { type: String },
  utm_medium:      { type: String },
  utm_campaign:    { type: String },

  visitor_id:      { type: String, required: true },
  is_unique:       { type: Boolean, default: false },
  is_bot:          { type: Boolean, default: false },

  ip:              { type: String },
  user_agent:      { type: String },
  device_type:     { type: String, enum: Object.values(DeviceType), default: DeviceType.UNKNOWN },
  browser:         { type: String, default: 'Unknown' },
  browser_version: { type: String },
  os:              { type: String, default: 'Unknown' },
  os_version:      { type: String },

  referrer:        { type: String },
  referrer_domain: { type: String },
  country:         { type: String },
  region:          { type: String },
  city:            { type: String },
  language:        { type: String },

  access_type:     { type: String, enum: Object.values(ClickAccessType), required: true },
  clicked_at:      { type: Date, default: Date.now },
}, { versionKey: false });

// Per-campaign analytics (date-range scans) and unique-visitor checks
CampaignClickSchema.index({ campaign_id: 1, clicked_at: -1 });
CampaignClickSchema.index({ campaign_id: 1, visitor_id: 1 });
// Cross-campaign analytics
CampaignClickSchema.index({ clicked_at: -1, industry_type: 1 });
CampaignClickSchema.index({ utm_source: 1, clicked_at: -1 });

export const CampaignClick = mongoose.model<ICampaignClickDocument>('CampaignClick', CampaignClickSchema);
