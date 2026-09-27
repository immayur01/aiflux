import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env explicitly regardless of cwd
const backendEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
}
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initSupabase } from './config/supabase.js';
import { logger } from './utils/logger.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import filesRouter from './routes/files.js';
import settingsRouter from './routes/settings.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Trust proxy ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5000',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (process.env.RAILWAY_PUBLIC_DOMAIN && origin.includes(process.env.RAILWAY_PUBLIC_DOMAIN)) ||
        origin.endsWith('.up.railway.app') ||
        origin.endsWith('.onrender.com') ||
        (process.env.RENDER_EXTERNAL_URL && origin.includes(process.env.RENDER_EXTERNAL_URL))
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/settings', settingsRouter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', provider: 'supabase' }));

// ── Unified Frontend Serving ──────────────────────────────────────────────────
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  logger.info(`📦 Serving built frontend from ${frontendDist}`);
} else {
  logger.warn(`⚠️ Frontend build not found at ${frontendDist}. Run 'npm run build' to generate it.`);
  app.get('/', (_req, res) => {
    res.send(`
      <div style="font-family:sans-serif; text-align:center; padding:50px;">
        <h2>Flux Backend Running (Supabase Edition)</h2>
        <p>Frontend build not found. Run <code>npm run build</code> in the root directory to build the frontend.</p>
      </div>
    `);
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
initSupabase();

app.listen(PORT, () => {
  logger.info(`⚡ Flux full application listening on http://localhost:${PORT} with Supabase`);
});

export default app;
