import { Document } from 'mongoose';

export interface IWebsiteUrlHit {
  url:          string;
  hit_count:    number;
  created_at:   Date;
  last_hit_at:  Date;
}

export interface IDeviceInfo {
  reference_id:              string;
  frontend_generated_uuid:  string;
  device_number:             string;
  device_name:               string;
  device_change:             number;
  device_ip:                 string;
  country?:                  string;
  lat?:                      number;
  long?:                     number;
  website_name:              string;
  website_all_url_route:     IWebsiteUrlHit[];
  is_active:                 boolean;
}

export interface IDeviceInfoDocument extends IDeviceInfo, Document {}
