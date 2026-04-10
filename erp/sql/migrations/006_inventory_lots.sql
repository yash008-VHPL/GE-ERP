-- =============================================================================
-- GE ERP — Migration 006
-- Inventory lot traceability: inward lots (IB), outward lots (OB),
-- and allocations linking one inward batch to many outbound shipments.
-- Docket numbers (GE-DCK-NNNN-YYYY) are auto-generated per receipt.
-- =============================================================================

-- Register new doc types
INSERT INTO document_sequences (doc_type, doc_year, last_number)
VALUES
  ('IB',  EXTRACT(YEAR FROM NOW())::SMALLINT, 0),
  ('OB',  EXTRACT(YEAR FROM NOW())::SMALLINT, 0),
  ('DCK', EXTRACT(YEAR FROM NOW())::SMALLINT, 0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- INWARD INVENTORY LOTS
-- Created when an Item Receipt is CONFIRMED.
-- One lot per receipt line (each receipt line = one product/qty combo).
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_lots (
    lot_id              SERIAL          PRIMARY KEY,
    lot_number          VARCHAR(20)     UNIQUE NOT NULL,  -- GE-IB-NNNN-YYYY (unique per lot)
    docket_number       VARCHAR(20)     NOT NULL,         -- GE-DCK-NNNN-YYYY (shared across all lots in one receipt)
    itr_id              INT             NOT NULL REFERENCES item_receipts(itr_id),
    irl_id              INT             NOT NULL REFERENCES item_receipt_lines(irl_id),
    item_id             INT             NOT NULL REFERENCES items(item_id),
    vendor_id           INT             NOT NULL REFERENCES vendors(vendor_id),

    quantity_received   NUMERIC(15,4)   NOT NULL CHECK (quantity_received > 0),
    quantity_available  NUMERIC(15,4)   NOT NULL,          -- decrements as allocated
    uom                 VARCHAR(20)     NOT NULL DEFAULT 'MT',

    vendor_batch_ref    VARCHAR(100),   -- vendor's own batch/COA reference
    sharepoint_folder   TEXT,           -- URL to SharePoint folder for this receipt's docs

    received_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    status              VARCHAR(20)     NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE', 'PARTIALLY_USED', 'FULLY_USED')),

    notes               TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_qty_available CHECK (quantity_available >= 0),
    CONSTRAINT chk_qty_available_lte_received CHECK (quantity_available <= quantity_received)
);

CREATE INDEX idx_invlot_item_id   ON inventory_lots(item_id);
CREATE INDEX idx_invlot_itr_id    ON inventory_lots(itr_id);
CREATE INDEX idx_invlot_status    ON inventory_lots(status);

-- ---------------------------------------------------------------------------
-- OUTWARD (SHIPMENT) LOTS
-- Created when goods are picked/allocated for a Sales Order.
-- Lot number manually assigned by warehouse team (for now).
-- ---------------------------------------------------------------------------
CREATE TABLE shipment_lots (
    shipment_lot_id     SERIAL          PRIMARY KEY,
    lot_number          VARCHAR(50)     UNIQUE NOT NULL,  -- OB-NNNN-YYYY (user-assigned)
    so_id               INT             NOT NULL REFERENCES sales_orders(so_id),
    fulfillment_id      INT             REFERENCES fulfillments(fulfillment_id),
    item_id             INT             NOT NULL REFERENCES items(item_id),

    quantity            NUMERIC(15,4)   NOT NULL CHECK (quantity > 0),
    uom                 VARCHAR(20)     NOT NULL DEFAULT 'MT',

    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'DISPATCHED', 'CANCELLED')),

    notes               TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shiplot_so_id    ON shipment_lots(so_id);
CREATE INDEX idx_shiplot_item_id  ON shipment_lots(item_id);

-- ---------------------------------------------------------------------------
-- LOT ALLOCATIONS
-- Links one or more inward lots to an outward lot.
-- A single inward batch can feed multiple shipments.
-- ---------------------------------------------------------------------------
CREATE TABLE lot_allocations (
    allocation_id       SERIAL          PRIMARY KEY,
    shipment_lot_id     INT             NOT NULL REFERENCES shipment_lots(shipment_lot_id)
                                            ON DELETE CASCADE,
    inventory_lot_id    INT             NOT NULL REFERENCES inventory_lots(lot_id),
    quantity_allocated  NUMERIC(15,4)   NOT NULL CHECK (quantity_allocated > 0),
    allocated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (shipment_lot_id, inventory_lot_id)
);

CREATE INDEX idx_lotalloc_inv_lot  ON lot_allocations(inventory_lot_id);
CREATE INDEX idx_lotalloc_ship_lot ON lot_allocations(shipment_lot_id);
