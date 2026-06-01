import { Request, Response }           from 'express';
import asyncHandler                    from '../utils/async-handler.util';
import { sendSuccess, sendError }      from '../utils/response.util';
import { MongoDataServices }           from '../frameworks/mongo';
import { BoardUseCase }                from '../use-cases/board/board.use-case';
import { createBoardSchema, updateBoardSchema, saveBoardSchema } from '../core/dtos';

const boardUseCase = new BoardUseCase(new MongoDataServices());

export const getAllBoards = asyncHandler(async (req: Request, res: Response) => {
  const result = await boardUseCase.getAllBoards(req.query as Record<string, string>);
  sendSuccess(res, 'Boards fetched successfully', result);
});

export const getBoardById = asyncHandler(async (req: Request, res: Response) => {
  const result = await boardUseCase.getBoardById(req.params['id']!);
  sendSuccess(res, 'Board fetched successfully', result);
});

export const createBoard = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createBoardSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));
  const result = await boardUseCase.createBoard(value);
  sendSuccess(res, 'Board created successfully', result, 201);
});

export const updateBoard = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateBoardSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));
  const result = await boardUseCase.updateBoard(req.params['id']!, value);
  sendSuccess(res, 'Board updated successfully', result);
});

export const saveBoard = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = saveBoardSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));
  const result = await boardUseCase.saveBoard(req.params['id']!, value);
  sendSuccess(res, 'Board saved successfully', result);
});

export const deleteBoard = asyncHandler(async (req: Request, res: Response) => {
  await boardUseCase.deleteBoard(req.params['id']!);
  sendSuccess(res, 'Board deleted successfully', null);
});

export const duplicateBoard = asyncHandler(async (req: Request, res: Response) => {
  const result = await boardUseCase.duplicateBoard(req.params['id']!);
  sendSuccess(res, 'Board duplicated successfully', result, 201);
});

export const getBoardHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await boardUseCase.getBoardHistory(req.params['id']!);
  sendSuccess(res, 'Board history fetched successfully', result);
});

export const getBoardVersion = asyncHandler(async (req: Request, res: Response) => {
  const version = parseInt(req.params['version']!);
  if (isNaN(version)) return sendError(res, 'version must be a valid number', 400);
  const result = await boardUseCase.getBoardVersion(req.params['id']!, version);
  sendSuccess(res, 'Board version fetched successfully', result);
});

export const restoreBoardVersion = asyncHandler(async (req: Request, res: Response) => {
  const version = parseInt(req.params['version']!);
  if (isNaN(version)) return sendError(res, 'version must be a valid number', 400);
  const result = await boardUseCase.restoreBoardVersion(req.params['id']!, version);
  sendSuccess(res, 'Board version restored successfully', result);
});
