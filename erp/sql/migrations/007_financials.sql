-- =============================================================================
-- GE ERP — Migration 007
-- Double-entry bookkeeping: chart of accounts, journal entries, journal lines.
-- Chart of accounts seeded from GIIAVA GNUCash books (audit file Feb 2026).
-- =============================================================================

-- Register JnE doc type
INSERT INTO document_sequences (doc_type, doc_year, last_number)
VALUES ('JnE', EXTRACT(YEAR FROM NOW())::SMALLINT, 0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- CHART OF ACCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
    account_id          SERIAL          PRIMARY KEY,
    account_code        VARCHAR(20)     UNIQUE NOT NULL,
    account_name        VARCHAR(200)    NOT NULL,
    -- GNUCash types mapped to standard: STOCK→ASSET, RECEIVABLE→ASSET,
    -- PAYABLE→LIABILITY, CREDIT→LIABILITY, INCOME→REVENUE
    account_type        VARCHAR(10)     NOT NULL
                            CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
    normal_balance      CHAR(2)         NOT NULL CHECK (normal_balance IN ('DR','CR')),
    parent_code         VARCHAR(20)     REFERENCES accounts(account_code),
    gnucash_type        VARCHAR(20),    -- original GNUCash type for reference
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SEED: GIIAVA Chart of Accounts (from GNUCash audit file 20250226)
-- ---------------------------------------------------------------------------
INSERT INTO accounts (account_code, account_name, account_type, normal_balance, parent_code, gnucash_type) VALUES

-- ── Assets ──────────────────────────────────────────────────────────────────
('1000', 'Assets',                          'ASSET',     'DR', NULL,   'ASSET'),
('1010', 'Current Assets',                  'ASSET',     'DR', '1000', 'ASSET'),

-- Bank accounts
('1100', 'Wise EUR',                         'ASSET',     'DR', '1010', 'BANK'),
('1110', 'Wise USD',                         'ASSET',     'DR', '1010', 'BANK'),

-- Receivables
('1200', 'AR Goods',                         'ASSET',     'DR', '1010', 'RECEIVABLE'),

-- Inventory by product (STOCK accounts)
('1300', 'Inventory',                        'ASSET',     'DR', '1010', 'ASSET'),
('1301', 'Sunflower Lecithin Liquid',        'ASSET',     'DR', '1300', 'STOCK'),
('1302', 'non GMO Soy Lecithin Liquid',      'ASSET',     'DR', '1300', 'STOCK'),
('1303', 'Sunflower DOL',                    'ASSET',     'DR', '1300', 'STOCK'),
('1304', 'IP DOL',                           'ASSET',     'DR', '1300', 'STOCK'),
('1305', 'IP DOL 97',                        'ASSET',     'DR', '1300', 'STOCK'),
('1306', 'Soy DOL',                          'ASSET',     'DR', '1300', 'STOCK'),
('1307', 'Rapeseed DOL',                     'ASSET',     'DR', '1300', 'STOCK'),
('1308', 'Soy Lecithin Liquid',              'ASSET',     'DR', '1300', 'STOCK'),

-- ── Liabilities ──────────────────────────────────────────────────────────────
('2000', 'Liabilities',                      'LIABILITY', 'CR', NULL,   'LIABILITY'),

-- Payables
('2100', 'AP Goods',                         'LIABILITY', 'CR', '2000', 'PAYABLE'),

-- Credit / Short-term
('2200', 'Credit Card',                      'LIABILITY', 'CR', '2000', 'CREDIT'),
('2210', 'Salary Payable',                   'LIABILITY', 'CR', '2000', 'PAYABLE'),
('2220', 'Management Consultancy Payable',   'LIABILITY', 'CR', '2000', 'LIABILITY'),

-- Long-term / related party
('2300', 'Shareholders Loan',                'LIABILITY', 'CR', '2000', 'LIABILITY'),
('2310', 'Directors Loan',                   'LIABILITY', 'CR', '2000', 'LIABILITY'),
('2320', 'Related Party Loan',               'LIABILITY', 'CR', '2000', 'LIABILITY'),

-- ── Equity ───────────────────────────────────────────────────────────────────
('3000', 'Equity',                           'EQUITY',    'CR', NULL,   'EQUITY'),
('3100', 'Opening Balances',                 'EQUITY',    'CR', '3000', 'EQUITY'),
('3200', 'Retained Earnings',                'EQUITY',    'CR', '3000', 'EQUITY'),

-- ── Revenue ───────────────────────────────────────────────────────────────────
('4000', 'Income',                           'REVENUE',   'CR', NULL,   'INCOME'),
('4100', 'Sale of Goods',                    'REVENUE',   'CR', '4000', 'INCOME'),
('4200', 'Tax Refund',                       'REVENUE',   'CR', '4000', 'INCOME'),
('4300', 'Interest Income',                  'REVENUE',   'CR', '4000', 'INCOME'),
('4310', 'Checking Interest',                'REVENUE',   'CR', '4300', 'INCOME'),
('4320', 'Other Interest',                   'REVENUE',   'CR', '4300', 'INCOME'),
('4330', 'Savings Interest',                 'REVENUE',   'CR', '4300', 'INCOME'),
('4400', 'Bonus',                            'REVENUE',   'CR', '4000', 'INCOME'),
('4500', 'Gifts Received',                   'REVENUE',   'CR', '4000', 'INCOME'),

-- ── Expenses ──────────────────────────────────────────────────────────────────
('5000', 'Expenses',                         'EXPENSE',   'DR', NULL,   'EXPENSE'),

-- Cost of goods sold
('5100', 'Cost of Goods Sold',               'EXPENSE',   'DR', '5000', 'EXPENSE'),
('5110', 'Stock Adjustment',                 'EXPENSE',   'DR', '5100', 'EXPENSE'),

-- Direct goods costs (capitalised into inventory)
('5200', 'Freight & Transport',              'EXPENSE',   'DR', '5000', 'EXPENSE'),
('5300', 'Packaging Charges',               'EXPENSE',   'DR', '5000', 'EXPENSE'),
('5400', 'Inventory (Product process Charges)', 'EXPENSE','DR', '5000', 'EXPENSE'),
('5500', 'Experimental and Trial Charges',   'EXPENSE',   'DR', '5000', 'EXPENSE'),

-- Consultancy & professional fees
('6000', 'Consultancy and Services',         'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6100', 'Accounting Fees',                  'EXPENSE',   'DR', '6000', 'EXPENSE'),
('6110', 'Registered Address Fees',          'EXPENSE',   'DR', '6000', 'EXPENSE'),
('6120', 'Legal Fees',                       'EXPENSE',   'DR', '6000', 'EXPENSE'),
('6130', 'Others',                           'EXPENSE',   'DR', '6000', 'EXPENSE'),

-- Operating expenses
('6200', 'External Consultancy Fee',         'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6300', 'Salary & Wages',                   'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6400', 'Bank Service Charge',              'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6500', 'Computer',                         'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6600', 'Travel',                           'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6700', 'Online Services',                  'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6710', 'Subscriptions',                    'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6720', 'Phone',                            'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6800', 'Taxes',                            'EXPENSE',   'DR', '5000', 'EXPENSE'),
('6900', 'Utilities',                        'EXPENSE',   'DR', '5000', 'EXPENSE')

ON CONFLICT (account_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- JOURNAL ENTRIES (header)
-- ---------------------------------------------------------------------------
CREATE TABLE journal_entries (
    je_id           SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,   -- GE-JnE-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,
    entry_date      DATE            NOT NULL DEFAULT CURRENT_DATE,
    description     VARCHAR(500)    NOT NULL,
    reference       VARCHAR(100),
    -- Source document that triggered this JE (auto-generated entries)
    source_type     VARCHAR(10)     NOT NULL DEFAULT 'MANUAL'
                        CHECK (source_type IN ('MANUAL','VBL','VPY','SIV','CPY','ITR')),
    source_id       INT,            -- vbl_id / vbp_id / itr_id etc.
    status          VARCHAR(10)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','POSTED')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_je_entry_date  ON journal_entries(entry_date);
CREATE INDEX idx_je_source      ON journal_entries(source_type, source_id);
CREATE INDEX idx_je_status      ON journal_entries(status);

CREATE TRIGGER tg_je_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- JOURNAL ENTRY LINES
-- ---------------------------------------------------------------------------
CREATE TABLE journal_entry_lines (
    jel_id          SERIAL          PRIMARY KEY,
    je_id           INT             NOT NULL REFERENCES journal_entries(je_id)
                                        ON DELETE RESTRICT,
    account_id      INT             NOT NULL REFERENCES accounts(account_id),
    line_seq        SMALLINT        NOT NULL,
    description     VARCHAR(500),
    debit           NUMERIC(15,4)   NOT NULL DEFAULT 0 CHECK (debit  >= 0),
    credit          NUMERIC(15,4)   NOT NULL DEFAULT 0 CHECK (credit >= 0),

    CONSTRAINT chk_jel_one_side_only
        CHECK (debit + credit > 0 AND NOT (debit > 0 AND credit > 0)),
    UNIQUE (je_id, line_seq)
);

CREATE INDEX idx_jel_account_id ON journal_entry_lines(account_id);
CREATE INDEX idx_jel_je_id      ON journal_entry_lines(je_id);
