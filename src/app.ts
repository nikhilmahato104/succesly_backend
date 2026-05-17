import express    from 'express';
import cors       from 'cors';
import helmet     from 'helmet';
import morgan     from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi  from 'swagger-ui-express';

import { swaggerSpec }    from './config/swagger';
import routes             from './routes';
import { errorMiddleware } from './middlewares';

const app = express();

// Trust the first proxy (nginx / Caddy) so req.secure reflects the real
// HTTPS connection rather than the internal HTTP hop from the proxy.
// This is required for SameSite=None + Secure cookies to work correctly.
app.set('trust proxy', 1);

app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
// Restrict to known origins.  Add new domains here as needed.
const allowedOrigins = [
  'http://localhost:5173',          // Vite dev server (local frontend)
  'http://localhost:3000',          // Alternative dev port
  'https://succesly.in',            // Production domain
  'https://identity.zynkly.com',   // Identity service
  'https://api.succesly.in',      // Admin dashboard
  'https://administration.succesly.in/', // Admin dashboard alternate domain
];

app.use(
  cors({
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
  })
);

// Parse cookies — needed to read the HTTP-only refresh token cookie
app.use(cookieParser());

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI — interactive docs at /api-docs
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,   // sends the rt cookie so /auth/refresh works in Swagger
    },
    customSiteTitle: 'Zynkly Identity Service',
  })
);

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
