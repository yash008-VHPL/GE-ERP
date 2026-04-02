// =============================================================================
// GE ERP — SharePoint Service
// src/utils/logger.ts
// Winston structured JSON logger
// =============================================================================

import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev
    ? combine(colorize(), timestamp(), simple())
    : combine(timestamp(), json()),
  transports: [
    new winston.transports.Console(),
  ],
});
