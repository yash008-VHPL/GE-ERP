import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT:             z.coerce.number().default(3002),
  NODE_ENV:         z.enum(['development','production','test']).default('development'),
  AZURE_TENANT_ID:  z.string().uuid(),
  AZURE_CLIENT_ID:  z.string().uuid(),
  DATABASE_URL:     z.string().url(),
  ALLOWED_ORIGINS:  z.string().default(''),
  COMPANY_NAME:     z.string().default('GIIAVA Pte Ltd'),
  COMPANY_ADDRESS:  z.string().default(''),
  COMPANY_EMAIL:    z.string().default(''),
  COMPANY_PHONE:    z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Invalid env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const config = parsed.data;
export const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
