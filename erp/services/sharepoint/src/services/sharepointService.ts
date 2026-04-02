// =============================================================================
// GE ERP — SharePoint Service
// src/services/sharepointService.ts
// All Microsoft Graph / SharePoint drive operations
// =============================================================================

import { Client } from '@microsoft/microsoft-graph-client';
import { config, GRAPH_SIMPLE_UPLOAD_LIMIT } from '../config/env';
import type { GraphDriveItem, SharePointUploadResult, UploadSession } from '../types/sharepoint';
import { logger } from '../utils/logger';

const DRIVE_ID   = config.SHAREPOINT_DRIVE_ID;
const BASE_PATH  = config.SHAREPOINT_BASE_PATH;

// ---------------------------------------------------------------------------
// Folder management
// ---------------------------------------------------------------------------

/**
 * Ensure the year subfolder exists: {BASE_PATH}/{year}
 * Uses a GET-or-create pattern; treats 409 Conflict as success.
 *
 * @returns The full folder path string (used when recording the upload)
 */
export async function ensureYearFolder(
  client: Client,
  year:   number
): Promise<string> {
  const folderPath = `${BASE_PATH}/${year}`;
  const apiPath    = `/drives/${DRIVE_ID}/root:/${folderPath}`;

  try {
    // Attempt to GET the folder — if it exists we are done
    await client.api(apiPath).get();
    logger.debug(`[sp] Folder already exists: ${folderPath}`);
    return folderPath;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status !== 404) throw err;
  }

  // Folder does not exist — create it (and any missing parent segments)
  logger.info(`[sp] Creating SharePoint folder: ${folderPath}`);

  // Build path segment by segment to handle missing intermediate folders
  const segments = folderPath.split('/');
  let builtPath  = '';

  for (const segment of segments) {
    const parent  = builtPath ? `/drives/${DRIVE_ID}/root:/${builtPath}:/children` : `/drives/${DRIVE_ID}/root/children`;
    builtPath      = builtPath ? `${builtPath}/${segment}` : segment;
    const checkApi = `/drives/${DRIVE_ID}/root:/${builtPath}`;

    try {
      await client.api(checkApi).get();
    } catch (e: unknown) {
      if ((e as { statusCode?: number }).statusCode === 404) {
        await client.api(parent).post({
          name:                          segment,
          folder:                        {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
        logger.debug(`[sp] Created folder segment: ${builtPath}`);
      } else {
        throw e;
      }
    }
  }

  return folderPath;
}

// ---------------------------------------------------------------------------
// File upload (auto-selects simple PUT or upload session based on file size)
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to SharePoint, placing it at:
 *   {BASE_PATH}/{year}/{storedFilename}
 *
 * Files ≤ 4 MB use a simple PUT.
 * Files > 4 MB use a Graph upload session (chunked, resumable).
 */
export async function uploadFile(
  client:          Client,
  folderPath:      string,    // e.g. "GE-ERP/Purchase/2026"
  storedFilename:  string,    // e.g. "GE-PuO-0001-2026.pdf"
  buffer:          Buffer,
  mimeType:        string
): Promise<SharePointUploadResult> {
  const uploadPath = `${folderPath}/${storedFilename}`;

  if (buffer.length <= GRAPH_SIMPLE_UPLOAD_LIMIT) {
    return simpleUpload(client, uploadPath, buffer, mimeType);
  } else {
    return sessionUpload(client, uploadPath, buffer, mimeType);
  }
}

/** Simple PUT for files ≤ 4 MB */
async function simpleUpload(
  client:     Client,
  uploadPath: string,
  buffer:     Buffer,
  mimeType:   string
): Promise<SharePointUploadResult> {
  logger.info(`[sp] Simple upload → ${uploadPath} (${buffer.length} bytes)`);

  const item = await client
    .api(`/drives/${DRIVE_ID}/root:/${uploadPath}:/content`)
    .header('Content-Type', mimeType)
    .put(buffer) as GraphDriveItem;

  return {
    itemId:      item.id,
    webUrl:      item.webUrl,
    downloadUrl: item['@microsoft.graph.downloadUrl'],
    fileSize:    buffer.length,
  };
}

/** Chunked upload session for files > 4 MB */
async function sessionUpload(
  client:     Client,
  uploadPath: string,
  buffer:     Buffer,
  mimeType:   string
): Promise<SharePointUploadResult> {
  const totalSize  = buffer.length;
  const chunkSize  = 5 * 1024 * 1024;  // 5 MB chunks (must be multiples of 320 KiB)

  logger.info(`[sp] Session upload → ${uploadPath} (${totalSize} bytes, chunk ${chunkSize})`);

  // Create upload session
  const session = await client
    .api(`/drives/${DRIVE_ID}/root:/${uploadPath}:/createUploadSession`)
    .post({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name: uploadPath.split('/').pop(),
      },
    }) as UploadSession;

  let offset  = 0;
  let lastItem: GraphDriveItem | undefined;

  while (offset < totalSize) {
    const end   = Math.min(offset + chunkSize, totalSize);
    const chunk = buffer.slice(offset, end);

    const rangeHeader = `bytes ${offset}-${end - 1}/${totalSize}`;
    logger.debug(`[sp] Uploading range ${rangeHeader}`);

    const response = await fetch(session.uploadUrl, {
      method:  'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range':  rangeHeader,
        'Content-Type':   mimeType,
      },
      body: chunk,
    });

    if (response.status === 200 || response.status === 201) {
      lastItem = (await response.json()) as GraphDriveItem;
    } else if (response.status === 202) {
      // Chunk accepted, more chunks expected
    } else {
      const body = await response.text();
      throw new Error(`Upload session chunk failed [${response.status}]: ${body}`);
    }

    offset = end;
  }

  if (!lastItem) {
    throw new Error('Session upload completed but no final driveItem was returned');
  }

  return {
    itemId:      lastItem.id,
    webUrl:      lastItem.webUrl,
    downloadUrl: lastItem['@microsoft.graph.downloadUrl'],
    fileSize:    totalSize,
  };
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/** Fetch current metadata for a driveItem by its stable ID */
export async function getItemById(
  client: Client,
  itemId: string
): Promise<GraphDriveItem> {
  return client
    .api(`/drives/${DRIVE_ID}/items/${itemId}`)
    .select('id,name,webUrl,size,file,parentReference')
    .get() as Promise<GraphDriveItem>;
}
