-- ============================================================
-- SALES MODULE — Item Fulfillments (outbound shipments)
-- ============================================================
CREATE TABLE IF NOT EXISTS item_fulfillments (
  itf_id           SERIAL PRIMARY KEY,
  doc_id           TEXT NOT NULL UNIQUE,
  doc_number       INTEGER NOT NULL,
  doc_year         SMALLINT NOT NULL,
  sao_id           INTEGER NOT NULL REFERENCES sales_orders(sao_id),
  fulfillment_date DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_fulfillment_lines (
  itfl_id            SERIAL PRIMARY KEY,
  itf_id             INTEGER NOT NULL REFERENCES item_fulfillments(itf_id) ON DELETE CASCADE,
  sol_id             INTEGER NOT NULL REFERENCES sales_order_lines(sol_id),
  line_seq           SMALLINT NOT NULL,
  quantity_fulfilled NUMERIC(14,4) NOT NULL CHECK (quantity_fulfilled > 0),
  batch_number       TEXT,         -- outbound batch tracking
  production_date    DATE,
  UNIQUE (itf_id, line_seq)
);

-- Trigger: on CONFIRM, update qty_fulfilled on sales_order_lines and roll up SO status
CREATE OR REPLACE FUNCTION trg_itf_confirm_rollup()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sao_id INTEGER;
  v_total  NUMERIC; v_fulfilled NUMERIC;
BEGIN
  IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
    -- update qty_fulfilled on each line
    UPDATE sales_order_lines sol
    SET qty_fulfilled = qty_fulfilled + itfl.quantity_fulfilled
    FROM item_fulfillment_lines itfl
    WHERE itfl.itf_id = NEW.itf_id AND itfl.sol_id = sol.sol_id;

    -- roll up SO status
    SELECT sao_id INTO v_sao_id FROM item_fulfillments WHERE itf_id = NEW.itf_id;
    SELECT SUM(quantity), SUM(qty_fulfilled) INTO v_total, v_fulfilled
    FROM sales_order_lines WHERE sao_id = v_sao_id;

    UPDATE sales_orders SET
      status = CASE
        WHEN v_fulfilled >= v_total THEN 'FULLY_FULFILLED'
        WHEN v_fulfilled > 0        THEN 'PARTIALLY_FULFILLED'
        ELSE status
      END,
      updated_at = now()
    WHERE sao_id = v_sao_id AND status NOT IN ('INVOICED','CLOSED','CANCELLED');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS itf_confirm_rollup ON item_fulfillments;
CREATE TRIGGER itf_confirm_rollup
  AFTER UPDATE ON item_fulfillments
  FOR EACH ROW EXECUTE FUNCTION trg_itf_confirm_rollup();
