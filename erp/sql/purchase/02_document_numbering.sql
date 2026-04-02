-- =============================================================================
-- GE ERP — Purchase Module
-- File: 02_document_numbering.sql
-- Document ID format:  GE-DDD-NNNN-YYYY
--   DDD  = document type code (PuO, ItR, VBl, VBP, VPr, VPA)
--   NNNN = 4-digit zero-padded number; resets to 0001 each calendar year
--   YYYY = calendar year
--
-- Numbering rules
-- ───────────────
-- Workflows 1 & 2 (purchase-driven):
--   PuO  → originates the number.  ItR, VBl, VPr, VBP, VPA all INHERIT it.
-- Workflow 3 (usage/expense):
--   VBl  → originates the number.  VBP inherits it.
--
-- Each document type therefore has its own sequence, but within a workflow
-- chain every document carries the same NNNN so related docs are tied together
-- by their shared number and year.
-- =============================================================================

CREATE TABLE document_sequences (
    doc_type        VARCHAR(3)      NOT NULL,
    doc_year        SMALLINT        NOT NULL,
    last_number     INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_type, doc_year)
);

-- ---------------------------------------------------------------------------
-- next_doc_number(doc_type, year)
--   Atomically increments and returns the next NNNN for an originating doc.
--   Only call this when creating the FIRST document in a new chain.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_doc_number(
    p_doc_type  VARCHAR,
    p_year      SMALLINT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT
)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_num INT;
BEGIN
    INSERT INTO document_sequences (doc_type, doc_year, last_number)
    VALUES (p_doc_type, p_year, 1)
    ON CONFLICT (doc_type, doc_year)
    DO UPDATE SET last_number = document_sequences.last_number + 1
    RETURNING last_number INTO v_num;

    RETURN v_num;
END;
$$;

-- ---------------------------------------------------------------------------
-- fmt_doc_id(doc_type, number, year)
--   Pure formatting function — no side effects.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fmt_doc_id(
    p_type  VARCHAR,
    p_num   INT,
    p_year  SMALLINT
)
RETURNS VARCHAR(20)
LANGUAGE sql IMMUTABLE AS $$
    SELECT 'GE-' || p_type || '-' || LPAD(p_num::TEXT, 4, '0') || '-' || p_year::TEXT;
$$;

-- Example usage (no rows inserted):
-- SELECT fmt_doc_id('PuO', next_doc_number('PuO'), EXTRACT(YEAR FROM NOW())::SMALLINT);
-- → 'GE-PuO-0001-2026'
