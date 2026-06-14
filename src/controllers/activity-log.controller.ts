import { Request, Response }        from 'express';
import asyncHandler                  from '../utils/async-handler.util';
import { sendSuccess }               from '../utils/response.util';
import { MongoDataServices }         from '../frameworks/mongo';
import { ActivityLogUseCase }        from '../use-cases/activity-log/activity-log.use-case';

const dataServices      = new MongoDataServices();
const activityLogUseCase = new ActivityLogUseCase(dataServices);

export const getAllLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await activityLogUseCase.getAllLogs(req.query as Record<string, string>);
  sendSuccess(res, 'Activity logs fetched successfully', result);
});

export const getLogById = asyncHandler(async (req: Request, res: Response) => {
  const result = await activityLogUseCase.getLogById(req.params['id']!);
  sendSuccess(res, 'Activity log fetched successfully', result);
});

export const getLogsSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await activityLogUseCase.getSummary(req.query as Record<string, string>);
  sendSuccess(res, 'Activity log summary fetched successfully', result);
});
