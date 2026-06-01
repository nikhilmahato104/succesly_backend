import Joi from 'joi';

export interface CreateBoardDto {
  name: string;
}

export const createBoardSchema = Joi.object<CreateBoardDto>({
  name: Joi.string().trim().max(100).required()
         .messages({
           'any.required': 'name is required',
           'string.max':   'name must be at most 100 characters',
         }),
});
