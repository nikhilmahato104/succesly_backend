import Joi from 'joi';

export interface UpdateDeviceInfoDto {
  device_name?: string;
  country?:     string;
  lat?:         number;
  long?:        number;
  is_active?:   boolean;
}

export const updateDeviceInfoSchema = Joi.object<UpdateDeviceInfoDto>({
  device_name: Joi.string(),
  country:     Joi.string().allow(''),
  lat:         Joi.number().min(-90).max(90),
  long:        Joi.number().min(-180).max(180),
  is_active:   Joi.boolean(),
}).min(1);
