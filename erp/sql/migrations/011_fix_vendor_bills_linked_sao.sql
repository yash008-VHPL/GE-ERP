-- =============================================================================
-- GE ERP — Migration 011
-- Fix: vendor_bills.linked_sao_id column
--
-- Migration 008 added the column as 'linked_so_id' with an incorrect FK
-- reference (sales_orders(so_id) — the correct PK is sao_id).
-- This migration renames it to the correct name used throughout the codebase
-- and fixes the FK if it was created. If neither exists, it adds the column
-- fresh with the correct definition.
-- =============================================================================

DO $$
BEGIN
  -- Case 1: wrong-named column exists — rename it and fix the FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'vendor_bills' AND column_name = 'linked_so_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'vendor_bills' AND column_name = 'linked_sao_id'
  ) THEN
    -- Drop the bad FK constraint (name may vary)
    DECLARE
      v_fk_name TEXT;
    BEGIN
      SELECT tc.constraint_name INTO v_fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_name  = 'vendor_bills'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name    = 'linked_so_id'
       LIMIT 1;

      IF v_fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE vendor_bills DROP CONSTRAINT %I', v_fk_name);
      END IF;
    END;

    ALTER TABLE vendor_bills RENAME COLUMN linked_so_id TO linked_sao_id;

    -- Re-add a clean FK with correct reference
    ALTER TABLE vendor_bills
      ADD CONSTRAINT vendor_bills_linked_sao_id_fkey
      FOREIGN KEY (linked_sao_id) REFERENCES sales_orders(sao_id);

  -- Case 2: neither column exists — add it fresh
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'vendor_bills' AND column_name = 'linked_sao_id'
  ) THEN
    ALTER TABLE vendor_bills
      ADD COLUMN linked_sao_id INT REFERENCES sales_orders(sao_id);
  END IF;
  -- Case 3: linked_sao_id already exists — nothing to do
END $$;
