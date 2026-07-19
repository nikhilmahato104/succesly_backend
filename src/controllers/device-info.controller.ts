import { Request, Response }                                 from 'express';
import asyncHandler                                           from '../utils/async-handler.util';
import { sendSuccess, sendError }                             from '../utils/response.util';
import { MongoDataServices }                                  from '../frameworks/mongo';
import { DeviceInfoUseCase }                                  from '../use-cases/device-info/device-info.use-case';
import { trackDeviceInfoSchema, updateDeviceInfoSchema }      from '../core/dtos';

const dataServices     = new MongoDataServices();
const deviceInfoUseCase = new DeviceInfoUseCase(dataServices);

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}

export const getAllDeviceInfos = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceInfoUseCase.getAllDeviceInfos(req.query as Record<string, string>);
  sendSuccess(res, 'Device info fetched successfully', result);
});

export const getDeviceInfoById = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceInfoUseCase.getDeviceInfoById(req.params['id']!);
  sendSuccess(res, 'Device info fetched successfully', result);
});

export const trackDeviceInfo = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = trackDeviceInfoSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  // device_ip is always captured server-side — never trusted from the request body
  const result = await deviceInfoUseCase.trackDevice(value, getIp(req));
  sendSuccess(res, 'Device info recorded successfully', result, 201);
});

export const updateDeviceInfo = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateDeviceInfoSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await deviceInfoUseCase.updateDeviceInfo(req.params['id']!, value);
  sendSuccess(res, 'Device info updated successfully', result);
});

export const deleteDeviceInfo = asyncHandler(async (req: Request, res: Response) => {
  await deviceInfoUseCase.deleteDeviceInfo(req.params['id']!);
  sendSuccess(res, 'Device info deleted successfully', null);
});
