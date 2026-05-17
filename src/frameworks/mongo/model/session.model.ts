import { Schema, model, Types, Document } from 'mongoose';

export interface ISession {
  user_id:             Types.ObjectId;
  refresh_token_hash:  string;
  csrf_token:          string;
  expires_at:          Date;
  user_agent?:         string;
  ip_address?:         string;
  is_valid:            boolean;
}

export interface ISessionDocument extends ISession, Document {}

const sessionSchema = new Schema<ISessionDocument>(
  {
    user_id:            { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refresh_token_hash: { type: String, required: true },
    csrf_token:         { type: String, required: true },
    expires_at:         { type: Date,   required: true },
    user_agent:         { type: String },
    ip_address:         { type: String },
    is_valid:           { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

// MongoDB auto-removes expired sessions via TTL index
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ refresh_token_hash: 1 });

export const Session = model<ISessionDocument>('Session', sessionSchema);
