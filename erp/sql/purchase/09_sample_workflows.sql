-- =============================================================================
-- GE ERP — Purchase Module
-- File: 09_sample_workflows.sql
-- Annotated walk-through of all three purchase workflows.
-- Run in a transaction and ROLLBACK to inspect without persisting.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SETUP: seed vendors and items
-- =============================================================================
INSERT INTO vendors (vendor_code, vendor_name, credit_terms, credit_days, currency) VALUES
    ('V001', 'Acme Supplies Ltd',     TRUE,  30, 'USD'),  -- credit vendor
    ('V002', 'FastParts Co',          FALSE,  0, 'USD'),  -- prepay vendor
    ('V003', 'City Secretarial Svcs', FALSE,  0, 'USD');  -- usage/services vendor

INSERT INTO items (item_code, item_name, uom, item_type) VALUES
    ('WIDGET-A',  'Aluminium Widget Type A', 'EA',  'PRODUCT'),
    ('WIDGET-B',  'Brass Widget Type B',     'EA',  'PRODUCT'),
    ('SEC-SVC',   'Secretarial Services',    'HRS', 'SERVICE'),
    ('UTILITY',   'Office Utilities',        'MTH', 'SERVICE');

-- =============================================================================
-- WORKFLOW 1: CREDIT  →  PuO → ItR → VBl → VBP
-- Vendor: Acme Supplies (has credit terms, net 30)
-- =============================================================================

DO $$
DECLARE
    v_year      SMALLINT := EXTRACT(YEAR FROM NOW())::SMALLINT;
    v_num       INT;
    v_puo_id    INT;
    v_itr_id    INT;
    v_vbl_id    INT;
    v_pol_id    INT;
    v_irl_id    INT;
BEGIN
    -- ---- Step 1: Purchase Order ------------------------------------------------
    v_num := next_doc_number('PuO', v_year);   -- allocates 0001

    INSERT INTO purchase_orders
        (doc_id,                          doc_number, doc_year,
         vendor_id, order_date, expected_date, workflow)
    VALUES
        (fmt_doc_id('PuO', v_num, v_year), v_num,     v_year,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V001'),
         CURRENT_DATE, CURRENT_DATE + 14, 'CREDIT')
    RETURNING puo_id INTO v_puo_id;

    INSERT INTO purchase_order_lines (puo_id, line_seq, item_id, quantity, unit_price)
    VALUES (v_puo_id, 1,
            (SELECT item_id FROM items WHERE item_code='WIDGET-A'),
            100, 25.00)
    RETURNING pol_id INTO v_pol_id;

    -- Confirm PuO
    UPDATE purchase_orders SET status='CONFIRMED' WHERE puo_id=v_puo_id;

    -- ---- Step 2: Item Receipt --------------------------------------------------
    -- Same doc_number as PuO
    INSERT INTO item_receipts
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id, receipt_date)
    VALUES
        (fmt_doc_id('ItR', v_num, v_year), v_num, v_year,
         v_puo_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V001'),
         CURRENT_DATE)
    RETURNING itr_id INTO v_itr_id;

    INSERT INTO item_receipt_lines
        (itr_id, line_seq, pol_id,
         item_id,
         qty_received, unit_price)
    VALUES
        (v_itr_id, 1, v_pol_id,
         (SELECT item_id FROM items WHERE item_code='WIDGET-A'),
         100, 25.00)
    RETURNING irl_id INTO v_irl_id;

    -- Confirm receipt → triggers qty rollup on POL and PuO status update
    UPDATE item_receipts SET status='CONFIRMED' WHERE itr_id=v_itr_id;

    -- ---- Step 3: Vendor Bill ---------------------------------------------------
    INSERT INTO vendor_bills
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id, vendor_inv_ref,
         bill_date, due_date, workflow)
    VALUES
        (fmt_doc_id('VBl', v_num, v_year), v_num, v_year,
         v_puo_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V001'),
         'ACME-INV-2026-0042',
         CURRENT_DATE, CURRENT_DATE + 30, 'CREDIT')
    RETURNING vbl_id INTO v_vbl_id;

    INSERT INTO vendor_bill_lines
        (vbl_id, line_seq, irl_id,
         item_id, description, quantity, unit_price, tax_rate, tax_amount)
    VALUES
        (v_vbl_id, 1, v_irl_id,
         (SELECT item_id FROM items WHERE item_code='WIDGET-A'),
         'Aluminium Widget Type A', 100, 25.00, 0.00, 0.00);

    -- Post bill → triggers VBl totals and PuO BILLED status
    UPDATE vendor_bills SET status='POSTED' WHERE vbl_id=v_vbl_id;

    -- ---- Step 4: Vendor Bill Payment -------------------------------------------
    INSERT INTO vendor_bill_payments
        (doc_id,                          doc_number, doc_year,
         vbl_id, vendor_id,
         payment_date, payment_method, payment_ref, amount)
    VALUES
        (fmt_doc_id('VBP', v_num, v_year), v_num, v_year,
         v_vbl_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V001'),
         CURRENT_DATE + 30, 'BANK_TRANSFER', 'TT-20260428-001', 2500.00);

    RAISE NOTICE 'Workflow 1 complete — transaction number: %', v_num;
