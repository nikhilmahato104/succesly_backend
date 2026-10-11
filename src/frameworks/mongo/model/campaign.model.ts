import mongoose, { Schema } from 'mongoose';
import { ICampaignDocument, IndustryType, CampaignStatus } from '../../../core/entities/campaign.entity';

const UtmSchema = new Schema({
  utm_source:          { type: String, required: true, trim: true },
  utm_medium:          { type: String, required: true, trim: true },
  utm_campaign:        { type: String, required: true, trim: true },
  utm_term:            { type: String, trim: true },
  utm_content:         { type: String, trim: true },
  utm_id:              { type: String, trim: true },
  utm_source_platform: { type: String, trim: true },
}, { _id: false });

const CustomParamSchema = new Schema({
  key:   { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
}, { _id: false });

const CampaignSchema = new Schema<ICampaignDocument>({
  reference_id:    { type: String, unique: true, required: true, index: true },
  name:            { type: String, required: true, trim: true },
  description:     { type: String, trim: true },
  industry_type:   { type: String, enum: Object.values(IndustryType), required: true, index: true },

  destination_url: { type: String, required: true, trim: true },
  utm:             { type: UtmSchema, required: true },
  custom_params:   { type: [CustomParamSchema], default: [] },
  final_url:       { type: String, required: true },

  // Unique across ALL campaigns, including archived ones — a slug is never reused
  slug:            { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  tags:            { type: [String], default: [] },

  status:          { type: String, enum: Object.values(CampaignStatus), default: CampaignStatus.ACTIVE, index: true },
  start_date:      { type: Date },
  expires_at:      { type: Date },
  fallback_url:    { type: String, trim: true },

  total_clicks:    { type: Number, default: 0 },
  unique_clicks:   { type: Number, default: 0 },
  bot_clicks:      { type: Number, default: 0 },
  last_clicked_at: { type: Date },

  created_by:      { type: String },
  is_active:       { type: Boolean, default: true },
}, { timestamps: true });

CampaignSchema.index({ 'utm.utm_source': 1, 'utm.utm_medium': 1 });

export const Campaign = mongoose.model<ICampaignDocument>('Campaign', CampaignSchema);
