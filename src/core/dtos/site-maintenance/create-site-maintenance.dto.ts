import Joi from 'joi';

export interface CreateSiteMaintenanceDto {
  site_name:            string;
  site_url:             string;
  is_maintenance_mode?: boolean;
  maintenance_message?: string;
}

/**
 * site_url is deliberately NOT Joi.string().uri() — a bare 'abc.com' is a
 * perfectly acceptable input here but fails uri() because it has no scheme.
 * The real parsing/validation happens in normalizeSiteUrl(), which rejects
 * anything unparseable with a 400.
 */
export const createSiteMaintenanceSchema = Joi.object<CreateSiteMaintenanceDto>({
  site_name:           Joi.string().trim().min(1).max(120).required(),
  site_url:            Joi.string().trim().min(3).max(500).required(),
  is_maintenance_mode: Joi.boolean().optional(),
  maintenance_message: Joi.string().trim().max(1000).optional(),
});
