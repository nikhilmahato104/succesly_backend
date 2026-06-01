import { Document } from 'mongoose';

export interface ICameraState {
  x:     number;
  y:     number;
  scale: number;
}

export interface IBoard {
  _id:         string;
  name:        string;
  slug:        string;
  thumbnail:   string | null;
  cameraState: ICameraState;
  objects:     object[];
  objectCount: number;
  version:     number;
  deletedAt:   Date | null;
}

export interface IBoardDocument extends IBoard, Document<string> {}
