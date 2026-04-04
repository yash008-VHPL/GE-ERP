-- ============================================================
-- DUMMY TEST DATA — do not use in production
-- ============================================================

-- Test Vendors
INSERT INTO vendors (vendor_code, vendor_name, credit_terms, credit_days, currency, contact_name, email)
VALUES
  ('V-TEST-01', 'Acme Supplies Pte Ltd',    TRUE,  30, 'USD', 'John Smith',   'john@acme-test.com'),
  ('V-TEST-02', 'Beta Trading Co.',         FALSE,  0, 'EUR', 'Maria Garcia', 'maria@beta-test.com'),
  ('V-TEST-03', 'Gamma Logistics BV',       TRUE,  60, 'EUR', 'Hans Müller',  'hans@gamma-test.com')
ON CONFLICT (vendor_code) DO NOTHING;

-- Test Items
INSERT INTO items (item_code, item_name, uom, item_type)
VALUES
  ('ITEM-001', 'Widget Type A',       'PCS', 'PRODUCT'),
  ('ITEM-002', 'Widget Type B',       'PCS', 'PRODUCT'),
  ('ITEM-003', 'Raw Material Alpha',  'KG',  'PRODUCT'),
  ('ITEM-004', 'Packaging Box Large', 'PCS', 'PRODUCT'),
  ('ITEM-005', 'Freight & Handling',  'LOT', 'SERVICE')
ON CONFLICT (item_code) DO NOTHING;

-- Test Clients
INSERT INTO clients (client_code, client_name, credit_terms, credit_days, currency, contact_name, email)
VALUES
  ('C-TEST-01', 'Delta Distributors Ltd',  TRUE,  45, 'USD', 'Alice Wong',    'alice@delta-test.com'),
  ('C-TEST-02', 'Epsilon Retail GmbH',     FALSE,  0, 'EUR', 'Klaus Schmidt', 'klaus@epsilon-test.com'),
  ('C-TEST-03', 'Zeta Commerce Pte Ltd',   TRUE,  30, 'SGD', 'Raj Patel',     'raj@zeta-test.com')
ON CONFLICT (client_code) DO NOTHING;
