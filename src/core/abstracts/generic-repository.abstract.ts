/**
 * IGenericRepository<T> — Generic interface for all CRUD operations.
 *
 * WHY: Decouples all layers (use-cases, services) from Mongoose.
 * TypeScript generics ensure type-safety per collection without code duplication.
 * Swapping MongoDB → PostgreSQL only requires a new class implementing this interface.
 */
export interface IGenericRepository<T> {
  getAll(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  find(filter: object): Promise<T[]>;
  findOne(filter: object, session?: unknown): Promise<T | null>;
  findWithPagination(filter: object, skip: number, limit: number, sort?: object, session?: unknown): Promise<T[]>;
  count(filter: object): Promise<number>;
  create(item: Partial<T>, session?: unknown): Promise<T>;
  update(id: string, item: Partial<T>, session?: unknown): Promise<T | null>;
  updateMany(filter: object, update: object, session?: unknown): Promise<unknown>;
  delete(id: string, session?: unknown): Promise<T | null>;
  deleteMany(filter: object): Promise<unknown>;
  findUnique(data: object, session?: unknown): Promise<T | null>;
  aggregate(pipeline: object[]): Promise<unknown[]>;
  aggregateWithPagination(pipeline: object[], page?: number, limit?: number): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }>;
}
