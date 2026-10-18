import Joi from 'joi';

export interface UpdateSiteMaintenanceDto {
  site_name?:           string;
  site_url?:            string;
  is_maintenance_mode?: boolean;
  maintenance_message?: string;
  is_active?:           boolean;
}

export const updateSiteMaintenanceSchema = Joi.object<UpdateSiteMaintenanceDto>({
  site_name:           Joi.string().trim().min(1).max(120).optional(),
  site_url:            Joi.string().trim().min(3).max(500).optional(),
  is_maintenance_mode: Joi.boolean().optional(),
  maintenance_message: Joi.string().trim().max(1000).allow('').optional(),
  is_active:           Joi.boolean().optional(),
}).min(1);
