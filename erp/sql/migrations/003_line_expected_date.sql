-- Add per-line expected delivery date to purchase order lines
ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS expected_date DATE;
