import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../config/db';
import { allocateDocNumber, formatDocId } from '../services/poService';

export const vendorBillsRouter = Router();

// GET /vendor-bills — list (uses v_outstanding_bills for unpaid, or full list)
vendorBillsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { outstanding, vendor_id } = req.query;
    let query = outstanding === 'true'
      ? `SELECT * FROM v_outstanding_bills WHERE 1=1`
      : `SELECT b.*, v.vendor_name FROM vendor_bills b JOIN vendors v ON b.vendor_id = v.vendor_id WHERE 1=1`;

    const params: unknown[] = [];
    if (vendor_id) { params.push(vendor_id); query += ` AND vendor_id = $${params.length}`; }
    query += ' ORDER BY bill_date DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /vendor-bills/:docId
vendorBillsRouter.get('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, v.vendor_name, v.vendor_code
         FROM vendor_bills b
         JOIN vendors v ON b.vendor_id = v.vendor_id
        WHERE b.doc_id = $1`, [req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(
      `SELECT vll.*, i.item_code, i.item_name
         FROM vendor_bill_lines vll
         LEFT JOIN items i ON vll.item_id = i.item_id
        WHERE vll.vbl_id = $1 ORDER BY vll.line_seq`,
      [rows[0].vbl_id]
    );
    res.json({ success: true, data: { ...rows[0], lines } });
  } catch (e) { next(e); }
});

// POST /vendor-bills
vendorBillsRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { vendorId, puoId, workflow, billDate, dueDate, vendorInvRef, currency, notes, lines } = req.body;

    const year      = new Date().getFullYear();
    // EXPENSE bills get their own VBl number; CREDIT/PREPAY inherit PuO number
    let docNumber: number;
    if (workflow === 'EXPENSE') {
      const { rows } = await client.query<{ next_doc_number: number }>(
        'SELECT next_doc_number($1, $2) AS next_doc_number', ['VBl', year]
      );
      docNumber = rows[0].next_doc_number;
    } else {
      const { rows } = await client.query<{ doc_number: number }>(
        'SELECT doc_number FROM purchase_orders WHERE puo_id = $1', [puoId]
      );
      docNumber = rows[0].doc_number;
    }
    const docId = formatDocId('VBl', docNumber, year);

    const { rows: [bill] } = await client.query(
      `INSERT INTO vendor_bills
         (doc_id, doc_number, doc_year, puo_id, vendor_id, vendor_inv_ref,
          bill_date, due_date, workflow, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [docId, docNumber, year, puoId ?? null, vendorId, vendorInvRef ?? null,
       billDate, dueDate ?? null, workflow, currency ?? 'USD', notes ?? null]
    );

    for (let i = 0; i < (lines ?? []).length; i++) {
      const l = lines[i];
      await client.query(
        `INSERT INTO vendor_bill_lines
           (vbl_id, line_seq, item_id, description, quantity, unit_price, tax_rate, tax_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [bill.vbl_id, i + 1, l.itemId ?? null, l.description,
         l.quantity, l.unitPrice, l.taxRate ?? 0, l.taxAmount ?? 0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: bill });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// PATCH /vendor-bills/:docId/status
vendorBillsRouter.patch('/:docId/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      'UPDATE vendor_bills SET status=$1 WHERE doc_id=$2 RETURNING *',
      [req.body.status, req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
