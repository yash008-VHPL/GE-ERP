-- =============================================================================
-- GE ERP — Purchase Module
-- File: 10_supporting_documents.sql
-- SharePoint-backed supporting document references for all purchase docs
--
-- Every ERP document requires one corresponding physical document:
--   PuO  →  Vendor's Sales Order
--   ItR  →  Bill of Lading from vendor
--   VBl  →  Actual vendor invoice
--   VBP  →  Bank payment proof
--   VPr  →  Bank payment proof
--   VPA  →  Application confirmation (references VPr)
--
-- Files are uploaded via the sharepoint-service, renamed to GE-DDD-NNNN-YYYY.ext
-- and stored in SharePoint at: GE-ERP/Purchase/{YYYY}/
-- =============================================================================

CREATE TABLE supporting_documents (
    sd_id                   SERIAL          PRIMARY KEY,

    -- ERP document this file belongs to
    doc_id                  VARCHAR(20)     NOT NULL,           -- GE-PuO-0001-2026
    doc_type                VARCHAR(3)      NOT NULL
                                CHECK (doc_type IN ('PuO','ItR','VBl','VBP','VPr','VPA')),
    doc_year                SMALLINT        NOT NULL,

    -- For VPA: the VPr doc this application references
    related_doc_id          VARCHAR(20),                        -- e.g. GE-VPr-0002-2026

    -- File identity
    original_filename       VARCHAR(500)    NOT NULL,           -- as uploaded by user
    stored_filename         VARCHAR(500)    NOT NULL,           -- GE-PuO-0001-2026.pdf
    file_ext                VARCHAR(20)     NOT NULL,           -- pdf, jpg, png …
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(100),

    -- SharePoint location (Graph API identifiers)
    sharepoint_site_id      VARCHAR(200)    NOT NULL,
    sharepoint_drive_id     VARCHAR(200)    NOT NULL,
    sharepoint_item_id      VARCHAR(200)    NOT NULL,           -- stable driveItem ID
    sharepoint_web_url      TEXT            NOT NULL,           -- browser-viewable URL
    sharepoint_folder_path  TEXT            NOT NULL,           -- GE-ERP/Purchase/2026

    -- M365 upload context
    uploaded_by_upn         VARCHAR(200),                       -- user@company.com
    uploaded_by_name        VARCHAR(200),
    uploaded_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Audit / lifecycle
    is_superseded           BOOLEAN         NOT NULL DEFAULT FALSE,
    superseded_at           TIMESTAMPTZ,
    superseded_by_sd_id     INT             REFERENCES supporting_documents(sd_id),
    notes                   TEXT
);

-- Fast lookup by ERP doc_id (primary query pattern)
CREATE INDEX idx_sd_doc_id          ON supporting_documents (doc_id);
CREATE INDEX idx_sd_active          ON supporting_documents (doc_id) WHERE is_superseded = FALSE;
CREATE INDEX idx_sd_doc_type_year   ON supporting_documents (doc_type, doc_year);
CREATE INDEX idx_sd_sp_item         ON supporting_documents (sharepoint_item_id);

COMMENT ON TABLE  supporting_documents                  IS 'SharePoint file references for all purchase workflow supporting documents';
COMMENT ON COLUMN supporting_documents.sharepoint_item_id IS 'Graph driveItem.id — use for programmatic access; immune to URL restructuring';
COMMENT ON COLUMN supporting_documents.sharepoint_web_url IS 'Human-readable browser URL captured at upload time; may become stale if SharePoint is reorganised';
COMMENT ON COLUMN supporting_documents.is_superseded    IS 'TRUE when a replacement has been uploaded; row kept for financial audit trail';
COMMENT ON COLUMN supporting_documents.related_doc_id   IS 'VPA only: the GE-VPr-NNNN-YYYY this application is based on';
