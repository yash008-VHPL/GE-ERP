// =============================================================================
// GE ERP — SharePoint Service
// src/utils/docIdParser.ts
// Parses and validates GE-DDD-NNNN-YYYY document ID strings
// =============================================================================

import { DOC_TYPES, type DocType, type ParsedDocId } from '../types/document';

const DOC_ID_REGEX = /^GE-(PuO|ItR|VBl|VBP|VPr|VPA)-(\d{4})-(\d{4})$/;

/**
 * Parse a raw doc_id string into its components.
 * Throws if the format is invalid.
 *
 * @example parseDocId('GE-PuO-0001-2026')
 * // → { docType: 'PuO', docNumber: 1, docYear: 2026, raw: 'GE-PuO-0001-2026' }
 */
export function parseDocId(docId: string): ParsedDocId {
  const match = docId.trim().match(DOC_ID_REGEX);

  if (!match) {
    throw new Error(
      `Invalid doc_id "${docId}". Expected format: GE-{${DOC_TYPES.join('|')}}-NNNN-YYYY`
    );
  }

  const docType  = match[1] as DocType;
  const docNumber = parseInt(match[2], 10);
  const docYear   = parseInt(match[3], 10);

  const currentYear = new Date().getFullYear();
  if (docYear < 2024 || docYear > currentYear + 1) {
    throw new Error(`doc_id year ${docYear} is outside the acceptable range`);
  }
  if (docNumber < 1 || docNumber > 9999) {
    throw new Error(`doc_id number ${docNumber} is outside the acceptable range (0001–9999)`);
  }

  return { docType, docNumber, docYear, raw: docId.trim() };
}

/** Returns true if the string matches the doc_id format, false otherwise */
export function isValidDocId(docId: string): boolean {
  try {
    parseDocId(docId);
    return true;
  } catch {
    return false;
  }
}
