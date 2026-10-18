import { Document } from 'mongoose';

/**
 * ISiteMaintenance — one row per site whose maintenance window is controlled
 * from this API.
 *
 * `site_url` keeps the URL exactly as the operator typed it (it is what the
 * dashboard shows), while `normalized_url` / `site_host` are the derived,
 * lower-cased forms the status lookup matches on. See normalizeSiteUrl().
 */
export interface ISiteMaintenance {
  reference_id:         string;
  site_name:            string;
  /** As entered — e.g. 'https://abc.com/' */
  site_url:             string;
  /** Derived match key — e.g. 'abc.com'. Unique across the collection. */
  normalized_url:       string;
  /** Host portion of normalized_url — lets a root record cover every sub-path */
  site_host:            string;
  is_maintenance_mode:  boolean;
  /** Shown to visitors while the site is down */
  maintenance_message:  string;
  created_by:           string;
  is_active:            boolean;
}

export interface ISiteMaintenanceDocument extends ISiteMaintenance, Document {}

/** Used when no custom message was supplied for the site */
export const DEFAULT_MAINTENANCE_MESSAGE =
  'This site is currently under maintenance. Please check back shortly.';
