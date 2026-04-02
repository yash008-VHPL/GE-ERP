-- =============================================================================
-- GE ERP — Purchase Module
-- File: 07_payments_and_applications.sql
-- Vendor Bill Payment (VBP) — Workflows 1 & 3
-- Prepayment Application  (VPA) — Workflow 2 only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- VENDOR BILL PAYMENTS (VBP)
-- Direct cash payment against a posted Vendor Bill.
-- Inherits doc_number/doc_year from the VBl it settles.
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_bill_payments (
    vbp_id          SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-VBP-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,

    vbl_id          INT             NOT NULL REFERENCES vendor_bills(vbl_id),
    vendor_id       INT             NOT NULL REFERENCES vendors(vendor_id),

    payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    payment_method  VARCHAR(50),                      -- BANK_TRANSFER, CHECK, CASH, etc.
    payment_ref     VARCHAR(100),                     -- bank ref / check number

    amount          NUMERIC(15,4)   NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vendor_bill_payments IS
    'Workflow 1 (CREDIT) and Workflow 3 (EXPENSE): direct outgoing payment settling a VBl';

-- ---------------------------------------------------------------------------
-- Trigger: when VBP is inserted, increment VBl.amount_paid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_vbp_update_vbl_paid()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE vendor_bills
    SET    amount_paid = amount_paid + NEW.amount
    WHERE  vbl_id = NEW.vbl_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_vbp_update_vbl
    AFTER INSERT ON vendor_bill_payments
    FOR EACH ROW EXECUTE FUNCTION trg_vbp_update_vbl_paid();


-- ---------------------------------------------------------------------------
-- PREPAYMENT APPLICATIONS (VPA)
-- Applies a VPr balance against a posted Vendor Bill (Workflow 2).
-- Inherits doc_number/doc_year from the chain (PuO number).
-- ---------------------------------------------------------------------------
CREATE TABLE prepayment_applications (
    vpa_id              SERIAL          PRIMARY KEY,
    doc_id              VARCHAR(20)     UNIQUE NOT NULL,  -- GE-VPA-NNNN-YYYY
    doc_number          INT             NOT NULL,
    doc_year            SMALLINT        NOT NULL,

    vbl_id              INT             NOT NULL REFERENCES vendor_bills(vbl_id),
    vpr_id              INT             NOT NULL REFERENCES vendor_prepayments(vpr_id),

    application_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    amount_applied      NUMERIC(15,4)   NOT NULL CHECK (amount_applied > 0),
    notes               TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE prepayment_applications IS
    'Workflow 2 (PREPAY): offsets a prior VPr against the final VBl';

-- ---------------------------------------------------------------------------
-- Trigger: when VPA is inserted:
--   1. Increment VBl.amount_paid (reduces outstanding balance)
--   2. Increment VPr.amount_applied (reduces available prepayment balance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_vpa_apply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_vpr_remaining NUMERIC;
    v_vbl_due       NUMERIC;
BEGIN
    -- Guard: cannot apply more than what remains on the prepayment
    SELECT amount - amount_applied
    INTO   v_vpr_remaining
    FROM   vendor_prepayments
    WHERE  vpr_id = NEW.vpr_id;

    IF NEW.amount_applied > v_vpr_remaining THEN
        RAISE EXCEPTION 'Application amount (%) exceeds remaining prepayment balance (%)',
            NEW.amount_applied, v_vpr_remaining;
    END IF;

    -- Guard: cannot over-pay the bill
    SELECT total_amount - amount_paid
    INTO   v_vbl_due
    FROM   vendor_bills
    WHERE  vbl_id = NEW.vbl_id;

    IF NEW.amount_applied > v_vbl_due THEN
        RAISE EXCEPTION 'Application amount (%) exceeds bill amount due (%)',
            NEW.amount_applied, v_vbl_due;
    END IF;

    -- Apply to VBl (triggers tg_vbl_payment_status to update bill status)
    UPDATE vendor_bills
    SET    amount_paid = amount_paid + NEW.amount_applied
    WHERE  vbl_id = NEW.vbl_id;

    -- Consume from VPr (triggers tg_vpr_status to update prepayment status)
    UPDATE vendor_prepayments
    SET    amount_applied = amount_applied + NEW.amount_applied
    WHERE  vpr_id = NEW.vpr_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_vpa_apply
    AFTER INSERT ON prepayment_applications
    FOR EACH ROW EXECUTE FUNCTION trg_vpa_apply();
