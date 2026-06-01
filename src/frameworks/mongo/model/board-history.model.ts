import { Schema, model } from 'mongoose';
import { IBoardHistoryDocument } from '../../../core/entities/board-history.entity';

const boardHistorySchema = new Schema<IBoardHistoryDocument>(
  {
    boardId: { type: String, required: [true, 'boardId is required'], ref: 'Board' },
    objects: { type: [Schema.Types.Mixed], default: [] },
    version: { type: Number, required: [true, 'version is required'] },
    savedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

boardHistorySchema.index({ boardId: 1, version: 1 }, { unique: true });

export const BoardHistory = model<IBoardHistoryDocument>('BoardHistory', boardHistorySchema);
