import { Schema, model, Types } from 'mongoose';
import { IUserDocument } from '../../../core/entities/user.entity';

const userSchema = new Schema<IUserDocument>(
  {
    username:  { type: String, required: [true, 'username is required'], trim: true },
    email:     { type: String, required: [true, 'email is required'], unique: true, lowercase: true, trim: true },
    mobile_no: { type: String, required: [true, 'mobile_no is required'], trim: true },
    password:  { type: String, required: [true, 'password is required'] },
    role_id:           { type: Schema.Types.ObjectId, ref: 'Role', required: [true, 'role_id is required'] },
    is_active:         { type: Boolean, default: true },
    profile_image_url: { type: String, trim: true, default: null },
  },
  { timestamps: true, versionKey: false }
);

export const User = model<IUserDocument>('User', userSchema);
