import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';

const DOCS_PASSWORD = process.env.DOCS_PASSWORD || 'Puja@9304';
const COOKIE_NAME   = 'docs_auth';

const sha = (v: string) => crypto.createHash('sha256').update(v).digest();

/** Stateless token: HMAC of the mount path keyed by the password. */
const tokenFor = (mount: string) =>
  crypto.createHmac('sha256', DOCS_PASSWORD).update(mount).digest('hex');

const safeEqual = (a: string, b: string) => crypto.timingSafeEqual(sha(a), sha(b));

const loginPage = (mount: string, error?: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>API Docs Login</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;background:#f4f5f7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
form{background:#fff;padding:32px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);width:300px}
h2{margin:0 0 16px}input,button{width:100%;padding:10px;margin-top:8px;box-sizing:border-box;font-size:14px}
button{background:#1f6feb;color:#fff;border:0;border-radius:4px;cursor:pointer}.err{color:#c00;font-size:13px}
</style></head><body>
<form method="post" action="${mount}/login">
<h2>API Docs</h2>
<input type="password" name="password" placeholder="Password" autofocus required>
${error ? `<div class="err">${error}</div>` : ''}
<button type="submit">Open docs</button>
</form></body></html>`;

/**
 * Password gate for a Swagger UI mount (e.g. '/api-docs').
 * Returns a router: serves a login form until the correct password is entered.
 */
export function docsGate(mount: string): Router {
  const router = Router();
  const expected = tokenFor(mount);

  router.post(`${mount}/login`, (req: Request, res: Response) => {
    const password = String(req.body?.password ?? '');
    if (!safeEqual(password, DOCS_PASSWORD)) {
      res.status(401).send(loginPage(mount, 'Wrong password'));
      return;
    }
    res.cookie(COOKIE_NAME + mount.replace(/\W/g, '_'), expected, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   req.secure,
      path:     mount,
    });
    res.redirect(`${mount}/`);
  });

  router.use(mount, (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/login') return next();
    const got = String(req.cookies?.[COOKIE_NAME + mount.replace(/\W/g, '_')] ?? '');
    if (got && safeEqual(got, expected)) return next();
    res.status(401).send(loginPage(mount));
  });

  return router;
}
