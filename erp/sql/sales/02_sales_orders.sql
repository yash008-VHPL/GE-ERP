-- ============================================================
-- SALES MODULE — Sales Orders + Lines
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  sao_id        SERIAL PRIMARY KEY,
  doc_id        TEXT NOT NULL UNIQUE,
  doc_number    INTEGER NOT NULL,
  doc_year      SMALLINT NOT NULL,
  client_id     INTEGER NOT NULL REFERENCES clients(client_id),
  workflow      TEXT NOT NULL CHECK (workflow IN ('CREDIT','PREPAY')),
  order_date    DATE NOT NULL,
  expected_date DATE,
  status        TEXT NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','CONFIRMED','PARTIALLY_FULFILLED',
                                    'FULLY_FULFILLED','INVOICED','CLOSED','CANCELLED')),
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  sol_id        SERIAL PRIMARY KEY,
  sao_id        INTEGER NOT NULL REFERENCES sales_orders(sao_id) ON DELETE CASCADE,
  line_seq      SMALLINT NOT NULL,
  item_id       INTEGER REFERENCES items(item_id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_amount   NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  qty_fulfilled NUMERIC(14,4) NOT NULL DEFAULT 0,
  qty_invoiced  NUMERIC(14,4) NOT NULL DEFAULT 0,
  uom           TEXT,
  UNIQUE (sao_id, line_seq)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_set_sao_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_sao_updated_at ON sales_orders;
CREATE TRIGGER set_sao_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION trg_set_sao_updated_at();
