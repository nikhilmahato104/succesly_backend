import { Schema, model } from 'mongoose';
import { IBoardDocument } from '../../../core/entities/board.entity';

const cameraStateSchema = new Schema(
  {
    x:     { type: Number, default: 0 },
    y:     { type: Number, default: 0 },
    scale: { type: Number, default: 1 },
  },
  { _id: false },
);

const boardSchema = new Schema<IBoardDocument>(
  {
    _id:         { type: String },
    name:        { type: String, required: [true, 'name is required'], trim: true, maxlength: 100 },
    slug:        { type: String, required: true, trim: true },
    thumbnail:   { type: String, default: null },
    cameraState: { type: cameraStateSchema, default: () => ({ x: 0, y: 0, scale: 1 }) },
    objects:     { type: [Schema.Types.Mixed], default: [] },
    objectCount: { type: Number, default: 0 },
    version:     { type: Number, default: 1 },
    deletedAt:   { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const Board = model<IBoardDocument>('Board', boardSchema);
