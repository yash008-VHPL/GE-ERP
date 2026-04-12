import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../config/db';
import { formatDocId } from '../services/poService';

export const paymentsRouter = Router();

// GET /payments/client-invoices — list of client_invoice_payments joined to invoice and client
paymentsRouter.get('/client-invoices', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT cip.*,
             c.client_name, c.client_code,
             inv.doc_id AS inv_doc_id,
             inv.total_amount AS inv_total_amount
      FROM client_invoice_payments cip
      JOIN clients c       ON c.client_id = cip.client_id
      JOIN client_invoices inv ON inv.inv_id = cip.inv_id
      ORDER BY cip.payment_date DESC, cip.created_at DESC
    `);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// POST /payments/vendor-bill-payment — VBP (direct payment, Workflows 1 & 3)
paymentsRouter.post('/vendor-bill-payment', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vblId, amount, paymentDate, paymentMethod, paymentRef, currency, notes } = req.body;

    // Get parent bill's doc_number to inherit
    const { rows: [bill] } = await pool.query(
      'SELECT doc_number, doc_year FROM vendor_bills WHERE vbl_id = $1', [vblId]
    );
    if (!bill) { res.status(404).json({ error: 'Vendor bill not found' }); return; }

    const docId = formatDocId('VBP', bill.doc_number, bill.doc_year);
    const { rows: [vbp] } = await pool.query(
      `INSERT INTO vendor_bill_payments
         (doc_id, doc_number, doc_year, vbl_id, vendor_id, payment_date,
          payment_method, payment_ref, amount, currency, notes)
       SELECT $1, $2, $3, vbl_id, vendor_id, $4, $5, $6, $7, $8, $9
         FROM vendor_bills WHERE vbl_id = $10
       RETURNING *`,
      [docId, bill.doc_number, bill.doc_year, paymentDate,
       paymentMethod ?? null, paymentRef ?? null, amount,
       currency ?? 'USD', notes ?? null, vblId]
    );
    res.status(201).json({ success: true, data: vbp });
  } catch (e) { next(e); }
});

// POST /payments/vendor-prepayment — VPr (Workflow 2)
paymentsRouter.post('/vendor-prepayment', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { puoId, amount, paymentDate, paymentMethod, paymentRef, currency, notes } = req.body;

    const { rows: [po] } = await pool.query(
      'SELECT doc_number, doc_year, vendor_id FROM purchase_orders WHERE puo_id = $1', [puoId]
    );
    if (!po) { res.status(404).json({ error: 'Purchase order not found' }); return; }

    const docId = formatDocId('VPr', po.doc_number, po.doc_year);
    const { rows: [vpr] } = await pool.query(
      `INSERT INTO vendor_prepayments
         (doc_id, doc_number, doc_year, puo_id, vendor_id, payment_date,
          payment_method, payment_ref, amount, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [docId, po.doc_number, po.doc_year, puoId, po.vendor_id,
       paymentDate, paymentMethod ?? null, paymentRef ?? null,
       amount, currency ?? 'USD', notes ?? null]
    );
    res.status(201).json({ success: true, data: vpr });
  } catch (e) { next(e); }
});

// POST /payments/prepayment-application — VPA (Workflow 2)
paymentsRouter.post('/prepayment-application', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vblId, vprId, amountApplied, applicationDate, notes } = req.body;

    const { rows: [vpr] } = await pool.query(
      'SELECT doc_number, doc_year FROM vendor_prepayments WHERE vpr_id = $1', [vprId]
    );
    if (!vpr) { res.status(404).json({ error: 'Prepayment not found' }); return; }

    const docId = formatDocId('VPA', vpr.doc_number, vpr.doc_year);
    const { rows: [vpa] } = await pool.query(
      `INSERT INTO prepayment_applications
         (doc_id, doc_number, doc_year, vbl_id, vpr_id, application_date, amount_applied, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [docId, vpr.doc_number, vpr.doc_year, vblId, vprId,
       applicationDate, amountApplied, notes ?? null]
    );
    res.status(201).json({ success: true, data: vpa });
  } catch (e) { next(e); }
});
