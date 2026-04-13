-- 010: record_amendments — full audit trail for coordinator edits
-- Every PATCH to a mutable document must insert a row here.

CREATE TABLE IF NOT EXISTS record_amendments (
  amendment_id  SERIAL       PRIMARY KEY,
  table_name    TEXT         NOT NULL,
  record_id     INTEGER      NOT NULL,
  doc_id        TEXT,
  changed_by    TEXT         NOT NULL,
  change_note   TEXT         NOT NULL,
  old_values    JSONB,
  new_values    JSONB,
  changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amendments_table_record
  ON record_amendments (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_amendments_doc_id
  ON record_amendments (doc_id)
  WHERE doc_id IS NOT NULL;
