import Joi from 'joi';

export interface UpdateBoardDto {
  name?: string;
}

export const updateBoardSchema = Joi.object<UpdateBoardDto>({
  name: Joi.string().trim().max(100).optional()
         .messages({ 'string.max': 'name must be at most 100 characters' }),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });
