import Joi from 'joi';

export interface SaveBoardDto {
  objects:     object[];
  cameraState: { x: number; y: number; scale: number };
  thumbnail?:  string | null;
}

export const saveBoardSchema = Joi.object<SaveBoardDto>({
  objects: Joi.array().required()
             .messages({ 'any.required': 'objects is required' }),
  cameraState: Joi.object({
    x:     Joi.number().required(),
    y:     Joi.number().required(),
    scale: Joi.number().positive().required(),
  }).required().messages({ 'any.required': 'cameraState is required' }),
  thumbnail: Joi.string().optional().allow(null, ''),
});
