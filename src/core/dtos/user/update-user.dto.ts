import Joi from 'joi';

export interface UpdateUserDto {
  username?:           string;
  email?:              string;
  mobile_no?:          string;
  password?:           string;
  role_id?:            string;
  is_active?:          boolean;
  profile_image_url?:  string | null;
}

export const updateUserSchema = Joi.object<UpdateUserDto>({
  username:  Joi.string().trim().min(2).max(50).optional(),
  email:     Joi.string().trim().lowercase().email().optional()
               .messages({ 'string.email': 'email must be valid' }),
  mobile_no: Joi.string().trim().pattern(/^\+?[0-9]{7,15}$/).optional()
               .messages({ 'string.pattern.base': 'mobile_no must be a valid phone number' }),
  password:  Joi.string().min(8).max(128).optional()
               .messages({ 'string.min': 'password must be at least 8 characters' }),
  role_id:   Joi.string().trim().optional(),
  is_active: Joi.boolean().optional(),
  profile_image_url: Joi.string().trim().uri().optional().allow(null, '')
               .messages({ 'string.uri': 'profile_image_url must be a valid URL' }),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });
