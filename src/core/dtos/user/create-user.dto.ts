import Joi from 'joi';

export interface CreateUserDto {
  username:           string;
  email:              string;
  mobile_no:          string;
  password:           string;
  role_id:            string;
  profile_image_url?: string;
}

export const createUserSchema = Joi.object<CreateUserDto>({
  username:  Joi.string().trim().min(2).max(50).required()
               .messages({ 'any.required': 'username is required' }),
  email:     Joi.string().trim().lowercase().email().required()
               .messages({ 'any.required': 'email is required', 'string.email': 'email must be valid' }),
  mobile_no: Joi.string().trim().pattern(/^\+?[0-9]{7,15}$/).required()
               .messages({ 'any.required': 'mobile_no is required', 'string.pattern.base': 'mobile_no must be a valid phone number' }),
  password:  Joi.string().min(8).max(128).required()
               .messages({ 'any.required': 'password is required', 'string.min': 'password must be at least 8 characters' }),
  role_id:   Joi.string().trim().required()
               .messages({ 'any.required': 'role_id is required' }),
  profile_image_url: Joi.string().trim().uri().optional().allow(null, '')
               .messages({ 'string.uri': 'profile_image_url must be a valid URL' }),
});
