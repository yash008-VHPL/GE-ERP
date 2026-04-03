import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const itemReceiptsRouter = Router();
itemReceiptsRouter.use(requireAuth);

// GET /item-receipts
itemReceiptsRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ir.itr_id, ir.doc_id,
        po.doc_id   AS puo_doc_id,
        v.vendor_name,
        ir.receipt_date, ir.status, ir.notes
      FROM item_receipts ir
      JOIN purchase_orders po ON po.puo_id = ir.puo_id
      JOIN vendors v          ON v.vendor_id = po.vendor_id
      ORDER BY ir.created_at DESC
    `);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /item-receipts/:docId
itemReceiptsRouter.get('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ir.*, po.doc_id AS puo_doc_id, v.vendor_name
      FROM item_receipts ir
      JOIN purchase_orders po ON po.puo_id = ir.puo_id
      JOIN vendors v          ON v.vendor_id = po.vendor_id
      WHERE ir.doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT irl.*, pol.description, pol.item_code, pol.uom
      FROM item_receipt_lines irl
      JOIN purchase_order_lines pol ON pol.pol_id = irl.pol_id
      WHERE irl.itr_id = $1
      ORDER BY irl.line_seq
    `, [rows[0].itr_id]);

    res.json({ data: { ...rows[0], lines } });
  } catch (e) { next(e); }
});

// POST /item-receipts
itemReceiptsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { puoId, receiptDate, notes, lines } = req.body;

    // Get next doc number
    const year = new Date(receiptDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('ItR', $1) AS num`, [year]
    );

    // Get the PO's doc_number to inherit chain
    const { rows: [po] } = await client.query(
      `SELECT doc_number FROM purchase_orders WHERE puo_id = $1`, [puoId]
    );

    const docId = `GE-ItR-${String(po.doc_number).padStart(4,'0')}-${year}`;

    const { rows: [itr] } = await client.query(`
      INSERT INTO item_receipts (doc_id, doc_number, doc_year, puo_id, receipt_date, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
      RETURNING *
    `, [docId, seq.num, year, puoId, receiptDate, notes ?? null]);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.quantityReceived || l.quantityReceived <= 0) continue;
      await client.query(`
        INSERT INTO item_receipt_lines
          (itr_id, pol_id, line_seq, quantity_received, batch_number, production_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [itr.itr_id, l.polId, i + 1, l.quantityReceived, l.batchNumber ?? null, l.productionDate ?? null]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: itr });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// PATCH /item-receipts/:docId/status
itemReceiptsRouter.patch('/:docId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      `UPDATE item_receipts SET status = $1, updated_at = now()
       WHERE doc_id = $2 RETURNING *`,
      [status, req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});
