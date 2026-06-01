import { Document } from 'mongoose';

export interface IBoardHistory {
  boardId: string;
  objects: object[];
  version: number;
  savedAt: Date;
}

export interface IBoardHistoryDocument extends IBoardHistory, Document {}
