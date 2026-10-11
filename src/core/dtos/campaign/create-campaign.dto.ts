import Joi from 'joi';
import { IndustryType, CampaignStatus, IUtmParams, ICustomParam } from '../../entities/campaign.entity';
import { SLUG_MIN_LENGTH, SLUG_MAX_LENGTH, MAX_CUSTOM_PARAMS } from '../../../utils/short-link.util';

export interface CreateCampaignDto {
  name:            string;
  description?:    string;
  industry_type:   IndustryType;
  destination_url: string;
  utm:             IUtmParams;
  custom_params?:  ICustomParam[];
  slug?:           string;          // omitted → random 6-char slug
  tags?:           string[];
  status?:         CampaignStatus;
  start_date?:     Date;
  expires_at?:     Date;
  fallback_url?:   string;
}

const httpUrl = Joi.string().trim().uri({ scheme: ['http', 'https'] });

// UTM values: no spaces/& so they stay readable in GA reports — e.g. "diwali_sale_2026"
const utmValue = Joi.string().trim().max(100).pattern(/^[^\s&=#?]+$/)
  .messages({ 'string.pattern.base': '{{#label}} must not contain spaces or & = # ? characters' });

export const utmSchema = Joi.object<IUtmParams>({
  utm_source:          utmValue.required(),
  utm_medium:          utmValue.required(),
  utm_campaign:        utmValue.required(),
  utm_term:            utmValue,
  utm_content:         utmValue,
  utm_id:              utmValue,
  utm_source_platform: utmValue,
});

export const customParamsSchema = Joi.array().max(MAX_CUSTOM_PARAMS).items(Joi.object<ICustomParam>({
  key:   Joi.string().trim().max(50).pattern(/^[a-zA-Z0-9_\-.]+$/).invalid(
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_source_platform',
  ).required().messages({ 'any.invalid': 'custom_params key {{#value}} is a UTM field — put it inside utm instead' }),
  value: utmValue.required(),
})).unique('key');

// Format/reserved-word checks run in the use-case so the error can carry suggestions
export const slugSchema = Joi.string().trim().lowercase().min(SLUG_MIN_LENGTH).max(SLUG_MAX_LENGTH);

export const createCampaignSchema = Joi.object<CreateCampaignDto>({
  name:            Joi.string().trim().min(2).max(150).required(),
  description:     Joi.string().trim().max(1000).allow(''),
  industry_type:   Joi.string().valid(...Object.values(IndustryType)).required(),
  destination_url: httpUrl.max(2000).required(),
  utm:             utmSchema.required(),
  custom_params:   customParamsSchema,
  slug:            slugSchema,
  tags:            Joi.array().max(20).items(Joi.string().trim().lowercase().max(40)),
  status:          Joi.string().valid(CampaignStatus.ACTIVE, CampaignStatus.PAUSED),
  start_date:      Joi.date().iso(),
  expires_at:      Joi.date().iso().when('start_date', {
    is:   Joi.exist(),
    then: Joi.date().greater(Joi.ref('start_date')),
  }),
  fallback_url:    httpUrl.max(2000),
});
