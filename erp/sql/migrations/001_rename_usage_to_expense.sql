-- =============================================================================
-- GE ERP — Migration 001
-- Rename workflow type USAGE → EXPENSE on vendor_bills
-- =============================================================================

BEGIN;

-- 1. Drop the old check constraint
ALTER TABLE vendor_bills
    DROP CONSTRAINT vendor_bills_workflow_check;

-- 2. Update any existing rows (in case sample data was inserted)
UPDATE vendor_bills SET workflow = 'EXPENSE' WHERE workflow = 'USAGE';

-- 3. Re-add the constraint with the new value
ALTER TABLE vendor_bills
    ADD CONSTRAINT vendor_bills_workflow_check
        CHECK (workflow IN ('CREDIT', 'PREPAY', 'EXPENSE'));

-- 4. Drop and re-add the puo/workflow consistency constraint
ALTER TABLE vendor_bills
    DROP CONSTRAINT chk_vbl_puo_workflow;

ALTER TABLE vendor_bills
    ADD CONSTRAINT chk_vbl_puo_workflow CHECK (
        (workflow IN ('CREDIT', 'PREPAY') AND puo_id IS NOT NULL) OR
        (workflow = 'EXPENSE'             AND puo_id IS NULL)
    );

COMMIT;
