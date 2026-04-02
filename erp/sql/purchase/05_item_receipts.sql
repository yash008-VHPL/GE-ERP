-- =============================================================================
-- GE ERP — Purchase Module
-- File: 05_item_receipts.sql
-- Item Receipt (ItR) — Workflows 1 (CREDIT) and 2 (PREPAY)
--
-- Records physical receipt of goods against a Purchase Order.
-- Inherits doc_number/doc_year from its parent PuO.
-- Multiple receipts can exist per PuO (partial deliveries).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ITEM RECEIPTS — header
-- ---------------------------------------------------------------------------
CREATE TABLE item_receipts (
    itr_id          SERIAL          PRIMARY KEY,
    doc_id          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-ItR-NNNN-YYYY
    doc_number      INT             NOT NULL,
    doc_year        SMALLINT        NOT NULL,

    puo_id          INT             NOT NULL REFERENCES purchase_orders(puo_id),
    vendor_id       INT             NOT NULL REFERENCES vendors(vendor_id),

    receipt_date    DATE            NOT NULL DEFAULT CURRENT_DATE,

    status          VARCHAR(10)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED')),

    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN item_receipts.status IS 'CONFIRMED = receipt validated; triggers update of pol.qty_received';

-- ---------------------------------------------------------------------------
-- ITEM RECEIPT LINES
-- ---------------------------------------------------------------------------
CREATE TABLE item_receipt_lines (
    irl_id          SERIAL          PRIMARY KEY,
    itr_id          INT             NOT NULL REFERENCES item_receipts(itr_id)
                                        ON DELETE RESTRICT,
    line_seq        SMALLINT        NOT NULL,

    pol_id          INT             NOT NULL REFERENCES purchase_order_lines(pol_id),
    item_id         INT             REFERENCES items(item_id),
    description     VARCHAR(500),

    qty_received    NUMERIC(15,4)   NOT NULL CHECK (qty_received > 0),
    unit_price      NUMERIC(15,4)   NOT NULL CHECK (unit_price >= 0),
    line_amount     NUMERIC(15,4)   GENERATED ALWAYS AS (qty_received * unit_price) STORED,

    UNIQUE (itr_id, line_seq)
);

-- ---------------------------------------------------------------------------
-- Trigger: when ItR is CONFIRMED, roll up qty_received onto purchase_order_lines
-- and update PuO status accordingly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_itr_confirm_rollup()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_puo_id        INT;
    v_total_ordered NUMERIC;
    v_total_recvd   NUMERIC;
BEGIN
    -- Only fire on transition to CONFIRMED
    IF OLD.status = 'CONFIRMED' OR NEW.status <> 'CONFIRMED' THEN
        RETURN NEW;
    END IF;

    -- Increment qty_received on each matched PO line
    UPDATE purchase_order_lines pol
    SET    qty_received = pol.qty_received + irl.qty_received
    FROM   item_receipt_lines irl
    WHERE  irl.itr_id = NEW.itr_id
      AND  irl.pol_id = pol.pol_id;

    -- Recalculate PuO status
    v_puo_id := NEW.puo_id;

    SELECT SUM(quantity), SUM(qty_received)
    INTO   v_total_ordered, v_total_recvd
    FROM   purchase_order_lines
    WHERE  puo_id = v_puo_id;

    UPDATE purchase_orders
    SET    status = CASE
                     WHEN v_total_recvd >= v_total_ordered THEN 'FULLY_RECEIVED'
                     WHEN v_total_recvd >  0               THEN 'PARTIALLY_RECEIVED'
                     ELSE status
                   END
    WHERE  puo_id = v_puo_id
      AND  status NOT IN ('BILLED', 'CLOSED', 'CANCELLED');

    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_itr_confirm
    AFTER UPDATE OF status ON item_receipts
    FOR EACH ROW EXECUTE FUNCTION trg_itr_confirm_rollup();
