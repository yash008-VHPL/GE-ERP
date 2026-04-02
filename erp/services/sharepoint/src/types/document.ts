// =============================================================================
// GE ERP — SharePoint Service
// src/types/document.ts
// Core domain types for ERP documents and their supporting files
// =============================================================================

/** Valid purchase-module document type codes */
export type DocType = 'PuO' | 'ItR' | 'VBl' | 'VBP' | 'VPr' | 'VPA';

export const DOC_TYPES: readonly DocType[] = ['PuO', 'ItR', 'VBl', 'VBP', 'VPr', 'VPA'] as const;

/** Human-readable label for the required supporting document per type */
export const SUPPORTING_DOC_LABEL: Record<DocType, string> = {
  PuO: "Vendor's Sales Order",
  ItR: 'Bill of Lading from vendor',
  VBl: 'Actual vendor invoice',
  VBP: 'Bank payment proof',
  VPr: 'Bank payment proof',
  VPA: 'Prepayment application confirmation / reference to VPr',
};

/** Parsed components of a GE-DDD-NNNN-YYYY document ID */
export interface ParsedDocId {
  docType:   DocType;
  docNumber: number;   // 1–9999
  docYear:   number;   // 4-digit year
  raw:       string;   // original string, e.g. "GE-PuO-0001-2026"
}

/** Data needed to upload a supporting document */
export interface UploadRequest {
  docId:          string;          // GE-PuO-0001-2026
  relatedDocId?:  string;          // VPA only: the corresponding GE-VPr-NNNN-YYYY
  file:           Express.Multer.File;
  uploadedByUpn:  string;
  uploadedByName: string;
  graphToken:     string;
}

/** Result of a successful upload */
export interface UploadResult {
  sdId:                  number;
  docId:                 string;
  storedFilename:        string;
  sharepointWebUrl:      string;
  sharepointItemId:      string;
  uploadedAt:            Date;
}

/** Row shape returned from `supporting_documents` */
export interface SupportingDocumentRow {
  sd_id:                  number;
  doc_id:                 string;
  doc_type:               DocType;
  doc_year:               number;
  related_doc_id:         string | null;
  original_filename:      string;
  stored_filename:        string;
  file_ext:               string;
  file_size_bytes:        number | null;
  mime_type:              string | null;
  sharepoint_site_id:     string;
  sharepoint_drive_id:    string;
  sharepoint_item_id:     string;
  sharepoint_web_url:     string;
  sharepoint_folder_path: string;
  uploaded_by_upn:        string | null;
  uploaded_by_name:       string | null;
  uploaded_at:            Date;
  is_superseded:          boolean;
  superseded_at:          Date | null;
  superseded_by_sd_id:    number | null;
  notes:                  string | null;
}

/** Payload sent to dbService.saveDocumentRecord */
export interface SaveDocumentPayload {
  docId:                string;
  docType:              DocType;
  docYear:              number;
  relatedDocId?:        string;
  originalFilename:     string;
  storedFilename:       string;
  fileExt:              string;
  fileSizeBytes:        number;
  mimeType:             string;
  sharepointSiteId:     string;
  sharepointDriveId:    string;
  sharepointItemId:     string;
  sharepointWebUrl:     string;
  sharepointFolderPath: string;
  uploadedByUpn:        string;
  uploadedByName:       string;
}
