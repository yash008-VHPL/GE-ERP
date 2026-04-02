// =============================================================================
// GE ERP — SharePoint Service
// src/middleware/upload.ts
// Multer memoryStorage configuration — files never touch disk locally
// =============================================================================

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { MAX_FILE_BYTES } from '../config/env';

/** MIME types accepted for upload */
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',   // .xlsx
  'application/vnd.ms-excel',                                             // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                    // .doc
  'application/vnd.ms-outlook',                                            // .msg
  'message/rfc822',                                                        // .eml
]);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  if (ACCEPTED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`MIME type "${file.mimetype}" is not permitted for upload`));
  }
}

/**
 * Multer instance configured for a single file upload.
 * Files are stored in memory (Buffer); they are streamed directly to SharePoint
 * without ever being written to the local filesystem.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter,
});
