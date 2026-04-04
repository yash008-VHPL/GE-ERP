-- Add shipping method, incoterms and payment terms to purchase orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS incoterms       TEXT,
  ADD COLUMN IF NOT EXISTS incoterms_port  TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms   TEXT;
