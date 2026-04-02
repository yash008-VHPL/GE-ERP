// =============================================================================
// GE ERP — SharePoint Service
// src/utils/filenameBuilder.ts
// Builds the SharePoint stored filename from a doc_id + original extension
// =============================================================================

import path from 'path';

/** File extensions that are always accepted */
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif',
  '.xlsx', '.xls', '.docx', '.doc', '.msg', '.eml',
]);

/**
 * Derive the stored filename from the doc_id and the original upload filename.
 *
 * @example buildStoredFilename('GE-PuO-0001-2026', 'vendor_so_march.pdf')
 * // → 'GE-PuO-0001-2026.pdf'
 */
export function buildStoredFilename(docId: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  if (!ext) {
    throw new Error(`Uploaded file "${originalFilename}" has no extension`);
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `File extension "${ext}" is not permitted. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`
    );
  }
  return `${docId}${ext}`;
}

/**
 * Extract the clean lowercase extension (without the leading dot).
 * @example getExt('GE-PuO-0001-2026.pdf') → 'pdf'
 */
export function getExt(filename: string): string {
  return path.extname(filename).toLowerCase().slice(1);
}
