-- =============================================================================
-- GE ERP — Purchase Module
-- File: 03_purchase_orders.sql
-- Purchase Order (PuO) — Workflows 1 (CREDIT) and 2 (PREPAY)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PURCHASE ORDERS — header
-- ---------------------------------------------------------------------------
CREATE TABLE purchase_orders (
    puo_id          SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-PuO-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,

    vendor_id       INT             NOT NULL REFERENCES vendors(vendor_id),
    order_date      DATE            NOT NULL DEFAULT CURRENT_DATE,
    expected_date   DATE,

    -- CREDIT = vendor gives net terms (Workflow 1)
    -- PREPAY = payment required before/on delivery (Workflow 2)
    workflow        VARCHAR(10)     NOT NULL CHECK (workflow IN ('CREDIT', 'PREPAY')),

    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN (
                            'DRAFT',
                            'CONFIRMED',
                            'PARTIALLY_RECEIVED',
                            'FULLY_RECEIVED',
                            'BILLED',
                            'CLOSED',
                            'CANCELLED'
                        )),

    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (doc_number, doc_year)  -- one PuO per number/year combination
);

-- ---------------------------------------------------------------------------
-- PURCHASE ORDER LINES
-- ---------------------------------------------------------------------------
CREATE TABLE purchase_order_lines (
    pol_id          SERIAL          PRIMARY KEY,
    puo_id          INT             NOT NULL REFERENCES purchase_orders(puo_id)
                                        ON DELETE RESTRICT,
    line_seq        SMALLINT        NOT NULL,               -- 1-based line number
    item_id         INT             REFERENCES items(item_id),
    description     VARCHAR(500),                           -- free-text override / fallback
    quantity        NUMERIC(15,4)   NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(15,4)   NOT NULL CHECK (unit_price >= 0),
    line_amount     NUMERIC(15,4)   GENERATED ALWAYS AS (quantity * unit_price) STORED,
    qty_received    NUMERIC(15,4)   NOT NULL DEFAULT 0
                        CHECK (qty_received >= 0),
    qty_billed      NUMERIC(15,4)   NOT NULL DEFAULT 0
                        CHECK (qty_billed >= 0),
    UNIQUE (puo_id, line_seq),
    CONSTRAINT chk_recv_lte_ordered  CHECK (qty_received <= quantity),
    CONSTRAINT chk_billed_lte_recvd  CHECK (qty_billed   <= qty_received)
);

COMMENT ON COLUMN purchase_order_lines.qty_received IS 'Updated when ItR lines are confirmed';
COMMENT ON COLUMN purchase_order_lines.qty_billed   IS 'Updated when VBl lines are posted';

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current on purchase_orders
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_puo_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
