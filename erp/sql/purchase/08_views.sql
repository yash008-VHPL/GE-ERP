-- =============================================================================
-- GE ERP — Purchase Module
-- File: 08_views.sql
-- Operational views for reporting and AP management
-- =============================================================================

-- ---------------------------------------------------------------------------
-- v_purchase_chain
-- Full workflow chain for every PuO-originated transaction.
-- One row per (PuO, VBl) pair; use for transaction-level drill-down.
-- ---------------------------------------------------------------------------
CREATE VIEW v_purchase_chain AS
SELECT
    -- Purchase Order
    p.doc_id                                        AS puo_doc_id,
    p.doc_number,
    p.doc_year,
    p.workflow                                      AS puo_workflow,
    p.status                                        AS puo_status,
    p.order_date,
    p.expected_date,

    -- Vendor
    v.vendor_name,
    v.vendor_code,

    -- PO value
    COALESCE(SUM(pol.line_amount), 0)               AS po_total,

    -- Receipt summary
    COUNT(DISTINCT r.itr_id)                        AS receipt_count,
    COALESCE(SUM(irl.qty_received * irl.unit_price),0) AS total_received_value,

    -- Prepayment (Workflow 2 only)
    vpr.doc_id                                      AS prepayment_doc_id,
    vpr.amount                                      AS prepayment_amount,
    vpr.amount_applied                              AS prepayment_applied,
    vpr.amount - vpr.amount_applied                 AS prepayment_remaining,
    vpr.status                                      AS prepayment_status,

    -- Vendor Bill
    b.doc_id                                        AS bill_doc_id,
    b.vendor_inv_ref,
    b.bill_date,
    b.due_date,
    b.status                                        AS bill_status,
    b.total_amount                                  AS bill_total,
    b.amount_paid                                   AS bill_paid,
    b.total_amount - b.amount_paid                  AS bill_outstanding,

    -- Overdue flag
    CASE
        WHEN b.due_date < CURRENT_DATE
         AND b.status NOT IN ('PAID', 'CANCELLED')
        THEN TRUE ELSE FALSE
    END                                             AS is_overdue,

    CASE
        WHEN b.due_date < CURRENT_DATE
         AND b.status NOT IN ('PAID', 'CANCELLED')
        THEN CURRENT_DATE - b.due_date
    END                                             AS days_overdue

FROM purchase_orders p
JOIN vendors                 v   ON p.vendor_id   = v.vendor_id
LEFT JOIN purchase_order_lines pol ON p.puo_id    = pol.puo_id
LEFT JOIN item_receipts      r   ON p.puo_id      = r.puo_id
LEFT JOIN item_receipt_lines irl ON r.itr_id      = irl.itr_id
LEFT JOIN vendor_prepayments vpr ON p.puo_id      = vpr.puo_id
LEFT JOIN vendor_bills       b   ON p.puo_id      = b.puo_id

GROUP BY
    p.puo_id, p.doc_id, p.doc_number, p.doc_year,
    p.workflow, p.status, p.order_date, p.expected_date,
    v.vendor_name, v.vendor_code,
    vpr.vpr_id, vpr.doc_id, vpr.amount, vpr.amount_applied, vpr.status,
    b.vbl_id,  b.doc_id,   b.vendor_inv_ref, b.bill_date, b.due_date,
    b.status,  b.total_amount, b.amount_paid;


-- ---------------------------------------------------------------------------
-- v_outstanding_bills
-- All unpaid / partially-paid bills (across all workflows).
-- Primary AP aging view.
-- ---------------------------------------------------------------------------
CREATE VIEW v_outstanding_bills AS
SELECT
    b.doc_id                                        AS bill_doc_id,
    b.workflow,
    v.vendor_name,
    b.vendor_inv_ref,
    b.bill_date,
    b.due_date,
    b.status,
    b.total_amount,
    b.amount_paid,
    b.total_amount - b.amount_paid                  AS amount_due,
    -- AP aging buckets
    CASE
        WHEN b.due_date >= CURRENT_DATE                          THEN 'CURRENT'
        WHEN CURRENT_DATE - b.due_date BETWEEN 1  AND 30        THEN '1-30 DAYS'
        WHEN CURRENT_DATE - b.due_date BETWEEN 31 AND 60        THEN '31-60 DAYS'
        WHEN CURRENT_DATE - b.due_date BETWEEN 61 AND 90        THEN '61-90 DAYS'
        ELSE                                                          '90+ DAYS'
    END                                             AS aging_bucket,
    GREATEST(CURRENT_DATE - b.due_date, 0)         AS days_overdue,
    -- Linked PuO (NULL for Workflow 3)
    p.doc_id                                        AS puo_doc_id
FROM vendor_bills   b
JOIN vendors        v ON b.vendor_id = v.vendor_id
LEFT JOIN purchase_orders p ON b.puo_id = p.puo_id
WHERE b.status NOT IN ('PAID', 'CANCELLED');


-- ---------------------------------------------------------------------------
-- v_prepayment_balances
-- Unapplied prepayment balances — useful for cash planning.
-- ---------------------------------------------------------------------------
CREATE VIEW v_prepayment_balances AS
SELECT
    vpr.doc_id,
    v.vendor_name,
    p.doc_id                        AS puo_doc_id,
    vpr.payment_date,
    vpr.amount,
    vpr.amount_applied,
    vpr.amount - vpr.amount_applied AS balance_remaining,
    vpr.status,
    vpr.currency
FROM vendor_prepayments vpr
JOIN vendors            v   ON vpr.vendor_id = v.vendor_id
JOIN purchase_orders    p   ON vpr.puo_id    = p.puo_id
WHERE vpr.status <> 'FULLY_APPLIED';


-- ---------------------------------------------------------------------------
-- v_po_receipt_status
-- Per-line receipt tracking against each Purchase Order.
-- ---------------------------------------------------------------------------
CREATE VIEW v_po_receipt_status AS
SELECT
    p.doc_id                                        AS puo_doc_id,
    v.vendor_name,
    pol.line_seq,
    i.item_code,
    pol.description,
    pol.quantity                                    AS qty_ordered,
    pol.qty_received,
    pol.quantity - pol.qty_received                 AS qty_outstanding,
    pol.qty_billed,
    pol.unit_price,
    pol.line_amount,
    ROUND(pol.qty_received / pol.quantity * 100, 1) AS pct_received
FROM purchase_order_lines pol
JOIN purchase_orders p ON pol.puo_id   = p.puo_id
JOIN vendors         v ON p.vendor_id  = v.vendor_id
LEFT JOIN items      i ON pol.item_id  = i.item_id
WHERE p.status NOT IN ('CLOSED', 'CANCELLED');
