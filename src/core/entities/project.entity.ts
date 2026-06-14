import { Document } from 'mongoose';

export enum ProjectType {
  SALON              = 'salon',
  GYM                = 'gym',
  SPA                = 'spa',
  LEGAL              = 'legal',
  HOSPITAL           = 'hospital',
  SCHOOL_MANAGEMENT  = 'school_management',
  ECOMMERCE          = 'ecommerce',
  REAL_ESTATE        = 'real_estate',
  RESTAURANT         = 'restaurant',
  HOTEL              = 'hotel',
  TRAVEL             = 'travel',
  FINANCE            = 'finance',
  INVENTORY          = 'inventory',
  CRM                = 'crm',
  ERP                = 'erp',
  OTHER              = 'other',
}

export enum ProjectStatus {
  LEAD        = 'lead',
  IN_PROGRESS = 'in_progress',
  COMPLETED   = 'completed',
  ON_HOLD     = 'on_hold',
  CANCELLED   = 'cancelled',
}

export enum ProjectPaymentStatus {
  PENDING  = 'pending',
  PARTIAL  = 'partial',
  PAID     = 'paid',
  OVERDUE  = 'overdue',
}

export enum PaymentTermStatus {
  PENDING  = 'pending',
  PAID     = 'paid',
  OVERDUE  = 'overdue',
}

export enum PaymentMode {
  CASH          = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  UPI           = 'upi',
  CHEQUE        = 'cheque',
  ONLINE        = 'online',
}

export enum DeploymentPlatform {
  VERCEL         = 'vercel',
  NETLIFY        = 'netlify',
  AWS            = 'aws',
  DIGITAL_OCEAN  = 'digital_ocean',
  HOSTINGER      = 'hostinger',
  CPANEL         = 'cpanel',
  VPS            = 'vps',
  HEROKU         = 'heroku',
  RENDER         = 'render',
  FIREBASE       = 'firebase',
  OTHER          = 'other',
  NA             = 'na',
}

export interface IPaymentTerm {
  term_number:   number;
  amount:        number;
  due_date?:     Date;
  paid_date?:    Date;
  payment_mode?: PaymentMode;
  status:        PaymentTermStatus;
  note?:         string;
}

export interface IProject {
  reference_id:                string;
  client_name:                 string;
  client_mobile:               string;
  client_alternative_mobile?:  string;
  client_email?:               string;
  project_name:                string;
  project_type:                ProjectType;
  project_description?:        string;
  project_status:              ProjectStatus;
  is_lead_converted:           boolean;
  lead_converted_date?:        Date;
  project_github_link?:        string;
  frontend_deploy_on:          DeploymentPlatform;
  frontend_deploy_url?:        string;
  backend_deploy_on:           DeploymentPlatform;
  backend_deploy_url?:         string;
  is_maintenance_mode:         boolean;
  maintenance_start_date?:     Date;
  maintenance_end_date?:       Date;
  payment_status:              ProjectPaymentStatus;
  payment_total_amount:        number;
  payment_paid_amount:         number;
  payment_due_amount:          number;
  payment_terms:               IPaymentTerm[];
  created_by:                  string;
  is_active:                   boolean;
}

export interface IProjectDocument extends IProject, Document {}
