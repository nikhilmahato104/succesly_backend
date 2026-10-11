import express    from 'express';
import cors       from 'cors';
import helmet     from 'helmet';
import morgan     from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi  from 'swagger-ui-express';

import { swaggerSpec }        from './config/swagger';
import { swaggerSpec1 }       from './config/swagger1';
import { docsGate }           from './middlewares/docs-gate.middleware';
import routes                 from './routes';
import { errorMiddleware, requestTimerMiddleware } from './middlewares';

const app = express();

// Trust the first proxy (nginx / Caddy) so req.secure reflects the real
// HTTPS connection rather than the internal HTTP hop from the proxy.
// This is required for SameSite=None + Secure cookies to work correctly.
app.set('trust proxy', 1);

// Stamp every request with a start timestamp — used by controllers to compute response_time_ms
app.use(requestTimerMiddleware);

app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
// Restrict to known origins.  Add new domains here as needed.
const allowedOrigins = [
  'http://localhost:5173',          // Vite dev server (local frontend)
   'http://localhost:7000',
  'http://localhost:3000',          // Alternative dev port
  'https://succesly.in',            // Production domain
  'https://identity.zynkly.com',   // Identity service
  'https://api.succesly.in',      // Admin dashboard
  'https://administration.succesly.in', // Admin dashboard alternate domain
  'http://192.168.0.106:5173',
  'https://mayrarussianspa.com',
];

const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,   // Required so cookies (refresh token) are sent cross-origin
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-Requested-With',
      'Accept',
      'x-csrf-token',   // Required for CSRF protection
    ],
  });

// The Swagger docs pages (/api-docs, /api-docs1) are HTML served straight to the
// browser, not cross-origin API calls, so the origin allow-list is skipped for them
// (otherwise the docs login form 500s on any host not in the list).
// Every other route still goes through the allow-list.
app.use((req, res, next) =>
  /^\/api-docs1?(\/|$)/.test(req.path) ? next() : corsMiddleware(req, res, next));

// Parse cookies — needed to read the HTTP-only refresh token cookie
app.use(cookieParser());

app.use(morgan('dev'));
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

// Swagger docs — only mounted when SWAGGER_ENABLE=true in .env
if (process.env.SWAGGER_ENABLE === 'true') {
  // Swagger UI — interactive docs at /api-docs
  app.use(docsGate('/api-docs'));
  app.use(
    '/api-docs',
    swaggerUi.serveFiles(swaggerSpec),
    swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        persistAuthorization: true,
        withCredentials: true,   // sends the rt cookie so /auth/refresh works in Swagger
      },
      customSiteTitle: 'Zynkly Identity Service',
    })
  );

  // Second, separate Swagger UI at /api-docs1 (password protected)
  app.get('/api-docs-1', (_req, res) => res.redirect('/api-docs1/'));
  app.use(docsGate('/api-docs1'));
  app.use(
    '/api-docs1',
    swaggerUi.serveFiles(swaggerSpec1),
    swaggerUi.setup(swaggerSpec1, {
      swaggerOptions: { persistAuthorization: true, withCredentials: true },
      customSiteTitle: 'API Docs 1',
    })
  );
}

// Versioned API routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler — MUST be last
app.use(errorMiddleware);

export default app;
