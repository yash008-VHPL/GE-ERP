// =============================================================================
// GE ERP — SharePoint Service
// src/middleware/errorHandler.ts
// Central Express error handler — logs and returns structured JSON errors
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?:    unknown;
}

export function errorHandler(
  err:  AppError,
  req:  Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isClient   = statusCode < 500;

  if (isClient) {
    logger.warn(`[error] ${req.method} ${req.path} → ${statusCode}: ${err.message}`);
  } else {
    logger.error(`[error] ${req.method} ${req.path} → ${statusCode}: ${err.message}`, {
      stack:   err.stack,
      details: err.details,
    });
  }

  res.status(statusCode).json({
    error:   err.message || 'Internal server error',
    details: isClient ? err.details : undefined,
  });
}

/** Wrap an error with an HTTP status code */
export function httpError(message: string, statusCode = 500, details?: unknown): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.details    = details;
  return err;
}
