import { Document, Types } from 'mongoose';

export interface IUser {
  username:  string;
  email:     string;
  mobile_no: string;
  password:  string;   // bcrypt-hashed, never returned in API responses
  role_id:   Types.ObjectId;
  is_active: boolean;
}

export interface IUserDocument extends IUser, Document {}

/** Shape embedded in every JWT access token */
export interface IJwtPayload {
  user_id:    string;
  email:      string;
  role_id:    string;
  session_id: string; // links token to a server-side session document
}
