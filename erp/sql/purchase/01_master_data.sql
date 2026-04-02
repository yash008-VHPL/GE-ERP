-- =============================================================================
-- GE ERP — Purchase Module
-- File: 01_master_data.sql
-- Vendor and Item master tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- VENDORS
-- -----------------------------------------------------------------------------
CREATE TABLE vendors (
    vendor_id       SERIAL          PRIMARY KEY,
    vendor_code     VARCHAR(20)     UNIQUE NOT NULL,
    vendor_name     VARCHAR(200)    NOT NULL,
    credit_terms    BOOLEAN         NOT NULL DEFAULT FALSE,
    credit_days     INT             NOT NULL DEFAULT 0,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    contact_name    VARCHAR(100),
    email           VARCHAR(150),
    phone           VARCHAR(30),
    address         TEXT,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_credit_days CHECK (credit_days >= 0)
);

COMMENT ON COLUMN vendors.credit_terms IS 'TRUE = vendor has extended credit; drives PuO workflow selection';
COMMENT ON COLUMN vendors.credit_days  IS 'Net payment days when credit_terms = TRUE';


-- -----------------------------------------------------------------------------
-- ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE items (
    item_id         SERIAL          PRIMARY KEY,
    item_code       VARCHAR(50)     UNIQUE NOT NULL,
    item_name       VARCHAR(200)    NOT NULL,
    uom             VARCHAR(20)     NOT NULL DEFAULT 'EA',
    item_type       VARCHAR(10)     NOT NULL DEFAULT 'PRODUCT'
                        CHECK (item_type IN ('PRODUCT', 'SERVICE')),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN items.item_type IS 'PRODUCT = physical inventory item; SERVICE = usage/expense item (Workflow 3)';
