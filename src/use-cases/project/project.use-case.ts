import { IDataServices }           from '../../core/abstracts/data-service.abstract';
import { CreateProjectDto }         from '../../core/dtos/project/create-project.dto';
import { UpdateProjectDto }         from '../../core/dtos/project/update-project.dto';
import {
  ProjectStatus,
  ProjectPaymentStatus,
  PaymentTermStatus,
  IPaymentTerm,
  IMaintenanceTerm,
} from '../../core/entities/project.entity';
import { AppError }                 from '../../utils/app-error.util';
import { ListQuery, parsePagination, buildPageResult } from '../../utils/pagination.util';
import { Counter }                  from '../../frameworks/mongo/model/counter.model';

async function generateProjectReferenceId(): Promise<string> {
  const now = new Date();
  const dd   = now.getDate().toString().padStart(2, '0');
  const mm   = (now.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = now.getFullYear().toString();

  const counter = await Counter.findOneAndUpdate(
    { _id: 'project_reference' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  const seq = counter!.seq;
  const formatted = seq <= 99999
    ? seq.toString().padStart(5, '0')
    : String.fromCharCode(65 + Math.floor((seq - 100000) / 9999)) + ((seq - 100000) % 9999 + 1).toString().padStart(4, '0');

  return `PRJ-${dd}${mm}${yyyy}-${formatted}`;
}

function recalculatePayment(
  totalAmount: number,
  terms: IPaymentTerm[],
): { paid: number; due: number; status: ProjectPaymentStatus } {
  const paid = terms
    .filter(t => t.status === PaymentTermStatus.PAID)
    .reduce((sum, t) => sum + t.amount, 0);

  const due = Math.max(0, totalAmount - paid);

  let status: ProjectPaymentStatus;
  if (paid === 0)              status = ProjectPaymentStatus.PENDING;
  else if (due === 0)          status = ProjectPaymentStatus.PAID;
  else                         status = ProjectPaymentStatus.PARTIAL;

  return { paid, due, status };
}

/**
 * Mongoose subdocuments store data internally in _doc and expose fields via
 * prototype getters. Spreading them directly ({...subdoc}) loses those getters
 * and produces an object with Mongoose internals but NOT the schema fields.
 * This helper calls .toObject() (Mongoose's own serialiser) to get a safe
 * plain-object copy before we spread or sort.
 */
function toPlainTerms(raw: unknown): IPaymentTerm[] {
  return (raw as Array<{ toObject?(): IPaymentTerm } & IPaymentTerm>).map(t =>
    typeof t.toObject === 'function' ? t.toObject() : (t as IPaymentTerm),
  );
}

function toPlainMaintenanceTerms(raw: unknown): IMaintenanceTerm[] {
  return (raw as Array<{ toObject?(): IMaintenanceTerm } & IMaintenanceTerm>).map(t =>
    typeof t.toObject === 'function' ? t.toObject() : (t as IMaintenanceTerm),
  );
}

function recalculateMaintenancePayment(
  totalAmount: number,
  terms: IMaintenanceTerm[],
): { paid: number; due: number; status: ProjectPaymentStatus } {
  const paid = terms
    .filter(t => t.status === PaymentTermStatus.PAID)
    .reduce((sum, t) => sum + t.amount, 0);

  const due = Math.max(0, totalAmount - paid);

  let status: ProjectPaymentStatus;
  if (paid === 0)     status = ProjectPaymentStatus.PENDING;
  else if (due === 0) status = ProjectPaymentStatus.PAID;
  else                status = ProjectPaymentStatus.PARTIAL;

  return { paid, due, status };
}

export class ProjectUseCase {
  constructor(private readonly dataServices: IDataServices) {}

  async getAllProjects(query: ListQuery = {}) {
    const { pageNum, limitNum, hasPagination } = parsePagination(query);

    const match: Record<string, unknown> = {};

    match['is_active'] = query['is_active'] !== undefined ? query['is_active'] === 'true' : true;

    if (query['project_status'])  match['project_status']  = query['project_status'];
    if (query['project_type'])    match['project_type']    = query['project_type'];
    if (query['payment_status'])  match['payment_status']  = query['payment_status'];
    if (query['is_lead_converted'] !== undefined) {
      match['is_lead_converted'] = query['is_lead_converted'] === 'true';
    }
    if (query['is_maintenance_mode'] !== undefined) {
      match['is_maintenance_mode'] = query['is_maintenance_mode'] === 'true';
    }
    if (query['created_by']) match['created_by'] = query['created_by'];

    if (query['date_from'] || query['date_to']) {
      const range: Record<string, Date> = {};
      if (query['date_from']) range['$gte'] = new Date(query['date_from']);
      if (query['date_to']) {
        const to = new Date(query['date_to']);
        to.setHours(23, 59, 59, 999);
        range['$lte'] = to;
      }
      match['createdAt'] = range;
    }

    if (query['search']) {
      const regex = { $regex: query['search'], $options: 'i' };
      match['$or'] = [
        { client_name:   regex },
        { client_mobile: regex },
        { client_email:  regex },
        { project_name:  regex },
        { reference_id:  regex },
      ];
    }

    const pipeline = [{ $match: match }, { $sort: { createdAt: -1 } }];

    if (hasPagination) {
      return this.dataServices.projects.aggregateWithPagination(pipeline, pageNum, limitNum);
    }

    const data = await this.dataServices.projects.aggregate(pipeline) as Record<string, unknown>[];
    return buildPageResult(data, data.length, 1, data.length || 1);
  }

  async getProjectById(id: string) {
    const project = await this.dataServices.projects.get(id);
    if (!project) throw new AppError('Project not found', 404);
    return project;
  }

  async createProject(dto: CreateProjectDto, createdBy: string) {
    const reference_id = await generateProjectReferenceId();

    const terms: IPaymentTerm[] = (dto.payment_terms ?? []).map(t => ({
      term_number:  t.term_number,
      amount:       t.amount,
      due_date:     t.due_date ? new Date(t.due_date) : undefined,
      payment_mode: t.payment_mode,
      status:       t.status ?? PaymentTermStatus.PENDING,
      note:         t.note,
    }));

    const maintenanceTerms: IMaintenanceTerm[] = (dto.maintenance_terms ?? []).map(t => ({
      term_number:  t.term_number,
      amount:       t.amount,
      start_date:   t.start_date ? new Date(t.start_date) : undefined,
      end_date:     t.end_date   ? new Date(t.end_date)   : undefined,
      due_date:     t.due_date   ? new Date(t.due_date)   : undefined,
      payment_mode: t.payment_mode,
      status:       t.status ?? PaymentTermStatus.PENDING,
      note:         t.note,
    }));

    const { paid, due, status } = recalculatePayment(dto.payment_total_amount, terms);
    const mainTotal = dto.maintenance_total_amount ?? 0;
    const { paid: mPaid, due: mDue, status: mStatus } = recalculateMaintenancePayment(mainTotal, maintenanceTerms);

    return this.dataServices.projects.create({
      reference_id,
      client_name:                dto.client_name,
      client_mobile:              dto.client_mobile,
      client_alternative_mobile:  dto.client_alternative_mobile,
      client_email:               dto.client_email,
      project_name:               dto.project_name,
      project_type:               dto.project_type,
      project_description:        dto.project_description,
      project_status:             dto.project_status ?? ProjectStatus.LEAD,
      is_lead_converted:          dto.is_lead_converted ?? false,
      lead_converted_date:        dto.lead_converted_date ? new Date(dto.lead_converted_date) : undefined,
      project_github_link:        dto.project_github_link,
      frontend_deploy_on:         dto.frontend_deploy_on,
      frontend_deploy_url:        dto.frontend_deploy_url,
      backend_deploy_on:          dto.backend_deploy_on,
      backend_deploy_url:         dto.backend_deploy_url,
      is_maintenance_mode:        dto.is_maintenance_mode ?? false,
      maintenance_start_date:     dto.maintenance_start_date ? new Date(dto.maintenance_start_date) : undefined,
      maintenance_end_date:       dto.maintenance_end_date ? new Date(dto.maintenance_end_date) : undefined,
      payment_total_amount:       dto.payment_total_amount,
      payment_paid_amount:        paid,
      payment_due_amount:         due,
      payment_status:             status,
      payment_terms:              terms,
      maintenance_total_amount:   mainTotal,
      maintenance_paid_amount:    mPaid,
      maintenance_due_amount:     mDue,
      maintenance_payment_status: mStatus,
      maintenance_terms:          maintenanceTerms,
      created_by:                 createdBy,
      is_active:                  true,
    });
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    const existing = await this.dataServices.projects.get(id);
    if (!existing) throw new AppError('Project not found', 404);

    const update: Record<string, unknown> = {};

    const scalarFields: (keyof UpdateProjectDto)[] = [
      'client_name', 'client_mobile', 'client_alternative_mobile', 'client_email',
      'project_name', 'project_type', 'project_description', 'project_status',
      'is_lead_converted', 'project_github_link',
      'frontend_deploy_on', 'frontend_deploy_url',
      'backend_deploy_on', 'backend_deploy_url',
      'is_maintenance_mode', 'is_active',
    ];

    for (const field of scalarFields) {
      if (dto[field] !== undefined) update[field] = dto[field];
    }

    if (dto.lead_converted_date  !== undefined) update['lead_converted_date']  = new Date(dto.lead_converted_date);
    if (dto.maintenance_start_date !== undefined) update['maintenance_start_date'] = new Date(dto.maintenance_start_date);
    if (dto.maintenance_end_date   !== undefined) update['maintenance_end_date']   = new Date(dto.maintenance_end_date);

    const newTotal = dto.payment_total_amount ?? existing.payment_total_amount;
    let   terms    = existing.payment_terms as IPaymentTerm[];

    if (dto.payment_terms !== undefined) {
      terms = dto.payment_terms.map(t => {
        const existing_term = (existing.payment_terms as IPaymentTerm[]).find(e => e.term_number === t.term_number);
        return {
          term_number:  t.term_number,
          amount:       t.amount        ?? existing_term?.amount        ?? 0,
          due_date:     t.due_date      ? new Date(t.due_date)          : existing_term?.due_date,
          paid_date:    t.paid_date     ? new Date(t.paid_date)         : existing_term?.paid_date,
          payment_mode: t.payment_mode  ?? existing_term?.payment_mode,
          status:       t.status        ?? existing_term?.status        ?? PaymentTermStatus.PENDING,
          note:         t.note          ?? existing_term?.note,
        };
      });
      update['payment_terms'] = terms;
    }

    if (dto.payment_total_amount !== undefined || dto.payment_terms !== undefined) {
      const { paid, due, status } = recalculatePayment(newTotal, terms);
      update['payment_total_amount'] = newTotal;
      update['payment_paid_amount']  = paid;
      update['payment_due_amount']   = due;
      update['payment_status']       = status;
    }

    if (dto.payment_status !== undefined) {
      update['payment_status'] = dto.payment_status;
    }

    // ── Maintenance terms ────────────────────────────────────────────────────
    const newMaintTotal = dto.maintenance_total_amount ?? existing.maintenance_total_amount ?? 0;
    let   mainTerms     = toPlainMaintenanceTerms(existing.maintenance_terms ?? []);

    if (dto.maintenance_terms !== undefined) {
      mainTerms = dto.maintenance_terms.map(t => {
        const ex = mainTerms.find(e => e.term_number === t.term_number);
        return {
          term_number:  t.term_number,
          amount:       t.amount        ?? ex?.amount        ?? 0,
          start_date:   t.start_date    ? new Date(t.start_date) : ex?.start_date,
          end_date:     t.end_date      ? new Date(t.end_date)   : ex?.end_date,
          due_date:     t.due_date      ? new Date(t.due_date)   : ex?.due_date,
          paid_date:    t.paid_date     ? new Date(t.paid_date)  : ex?.paid_date,
          payment_mode: t.payment_mode  ?? ex?.payment_mode,
          status:       t.status        ?? ex?.status        ?? PaymentTermStatus.PENDING,
          note:         t.note          ?? ex?.note,
        };
      });
      update['maintenance_terms'] = mainTerms;
    }

    if (dto.maintenance_total_amount !== undefined || dto.maintenance_terms !== undefined) {
      const { paid: mPaid, due: mDue, status: mStatus } = recalculateMaintenancePayment(newMaintTotal, mainTerms);
      update['maintenance_total_amount']   = newMaintTotal;
      update['maintenance_paid_amount']    = mPaid;
      update['maintenance_due_amount']     = mDue;
      update['maintenance_payment_status'] = mStatus;
    }

    if (dto.maintenance_payment_status !== undefined) {
      update['maintenance_payment_status'] = dto.maintenance_payment_status;
    }

    return this.dataServices.projects.update(id, update);
  }

  async deleteProject(id: string) {
    const project = await this.dataServices.projects.get(id);
    if (!project) throw new AppError('Project not found', 404);
    await this.dataServices.projects.delete(id);
  }

  async addPaymentTerm(projectId: string, term: {
    term_number: number;
    amount: number;
    due_date?: string;
    payment_mode?: string;
    note?: string;
  }) {
    const project = await this.dataServices.projects.get(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const terms = toPlainTerms(project.payment_terms);
    const duplicate = terms.find(t => t.term_number === term.term_number);
    if (duplicate) throw new AppError(`Term number ${term.term_number} already exists`, 409);

    const newTerm: IPaymentTerm = {
      term_number:  term.term_number,
      amount:       term.amount,
      due_date:     term.due_date ? new Date(term.due_date) : undefined,
      payment_mode: term.payment_mode as IPaymentTerm['payment_mode'],
      status:       PaymentTermStatus.PENDING,
      note:         term.note,
    };

    const updatedTerms = [...terms, newTerm].sort((a, b) => a.term_number - b.term_number);
    const { paid, due, status } = recalculatePayment(project.payment_total_amount, updatedTerms);

    return this.dataServices.projects.update(projectId, {
      payment_terms:       updatedTerms,
      payment_paid_amount: paid,
      payment_due_amount:  due,
      payment_status:      status,
    });
  }

  async addMaintenanceTerm(projectId: string, term: {
    term_number:  number;
    amount:       number;
    start_date?:  string;
    end_date?:    string;
    due_date?:    string;
    payment_mode?: string;
    note?:        string;
  }) {
    const project = await this.dataServices.projects.get(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const terms = toPlainMaintenanceTerms(project.maintenance_terms ?? []);
    if (terms.find(t => t.term_number === term.term_number)) {
      throw new AppError(`Maintenance term number ${term.term_number} already exists`, 409);
    }

    const newTerm: IMaintenanceTerm = {
      term_number:  term.term_number,
      amount:       term.amount,
      start_date:   term.start_date ? new Date(term.start_date) : undefined,
      end_date:     term.end_date   ? new Date(term.end_date)   : undefined,
      due_date:     term.due_date   ? new Date(term.due_date)   : undefined,
      payment_mode: term.payment_mode as IMaintenanceTerm['payment_mode'],
      status:       PaymentTermStatus.PENDING,
      note:         term.note,
    };

    const updatedTerms = [...terms, newTerm].sort((a, b) => a.term_number - b.term_number);
    const total = project.maintenance_total_amount ?? 0;
    const { paid, due, status } = recalculateMaintenancePayment(total, updatedTerms);

    return this.dataServices.projects.update(projectId, {
      maintenance_terms:          updatedTerms,
      maintenance_paid_amount:    paid,
      maintenance_due_amount:     due,
      maintenance_payment_status: status,
    });
  }

  async markMaintenanceTermPaid(projectId: string, termNumber: number, paidDate?: string, paymentMode?: string) {
    const project = await this.dataServices.projects.get(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const plainTerms  = toPlainMaintenanceTerms(project.maintenance_terms ?? []);
    const targetIndex = plainTerms.findIndex(t => t.term_number === termNumber);
    if (targetIndex === -1) throw new AppError(`Maintenance term number ${termNumber} not found`, 404);

    const terms: IMaintenanceTerm[] = plainTerms.map(t => {
      if (t.term_number !== termNumber) return t;
      return {
        ...t,
        status:       PaymentTermStatus.PAID,
        paid_date:    paidDate ? new Date(paidDate) : new Date(),
        payment_mode: (paymentMode as IMaintenanceTerm['payment_mode']) ?? t.payment_mode,
      };
    });

    const total = project.maintenance_total_amount ?? 0;
    const { paid, due, status } = recalculateMaintenancePayment(total, terms);

    return this.dataServices.projects.update(projectId, {
      maintenance_terms:          terms,
      maintenance_paid_amount:    paid,
      maintenance_due_amount:     due,
      maintenance_payment_status: status,
    });
  }

  async markTermPaid(projectId: string, termNumber: number, paidDate?: string, paymentMode?: string) {
    const project = await this.dataServices.projects.get(projectId);
    if (!project) throw new AppError('Project not found', 404);

    // toPlainTerms() converts Mongoose subdocuments → safe plain objects so
    // spread ({...t}) and strict equality checks work correctly.
    const plainTerms = toPlainTerms(project.payment_terms);

    const targetIndex = plainTerms.findIndex(t => t.term_number === termNumber);
    if (targetIndex === -1) throw new AppError(`Term number ${termNumber} not found`, 404);

    const terms: IPaymentTerm[] = plainTerms.map(t => {
      if (t.term_number !== termNumber) return t;
      return {
        ...t,
        status:       PaymentTermStatus.PAID,
        paid_date:    paidDate ? new Date(paidDate) : new Date(),
        payment_mode: (paymentMode as IPaymentTerm['payment_mode']) ?? t.payment_mode,
      };
    });

    const { paid, due, status } = recalculatePayment(project.payment_total_amount, terms);

    return this.dataServices.projects.update(projectId, {
      payment_terms:       terms,
      payment_paid_amount: paid,
      payment_due_amount:  due,
      payment_status:      status,
    });
  }
}
