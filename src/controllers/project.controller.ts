import { Request, Response }           from 'express';
import asyncHandler                    from '../utils/async-handler.util';
import { sendSuccess, sendError }      from '../utils/response.util';
import { MongoDataServices }           from '../frameworks/mongo';
import { ProjectUseCase }              from '../use-cases/project/project.use-case';
import { createProjectSchema }         from '../core/dtos/project/create-project.dto';
import { updateProjectSchema }         from '../core/dtos/project/update-project.dto';
import { activityLogService, computeFieldChanges } from '../services/activity-log.service';
import { IProject }                    from '../core/entities/project.entity';

const dataServices   = new MongoDataServices();
const projectUseCase = new ProjectUseCase(dataServices);

// Fields tracked in update diff — changes to these generate meaningful log sentences
const TRACKED_FIELDS: (keyof IProject)[] = [
  'client_name', 'client_mobile', 'client_email',
  'project_name', 'project_type', 'project_description',
  'project_status', 'payment_total_amount',
  'is_lead_converted', 'is_maintenance_mode', 'is_active',
  'frontend_deploy_on', 'backend_deploy_on',
];

// ─── Helper — resolve client IP through proxies ───────────────────────────────
function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}

// ─── Helper — ms elapsed since request was stamped by requestTimerMiddleware ──
function elapsed(req: Request): number {
  return req.startTime ? Date.now() - req.startTime : 0;
}

// ─────────────────────────────────────────────────────────────────────────────

export const getAllProjects = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectUseCase.getAllProjects(req.query as Record<string, string>);
  sendSuccess(res, 'Projects fetched successfully', result);

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'list',
    module:           'project',
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} listed projects`
    ),
    method:           'GET',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectUseCase.getProjectById(req.params['id']!);
  sendSuccess(res, 'Project fetched successfully', result);

  const project = result as unknown as IProject & { _id: string; reference_id: string };
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'view',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${project.project_name} (${project.reference_id})`,
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} viewed project '${project.project_name} (${project.reference_id})'`
    ),
    method:           'GET',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  const result = await projectUseCase.createProject(value, req.user!.user_id);
  sendSuccess(res, 'Project created successfully', result, 201);

  const created = result as unknown as IProject & { _id: string; reference_id: string };
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'create',
    module:           'project',
    entity_id:        String(created._id),
    entity_ref:       `${created.project_name} (${created.reference_id})`,
    description:      activityLogService.describe.create(
      activityLogService.who(req.user!.email),
      'project',
      `${created.project_name} (${created.reference_id})`,
      `type: ${created.project_type}, client: ${created.client_name}, total: ₹${created.payment_total_amount.toLocaleString()}`
    ),
    method:           'POST',
    endpoint:         req.originalUrl,
    status_code:      201,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateProjectSchema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 'Validation failed', 400, error.details.map(d => d.message));

  // Fetch before update so we can build a meaningful field-level diff
  const before = await projectUseCase.getProjectById(req.params['id']!);
  const result  = await projectUseCase.updateProject(req.params['id']!, value);
  sendSuccess(res, 'Project updated successfully', result);

  const beforeDoc = before as unknown as IProject & { reference_id: string; project_name: string };
  const changes   = computeFieldChanges(
    beforeDoc as unknown as Record<string, unknown>,
    value as Record<string, unknown>,
    TRACKED_FIELDS as string[],
  );

  // Note payment_terms changes at a high level (not field-by-field, too noisy)
  if (value['payment_terms'] !== undefined) {
    changes.push({ field: 'payment_terms', from: 'previous schedule', to: 'updated schedule' });
  }

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'update',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${beforeDoc.project_name} (${beforeDoc.reference_id})`,
    description:      activityLogService.describe.update(
      activityLogService.who(req.user!.email),
      'project',
      `${beforeDoc.project_name} (${beforeDoc.reference_id})`,
      changes,
    ),
    changes,
    method:           'PATCH',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  // Fetch before delete so we can log the project name
  const existing = await projectUseCase.getProjectById(req.params['id']!);
  await projectUseCase.deleteProject(req.params['id']!);
  sendSuccess(res, 'Project deleted successfully', null);

  const doc = existing as unknown as IProject & { reference_id: string; project_name: string };
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'delete',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.project_name} (${doc.reference_id})`,
    description:      activityLogService.describe.delete(
      activityLogService.who(req.user!.email),
      'project',
      `${doc.project_name} (${doc.reference_id}) — client: ${doc.client_name}`,
    ),
    method:           'DELETE',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const addPaymentTerm = asyncHandler(async (req: Request, res: Response) => {
  const { term_number, amount, due_date, payment_mode, note } = req.body as {
    term_number:   number;
    amount:        number;
    due_date?:     string;
    payment_mode?: string;
    note?:         string;
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

  const doc = result as unknown as IProject & { reference_id: string; project_name: string };
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'add_term',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.project_name} (${doc.reference_id})`,
    description:      activityLogService.describe.addTerm(
      activityLogService.who(req.user!.email),
      `${doc.project_name} (${doc.reference_id})`,
      Number(term_number),
      Number(amount),
      due_date,
    ),
    method:           'POST',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const addMaintenanceTerm = asyncHandler(async (req: Request, res: Response) => {
  const { term_number, amount, start_date, end_date, due_date, payment_mode, note } = req.body as {
    term_number:   number;
    amount:        number;
    start_date?:   string;
    end_date?:     string;
    due_date?:     string;
    payment_mode?: string;
    note?:         string;
  };

  if (!term_number || !amount) {
    return sendError(res, 'term_number and amount are required', 400);
  }

  const result = await projectUseCase.addMaintenanceTerm(req.params['id']!, {
    term_number: Number(term_number),
    amount:      Number(amount),
    start_date,
    end_date,
    due_date,
    payment_mode,
    note,
  });
  sendSuccess(res, 'Maintenance term added successfully', result);

  const doc = result as unknown as IProject & { reference_id: string; project_name: string };
  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'add_term',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.project_name} (${doc.reference_id})`,
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} added maintenance term #${term_number} (₹${Number(amount).toLocaleString()}) to '${doc.project_name} (${doc.reference_id})'`
    ),
    method:           'POST',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});

