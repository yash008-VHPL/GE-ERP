-- ============================================================
-- SALES MODULE — Client Invoices, Payments, Prepayments, Applications
-- ============================================================

-- Client Prepayments (CPr) — received before fulfillment
CREATE TABLE IF NOT EXISTS client_prepayments (
  cpr_id         SERIAL PRIMARY KEY,
  doc_id         TEXT NOT NULL UNIQUE,
  doc_number     INTEGER NOT NULL,
  doc_year       SMALLINT NOT NULL,
  sao_id         INTEGER NOT NULL REFERENCES sales_orders(sao_id),
  client_id      INTEGER NOT NULL REFERENCES clients(client_id),
  payment_date   DATE NOT NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_applied NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  reference      TEXT,
  status         TEXT NOT NULL DEFAULT 'RECEIVED'
                   CHECK (status IN ('RECEIVED','PARTIALLY_APPLIED','FULLY_APPLIED')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Invoices (Inv)
CREATE TABLE IF NOT EXISTS client_invoices (
  inv_id         SERIAL PRIMARY KEY,
  doc_id         TEXT NOT NULL UNIQUE,
  doc_number     INTEGER NOT NULL,
  doc_year       SMALLINT NOT NULL,
  sao_id         INTEGER NOT NULL REFERENCES sales_orders(sao_id),
  client_id      INTEGER NOT NULL REFERENCES clients(client_id),
  workflow       TEXT NOT NULL CHECK (workflow IN ('CREDIT','PREPAY')),
  invoice_date   DATE NOT NULL,
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','POSTED','PARTIALLY_PAID','PAID','CANCELLED')),
  total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  client_ref     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_invoice_lines (
  invl_id      SERIAL PRIMARY KEY,
  inv_id       INTEGER NOT NULL REFERENCES client_invoices(inv_id) ON DELETE CASCADE,
  sol_id       INTEGER REFERENCES sales_order_lines(sol_id),
  line_seq     SMALLINT NOT NULL,
  description  TEXT NOT NULL,
  quantity     NUMERIC(14,4) NOT NULL,
  unit_price   NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_amount  NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  UNIQUE (inv_id, line_seq)
);

-- Client Invoice Payments (CIP)
CREATE TABLE IF NOT EXISTS client_invoice_payments (
  cip_id       SERIAL PRIMARY KEY,
  doc_id       TEXT NOT NULL UNIQUE,
  doc_number   INTEGER NOT NULL,
  doc_year     SMALLINT NOT NULL,
  inv_id       INTEGER NOT NULL REFERENCES client_invoices(inv_id),
  client_id    INTEGER NOT NULL REFERENCES clients(client_id),
  payment_date DATE NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  reference    TEXT,
  status       TEXT NOT NULL DEFAULT 'POSTED'
                 CHECK (status IN ('POSTED','REVERSED')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prepayment Applications (CPA) — links CPr to Inv
CREATE TABLE IF NOT EXISTS client_prepayment_applications (
  cpa_id           SERIAL PRIMARY KEY,
  doc_id           TEXT NOT NULL UNIQUE,
  doc_number       INTEGER NOT NULL,
  doc_year         SMALLINT NOT NULL,
  inv_id           INTEGER NOT NULL REFERENCES client_invoices(inv_id),
  cpr_id           INTEGER NOT NULL REFERENCES client_prepayments(cpr_id),
  amount_applied   NUMERIC(14,2) NOT NULL CHECK (amount_applied > 0),
  application_date DATE NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: CIP updates invoice amount_paid and status
CREATE OR REPLACE FUNCTION trg_cip_update_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC; v_paid NUMERIC;
BEGIN
  SELECT total_amount, amount_paid + NEW.amount INTO v_total, v_paid
  FROM client_invoices WHERE inv_id = NEW.inv_id;
  UPDATE client_invoices SET
    amount_paid = v_paid,
    status = CASE WHEN v_paid >= v_total THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
    updated_at = now()
  WHERE inv_id = NEW.inv_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cip_update_invoice ON client_invoice_payments;
CREATE TRIGGER cip_update_invoice
  AFTER INSERT ON client_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION trg_cip_update_invoice();

-- Register doc types for sales
INSERT INTO document_sequences (doc_type, doc_year, last_number)
VALUES
  ('SaO', EXTRACT(YEAR FROM now())::SMALLINT, 0),
  ('ItF', EXTRACT(YEAR FROM now())::SMALLINT, 0),
  ('Inv', EXTRACT(YEAR FROM now())::SMALLINT, 0),
  ('CIP', EXTRACT(YEAR FROM now())::SMALLINT, 0),
  ('CPr', EXTRACT(YEAR FROM now())::SMALLINT, 0),
  ('CPA', EXTRACT(YEAR FROM now())::SMALLINT, 0)
ON CONFLICT (doc_type, doc_year) DO NOTHING;
