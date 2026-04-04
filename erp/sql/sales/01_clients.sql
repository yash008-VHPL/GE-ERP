-- ============================================================
-- SALES MODULE — Clients (Customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  client_id    SERIAL PRIMARY KEY,
  client_code  TEXT NOT NULL UNIQUE,
  client_name  TEXT NOT NULL,
  credit_terms BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE = invoice first, FALSE = prepayment required
  credit_days  INTEGER NOT NULL DEFAULT 30,
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
