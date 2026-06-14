import Joi from 'joi';
import {
  ProjectType,
  ProjectStatus,
  PaymentTermStatus,
  PaymentMode,
  DeploymentPlatform,
} from '../../entities/project.entity';

export interface CreatePaymentTermDto {
  term_number:   number;
  amount:        number;
  due_date?:     string;
  payment_mode?: PaymentMode;
  status?:       PaymentTermStatus;
  note?:         string;
}

export interface CreateProjectDto {
  client_name:                string;
  client_mobile:              string;
  client_alternative_mobile?: string;
  client_email?:              string;
  project_name:               string;
  project_type:               ProjectType;
  project_description?:       string;
  project_status?:            ProjectStatus;
  is_lead_converted?:         boolean;
  lead_converted_date?:       string;
  project_github_link?:       string;
  frontend_deploy_on?:        DeploymentPlatform;
  frontend_deploy_url?:       string;
  backend_deploy_on?:         DeploymentPlatform;
  backend_deploy_url?:        string;
  is_maintenance_mode?:       boolean;
  maintenance_start_date?:    string;
  maintenance_end_date?:      string;
  payment_total_amount:       number;
  payment_terms?:             CreatePaymentTermDto[];
}

const paymentTermSchema = Joi.object<CreatePaymentTermDto>({
  term_number:  Joi.number().integer().min(1).required(),
  amount:       Joi.number().min(0).required(),
  due_date:     Joi.date().iso().optional(),
  payment_mode: Joi.string().valid(...Object.values(PaymentMode)).optional(),
  status:       Joi.string().valid(...Object.values(PaymentTermStatus)).optional(),
  note:         Joi.string().trim().optional(),
});

export const createProjectSchema = Joi.object<CreateProjectDto>({
  client_name:                Joi.string().trim().required(),
  client_mobile:              Joi.string().trim().required(),
  client_alternative_mobile:  Joi.string().trim().optional(),
  client_email:               Joi.string().email().lowercase().optional(),
  project_name:               Joi.string().trim().required(),
  project_type:               Joi.string().valid(...Object.values(ProjectType)).required(),
  project_description:        Joi.string().trim().optional(),
  project_status:             Joi.string().valid(...Object.values(ProjectStatus)).optional(),
  is_lead_converted:          Joi.boolean().optional(),
  lead_converted_date:        Joi.date().iso().optional(),
  project_github_link:        Joi.string().uri().optional(),
  frontend_deploy_on:         Joi.string().valid(...Object.values(DeploymentPlatform)).optional(),
  frontend_deploy_url:        Joi.string().uri().optional(),
  backend_deploy_on:          Joi.string().valid(...Object.values(DeploymentPlatform)).optional(),
  backend_deploy_url:         Joi.string().uri().optional(),
  is_maintenance_mode:        Joi.boolean().optional(),
  maintenance_start_date:     Joi.date().iso().optional(),
  maintenance_end_date:       Joi.date().iso().optional(),
  payment_total_amount:       Joi.number().min(0).required(),
  payment_terms:              Joi.array().items(paymentTermSchema).optional(),
});
