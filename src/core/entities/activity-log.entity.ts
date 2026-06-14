import { Document } from 'mongoose';

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'list'
  | 'mark_paid'
  | 'add_term';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface IFieldChange {
  field: string;
  from:  unknown;
  to:    unknown;
}

export interface IActivityLog {
  user_id:          string;
  user_email:       string;
  action:           ActivityAction;
  module:           string;
  entity_id?:       string;
  entity_ref?:      string;
  description:      string;
  changes?:         IFieldChange[];
  method:           HttpMethod;
  endpoint:         string;
  status_code:      number;
  is_success:       boolean;
  response_time_ms: number;
  ip_address?:      string;
}

export interface IActivityLogDocument extends IActivityLog, Document {}
