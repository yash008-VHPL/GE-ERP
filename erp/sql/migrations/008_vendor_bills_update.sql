-- =============================================================================
-- GE ERP — Migration 008
-- Extend vendor_bills with bill_type and SO linkage.
-- Extend items with gl_account_code for auto-journal mapping.
-- Extend vendor_bill_lines with gl_account_code override for indirect services.
-- =============================================================================

-- Bill type on the header
ALTER TABLE vendor_bills
  ADD COLUMN IF NOT EXISTS bill_type VARCHAR(20) NOT NULL DEFAULT 'GOODS'
      CHECK (bill_type IN ('GOODS', 'DIRECT_SERVICE', 'INDIRECT_SERVICE')),
  ADD COLUMN IF NOT EXISTS linked_so_id INT REFERENCES sales_orders(so_id);

-- GL account override per bill line (used for INDIRECT_SERVICE lines)
ALTER TABLE vendor_bill_lines
  ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(20) REFERENCES accounts(account_code);

-- GL account mapping on items (drives auto-journal debit account)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(20) REFERENCES accounts(account_code),
  ADD COLUMN IF NOT EXISTS item_usage VARCHAR(10) NOT NULL DEFAULT 'BOTH'
      CHECK (item_usage IN ('PURCHASE', 'SALE', 'BOTH'));

-- Relax the workflow constraint to allow DIRECT_SERVICE and INDIRECT_SERVICE
-- bills to not require a puo_id (they link via so_id or are standalone)
ALTER TABLE vendor_bills DROP CONSTRAINT IF EXISTS chk_vbl_puo_workflow;

-- Backfill gl_account_code for known items based on item_type
-- (PRODUCT items default to '1300' Inventory parent; SERVICE items default to NULL — set per item)
UPDATE items SET gl_account_code = '1300' WHERE item_type = 'PRODUCT' AND gl_account_code IS NULL;
