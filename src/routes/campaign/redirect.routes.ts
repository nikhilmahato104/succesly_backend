import { Router, Request, Response, NextFunction } from 'express';
import { redirectBySlug, serveShortLink } from '../../controllers/campaign.controller';
import { ClickAccessType }                from '../../core/entities/campaign-click.entity';
import { getShortLinkConfig, RESERVED_SLUGS } from '../../utils/short-link.util';

const router = Router();

// GET /r/:slug → PUBLIC. Path form of the short link — works without wildcard DNS.
router.get('/:slug', redirectBySlug);

export default router;

/**
 * GET https://<slug>.<SHORT_LINK_DOMAIN>/ → PUBLIC. Subdomain form of the short link.
 *
 * Only the bare root path of a single-label subdomain is treated as a short link,
 * and reserved names (api, www, admin, ...) are skipped — so the API itself can live on
 * api.<domain> without ever being mistaken for a slug.
 */
export function subdomainRedirect(req: Request, res: Response, next: NextFunction): void {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path !== '/') return next();

  const { hostname } = getShortLinkConfig();
  const host = req.hostname?.toLowerCase();
  if (!host || !host.endsWith(`.${hostname}`)) return next();

  const slug = host.slice(0, -(hostname.length + 1));
  if (!slug || slug.includes('.') || RESERVED_SLUGS.has(slug)) return next();

  serveShortLink(req, res, slug, ClickAccessType.SUBDOMAIN).catch(next);
}
