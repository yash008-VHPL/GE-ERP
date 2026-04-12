-- =============================================================================
-- GE ERP — Migration 009
-- Opening Balances as at 2024-12-31 (Audited GNUCash Import)
--
-- Source: "20250226 audit 2024 gnucash file.gnucash"
-- Verified: books balance — Assets 276,427.14 = Liabilities 247,215.24 + Retained Earnings 29,211.90
-- All figures in EUR.
--
-- Notes:
--  • GNUCash "Wise USD" shows EUR cost basis -8,525.53 (net outflows at historic
--    cost). Actual USD cash held at 2024-12-31 = 187.33 USD. The negative EUR
--    cost basis is recorded as-is (credit to 1110); the USD cash balance will be
--    re-stated in the first 2025 FX revaluation entry.
--  • GNUCash "non GMO Soy Lecithin Liquid" shows EUR cost basis -68,618.00.
--    This reflects goods received but invoiced at different values / returns.
--    Recorded as-is (credit to 1302); stock quantities to be reconciled in
--    inventory module.
--  • GNUCash "Imbalance-EUR" 215.35 = forex rounding on 2024-12-31.
--    Folded into Wise EUR (1100) for a clean opening balance.
--  • Income / Expense accounts start at zero in the ERP (fresh 2025 fiscal year).
--    Cumulative GNUCash net income 29,211.90 is posted to Retained Earnings (3200).
-- =============================================================================

-- Ensure 2024 JnE sequence exists
INSERT INTO document_sequences (doc_type, doc_year, last_number)
VALUES ('JnE', 2024, 0)
ON CONFLICT (doc_type, doc_year) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Opening Balance Journal Entry — 2024-12-31 (POSTED, audited)
-- -----------------------------------------------------------------------------
WITH je AS (
    INSERT INTO journal_entries (
        doc_id, doc_number, doc_year,
        entry_date, description, reference,
        source_type, status
    ) VALUES (
        'GE-JnE-0001-2024', 1, 2024,
        '2024-12-31',
        'Opening Balances — Audited GNUCash 2024-12-31',
        'GNUCash audit file 20250226',
        'MANUAL', 'POSTED'
    )
    ON CONFLICT (doc_id) DO NOTHING
    RETURNING je_id
),
-- Fetch je_id whether we just inserted or it already existed
je_id_row AS (
    SELECT je_id FROM je
    UNION ALL
    SELECT je_id FROM journal_entries WHERE doc_id = 'GE-JnE-0001-2024'
    LIMIT 1
)

INSERT INTO journal_entry_lines (je_id, account_id, line_seq, description, debit, credit)
SELECT
    (SELECT je_id FROM je_id_row),
    a.account_id,
    v.seq,
    v.descr,
    v.dr,
    v.cr
FROM (VALUES
    -- ── ASSETS (positive balances → DEBIT) ──────────────────────────────────
    -- 1100  Wise EUR: 130,291.52 + Imbalance-EUR 215.35 = 130,506.87
    ( 1, '1100', 'Wise EUR bank balance (incl. forex rounding 215.35)',  130506.87,     0.00),

    -- 1200  AR Goods: trade receivables
    ( 2, '1200', 'Trade receivables (AR Goods)',                         158918.70,     0.00),

    -- 1301  Sunflower Lecithin Liquid: qty 25,180 @ EUR cost
    ( 3, '1301', 'Inventory — Sunflower Lecithin Liquid (25,180 units)',  37486.10,     0.00),

    -- 1302  non GMO Soy Lecithin Liquid: EUR cost basis NEGATIVE → CREDIT
    ( 4, '1302', 'Inventory — non GMO Soy Lecithin Liquid (13,400 units — negative cost basis)',
                                                                              0.00, 68618.00),

    -- 1303  Sunflower DOL: qty 4,450
    ( 5, '1303', 'Inventory — Sunflower DOL (4,450 units)',               23995.00,     0.00),

    -- 1304  IP DOL: qty 700
    ( 6, '1304', 'Inventory — IP DOL (700 units)',                         2334.00,     0.00),

    -- 1306  Soy DOL: qty 100
    ( 7, '1306', 'Inventory — Soy DOL (100 units)',                         330.00,     0.00),

    -- 1110  Wise USD: EUR cost basis negative (-8,525.53) → CREDIT
    ( 8, '1110', 'Wise USD bank (EUR cost basis -8,525.53; actual 187.33 USD)',
                                                                              0.00,  8525.53),

    -- ── LIABILITIES (→ CREDIT) ───────────────────────────────────────────────
    -- 2100  AP Goods
    ( 9, '2100', 'Trade payables (AP Goods)',                                 0.00, 145956.77),

    -- 2220  Management Consultancy Payable
    (10, '2220', 'Management consultancy fees payable',                       0.00,  72000.00),

    -- 2320  Related Party Loan
    (11, '2320', 'Related party loan payable',                                0.00,  19228.58),

    -- 2300  Shareholders Loan
    (12, '2300', 'Shareholders loan payable',                                 0.00,   9986.65),

    -- 2310  Directors Loan
    (13, '2310', 'Directors loan payable',                                    0.00,     43.24),

    -- ── EQUITY — Retained Earnings ───────────────────────────────────────────
    -- 3200  Retained Earnings = Total Assets 276,427.14 − Total Liabilities 247,215.24
    (14, '3200', 'Retained Earnings — cumulative net income to 2024-12-31',   0.00,  29211.90)

) AS v(seq, code, descr, dr, cr)
JOIN accounts a ON a.account_code = v.code
ON CONFLICT (je_id, line_seq) DO NOTHING;

-- Update sequence so next 2024 JnE would be 0002
UPDATE document_sequences
   SET last_number = GREATEST(last_number, 1)
 WHERE doc_type = 'JnE' AND doc_year = 2024;

-- -----------------------------------------------------------------------------
-- Verification query (run manually after applying to confirm balance)
-- -----------------------------------------------------------------------------
-- SELECT
--     SUM(debit)  AS total_dr,
--     SUM(credit) AS total_cr,
--     SUM(debit) - SUM(credit) AS difference
-- FROM journal_entry_lines jel
-- JOIN journal_entries je ON je.je_id = jel.je_id
-- WHERE je.doc_id = 'GE-JnE-0001-2024';
--
-- Expected: total_dr = total_cr = 353,570.67  difference = 0.00
