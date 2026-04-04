-- Add usage flag to items: PURCHASE, SALE, or BOTH
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS item_usage VARCHAR(10) NOT NULL DEFAULT 'BOTH'
    CHECK (item_usage IN ('PURCHASE', 'SALE', 'BOTH'));
