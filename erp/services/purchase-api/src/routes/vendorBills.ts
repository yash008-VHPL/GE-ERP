// =============================================================================
// GE ERP — Vendor Bills Router
// bill_type: GOODS | DIRECT_SERVICE | INDIRECT_SERVICE
// GOODS bills link to a PO; DIRECT_SERVICE bills link to a SO;
// INDIRECT_SERVICE bills are standalone (accounting fees, consultancy, etc.)
// Posting a bill auto-generates a double-entry journal entry.
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth }            from '../middleware/auth';
import { pool }                   from '../config/db';
import { formatDocId }            from '../services/poService';
import { buildVendorBillJE }      from '../services/jeService';

export const vendorBillsRouter = Router();

// GET /vendor-bills
vendorBillsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, vendor_id, bill_type, outstanding } = req.query;
    let query = `
      SELECT b.*, v.vendor_name, v.vendor_code,
             so.doc_id AS so_doc_id,
             po.doc_id AS puo_doc_id
        FROM vendor_bills b
        JOIN vendors v             ON b.vendor_id  = v.vendor_id
        LEFT JOIN sales_orders so  ON b.linked_sao_id = so.sao_id
        LEFT JOIN purchase_orders po ON b.puo_id   = po.puo_id
       WHERE 1=1`;
    const params: unknown[] = [];
    if (outstanding === 'true') { query += ` AND b.status IN ('POSTED','PARTIALLY_PAID')`; }
    if (status)    { params.push(status);    query += ` AND b.status = $${params.length}`; }
    if (vendor_id) { params.push(vendor_id); query += ` AND b.vendor_id = $${params.length}`; }
    if (bill_type) { params.push(bill_type); query += ` AND b.bill_type = $${params.length}`; }
    query += ' ORDER BY b.bill_date DESC, b.vbl_id DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /vendor-bills/:docId
vendorBillsRouter.get('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: [bill] } = await pool.query(`
      SELECT b.*, v.vendor_name, v.vendor_code,
             so.doc_id AS so_doc_id,
             po.doc_id AS puo_doc_id
        FROM vendor_bills b
        JOIN vendors v             ON b.vendor_id    = v.vendor_id
        LEFT JOIN sales_orders so  ON b.linked_sao_id = so.sao_id
        LEFT JOIN purchase_orders po ON b.puo_id     = po.puo_id
       WHERE b.doc_id = $1`, [req.params.docId]
    );
    if (!bill) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT vll.*, i.item_code, i.item_name, i.gl_account_code AS item_gl_code,
             a.account_name AS gl_account_name
        FROM vendor_bill_lines vll
        LEFT JOIN items i    ON vll.item_id        = i.item_id
        LEFT JOIN accounts a ON vll.gl_account_code = a.account_code
       WHERE vll.vbl_id = $1 ORDER BY vll.line_seq`, [bill.vbl_id]
    );

    // Payments against this bill
    const { rows: payments } = await pool.query(`
      SELECT * FROM vendor_bill_payments WHERE vbl_id = $1 ORDER BY payment_date`, [bill.vbl_id]
    );

    res.json({ success: true, data: { ...bill, lines, payments } });
  } catch (e) { next(e); }
});

// POST /vendor-bills
vendorBillsRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      vendorId, puoId, linkedSoId, billType, workflow,
      billDate, dueDate, vendorInvRef, currency, notes, lines,
    } = req.body;

    const resolvedBillType = billType ?? 'GOODS';
    const resolvedWorkflow = workflow ?? (resolvedBillType === 'GOODS' ? 'CREDIT' : 'EXPENSE');

    const year = new Date(billDate).getFullYear();

    // Doc number: GOODS/PREPAY bills inherit PO number; others get own sequence
    let docNumber: number;
    if (resolvedWorkflow !== 'EXPENSE' && puoId) {
      const { rows: [po] } = await client.query<{ doc_number: number }>(
        `SELECT doc_number FROM purchase_orders WHERE puo_id = $1`, [puoId]
      );
      if (!po) throw new Error('Purchase order not found');
      docNumber = po.doc_number;
    } else {
      const { rows: [seq] } = await client.query<{ next_doc_number: number }>(
        `SELECT next_doc_number('VBl', $1) AS next_doc_number`, [year]
      );
      docNumber = seq.next_doc_number;
    }
    const docId = formatDocId('VBl', docNumber, year);

    const { rows: [bill] } = await client.query(`
      INSERT INTO vendor_bills
        (doc_id, doc_number, doc_year, puo_id, linked_sao_id, vendor_id,
         vendor_inv_ref, bill_date, due_date, workflow, bill_type, currency, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [docId, docNumber, year,
       puoId ?? null, linkedSoId ?? null, vendorId,
       vendorInvRef ?? null, billDate, dueDate ?? null,
       resolvedWorkflow, resolvedBillType, currency ?? 'USD', notes ?? null]
    );

    for (let i = 0; i < (lines ?? []).length; i++) {
      const l = lines[i];
      await client.query(`
        INSERT INTO vendor_bill_lines
          (vbl_id, line_seq, item_id, description, quantity, unit_price,
           tax_rate, tax_amount, gl_account_code)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [bill.vbl_id, i + 1,
         l.itemId ?? null, l.description,
         l.quantity, l.unitPrice,
         l.taxRate ?? 0, l.taxAmount ?? 0,
         l.glAccountCode ?? null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: bill });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// PATCH /vendor-bills/:docId — edit mutable fields with mandatory amendment note
