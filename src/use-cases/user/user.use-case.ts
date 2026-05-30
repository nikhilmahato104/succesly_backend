import bcrypt              from 'bcryptjs';
import { Types }           from 'mongoose';
import { IDataServices }   from '../../core/abstracts/data-service.abstract';
import { CreateUserDto }   from '../../core/dtos/user/create-user.dto';
import { UpdateUserDto }   from '../../core/dtos/user/update-user.dto';
import { AppError }        from '../../utils/app-error.util';
import { SALT_ROUNDS }     from '../../utils/constants';
import {
  ListQuery, parsePagination, buildPageResult, buildSearchFilter,
} from '../../utils/pagination.util';

export class UserUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  // Strips password before returning a document from create/update (business rule: never expose it)
  private sanitize(doc: unknown): Record<string, unknown> {
    const obj = typeof (doc as { toObject?: () => unknown }).toObject === 'function'
      ? (doc as { toObject: () => Record<string, unknown> }).toObject()
      : { ...(doc as Record<string, unknown>) };
    const { password: _omitted, ...rest } = obj;
    return rest;
  }

  /**
   * List users with optional search / filter / pagination.
   *
   * Query params:
   *   page, limit  — pagination
   *   search       — case-insensitive match on username OR email
   *   role_id      — filter by exact role ObjectId
   *   is_active    — "true" | "false"
   *
   * Always does a $lookup to embed role details.
   * Password is excluded from all results via $project.
   */
  async getAllUsers(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    // Build the $match stage from query filters
    const match: Record<string, unknown> = {};
    if (query['is_active'] !== undefined) match['is_active'] = query['is_active'] === 'true';
    if (query['role_id'])                 match['role_id']   = new Types.ObjectId(query['role_id']);
    if (query['search'])                  Object.assign(match, buildSearchFilter(query['search'], ['username', 'email']));

    // Aggregation pipeline: filter → join role → normalise optional fields → strip password
    const pipeline = [
      { $match: match },
      { $lookup: { from: 'roles', localField: 'role_id', foreignField: '_id', as: 'role' } },
      { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
      { $addFields: { profile_image_url: { $ifNull: ['$profile_image_url', null] } } },
      { $project: { password: 0 } },
    ];

    if (hasPagination) {
      return this.dataServices.users.aggregateWithPagination(pipeline, pageNum, limitNum);
    }

    const data = await this.dataServices.users.aggregate(pipeline) as Record<string, unknown>[];
    return buildPageResult(data, data.length, 1, data.length || 1);
  }

  async getUserById(id: string) {
    const [user] = await this.dataServices.users.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      { $lookup: { from: 'roles', localField: 'role_id', foreignField: '_id', as: 'role' } },
      { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
      { $addFields: { profile_image_url: { $ifNull: ['$profile_image_url', null] } } },
      { $project: { password: 0 } },
    ]);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.dataServices.users.findOne({ email: dto.email });
    if (existing) throw new AppError(`User with email '${dto.email}' already exists`, 409);

    const role = await this.dataServices.roles.get(dto.role_id);
    if (!role) throw new AppError('Role not found', 404);

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const created = await this.dataServices.users.create({
      ...dto,
      password: hashedPassword,
      role_id:  new Types.ObjectId(dto.role_id) as unknown as Types.ObjectId,
    });
    return this.sanitize(created);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.dataServices.users.get(id);
    if (!user) throw new AppError('User not found', 404);

    const update: Record<string, unknown> = { ...dto };

    if (dto.password) {
      update['password'] = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    if (dto.role_id) {
      const role = await this.dataServices.roles.get(dto.role_id);
      if (!role) throw new AppError('Role not found', 404);
      update['role_id'] = new Types.ObjectId(dto.role_id);
    }

    const updated = await this.dataServices.users.update(id, update);
    if (!updated) throw new AppError('User not found', 404);
    return this.sanitize(updated);
  }

  async deleteUser(id: string) {
    const user = await this.dataServices.users.get(id);
    if (!user) throw new AppError('User not found', 404);
    await this.dataServices.users.update(id, { is_active: false });
  }
}
