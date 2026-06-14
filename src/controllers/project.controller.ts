import { Request, Response } from 'express';
import asyncHandler               from '../utils/async-handler.util';
import { sendSuccess, sendError } from '../utils/response.util';
import { MongoDataServices }      from '../frameworks/mongo';
import { ProjectUseCase }         from '../use-cases/project/project.use-case';
import { createProjectSchema }    from '../core/dtos/project/create-project.dto';
import { updateProjectSchema }    from '../core/dtos/project/update-project.dto';

const dataServices  = new MongoDataServices();
const projectUseCase = new ProjectUseCase(dataServices);

export const getAllProjects = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectUseCase.getAllProjects(req.query as Record<string, string>);
  sendSuccess(res, 'Projects fetched successfully', result);
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectUseCase.getProjectById(req.params['id']!);
  sendSuccess(res, 'Project fetched successfully', result);
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await projectUseCase.createProject(value, req.user!.user_id);
  sendSuccess(res, 'Project created successfully', result, 201);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateProjectSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await projectUseCase.updateProject(req.params['id']!, value);
  sendSuccess(res, 'Project updated successfully', result);
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await projectUseCase.deleteProject(req.params['id']!);
  sendSuccess(res, 'Project deleted successfully', null);
});

export const addPaymentTerm = asyncHandler(async (req: Request, res: Response) => {
  const { term_number, amount, due_date, payment_mode, note } = req.body as {
    term_number: number;
    amount:      number;
    due_date?:   string;
    payment_mode?: string;
    note?:       string;
  };

  if (!term_number || !amount) {
    return sendError(res, 'term_number and amount are required', 400);
  }

  const result = await projectUseCase.addPaymentTerm(req.params['id']!, {
    term_number: Number(term_number),
    amount:      Number(amount),
    due_date,
    payment_mode,
    note,
  });
  sendSuccess(res, 'Payment term added successfully', result);
});

export const markTermPaid = asyncHandler(async (req: Request, res: Response) => {
  const termNumber = Number(req.params['term_number']);
  if (isNaN(termNumber)) return sendError(res, 'Invalid term_number', 400);

  const { paid_date, payment_mode } = req.body as { paid_date?: string; payment_mode?: string };

  const result = await projectUseCase.markTermPaid(
    req.params['id']!,
    termNumber,
    paid_date,
    payment_mode,
  );
  sendSuccess(res, 'Payment term marked as paid', result);
});