export const markMaintenanceTermPaid = asyncHandler(async (req: Request, res: Response) => {
  const termNumber = Number(req.params['term_number']);
  if (isNaN(termNumber)) return sendError(res, 'Invalid term_number', 400);

  const { paid_date, payment_mode } = req.body as { paid_date?: string; payment_mode?: string };

  const result = await projectUseCase.markMaintenanceTermPaid(
    req.params['id']!,
    termNumber,
    paid_date,
    payment_mode,
  );
  sendSuccess(res, 'Maintenance term marked as paid', result);

  const doc  = result as unknown as IProject & { reference_id: string; project_name: string; maintenance_terms: { term_number: number; amount: number }[] };
  const term = doc.maintenance_terms.find(t => t.term_number === termNumber);

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'mark_paid',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.project_name} (${doc.reference_id})`,
    description:      activityLogService.describe.custom(
      `${activityLogService.who(req.user!.email)} marked maintenance term #${termNumber} (₹${(term?.amount ?? 0).toLocaleString()}) as paid on '${doc.project_name} (${doc.reference_id})'${payment_mode ? ` via ${payment_mode}` : ''}`
    ),
    method:           'PATCH',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
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

  const doc  = result as unknown as IProject & { reference_id: string; project_name: string };
  const term = (doc.payment_terms as { term_number: number; amount: number }[])
    .find(t => t.term_number === termNumber);

  activityLogService.log({
    user_id:          req.user!.user_id,
    user_email:       req.user!.email,
    action:           'mark_paid',
    module:           'project',
    entity_id:        req.params['id'],
    entity_ref:       `${doc.project_name} (${doc.reference_id})`,
    description:      activityLogService.describe.markPaid(
      activityLogService.who(req.user!.email),
      `${doc.project_name} (${doc.reference_id})`,
      termNumber,
      term?.amount ?? 0,
      payment_mode,
    ),
    method:           'PATCH',
    endpoint:         req.originalUrl,
    status_code:      200,
    is_success:       true,
    response_time_ms: elapsed(req),
    ip_address:       getIp(req),
  });
});
