import { AppError } from './app-error.util';

/**
 * Site URL normalisation — the single source of truth for "are these two
 * strings the same site?".
 *
 * WHY: the maintenance switch is looked up by whatever URL the caller happens
 * to have. A browser may send any of these for one and the same site:
 *
 *   abc.com            https://abc.com          https://abc.com/
 *   www.abc.com        http://www.abc.com/      https://abc.com/?utm=x#top
 *
 * All of them must resolve to the one stored record, so every URL — the one
 * saved at create time and the one sent to the status check — is pushed
 * through this function first and compared in its normalised form.
 *
 * Rules applied:
 *   - missing protocol      → assumed https (so a bare `abc.com` parses)
 *   - protocol              → dropped (http and https are the same site)
 *   - host                  → lower-cased, leading `www.` removed, port kept
 *                             (`localhost:7000` must stay distinct in dev)
 *   - path                  → lower-cased, trailing slash removed, `/` → ''
 *   - query string / hash   → dropped
 */
export interface NormalizedSiteUrl {
  /** Host without `www.`, port preserved — e.g. 'abc.com', 'localhost:7000' */
  host:       string;
  /** Path without the trailing slash, '' when the URL points at the root */
  path:       string;
  /** What gets stored and compared — host + path, e.g. 'abc.com/shop' */
  normalized: string;
}

export function normalizeSiteUrl(raw: string): NormalizedSiteUrl {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) throw new AppError('site url is required', 400);

  // A bare 'abc.com' is not a valid URL — give it a protocol so URL() accepts it.
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new AppError(`'${raw}' is not a valid site url`, 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(`'${raw}' is not a valid site url — only http and https are supported`, 400);
  }

  const host = parsed.host.toLowerCase().replace(/^www\./, '');
  if (!host) throw new AppError(`'${raw}' is not a valid site url`, 400);

  const path = parsed.pathname.toLowerCase().replace(/\/+$/, '');

  return { host, path, normalized: `${host}${path}` };
}
