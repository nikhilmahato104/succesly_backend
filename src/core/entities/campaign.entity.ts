import { Document } from 'mongoose';

/** Industry vertical of a campaign — used to slice analytics across campaigns */
export enum IndustryType {
  ECOMMERCE           = 'ecommerce',
  FASHION             = 'fashion',
  ELECTRONICS         = 'electronics',
  REAL_ESTATE         = 'real_estate',
  EDUCATION           = 'education',
  HEALTHCARE          = 'healthcare',
  FINANCE             = 'finance',
  TRAVEL              = 'travel',
  HOSPITALITY         = 'hospitality',
  FOOD_BEVERAGE       = 'food_beverage',
  AUTOMOTIVE          = 'automotive',
  SAAS_TECHNOLOGY     = 'saas_technology',
  MEDIA_ENTERTAINMENT = 'media_entertainment',
  BEAUTY_WELLNESS     = 'beauty_wellness',
  FITNESS             = 'fitness',
  GAMING              = 'gaming',
  NON_PROFIT          = 'non_profit',
  OTHER               = 'other',
}

export enum CampaignStatus {
  ACTIVE   = 'active',    // short link redirects
  PAUSED   = 'paused',    // short link goes to fallback_url (or "link inactive" page)
  ARCHIVED = 'archived',  // soft-deleted — slug stays reserved forever
}

/** The 7 standard Google Analytics UTM parameters */
export interface IUtmParams {
  utm_source:           string;   // where the traffic comes from   — instagram, facebook, google, newsletter
  utm_medium:           string;   // marketing medium               — social, cpc, email, banner
  utm_campaign:         string;   // campaign name                  — diwali_sale_2026
  utm_term?:            string;   // paid search keyword            — iphone+17
  utm_content?:         string;   // A/B variant / creative         — story_ad_v2
  utm_id?:              string;   // campaign id in the ad platform — cmp_123
  utm_source_platform?: string;   // buying platform                — meta_ads, google_ads
}

/** Extra non-UTM query param appended to the destination (e.g. ref=abc) */
export interface ICustomParam {
  key:   string;
  value: string;
}

export interface ICampaign {
  reference_id:     string;
  name:             string;
  description?:     string;
  industry_type:    IndustryType;

  destination_url:  string;          // URL as entered, without our UTM params
  utm:              IUtmParams;
  custom_params:    ICustomParam[];
  final_url:        string;          // destination_url + utm + custom params — where the short link redirects

  slug:             string;          // unique short name → https://<slug>.<SHORT_LINK_DOMAIN>
  tags:             string[];

  status:           CampaignStatus;
  start_date?:      Date;            // before this → link not live yet
  expires_at?:      Date;            // after this  → link expired
  fallback_url?:    string;          // where paused / expired / not-started links go

  // Denormalised counters — updated on every redirect so lists need no aggregation
  total_clicks:     number;          // human clicks (bots excluded)
  unique_clicks:    number;          // first click per visitor
  bot_clicks:       number;          // link-preview bots, crawlers, curl, etc.
  last_clicked_at?: Date;

  created_by?:      string;
  is_active:        boolean;         // false = soft-deleted
}

export interface ICampaignDocument extends ICampaign, Document {}
