// =============================================================================
// GE ERP — SharePoint Service
// src/services/dbService.ts
// PostgreSQL operations for the supporting_documents table
// =============================================================================

import { Pool } from 'pg';
import { config } from '../config/env';
import type { SaveDocumentPayload, SupportingDocumentRow } from '../types/document';
import { logger } from '../utils/logger';

const pool = new Pool({ connectionString: config.DATABASE_URL });

pool.on('error', (err) => {
  logger.error('[db] Unexpected pool error:', err);
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a new supporting_documents row.
 * Any existing active (non-superseded) row for the same doc_id is first
 * marked as superseded so we preserve a full upload history.
 *
 * @returns The newly inserted row
 */
export async function saveDocumentRecord(
  payload: SaveDocumentPayload
): Promise<SupportingDocumentRow> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Supersede any prior active upload for this doc_id
    await client.query(
      `UPDATE supporting_documents
          SET is_superseded  = TRUE,
              superseded_at  = NOW()
        WHERE doc_id         = $1
          AND is_superseded  = FALSE`,
      [payload.docId]
    );

    // Insert the new record
    const { rows } = await client.query<SupportingDocumentRow>(
      `INSERT INTO supporting_documents (
          doc_id, doc_type, doc_year, related_doc_id,
          original_filename, stored_filename, file_ext,
          file_size_bytes, mime_type,
          sharepoint_site_id, sharepoint_drive_id,
          sharepoint_item_id, sharepoint_web_url, sharepoint_folder_path,
          uploaded_by_upn, uploaded_by_name
       ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          $10, $11,
          $12, $13, $14,
          $15, $16
       )
       RETURNING *`,
      [
        payload.docId,         payload.docType,         payload.docYear,    payload.relatedDocId ?? null,
        payload.originalFilename, payload.storedFilename, payload.fileExt,
        payload.fileSizeBytes, payload.mimeType,
        payload.sharepointSiteId, payload.sharepointDriveId,
        payload.sharepointItemId, payload.sharepointWebUrl, payload.sharepointFolderPath,
        payload.uploadedByUpn, payload.uploadedByName,
      ]
    );

    await client.query('COMMIT');

    logger.info(`[db] Saved supporting doc for ${payload.docId} → ${payload.storedFilename}`);
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Fetch the active (non-superseded) supporting document for a given doc_id.
 * Returns null if none exists.
 */
export async function getActiveDocument(
  docId: string
): Promise<SupportingDocumentRow | null> {
  const { rows } = await pool.query<SupportingDocumentRow>(
    `SELECT * FROM supporting_documents
      WHERE doc_id        = $1
        AND is_superseded = FALSE
      ORDER BY uploaded_at DESC
      LIMIT 1`,
    [docId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch all supporting documents (including superseded) for a doc_id.
 * Useful for audit trail display.
 */
export async function getAllDocuments(
  docId: string
): Promise<SupportingDocumentRow[]> {
  const { rows } = await pool.query<SupportingDocumentRow>(
    `SELECT * FROM supporting_documents
      WHERE doc_id = $1
      ORDER BY uploaded_at DESC`,
    [docId]
  );
  return rows;
}

/**
 * Fetch all active supporting documents for a given doc type + year.
 * E.g. all confirmed PuO documents for 2026.
 */
export async function getDocumentsByTypeAndYear(
  docType: string,
  docYear: number
): Promise<SupportingDocumentRow[]> {
  const { rows } = await pool.query<SupportingDocumentRow>(
    `SELECT * FROM supporting_documents
      WHERE doc_type      = $1
        AND doc_year      = $2
        AND is_superseded = FALSE
      ORDER BY doc_id`,
    [docType, docYear]
  );
  return rows;
}
