-- Add batch tracking fields to item receipt lines
ALTER TABLE item_receipt_lines
  ADD COLUMN IF NOT EXISTS batch_number    TEXT,
  ADD COLUMN IF NOT EXISTS production_date DATE;
