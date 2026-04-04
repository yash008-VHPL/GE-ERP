// Document number allocation and PO business logic

import { pool } from '../config/db';
import type { PurchaseOrder, PurchaseOrderLine } from '../types';

/** Allocate the next doc_number for a given type + year (calls DB function) */
export async function allocateDocNumber(docType: string, year: number): Promise<number> {
  const { rows } = await pool.query<{ next_doc_number: number }>(
    'SELECT next_doc_number($1, $2) AS next_doc_number',
    [docType, year]
  );
  return rows[0].next_doc_number;
}

/** Format a doc_id string */
export function formatDocId(docType: string, num: number, year: number): string {
  return `GE-${docType}-${String(num).padStart(4, '0')}-${year}`;
}

/** Fetch a full PO with lines and vendor details */
export async function getPurchaseOrder(docId: string): Promise<PurchaseOrder | null> {
  const { rows } = await pool.query<PurchaseOrder>(
    `SELECT p.*,
            v.vendor_name, v.vendor_code,
            v.contact_name AS vendor_contact,
            v.email        AS vendor_email,
            v.phone        AS vendor_phone,
            v.address      AS vendor_address
       FROM purchase_orders p
       JOIN vendors v ON p.vendor_id = v.vendor_id
      WHERE p.doc_id = $1`,
    [docId]
  );
  if (!rows[0]) return null;

  const po = rows[0];
  const { rows: lines } = await pool.query<PurchaseOrderLine>(
    `SELECT pol.*, i.item_code, i.item_name, i.uom
       FROM purchase_order_lines pol
       LEFT JOIN items i ON pol.item_id = i.item_id
      WHERE pol.puo_id = $1
      ORDER BY pol.line_seq`,
    [po.puo_id]
  );
  po.lines = lines;
  return po;
}

/** Create a PO and its lines atomically */
export async function createPurchaseOrder(data: {
  vendorId:       number;
  workflow:       'CREDIT' | 'PREPAY';
  orderDate:      string;
  currency:       string;
  notes:          string | null;
  shippingMethod: string | null;
  incoterms:      string | null;
  incotermPort:   string | null;
  paymentTerms:   string | null;
  lines: Array<{
    itemId:       number | null;
    description:  string | null;
    quantity:     number;
    unitPrice:    number;
    expectedDate: string | null;
  }>;
}): Promise<PurchaseOrder> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const year = new Date().getFullYear();
    const { rows: numRow } = await client.query<{ next_doc_number: number }>(
      'SELECT next_doc_number($1, $2) AS next_doc_number',
      ['PuO', year]
    );
    const docNumber = numRow[0].next_doc_number;
    const docId     = formatDocId('PuO', docNumber, year);

    const { rows: [po] } = await client.query<PurchaseOrder>(
      `INSERT INTO purchase_orders
         (doc_id, doc_number, doc_year, vendor_id, order_date,
          workflow, currency, notes,
          shipping_method, incoterms, incoterms_port, payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [docId, docNumber, year, data.vendorId, data.orderDate,
       data.workflow, data.currency, data.notes,
       data.shippingMethod ?? null, data.incoterms ?? null,
       data.incotermPort ?? null, data.paymentTerms ?? null]
    );

    for (let i = 0; i < data.lines.length; i++) {
      const l = data.lines[i];
      await client.query(
        `INSERT INTO purchase_order_lines
           (puo_id, line_seq, item_id, description, quantity, unit_price, expected_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [po.puo_id, i + 1, l.itemId, l.description, l.quantity, l.unitPrice, l.expectedDate ?? null]
      );
    }

    await client.query('COMMIT');
    return (await getPurchaseOrder(docId))!;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
