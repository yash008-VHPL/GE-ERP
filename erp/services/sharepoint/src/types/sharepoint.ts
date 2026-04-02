// =============================================================================
// GE ERP — SharePoint Service
// src/types/sharepoint.ts
// Microsoft Graph API response shapes (subset used by this service)
// =============================================================================

/** Subset of a Graph driveItem response */
export interface GraphDriveItem {
  id:       string;
  name:     string;
  webUrl:   string;
  size?:    number;
  '@microsoft.graph.downloadUrl'?: string;
  folder?:  { childCount: number };
  file?:    { mimeType: string };
  parentReference?: {
    driveId: string;
    id:      string;
    path:    string;
  };
}

/** Graph upload session (for large files > 4 MB) */
export interface UploadSession {
  uploadUrl:          string;
  expirationDateTime: string;
  nextExpectedRanges?: string[];
}

/** Result returned from sharepointService.uploadFile */
export interface SharePointUploadResult {
  itemId:       string;
  webUrl:       string;
  downloadUrl?: string;
  fileSize:     number;
}
