// =============================================================================
// GE ERP — SharePoint Service
// src/index.ts
// Express application entry point
// =============================================================================

import 'dotenv/config';
import express        from 'express';
import helmet         from 'helmet';
import cors           from 'cors'; // add @types/cors + cors to package.json if needed
import { config, allowedOrigins }  from './config/env';
import { documentsRouter }         from './routes/documents';
import { healthRouter }            from './routes/health';
import { errorHandler }            from './middleware/errorHandler';
import { logger }                  from './utils/logger';

const app = express();

// ─── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '1mb' }));    // body JSON for non-file routes
app.use(express.urlencoded({ extended: true }));

// ─── CORS ────────────────────────────────────────────────────────────────────
if (allowedOrigins.length > 0) {
  app.use(
    (require('cors') as typeof cors)({
      origin:      allowedOrigins,
      credentials: true,
      methods:     ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    })
  );
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/health',     healthRouter);
app.use('/documents',  documentsRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Central error handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  logger.info(`[server] GE ERP SharePoint Service listening on port ${config.PORT}`);
  logger.info(`[server] Environment: ${config.NODE_ENV}`);
  logger.info(`[server] SharePoint base path: ${config.SHAREPOINT_BASE_PATH}`);
});

export default app;
