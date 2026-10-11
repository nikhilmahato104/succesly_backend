import Joi from 'joi';
import { IndustryType, CampaignStatus, IUtmParams, ICustomParam } from '../../entities/campaign.entity';
import { utmSchema, customParamsSchema, slugSchema } from './create-campaign.dto';

export interface UpdateCampaignDto {
  name?:            string;
  description?:     string;
  industry_type?:   IndustryType;
  destination_url?: string;
  utm?:             IUtmParams;     // full object — replaces the stored utm
  custom_params?:   ICustomParam[]; // full array  — replaces the stored list
  slug?:            string;         // changing it breaks already-shared links
  tags?:            string[];
  status?:          CampaignStatus.ACTIVE | CampaignStatus.PAUSED;
  start_date?:      Date | null;
  expires_at?:      Date | null;
  fallback_url?:    string | null;
}

const httpUrl = Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(2000);

export const updateCampaignSchema = Joi.object<UpdateCampaignDto>({
  name:            Joi.string().trim().min(2).max(150),
  description:     Joi.string().trim().max(1000).allow(''),
  industry_type:   Joi.string().valid(...Object.values(IndustryType)),
  destination_url: httpUrl,
  utm:             utmSchema,
  custom_params:   customParamsSchema,
  slug:            slugSchema,
  tags:            Joi.array().max(20).items(Joi.string().trim().lowercase().max(40)),
  status:          Joi.string().valid(CampaignStatus.ACTIVE, CampaignStatus.PAUSED),
  start_date:      Joi.date().iso().allow(null),
  expires_at:      Joi.date().iso().allow(null),
  fallback_url:    httpUrl.allow(null),
}).min(1);
