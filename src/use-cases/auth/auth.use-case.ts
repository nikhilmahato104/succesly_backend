import bcrypt          from 'bcryptjs';
import jwt             from 'jsonwebtoken';
import crypto          from 'crypto';
import { Types }       from 'mongoose';
import { User }        from '../../frameworks/mongo/model/user.model';
import { Session }     from '../../frameworks/mongo/model/session.model';
import { IDataServices } from '../../core/abstracts/data-service.abstract';
import { LoginDto }    from '../../core/dtos/user/login.dto';
import { IJwtPayload } from '../../core/entities/user.entity';
import { AppError }    from '../../utils/app-error.util';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_BYTES,
  CSRF_TOKEN_BYTES,
} from '../../utils/constants';

export class AuthUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  async login(
    dto:        LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    accessToken:  string;
    refreshToken: string;
    csrfToken:    string;
    user:         Omit<IJwtPayload, 'session_id'>;
  }> {
    const user = await this.dataServices.users.findOne({ email: dto.email });

    // Same message for missing user and wrong password — prevents user enumeration
    if (!user) throw new AppError('Invalid email or password.', 401);

    if (!user.is_active)
      throw new AppError('Your account has been deactivated. Please contact the administrator.', 401);

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new AppError('Invalid email or password.', 401);

    const userId = (user._id as unknown as Types.ObjectId).toString();

    const { accessToken, refreshToken, csrfToken } = await this._createSession(
      userId,
      user.email,
      user.role_id.toString(),
      userAgent,
      ipAddress,
    );

    return {
      accessToken,
      refreshToken,
      csrfToken,
      user: { user_id: userId, email: user.email, role_id: user.role_id.toString() },
    };
  }

  async refresh(
    refreshToken: string,
    userAgent?:   string,
    ipAddress?:   string,
  ): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const session = await Session.findOne({
      refresh_token_hash: hash,
      is_valid:           true,
      expires_at:         { $gt: new Date() },
    });

    if (!session) throw new AppError('Invalid or expired refresh token. Please login again.', 401);

    // Pull fresh user data to catch deactivations
    const user = await User.findById(session.user_id).select('email role_id is_active');
    if (!user || !user.is_active) {
      await Session.findByIdAndUpdate(session._id, { is_valid: false });
      throw new AppError('Your account has been deactivated. Please contact the administrator.', 401);
    }

    // Invalidate the consumed refresh token (rotation — one-time use)
    await Session.findByIdAndUpdate(session._id, { is_valid: false });

    const userId = (session.user_id as Types.ObjectId).toString();

    const result = await this._createSession(
      userId,
      user.email,
      user.role_id.toString(),
      userAgent,
      ipAddress,
    );

    return result;
  }

  async logout(sessionId?: string, refreshToken?: string): Promise<void> {
    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, { is_valid: false });
      return;
    }
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await Session.findOneAndUpdate({ refresh_token_hash: hash }, { is_valid: false });
    }
  }

  async getProfile(userId: string) {
    const [user] = await this.dataServices.users.aggregate([
      { $match: { _id: new Types.ObjectId(userId) } },
      { $lookup: { from: 'roles', localField: 'role_id', foreignField: '_id', as: 'role' } },
      { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
      { $project: { password: 0 } },
    ]);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _createSession(
    userId:     string,
    email:      string,
    roleId:     string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }> {
    const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const csrfToken    = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('hex');
    const refreshHash  = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const session = await Session.create({
      user_id:            new Types.ObjectId(userId),
      refresh_token_hash: refreshHash,
      csrf_token:         csrfToken,
      expires_at:         expiresAt,
      user_agent:         userAgent,
      ip_address:         ipAddress,
      is_valid:           true,
    });

    const payload: IJwtPayload = {
      user_id:    userId,
      email,
      role_id:    roleId,
      session_id: (session._id as Types.ObjectId).toString(),
    };

    const secret      = process.env['JWT_SECRET'] ?? 'change_me';
    const accessToken = jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions);

    return { accessToken, refreshToken, csrfToken };
  }
}
