import Joi from 'joi';

export interface TrackDeviceInfoDto {
  frontend_generated_uuid: string;
  device_number:           string;
  device_name:              string;
  country?:                 string;
  lat?:                     number;
  long?:                    number;
  website_name:             string;
  url:                      string;
}

export const trackDeviceInfoSchema = Joi.object<TrackDeviceInfoDto>({
  frontend_generated_uuid: Joi.string().required(),
  device_number:           Joi.string().required(),
  device_name:              Joi.string().required(),
  country:                  Joi.string().optional(),
  lat:                      Joi.number().min(-90).max(90).optional(),
  long:                     Joi.number().min(-180).max(180).optional(),
  website_name:             Joi.string().required(),
  url:                      Joi.string().required(),
});
