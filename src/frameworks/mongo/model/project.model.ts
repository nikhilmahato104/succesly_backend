import { Schema, model } from 'mongoose';
import {
  IProjectDocument,
  IMaintenanceTerm,
  ProjectType,
  ProjectStatus,
  ProjectPaymentStatus,
  PaymentTermStatus,
  PaymentMode,
  DeploymentPlatform,
} from '../../../core/entities/project.entity';

const paymentTermSchema = new Schema<IProjectDocument['payment_terms'][number]>(
  {
    term_number:  { type: Number, required: true },
    amount:       { type: Number, required: true, min: 0 },
    due_date:     { type: Date, default: null },
    paid_date:    { type: Date, default: null },
    payment_mode: { type: String, enum: Object.values(PaymentMode), default: null },
    status:       { type: String, enum: Object.values(PaymentTermStatus), default: PaymentTermStatus.PENDING },
    note:         { type: String, trim: true, default: null },
  },
  { _id: false }
);

const maintenanceTermSchema = new Schema<IMaintenanceTerm>(
  {
    term_number:  { type: Number, required: true },
    amount:       { type: Number, required: true, min: 0 },
    start_date:   { type: Date, default: null },
    end_date:     { type: Date, default: null },
    due_date:     { type: Date, default: null },
    paid_date:    { type: Date, default: null },
    payment_mode: { type: String, enum: Object.values(PaymentMode), default: null },
    status:       { type: String, enum: Object.values(PaymentTermStatus), default: PaymentTermStatus.PENDING },
    note:         { type: String, trim: true, default: null },
  },
  { _id: false }
);

const projectSchema = new Schema<IProjectDocument>(
  {
    reference_id: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    client_name:                { type: String, required: [true, 'client_name is required'], trim: true },
    client_mobile:              { type: String, required: [true, 'client_mobile is required'], trim: true },
    client_alternative_mobile:  { type: String, trim: true, default: null },
    client_email:               { type: String, trim: true, lowercase: true, default: null },
    project_name:               { type: String, required: [true, 'project_name is required'], trim: true },
    project_type:               { type: String, enum: Object.values(ProjectType), required: [true, 'project_type is required'] },
    project_description:        { type: String, trim: true, default: null },
    project_status:             { type: String, enum: Object.values(ProjectStatus), default: ProjectStatus.LEAD },
    is_lead_converted:          { type: Boolean, default: false },
    lead_converted_date:        { type: Date, default: null },
    project_github_link:        { type: String, trim: true, default: null },
    frontend_deploy_on:         { type: String, enum: Object.values(DeploymentPlatform), default: DeploymentPlatform.NA },
    frontend_deploy_url:        { type: String, trim: true, default: null },
    backend_deploy_on:          { type: String, enum: Object.values(DeploymentPlatform), default: DeploymentPlatform.NA },
    backend_deploy_url:         { type: String, trim: true, default: null },
    is_maintenance_mode:        { type: Boolean, default: false },
    maintenance_start_date:     { type: Date, default: null },
    maintenance_end_date:       { type: Date, default: null },
    payment_status:             { type: String, enum: Object.values(ProjectPaymentStatus), default: ProjectPaymentStatus.PENDING },
    payment_total_amount:       { type: Number, required: [true, 'payment_total_amount is required'], min: 0 },
    payment_paid_amount:        { type: Number, default: 0, min: 0 },
    payment_due_amount:         { type: Number, default: 0, min: 0 },
    payment_terms:              { type: [paymentTermSchema], default: [] },
    maintenance_total_amount:   { type: Number, default: 0, min: 0 },
    maintenance_paid_amount:    { type: Number, default: 0, min: 0 },
    maintenance_due_amount:     { type: Number, default: 0, min: 0 },
    maintenance_payment_status: { type: String, enum: Object.values(ProjectPaymentStatus), default: ProjectPaymentStatus.PENDING },
    maintenance_terms:          { type: [maintenanceTermSchema], default: [] },
    created_by:                 { type: String, required: [true, 'created_by is required'] },
    is_active:                  { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const Project = model<IProjectDocument>('Project', projectSchema);
