import { Document, Types } from 'mongoose';
import { IndustryType } from './campaign.entity';

export enum DeviceType {
  MOBILE  = 'mobile',
  TABLET  = 'tablet',
  DESKTOP = 'desktop',
  BOT     = 'bot',
  UNKNOWN = 'unknown',
}

/** How the visitor reached the short link */
export enum ClickAccessType {
  SUBDOMAIN = 'subdomain',   // https://<slug>.<SHORT_LINK_DOMAIN>/
  PATH      = 'path',        // https://<api-host>/r/<slug>
}

/**
 * One document per short-link hit. Campaign fields (industry, utm_*) are copied
 * onto the click so cross-campaign analytics never needs a $lookup.
 */
export interface ICampaignClick {
  campaign_id:      Types.ObjectId;
  slug:             string;
  industry_type:    IndustryType;
  utm_source:       string;
  utm_medium:       string;
  utm_campaign:     string;

  visitor_id:       string;          // anonymous id from the _cvid cookie (set on first redirect)
  is_unique:        boolean;         // first click of this visitor on this campaign
  is_bot:           boolean;

  ip?:              string;
  user_agent?:      string;
  device_type:      DeviceType;
  browser:          string;          // Chrome, Safari, Instagram (in-app), ...
  browser_version?: string;
  os:               string;          // Android, iOS, Windows, macOS, ...
  os_version?:      string;

  referrer?:        string;
  referrer_domain?: string;
  country?:         string;          // from CDN geo headers (Cloudflare / Vercel / CloudFront) when present
  region?:          string;
  city?:            string;
  language?:        string;          // first entry of Accept-Language

  access_type:      ClickAccessType;
  clicked_at:       Date;
}

export interface ICampaignClickDocument extends ICampaignClick, Document {}
