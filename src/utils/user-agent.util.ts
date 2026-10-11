import { DeviceType } from '../core/entities/campaign-click.entity';

export interface ParsedUserAgent {
  device_type:      DeviceType;
  browser:          string;
  browser_version?: string;
  os:               string;
  os_version?:      string;
  is_bot:           boolean;
}

/**
 * Link-preview bots (WhatsApp, Facebook, Slack, ...) fetch a short link the moment
 * it is pasted — counting them would inflate clicks, so they are tracked separately.
 */
const BOT_REGEX = new RegExp([
  'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 'facebot', 'whatsapp', 'telegram',
  'twitterbot', 'linkedinbot', 'discord', 'slack', 'skypeuripreview', 'embedly', 'pinterest',
  'redditbot', 'applebot', 'bingpreview', 'headless', 'preview', 'curl', 'wget', 'python-requests',
  'axios', 'postman', 'go-http-client', 'okhttp', 'node-fetch', 'httpclient', 'lighthouse',
].join('|'), 'i');

// Order matters — e.g. Edge and Opera UAs also contain "Chrome", in-app browsers contain "Safari"
const BROWSERS: [string, RegExp][] = [
  ['Instagram',        /Instagram\s?([\d.]+)?/i],
  ['Facebook',         /(?:FBAN|FBAV)\/([\d.]+)?/i],
  ['Snapchat',         /Snapchat\/([\d.]+)?/i],
  ['LinkedIn',         /LinkedInApp\/([\d.]+)?/i],
  ['Edge',             /Edg(?:e|A|iOS)?\/([\d.]+)/i],
  ['Opera',            /(?:OPR|Opera)\/([\d.]+)/i],
  ['Samsung Internet', /SamsungBrowser\/([\d.]+)/i],
  ['UC Browser',       /UCBrowser\/([\d.]+)/i],
  ['Firefox',          /(?:Firefox|FxiOS)\/([\d.]+)/i],
  ['Chrome',           /(?:Chrome|CriOS)\/([\d.]+)/i],
  ['Safari',           /Version\/([\d.]+).*Safari/i],
];

const OPERATING_SYSTEMS: [string, RegExp][] = [
  ['iOS',       /(?:iPhone|iPad|iPod).*?OS ([\d_]+)/i],
  ['Android',   /Android ([\d.]+)/i],
  ['Windows',   /Windows NT ([\d.]+)/i],
  ['macOS',     /Mac OS X ([\d_.]+)/i],
  ['Chrome OS', /CrOS/i],
  ['Linux',     /Linux/i],
];

export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
  if (!ua) {
    return { device_type: DeviceType.UNKNOWN, browser: 'Unknown', os: 'Unknown', is_bot: false };
  }

  const is_bot = BOT_REGEX.test(ua);

  let browser = 'Unknown';
  let browser_version: string | undefined;
  for (const [name, re] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = name; browser_version = m[1]; break; }
  }

  let os = 'Unknown';
  let os_version: string | undefined;
  for (const [name, re] of OPERATING_SYSTEMS) {
    const m = ua.match(re);
    if (m) { os = name; os_version = m[1]?.replace(/_/g, '.'); break; }
  }

  let device_type: DeviceType;
  if (is_bot)                                              device_type = DeviceType.BOT;
  else if (/iPad|Tablet|PlayBook|Silk/i.test(ua) ||
           (/Android/i.test(ua) && !/Mobile/i.test(ua)))   device_type = DeviceType.TABLET;
  else if (/Mobi|iPhone|iPod|Android/i.test(ua))           device_type = DeviceType.MOBILE;
  else                                                     device_type = DeviceType.DESKTOP;

  return { device_type, browser, browser_version, os, os_version, is_bot };
}
