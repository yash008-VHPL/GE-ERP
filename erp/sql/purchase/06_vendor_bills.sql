-- =============================================================================
-- GE ERP — Purchase Module
-- File: 06_vendor_bills.sql
-- Vendor Bill (VBl) — All three workflows
--
-- Workflow 1 (CREDIT):  VBl inherits PuO's doc_number/doc_year.
-- Workflow 2 (PREPAY):  VBl inherits PuO's doc_number/doc_year.
-- Workflow 3 (EXPENSE): VBl originates its own doc_number (no PuO).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- VENDOR BILLS — header
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_bills (
    vbl_id          SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-VBl-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,

    -- NULL for Workflow 3 (usage/expense bills with no PuO)
    puo_id          INT             REFERENCES purchase_orders(puo_id),
    vendor_id       INT             NOT NULL REFERENCES vendors(vendor_id),

    vendor_inv_ref  VARCHAR(100),                     -- vendor's own invoice number

    bill_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE,

    workflow        VARCHAR(10)     NOT NULL
                        CHECK (workflow IN ('CREDIT', 'PREPAY', 'EXPENSE')),

    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN (
                            'DRAFT',
                            'POSTED',
                            'PARTIALLY_PAID',
                            'PAID',
                            'CANCELLED'
                        )),

    -- Amounts — maintained by application logic / triggers
    subtotal        NUMERIC(15,4)   NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(15,4)   NOT NULL DEFAULT 0,
    total_amount    NUMERIC(15,4)   NOT NULL DEFAULT 0,
    amount_paid     NUMERIC(15,4)   NOT NULL DEFAULT 0,

    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_vbl_puo_workflow CHECK (
        (workflow IN ('CREDIT', 'PREPAY') AND puo_id IS NOT NULL) OR
        (workflow = 'EXPENSE'            AND puo_id IS NULL)
    ),
    CONSTRAINT chk_amount_paid_lte_total CHECK (amount_paid <= total_amount)
);

COMMENT ON COLUMN vendor_bills.vendor_inv_ref IS 'Vendor''s own invoice reference for three-way matching';
COMMENT ON COLUMN vendor_bills.subtotal       IS 'Sum of line_amount across all bill lines; updated by trigger';
COMMENT ON COLUMN vendor_bills.tax_amount     IS 'Sum of line tax_amounts; updated by trigger';
COMMENT ON COLUMN vendor_bills.total_amount   IS 'subtotal + tax_amount; updated by trigger';
COMMENT ON COLUMN vendor_bills.amount_paid    IS 'Running total of payments + prepayment applications; updated by trigger';

-- ---------------------------------------------------------------------------
-- VENDOR BILL LINES
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_bill_lines (
    vll_id          SERIAL          PRIMARY KEY,
    vbl_id          INT             NOT NULL REFERENCES vendor_bills(vbl_id)
                                        ON DELETE RESTRICT,
    line_seq        SMALLINT        NOT NULL,

    -- For Workflows 1 & 2: linked back to the ItR line (three-way match)
    -- NULL for Workflow 3 (no receipt exists)
    irl_id          INT             REFERENCES item_receipt_lines(irl_id),

    item_id         INT             REFERENCES items(item_id),
    description     VARCHAR(500)    NOT NULL,

    quantity        NUMERIC(15,4)   NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price      NUMERIC(15,4)   NOT NULL CHECK (unit_price >= 0),
    line_amount     NUMERIC(15,4)   GENERATED ALWAYS AS (quantity * unit_price) STORED,

    tax_rate        NUMERIC(6,4)    NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
    tax_amount      NUMERIC(15,4)   NOT NULL DEFAULT 0,

    UNIQUE (vbl_id, line_seq)
);

-- ---------------------------------------------------------------------------
-- Trigger: recompute vendor_bills totals when lines are inserted/updated/deleted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_vbl_recompute_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_vbl_id    INT;
    v_sub       NUMERIC;
    v_tax       NUMERIC;
BEGIN
    v_vbl_id := COALESCE(NEW.vbl_id, OLD.vbl_id);

    SELECT COALESCE(SUM(line_amount), 0),
           COALESCE(SUM(tax_amount), 0)
    INTO   v_sub, v_tax
    FROM   vendor_bill_lines
    WHERE  vbl_id = v_vbl_id;

    UPDATE vendor_bills
    SET    subtotal     = v_sub,
           tax_amount   = v_tax,
           total_amount = v_sub + v_tax,
           updated_at   = NOW()
    WHERE  vbl_id = v_vbl_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tg_vbl_lines_totals
    AFTER INSERT OR UPDATE OR DELETE ON vendor_bill_lines
    FOR EACH ROW EXECUTE FUNCTION trg_vbl_recompute_totals();

-- ---------------------------------------------------------------------------
-- Trigger: update VBl status when amount_paid changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_vbl_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.amount_paid = 0 THEN
        -- leave as POSTED — no regression from partially/fully paid
        NULL;
    ELSIF NEW.amount_paid < NEW.total_amount THEN
        NEW.status := 'PARTIALLY_PAID';
    ELSE
        NEW.status := 'PAID';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_vbl_payment_status
    BEFORE UPDATE OF amount_paid ON vendor_bills
    FOR EACH ROW EXECUTE FUNCTION trg_update_vbl_status();

-- ---------------------------------------------------------------------------
-- Trigger: updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER tg_vbl_updated_at
    BEFORE UPDATE ON vendor_bills
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: when VBl is POSTED against a PuO, mark PuO as BILLED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_vbl_post_update_puo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'POSTED' AND NEW.status = 'POSTED' AND NEW.puo_id IS NOT NULL THEN
        UPDATE purchase_orders
        SET    status = 'BILLED'
        WHERE  puo_id = NEW.puo_id
          AND  status NOT IN ('CLOSED', 'CANCELLED');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_vbl_post_puo
    AFTER UPDATE OF status ON vendor_bills
    FOR EACH ROW EXECUTE FUNCTION trg_vbl_post_update_puo();
