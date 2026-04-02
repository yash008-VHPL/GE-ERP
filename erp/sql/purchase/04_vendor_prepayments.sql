-- =============================================================================
-- GE ERP — Purchase Module
-- File: 04_vendor_prepayments.sql
-- Vendor Prepayment (VPr) — Workflow 2 only
--
-- A prepayment is an outgoing payment made BEFORE goods are received.
-- It is linked to a PuO and inherits the PuO's doc_number/doc_year.
-- Later it is applied to the Vendor Bill via a Prepayment Application (VPA).
-- =============================================================================

CREATE TABLE vendor_prepayments (
    vpr_id          SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-VPr-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,

    puo_id          INT             NOT NULL REFERENCES purchase_orders(puo_id),
    vendor_id       INT             NOT NULL REFERENCES vendors(vendor_id),

    payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    payment_method  VARCHAR(50),                      -- BANK_TRANSFER, CHECK, CASH, etc.
    payment_ref     VARCHAR(100),                     -- bank / check reference number

    amount          NUMERIC(15,4)   NOT NULL CHECK (amount > 0),
    amount_applied  NUMERIC(15,4)   NOT NULL DEFAULT 0,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',

    status          VARCHAR(20)     NOT NULL DEFAULT 'PAID'
                        CHECK (status IN ('PAID', 'PARTIALLY_APPLIED', 'FULLY_APPLIED')),

    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_applied_lte_amount CHECK (amount_applied <= amount),
    -- doc_number/year must match its parent PuO
    CONSTRAINT fk_vpr_matches_puo FOREIGN KEY (puo_id) REFERENCES purchase_orders(puo_id)
);

COMMENT ON TABLE  vendor_prepayments                IS 'Workflow 2: advance payment to vendor prior to goods receipt';
COMMENT ON COLUMN vendor_prepayments.amount_applied IS 'Sum of all VPA.amount_applied entries against this prepayment; updated by trigger';
COMMENT ON COLUMN vendor_prepayments.status         IS 'Maintained automatically: PAID → PARTIALLY_APPLIED → FULLY_APPLIED';

-- ---------------------------------------------------------------------------
-- Trigger: update VPr status when amount_applied changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_vpr_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.amount_applied = 0 THEN
        NEW.status := 'PAID';
    ELSIF NEW.amount_applied < NEW.amount THEN
        NEW.status := 'PARTIALLY_APPLIED';
    ELSE
        NEW.status := 'FULLY_APPLIED';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_vpr_status
    BEFORE UPDATE OF amount_applied ON vendor_prepayments
    FOR EACH ROW EXECUTE FUNCTION trg_update_vpr_status();
