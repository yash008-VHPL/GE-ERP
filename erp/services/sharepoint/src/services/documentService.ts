// =============================================================================
// GE ERP — SharePoint Service
// src/services/documentService.ts
// Business logic — orchestrates the upload pipeline
// =============================================================================

import { buildDelegatedGraphClient } from '../config/graph';
import { config } from '../config/env';
import * as spService from './sharepointService';
import * as dbService from './dbService';
import { parseDocId } from '../utils/docIdParser';
import { buildStoredFilename, getExt } from '../utils/filenameBuilder';
import type { UploadRequest, UploadResult } from '../types/document';
import { logger } from '../utils/logger';

/**
 * Full upload pipeline:
 * 1. Parse and validate the doc_id
 * 2. Build the stored filename  (GE-PuO-0001-2026.pdf)
 * 3. Ensure the year folder exists in SharePoint
 * 4. Upload the file buffer to SharePoint
 * 5. Persist the reference to PostgreSQL (marking any prior upload as superseded)
 */
export async function orchestrateUpload(req: UploadRequest): Promise<UploadResult> {
  const { docId, relatedDocId, file, uploadedByUpn, uploadedByName, graphToken } = req;

  // --- 1. Parse doc_id -------------------------------------------------------
  const parsed        = parseDocId(docId);
  const storedFilename = buildStoredFilename(docId, file.originalname);
  const folderYear    = parsed.docYear;

  logger.info(
    `[documentService] Upload requested by ${uploadedByUpn} — ${docId} ` +
    `(${file.originalname} → ${storedFilename}, ${file.size} bytes)`
  );

  // --- 2. Build Graph client using caller's delegated token ------------------
  const graphClient = await buildDelegatedGraphClient(graphToken);

  // --- 3. Ensure year folder exists ------------------------------------------
  const folderPath = await spService.ensureYearFolder(graphClient, folderYear);

  // --- 4. Upload to SharePoint -----------------------------------------------
  const spResult = await spService.uploadFile(
    graphClient,
    folderPath,
    storedFilename,
    file.buffer,
    file.mimetype
  );

  logger.info(`[documentService] SharePoint upload OK — itemId: ${spResult.itemId}`);

  // --- 5. Persist to PostgreSQL ----------------------------------------------
  const row = await dbService.saveDocumentRecord({
    docId,
    docType:              parsed.docType,
    docYear:              parsed.docYear,
    relatedDocId,
    originalFilename:     file.originalname,
    storedFilename,
    fileExt:              getExt(file.originalname),
    fileSizeBytes:        file.size,
    mimeType:             file.mimetype,
    sharepointSiteId:     config.SHAREPOINT_SITE_ID,
    sharepointDriveId:    config.SHAREPOINT_DRIVE_ID,
    sharepointItemId:     spResult.itemId,
    sharepointWebUrl:     spResult.webUrl,
    sharepointFolderPath: folderPath,
    uploadedByUpn,
    uploadedByName,
  });

  return {
    sdId:              row.sd_id,
    docId:             row.doc_id,
    storedFilename:    row.stored_filename,
    sharepointWebUrl:  row.sharepoint_web_url,
    sharepointItemId:  row.sharepoint_item_id,
    uploadedAt:        row.uploaded_at,
  };
}