END;
$$;


-- =============================================================================
-- WORKFLOW 2: PREPAY  →  PuO → VPr → ItR → VBl → VPA
-- Vendor: FastParts Co (no credit; requires prepayment)
-- =============================================================================

DO $$
DECLARE
    v_year      SMALLINT := EXTRACT(YEAR FROM NOW())::SMALLINT;
    v_num       INT;
    v_puo_id    INT;
    v_vpr_id    INT;
    v_itr_id    INT;
    v_vbl_id    INT;
    v_pol_id    INT;
    v_irl_id    INT;
BEGIN
    -- ---- Step 1: Purchase Order ------------------------------------------------
    v_num := next_doc_number('PuO', v_year);   -- allocates 0002

    INSERT INTO purchase_orders
        (doc_id,                          doc_number, doc_year,
         vendor_id, order_date, expected_date, workflow)
    VALUES
        (fmt_doc_id('PuO', v_num, v_year), v_num, v_year,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V002'),
         CURRENT_DATE, CURRENT_DATE + 7, 'PREPAY')
    RETURNING puo_id INTO v_puo_id;

    INSERT INTO purchase_order_lines (puo_id, line_seq, item_id, quantity, unit_price)
    VALUES (v_puo_id, 1,
            (SELECT item_id FROM items WHERE item_code='WIDGET-B'),
            50, 40.00)
    RETURNING pol_id INTO v_pol_id;

    UPDATE purchase_orders SET status='CONFIRMED' WHERE puo_id=v_puo_id;

    -- ---- Step 2: Vendor Prepayment ---------------------------------------------
    -- Same doc_number as PuO
    INSERT INTO vendor_prepayments
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id,
         payment_date, payment_method, payment_ref, amount)
    VALUES
        (fmt_doc_id('VPr', v_num, v_year), v_num, v_year,
         v_puo_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V002'),
         CURRENT_DATE, 'BANK_TRANSFER', 'TT-20260315-002', 2000.00)
    RETURNING vpr_id INTO v_vpr_id;

    -- ---- Step 3: Item Receipt --------------------------------------------------
    INSERT INTO item_receipts
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id, receipt_date)
    VALUES
        (fmt_doc_id('ItR', v_num, v_year), v_num, v_year,
         v_puo_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V002'),
         CURRENT_DATE + 5)
    RETURNING itr_id INTO v_itr_id;

    INSERT INTO item_receipt_lines
        (itr_id, line_seq, pol_id,
         item_id, qty_received, unit_price)
    VALUES
        (v_itr_id, 1, v_pol_id,
         (SELECT item_id FROM items WHERE item_code='WIDGET-B'),
         50, 40.00)
    RETURNING irl_id INTO v_irl_id;

    UPDATE item_receipts SET status='CONFIRMED' WHERE itr_id=v_itr_id;

    -- ---- Step 4: Vendor Bill ---------------------------------------------------
    INSERT INTO vendor_bills
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id, vendor_inv_ref,
         bill_date, due_date, workflow)
    VALUES
        (fmt_doc_id('VBl', v_num, v_year), v_num, v_year,
         v_puo_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V002'),
         'FPC-2026-0099',
         CURRENT_DATE + 5, CURRENT_DATE + 5, 'PREPAY')
    RETURNING vbl_id INTO v_vbl_id;

    INSERT INTO vendor_bill_lines
        (vbl_id, line_seq, irl_id,
         item_id, description, quantity, unit_price, tax_rate, tax_amount)
    VALUES
        (v_vbl_id, 1, v_irl_id,
         (SELECT item_id FROM items WHERE item_code='WIDGET-B'),
         'Brass Widget Type B', 50, 40.00, 0.00, 0.00);

    UPDATE vendor_bills SET status='POSTED' WHERE vbl_id=v_vbl_id;

    -- ---- Step 5: Prepayment Application ----------------------------------------
    -- Apply the full prepayment of 2000 → leaves 0 balance on VBl
    INSERT INTO prepayment_applications
        (doc_id,                          doc_number, doc_year,
         vbl_id, vpr_id, application_date, amount_applied)
    VALUES
        (fmt_doc_id('VPA', v_num, v_year), v_num, v_year,
         v_vbl_id, v_vpr_id, CURRENT_DATE + 5, 2000.00);

    RAISE NOTICE 'Workflow 2 complete — transaction number: %', v_num;