vendorBillsRouter.patch('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const { vendorInvRef, billDate, dueDate, notes, changeNote } = req.body;
  if (!changeNote?.trim()) {
    res.status(400).json({ error: 'changeNote is required — please explain what changed and why.' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [current] } = await client.query(
      `SELECT * FROM vendor_bills WHERE doc_id = $1`, [req.params.docId]
    );
    if (!current) { res.status(404).json({ error: 'Not found' }); return; }

    const oldV: Record<string, unknown> = {};
    const newV: Record<string, unknown> = {};
    const set: string[] = [];
    const p: unknown[] = [];
    let i = 1;

    const cmpStr = (a: unknown, b: unknown) => (a ?? null) !== (b ?? null);

    if (vendorInvRef !== undefined && cmpStr(vendorInvRef, current.vendor_inv_ref)) {
      oldV.vendor_inv_ref = current.vendor_inv_ref; newV.vendor_inv_ref = vendorInvRef || null;
      set.push(`vendor_inv_ref = $${i++}`); p.push(vendorInvRef || null);
    }
    if (billDate && current.status === 'DRAFT') {
      const cur = current.bill_date?.toISOString?.().split('T')[0] ?? current.bill_date;
      if (billDate !== cur) {
        oldV.bill_date = cur; newV.bill_date = billDate;
        set.push(`bill_date = $${i++}`); p.push(billDate);
      }
    }
    const curDue = current.due_date?.toISOString?.().split('T')[0] ?? current.due_date ?? null;
    if (dueDate !== undefined && cmpStr(dueDate || null, curDue)) {
      oldV.due_date = curDue; newV.due_date = dueDate || null;
      set.push(`due_date = $${i++}`); p.push(dueDate || null);
    }
    if (notes !== undefined && cmpStr(notes, current.notes)) {
      oldV.notes = current.notes; newV.notes = notes || null;
      set.push(`notes = $${i++}`); p.push(notes || null);
    }

    if (set.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No changes detected.' }); return;
    }

    set.push(`updated_at = now()`);
    p.push(req.params.docId);
    const { rows: [updated] } = await client.query(
      `UPDATE vendor_bills SET ${set.join(', ')} WHERE doc_id = $${i} RETURNING *`, p
    );
    await client.query(
      `INSERT INTO record_amendments
         (table_name, record_id, doc_id, changed_by, change_note, old_values, new_values)
       VALUES ('vendor_bills', $1, $2, $3, $4, $5, $6)`,
      [current.vbl_id, current.doc_id, req.userName, changeNote.trim(),
       JSON.stringify(oldV), JSON.stringify(newV)]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: updated });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// PATCH /vendor-bills/:docId/status
// Posting (DRAFT → POSTED) auto-generates a journal entry
vendorBillsRouter.patch('/:docId/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [bill] } = await client.query(
      `SELECT * FROM vendor_bills WHERE doc_id = $1 FOR UPDATE`, [req.params.docId]
    );
    if (!bill) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Not found' }); return; }

    const { status } = req.body;

    const { rows: [updated] } = await client.query(
      `UPDATE vendor_bills SET status = $1 WHERE vbl_id = $2 RETURNING *`,
      [status, bill.vbl_id]
    );

    // Auto-generate journal entry when posting
    if (status === 'POSTED' && bill.status !== 'POSTED') {
      await buildVendorBillJE(client, bill.vbl_id, bill.bill_date);
    }

    await client.query('COMMIT');
    res.json({ success: true, data: updated });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// POST /vendor-bills/:docId/payment — record payment against a bill
vendorBillsRouter.post('/:docId/payment', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [bill] } = await client.query(
      `SELECT * FROM vendor_bills WHERE doc_id = $1 FOR UPDATE`, [req.params.docId]
    );
    if (!bill) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Not found' }); return; }

    const { paymentDate, paymentMethod, paymentRef, amount } = req.body;

    // Insert payment record
    const { rows: [pmt] } = await client.query(`
      INSERT INTO vendor_bill_payments
        (vbl_id, vendor_id, payment_date, payment_method, payment_ref, amount, currency)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [bill.vbl_id, bill.vendor_id, paymentDate, paymentMethod ?? null,
       paymentRef ?? null, amount, bill.currency]
    );

    // Update amount_paid on bill (trigger handles status update)
    await client.query(
      `UPDATE vendor_bills SET amount_paid = amount_paid + $1 WHERE vbl_id = $2`,
      [amount, bill.vbl_id]
    );

    // Auto-generate payment journal entry
    const { rows: [vendor] } = await client.query(
      `SELECT vendor_name FROM vendors WHERE vendor_id = $1`, [bill.vendor_id]
    );
    const { buildVendorPaymentJE } = await import('../services/jeService');
    await buildVendorPaymentJE(
      client, pmt.vbp_id, paymentDate,
      parseFloat(amount), bill.currency,
      vendor.vendor_name, bill.doc_id
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: pmt });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// DELETE /vendor-bills/:docId — hard delete DRAFT only
vendorBillsRouter.delete('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: [bill] } = await pool.query(
      `SELECT vbl_id, status FROM vendor_bills WHERE doc_id = $1`, [req.params.docId]
    );
    if (!bill) { res.status(404).json({ error: 'Not found' }); return; }
    if (bill.status !== 'DRAFT') {
      res.status(400).json({ error: 'Only DRAFT bills can be deleted' }); return;
    }
    await pool.query(`DELETE FROM vendor_bills WHERE vbl_id = $1`, [bill.vbl_id]);
    res.json({ success: true, deleted: req.params.docId });
  } catch (e) { next(e); }
});
