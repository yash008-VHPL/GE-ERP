// =============================================================================
// GE ERP — SharePoint Service
// src/routes/health.ts
// Liveness probe — no auth required
// =============================================================================

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ge-erp-sharepoint-service',
    timestamp: new Date().toISOString(),
  });
});
