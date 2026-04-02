// =============================================================================
// GE ERP — SharePoint Service
// src/config/env.ts
// Zod-validated environment configuration — fails fast on missing values
// =============================================================================

import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT:                   z.coerce.number().int().positive().default(3001),
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),

  // Azure AD
  AZURE_TENANT_ID:        z.string().uuid('AZURE_TENANT_ID must be a valid GUID'),
  AZURE_CLIENT_ID:        z.string().uuid('AZURE_CLIENT_ID must be a valid GUID'),
  AZURE_CLIENT_SECRET:    z.string().min(1, 'AZURE_CLIENT_SECRET is required'),

  // SharePoint (Graph stable identifiers — obtained once during setup)
  SHAREPOINT_SITE_ID:     z.string().min(1, 'SHAREPOINT_SITE_ID is required'),
  SHAREPOINT_DRIVE_ID:    z.string().min(1, 'SHAREPOINT_DRIVE_ID is required'),
  SHAREPOINT_BASE_PATH:   z.string().default('GE-ERP/Purchase'),

  // Database
  DATABASE_URL:           z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),

  // CORS
  ALLOWED_ORIGINS:        z.string().default(''),

  // File upload
  MAX_FILE_SIZE_MB:       z.coerce.number().int().positive().default(25),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`[config] Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const config = parsed.data;

/** Allowed CORS origins as an array (split from comma-separated string) */
export const allowedOrigins: string[] =
  config.ALLOWED_ORIGINS
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

/** Max file size in bytes */
export const MAX_FILE_BYTES = config.MAX_FILE_SIZE_MB * 1024 * 1024;

/** Graph upload session threshold (Microsoft limit: 4 MB) */
export const GRAPH_SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;
