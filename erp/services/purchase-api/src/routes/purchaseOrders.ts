import { Router, Request, Response, NextFunction } from 'express';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { requireAuth } from '../middleware/auth';
import { pool } from '../config/db';
import * as poService from '../services/poService';
import { PODocument } from '../templates/PODocument';
import { config } from '../config/env';

export const purchaseOrdersRouter = Router();

// GET /purchase-orders — list with vendor name, status filter
purchaseOrdersRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, vendor_id, year } = req.query;
    let query = `
      SELECT p.*, v.vendor_name, v.vendor_code
        FROM purchase_orders p
        JOIN vendors v ON p.vendor_id = v.vendor_id
       WHERE 1=1`;
    const params: unknown[] = [];

    if (status)    { params.push(status);    query += ` AND p.status = $${params.length}`; }
    if (vendor_id) { params.push(vendor_id); query += ` AND p.vendor_id = $${params.length}`; }
    if (year)      { params.push(year);      query += ` AND p.doc_year = $${params.length}`; }

    query += ' ORDER BY p.doc_year DESC, p.doc_number DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /purchase-orders/:docId — single PO with lines
purchaseOrdersRouter.get('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await poService.getPurchaseOrder(req.params.docId);
    if (!po) { res.status(404).json({ error: 'Purchase order not found' }); return; }
    res.json({ success: true, data: po });
  } catch (e) { next(e); }
});

// POST /purchase-orders — create new PO
purchaseOrdersRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await poService.createPurchaseOrder(req.body);
    res.status(201).json({ success: true, data: po });
  } catch (e) { next(e); }
});

// PATCH /purchase-orders/:docId/status — update status only (triggers handle cascade)
purchaseOrdersRouter.patch('/:docId/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      `UPDATE purchase_orders SET status = $1 WHERE doc_id = $2 RETURNING *`,
      [status, req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// DELETE /purchase-orders/:docId — hard delete (admin only)
// Cascades: receipt lines → receipts → PO lines → PO
// Any vendor bills that reference the PO have their puo_id nullified (bills are financial records)
purchaseOrdersRouter.delete('/:docId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve puo_id
    const { rows: poRows } = await client.query(
      `SELECT puo_id FROM purchase_orders WHERE doc_id = $1`,
      [req.params.docId]
    );
    if (!poRows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const puoId = poRows[0].puo_id;

    // 1. Delete item receipt lines for any receipts on this PO
    await client.query(
      `DELETE FROM item_receipt_lines
         WHERE itr_id IN (SELECT itr_id FROM item_receipts WHERE puo_id = $1)`,
      [puoId]
    );

    // 2. Delete item receipts
    await client.query(`DELETE FROM item_receipts WHERE puo_id = $1`, [puoId]);

    // 3. Detach any vendor bills (keep the bill, just unlink the PO)
    await client.query(
      `UPDATE vendor_bills SET puo_id = NULL WHERE puo_id = $1`,
      [puoId]
    );

    // 4. Delete PO lines
    await client.query(`DELETE FROM purchase_order_lines WHERE puo_id = $1`, [puoId]);

    // 5. Delete the PO
    await client.query(`DELETE FROM purchase_orders WHERE puo_id = $1`, [puoId]);

    await client.query('COMMIT');
    res.json({ success: true, deleted: req.params.docId });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// GET /purchase-orders/:docId/pdf — stream PDF to browser
purchaseOrdersRouter.get('/:docId/pdf', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await poService.getPurchaseOrder(req.params.docId);
    if (!po) { res.status(404).json({ error: 'Purchase order not found' }); return; }

    let stream;
    try {
      const element = React.createElement(PODocument, { po });
      stream = await renderToStream(element as Parameters<typeof renderToStream>[0]);
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      console.error('[PDF] renderToStream failed:', renderErr);
      res.status(500).json({ error: `PDF render error: ${msg}` });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${po.doc_id}.pdf"`);
    stream.pipe(res);
  } catch (e) { next(e); }
});
