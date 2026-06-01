import { Model, PipelineStage } from 'mongoose';
import { IGenericRepository }   from '../../core/abstracts/generic-repository.abstract';

/**
 * MongoGenericRepository<T> — Concrete Mongoose implementation of IGenericRepository.
 *
 * WHY this is the ONLY place with Mongoose code:
 * All use-cases interact via the IGenericRepository<T> interface.
 * This file is the only thing that changes if we swap the database.
 */
export class MongoGenericRepository<T> implements IGenericRepository<T> {
  private readonly _repository:     Model<T>;
  private readonly _populateOnFind: string[];

  constructor(repository: Model<T>, populateOnFind: string[] = []) {
    this._repository     = repository;
    this._populateOnFind = populateOnFind;
  }

  getAll(): Promise<T[]> {
    return this._repository.find().populate(this._populateOnFind).exec() as Promise<T[]>;
  }

  get(id: string): Promise<T | null> {
    return this._repository.findById(id).populate(this._populateOnFind).exec() as Promise<T | null>;
  }

  /**
   * Supports full Mongoose filter syntax:
   *   { is_active: true }
   *   { grade: 'A' }
   *   { name: { $regex: 'john', $options: 'i' } }
   *   { $or: [{...}, {...}] }
   */
  find(filter: object): Promise<T[]> {
    return this._repository.find(filter).exec() as Promise<T[]>;
  }

  findOne(filter: object, session: unknown = null): Promise<T | null> {
    return this._repository.findOne(filter as never, {}, { session } as never).exec() as Promise<T | null>;
  }

  /**
   * Paginated query.
   * skip = (page - 1) * limit  → MongoDB skips N documents before returning results.
   * sort:  { createdAt: -1 }   → newest first
   */
  findWithPagination(filter: object, skip: number, limit: number, sort: object | null = null, session: unknown = null): Promise<T[]> {
    const query = this._repository.find(filter as never, {}, { session } as never).skip(skip).limit(limit);
    if (sort) query.sort(sort as never);
    return query.exec() as Promise<T[]>;
  }

  /** countDocuments uses the index — much faster than find().length */
  count(filter: object): Promise<number> {
    return this._repository.countDocuments(filter as never).exec();
  }

  /**
   * Uses doc.save() over Model.create() — returns a guaranteed single typed document.
   * Model.create() can return an array in some Mongoose configurations.
   */
  async create(item: Partial<T>, session: unknown = null): Promise<T> {
    const doc = new this._repository(item);
    if (session) return (await (doc as never as { save: (opts: unknown) => Promise<T> }).save({ session }));
    return (await (doc as never as { save: () => Promise<T> }).save());
  }

  /**
   * { new: true } returns the document AFTER the update.
   * Without it, Mongoose returns the document as it was BEFORE the update.
   */
  update(id: string, item: Partial<T>, session: unknown = null): Promise<T | null> {
    return this._repository.findByIdAndUpdate(id, item as never, { new: true, session } as never).exec() as Promise<T | null>;
  }

  /** Bulk update — useful for batch operations (e.g. deactivate entire grade) */
  updateMany(filter: object, update: object, session: unknown = null): Promise<unknown> {
    return this._repository.updateMany(filter as never, update as never, { session } as never);
  }

  delete(id: string, session: unknown = null): Promise<T | null> {
    return this._repository.findByIdAndDelete(id, { session } as never).exec() as Promise<T | null>;
  }

  deleteMany(filter: object): Promise<unknown> {
    return this._repository.deleteMany(filter as never);
  }

  findUnique(data: object, session: unknown = null): Promise<T | null> {
    return this._repository
      .findOne(data as never, {}, { session } as never)
      .populate(this._populateOnFind)
      .exec() as Promise<T | null>;
  }

  /**
   * Raw MongoDB Aggregation Pipeline.
   *
   * Common stages:
   *   $match   → filter documents (like SQL WHERE)
   *   $lookup  → join another collection (like SQL LEFT JOIN)
   *   $unwind  → flatten $lookup array into individual documents
   *   $group   → group + aggregate (like SQL GROUP BY + SUM/AVG)
   *   $project → shape output fields (like SQL SELECT)
   *   $sort    → sort results
   *   $facet   → run multiple sub-pipelines in parallel (data + count in one query)
   */
  aggregate(pipeline: object[]): Promise<unknown[]> {
    return this._repository.aggregate(pipeline as PipelineStage[]).exec();
  }

  /**
   * Pagination via $facet — fetches data slice + total count in ONE database round-trip.
   *
   * $facet runs two branches simultaneously on the same input:
   *   data:       paginated slice
   *   totalCount: collapses all matched docs to { total: N }
   */
  async aggregateWithPagination(pipeline: object[], page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const result = await this._repository.aggregate([
      ...(pipeline as PipelineStage[]),
      {
        $facet: {
          data:       [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ]).exec();

    const data  = (result[0]?.data        as unknown[]) ?? [];
    const total = (result[0]?.totalCount?.[0]?.total as number) ?? 0;
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Build a $lookup + $unwind stage pair for joining a related collection.
   *
   * $lookup  → MongoDB's LEFT JOIN equivalent.
   *   Fetches matching documents from `from` collection and attaches them as an array.
   *
   * $unwind  → Flattens the array produced by $lookup into a single embedded object.
   *   preserveNullAndEmptyArrays: true → keeps the parent doc even if no match found
   *   (same as SQL LEFT JOIN, not INNER JOIN — unmatched rows are not dropped).
   *
   * @example
   * // Join marks with student info
   * buildLookupStage('students', 'student_id', '_id', 'studentInfo')
   * // → each marks doc gets: { ...marks, studentInfo: { name, email, ... } }
   */
  buildLookupStage(from: string, localField: string, foreignField = '_id', as: string, preserveNull = true): PipelineStage[] {
    return [
      { $lookup: { from, localField, foreignField, as } },
      { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: preserveNull } },
    ];
  }
}
