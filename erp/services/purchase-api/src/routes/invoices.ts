import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../config/db';
import { formatDocId } from '../services/poService';

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

// GET /invoices — list with client_name, SO doc_id, status filter
invoicesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = 'WHERE inv.status = $1';
    }
    const { rows } = await pool.query(`
      SELECT inv.*,
             c.client_name, c.client_code,
             so.doc_id AS sao_doc_id
      FROM client_invoices inv
      JOIN clients c       ON c.client_id = inv.client_id
      LEFT JOIN sales_orders so ON so.sao_id = inv.sao_id
      ${where}
      ORDER BY inv.invoice_date DESC, inv.created_at DESC
    `, params);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /invoices/:docId — detail with lines and payments
invoicesRouter.get('/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT inv.*,
             c.client_name, c.client_code,
             c.contact_name, c.email, c.phone,
             so.doc_id AS sao_doc_id
      FROM client_invoices inv
      JOIN clients c       ON c.client_id = inv.client_id
      LEFT JOIN sales_orders so ON so.sao_id = inv.sao_id
      WHERE inv.doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT invl.*
      FROM client_invoice_lines invl
      WHERE invl.inv_id = $1
      ORDER BY invl.line_seq
    `, [rows[0].inv_id]);

    const { rows: payments } = await pool.query(`
      SELECT cip.*
      FROM client_invoice_payments cip
      WHERE cip.inv_id = $1
      ORDER BY cip.payment_date DESC
    `, [rows[0].inv_id]);

    res.json({ data: { ...rows[0], lines, payments } });
  } catch (e) { next(e); }
});

// POST /invoices — create draft from SO lines
invoicesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { saoId, invoiceDate, dueDate, currency, clientRef, notes, lines } = req.body;

    // Resolve client_id from sales order
    const { rows: [so] } = await client.query(
      `SELECT client_id FROM sales_orders WHERE sao_id = $1`, [saoId]
    );
    if (!so) { res.status(404).json({ error: 'Sales order not found' }); return; }

    const year = new Date(invoiceDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('Inv', $1) AS num`, [year]
    );
    const docId = formatDocId('Inv', seq.num, year);

    // Calculate total_amount from lines
    const totalAmount = (lines as Array<{ quantity: number; unitPrice: number }>)
      .reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unitPrice)), 0);

    const { rows: [inv] } = await client.query(`
      INSERT INTO client_invoices
        (doc_id, doc_number, doc_year, sao_id, client_id, invoice_date,
         due_date, currency, client_ref, notes, status, total_amount, amount_paid)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT',$11,0)
      RETURNING *
    `, [docId, seq.num, year, saoId, so.client_id, invoiceDate,
        dueDate ?? null, currency ?? 'USD', clientRef ?? null, notes ?? null, totalAmount]);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i] as { solId?: number; description: string; quantity: number; unitPrice: number };
      const lineAmount = Number(l.quantity) * Number(l.unitPrice);
      await client.query(`
        INSERT INTO client_invoice_lines
          (inv_id, sol_id, line_seq, description, quantity, unit_price, line_amount)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [inv.inv_id, l.solId ?? null, i + 1, l.description, l.quantity, l.unitPrice, lineAmount]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: inv });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// POST /invoices/:docId/post — set status to POSTED
invoicesRouter.post('/:docId/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `UPDATE client_invoices SET status='POSTED', updated_at=now()
       WHERE doc_id=$1 AND status='DRAFT' RETURNING *`,
      [req.params.docId]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Invoice not found or not in DRAFT status' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});

// POST /invoices/:docId/payment — record a client invoice payment
invoicesRouter.post('/:docId/payment', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { paymentDate, amount, currency, reference, notes } = req.body;

    const { rows: [inv] } = await client.query(
      `SELECT inv_id, doc_number, doc_year, client_id, total_amount, amount_paid, status
       FROM client_invoices WHERE doc_id = $1`, [req.params.docId]
    );
    if (!inv) { res.status(404).json({ error: 'Invoice not found' }); return; }
    if (inv.status === 'DRAFT') {
      res.status(400).json({ error: 'Cannot record payment on a DRAFT invoice. Post it first.' });
      return;
    }

    const year = new Date(paymentDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('CIP', $1) AS num`, [year]
    );
    const docId = formatDocId('CIP', seq.num, year);

    const { rows: [cip] } = await client.query(`
      INSERT INTO client_invoice_payments
        (doc_id, doc_number, doc_year, inv_id, client_id, payment_date,
         amount, currency, reference, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'POSTED')
      RETURNING *
    `, [docId, seq.num, year, inv.inv_id, inv.client_id, paymentDate,
        amount, currency ?? 'USD', reference ?? null, notes ?? null]);

    // Update amount_paid and status on the invoice
    const newAmountPaid = Number(inv.amount_paid) + Number(amount);
    const newStatus = newAmountPaid >= Number(inv.total_amount) ? 'PAID' : 'PARTIALLY_PAID';
    await client.query(
      `UPDATE client_invoices SET amount_paid=$1, status=$2, updated_at=now() WHERE inv_id=$3`,
      [newAmountPaid, newStatus, inv.inv_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ data: cip });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});
