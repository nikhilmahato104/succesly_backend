import { nanoid }          from 'nanoid';
import { IDataServices }   from '../../core/abstracts/data-service.abstract';
import { CreateBoardDto }  from '../../core/dtos/board/create-board.dto';
import { UpdateBoardDto }  from '../../core/dtos/board/update-board.dto';
import { SaveBoardDto }    from '../../core/dtos/board/save-board.dto';
import { AppError }        from '../../utils/app-error.util';
import { generateSlug }    from '../../utils/slug.util';
import {
  BOARD_ID_LENGTH,
  BOARD_MAX_OBJECTS,
  BOARD_MAX_HISTORY,
  BOARD_DEFAULT_LIMIT,
  BOARD_MAX_LIMIT,
} from '../../utils/constants';

type BoardDoc   = { _id: string; name: string; slug: string; version: number; objectCount: number; deletedAt: Date | null; objects: object[]; cameraState: object; thumbnail: string | null; createdAt: Date; updatedAt: Date };
type HistDoc    = { _id: unknown; boardId: string; objects: object[]; version: number; savedAt: Date };
type ListQuery  = Record<string, string | undefined>;

const ALLOWED_SORT = new Set(['updatedAt', 'createdAt', 'name']);

export class BoardUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  // ─── List ─────────────────────────────────────────────────────────────────────

  async getAllBoards(query: ListQuery) {
    const page      = Math.max(1, parseInt(query['page']  || '1'));
    const limit     = Math.min(BOARD_MAX_LIMIT, Math.max(1, parseInt(query['limit'] || String(BOARD_DEFAULT_LIMIT))));
    const skip      = (page - 1) * limit;
    const sortField = ALLOWED_SORT.has(query['sort'] || '') ? query['sort']! : 'updatedAt';
    const sortOrder = query['order'] === 'asc' ? 1 : -1;

    const match: Record<string, unknown> = { deletedAt: null };
    if (query['search']) match['name'] = { $regex: query['search'], $options: 'i' };

    const [boards, total] = await Promise.all([
      this.dataServices.boards.aggregate([
        { $match:   match },
        { $sort:    { [sortField]: sortOrder } },
        { $skip:    skip },
        { $limit:   limit },
        { $project: { objects: 0 } },   // omit heavy objects array in list view
      ]),
      this.dataServices.boards.count(match),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      boards,
      pagination: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ─── Get single ───────────────────────────────────────────────────────────────

  async getBoardById(id: string) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);
    return board;
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  async createBoard(dto: CreateBoardDto) {
    const id   = nanoid(BOARD_ID_LENGTH);
    const slug = generateSlug(dto.name);
    return this.dataServices.boards.create({
      _id:         id,
      name:        dto.name,
      slug,
      objects:     [],
      objectCount: 0,
      version:     1,
      cameraState: { x: 0, y: 0, scale: 1 },
      thumbnail:   null,
      deletedAt:   null,
    } as never);
  }

  // ─── Update name ──────────────────────────────────────────────────────────────

  async updateBoard(id: string, dto: UpdateBoardDto) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);

    const update: Record<string, unknown> = {};
    if (dto.name) {
      update['name'] = dto.name;
      update['slug'] = generateSlug(dto.name);
    }

    const updated = await this.dataServices.boards.update(id, update) as BoardDoc | null;
    if (!updated) throw new AppError('Board not found', 404);
    return { id: updated._id, name: updated.name, slug: updated.slug, updatedAt: updated.updatedAt };
  }

  // ─── Autosave ─────────────────────────────────────────────────────────────────

  async saveBoard(id: string, dto: SaveBoardDto) {
    if (dto.objects.length > BOARD_MAX_OBJECTS) {
      throw new AppError('Board object limit reached', 422);
    }

    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);

    const newVersion = board.version + 1;
    const savedAt    = new Date();

    const update: Record<string, unknown> = {
      objects:     dto.objects,
      objectCount: dto.objects.length,
      cameraState: dto.cameraState,
      version:     newVersion,
    };
    if (dto.thumbnail !== undefined) update['thumbnail'] = dto.thumbnail;

    await this.dataServices.boards.update(id, update);
    await this.dataServices.boardHistories.create({ boardId: id, objects: dto.objects, version: newVersion, savedAt });
    await this.pruneHistory(id);

    return { version: newVersion, objectCount: dto.objects.length, savedAt };
  }

  // ─── Soft delete ──────────────────────────────────────────────────────────────

  async deleteBoard(id: string) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);
    await this.dataServices.boards.update(id, { deletedAt: new Date() } as never);
  }

  // ─── Duplicate ────────────────────────────────────────────────────────────────

  async duplicateBoard(id: string) {
    const orig = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!orig || orig.deletedAt) throw new AppError('Board not found', 404);

    const newId   = nanoid(BOARD_ID_LENGTH);
    const newName = `Copy of ${orig.name}`;
    const created = await this.dataServices.boards.create({
      _id:         newId,
      name:        newName,
      slug:        generateSlug(newName),
      objects:     orig.objects,
      objectCount: orig.objectCount,
      cameraState: orig.cameraState,
      thumbnail:   orig.thumbnail,
      version:     1,
      deletedAt:   null,
    } as never) as unknown as BoardDoc;

    return { id: created._id, name: created.name, slug: created.slug };
  }

  // ─── History: list ────────────────────────────────────────────────────────────

  async getBoardHistory(id: string) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);

    const versions = await this.dataServices.boardHistories.aggregate([
      { $match:   { boardId: id } },
      { $sort:    { version: -1 } },
      { $project: { _id: 0, version: 1, objectCount: { $size: '$objects' }, savedAt: 1 } },
    ]);

    return { versions };
  }

  // ─── History: get specific version ────────────────────────────────────────────

  async getBoardVersion(id: string, version: number) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);

    const snap = await this.dataServices.boardHistories.findOne({ boardId: id, version }) as HistDoc | null;
    if (!snap) throw new AppError(`Version ${version} not found`, 404);
    return { version: snap.version, objects: snap.objects, savedAt: snap.savedAt };
  }

  // ─── History: restore ─────────────────────────────────────────────────────────

  async restoreBoardVersion(id: string, version: number) {
    const board = await this.dataServices.boards.get(id) as BoardDoc | null;
    if (!board || board.deletedAt) throw new AppError('Board not found', 404);

    const snap = await this.dataServices.boardHistories.findOne({ boardId: id, version }) as HistDoc | null;
    if (!snap) throw new AppError(`Version ${version} not found`, 404);

    const newVersion = board.version + 1;
    const savedAt    = new Date();

    await this.dataServices.boards.update(id, {
      objects:     snap.objects,
      objectCount: snap.objects.length,
      version:     newVersion,
    });
    await this.dataServices.boardHistories.create({ boardId: id, objects: snap.objects, version: newVersion, savedAt });
    await this.pruneHistory(id);

    return { version: newVersion, savedAt };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async pruneHistory(boardId: string): Promise<void> {
    const total = await this.dataServices.boardHistories.count({ boardId });
    if (total <= BOARD_MAX_HISTORY) return;

    const oldest = await this.dataServices.boardHistories.findWithPagination(
      { boardId }, 0, total - BOARD_MAX_HISTORY, { version: 1 },
    ) as HistDoc[];

    await this.dataServices.boardHistories.deleteMany({ _id: { $in: oldest.map(h => h._id) } });
  }
}
