import { customAlphabet } from 'nanoid';
import { IUtmParams, ICustomParam } from '../core/entities/campaign.entity';

// ─── Slug rules ──────────────────────────────────────────────────────────────

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;
export const RANDOM_SLUG_LENGTH = 6;
export const MAX_CUSTOM_PARAMS = 5;

/**
 * A slug becomes a DNS label (<slug>.domain.com), so it follows DNS rules:
 * lowercase letters, digits and single hyphens, no leading/trailing hyphen.
 */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

/** Subdomains that already exist / may exist on the root domain — never usable as a slug */
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'administration', 'dashboard', 'mail', 'email', 'smtp', 'imap', 'pop',
  'ftp', 'cdn', 'static', 'assets', 'img', 'images', 'media', 'files', 'docs', 'api-docs', 'api-docs1',
  'help', 'support', 'status', 'blog', 'shop', 'store', 'auth', 'login', 'logout', 'signup', 'register',
  'account', 'billing', 'dev', 'staging', 'test', 'beta', 'demo', 'ns1', 'ns2', 'mx', 'vpn', 'root',
  'health', 'r',
]);

// No 0/o/1/l — random slugs are often read aloud or typed from a poster
const randomSlug = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', RANDOM_SLUG_LENGTH);

export const generateRandomSlug = (): string => randomSlug();

export const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

/** Returns a human-readable reason when the slug is not allowed, otherwise null */
export function validateSlugFormat(slug: string): string | null {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return `Short URL name must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters long`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return 'Short URL name may only contain lowercase letters, numbers and single hyphens, and cannot start or end with a hyphen';
  }
  if (RESERVED_SLUGS.has(slug)) {
    return `'${slug}' is a reserved name — please choose a different short URL name`;
  }
  return null;
}

// ─── Short URL building ──────────────────────────────────────────────────────

export interface ShortLinkConfig {
  domain:      string;   // host[:port] the slugs live under — e.g. "succesly.in" or "localhost:7000"
  hostname:    string;   // domain without port — compared against req.hostname
  protocol:    string;
  pathBaseUrl: string;   // base for the /r/<slug> fallback form
}

/** Read lazily so values always reflect the loaded .env */
export function getShortLinkConfig(): ShortLinkConfig {
  const domain      = (process.env['SHORT_LINK_DOMAIN'] || 'localhost:7000').toLowerCase();
  const hostname    = domain.split(':')[0]!;
  const protocol    = process.env['SHORT_LINK_PROTOCOL'] || (hostname === 'localhost' ? 'http' : 'https');
  const pathBaseUrl = (process.env['SHORT_LINK_PATH_BASE_URL'] || `${protocol}://${domain}`).replace(/\/+$/, '');
  return { domain, hostname, protocol, pathBaseUrl };
}

export function buildShortUrls(slug: string) {
  const { domain, protocol, pathBaseUrl } = getShortLinkConfig();
  return {
    short_url:      `${protocol}://${slug}.${domain}`,   // primary — abc123.domain.com
    short_url_path: `${pathBaseUrl}/r/${slug}`,           // fallback — works without wildcard DNS
  };
}

// ─── Final (tracked) destination URL ─────────────────────────────────────────

const UTM_ORDER: (keyof IUtmParams)[] = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_source_platform',
];

/**
 * destination_url + UTM params + custom params.
 * Params already present on the destination are kept unless we set the same key
 * (ours win, so a pasted URL with stale utm_* values gets corrected).
 */
export function buildFinalUrl(destinationUrl: string, utm: IUtmParams, customParams: ICustomParam[] = []): string {
  const url = new URL(destinationUrl);
  for (const key of UTM_ORDER) {
    const value = utm[key];
    if (value) url.searchParams.set(key, value);
  }
  for (const { key, value } of customParams) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