END;
$$;


-- =============================================================================
-- WORKFLOW 3: EXPENSE  →  VBl → VBP
-- Vendor: City Secretarial Svcs (no PuO — expense invoice)
-- VBl generates its OWN new sequence number here.
-- =============================================================================

DO $$
DECLARE
    v_year      SMALLINT := EXTRACT(YEAR FROM NOW())::SMALLINT;
    v_num       INT;
    v_vbl_id    INT;
BEGIN
    -- ---- Step 1: Vendor Bill (standalone — no PuO) ----------------------------
    -- VBl is the originating doc, so it calls next_doc_number for 'VBl'
    v_num := next_doc_number('VBl', v_year);   -- allocates VBl-0001

    INSERT INTO vendor_bills
        (doc_id,                          doc_number, doc_year,
         puo_id, vendor_id, vendor_inv_ref,
         bill_date, due_date, workflow)
    VALUES
        (fmt_doc_id('VBl', v_num, v_year), v_num, v_year,
         NULL,   -- no PuO
         (SELECT vendor_id FROM vendors WHERE vendor_code='V003'),
         'CSS-MAR2026',
         CURRENT_DATE, CURRENT_DATE + 14, 'EXPENSE')
    RETURNING vbl_id INTO v_vbl_id;

    INSERT INTO vendor_bill_lines
        (vbl_id, line_seq,
         item_id, description, quantity, unit_price, tax_rate, tax_amount)
    VALUES
        (v_vbl_id, 1,
         (SELECT item_id FROM items WHERE item_code='SEC-SVC'),
         'March 2026 secretarial services', 20, 35.00, 0.00, 0.00),
        (v_vbl_id, 2,
         (SELECT item_id FROM items WHERE item_code='UTILITY'),
         'March 2026 office utilities',      1, 180.00, 0.00, 0.00);

    UPDATE vendor_bills SET status='POSTED' WHERE vbl_id=v_vbl_id;

    -- ---- Step 2: Vendor Bill Payment -------------------------------------------
    INSERT INTO vendor_bill_payments
        (doc_id,                          doc_number, doc_year,
         vbl_id, vendor_id,
         payment_date, payment_method, payment_ref, amount)
    VALUES
        (fmt_doc_id('VBP', v_num, v_year), v_num, v_year,
         v_vbl_id,
         (SELECT vendor_id FROM vendors WHERE vendor_code='V003'),
         CURRENT_DATE + 14, 'BANK_TRANSFER', 'TT-20260413-003', 880.00);

    RAISE NOTICE 'Workflow 3 complete — transaction number: VBl-%', v_num;
END;
$$;


-- Inspect results
SELECT * FROM v_purchase_chain      ORDER BY doc_year, doc_number;
SELECT * FROM v_outstanding_bills   ORDER BY due_date;
SELECT * FROM v_prepayment_balances;
SELECT * FROM v_po_receipt_status;

ROLLBACK;  -- remove this line to persist the sample data
