import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const salesOrdersRouter = Router();
salesOrdersRouter.use(requireAuth);

// GET /sales-orders
salesOrdersRouter.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await pool.query(`
      SELECT so.*, c.client_name, c.client_code
      FROM sales_orders so
      JOIN clients c ON c.client_id = so.client_id
      ${status ? 'WHERE so.status = $1' : ''}
      ORDER BY so.created_at DESC
    `, status ? [status] : []);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /sales-orders/:docId
salesOrdersRouter.get('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT so.*, c.client_name, c.client_code,
             c.contact_name, c.email, c.phone, c.address
      FROM sales_orders so
      JOIN clients c ON c.client_id = so.client_id
      WHERE so.doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT sol.*, i.item_code
      FROM sales_order_lines sol
      LEFT JOIN items i ON i.item_id = sol.item_id
      WHERE sol.sao_id = $1
      ORDER BY sol.line_seq
    `, [rows[0].sao_id]);

    res.json({ data: { ...rows[0], lines } });
  } catch (e) { next(e); }
});

// POST /sales-orders
salesOrdersRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { clientId, workflow, orderDate, expectedDate, currency, notes, lines } = req.body;
    const year = new Date(orderDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('SaO', $1) AS num`, [year]
    );
    const docId = `GE-SaO-${String(seq.num).padStart(4,'0')}-${year}`;

    const { rows: [so] } = await client.query(`
      INSERT INTO sales_orders (doc_id, doc_number, doc_year, client_id, workflow,
        order_date, expected_date, currency, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT') RETURNING *
    `, [docId, seq.num, year, clientId, workflow,
        orderDate, expectedDate ?? null, currency, notes ?? null]);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await client.query(`
        INSERT INTO sales_order_lines (sao_id, line_seq, item_id, description, quantity, unit_price, uom)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [so.sao_id, i+1, l.itemId ?? null, l.description, l.quantity, l.unitPrice, l.uom ?? null]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: so });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// DELETE /sales-orders/:docId — hard delete (testing only)
salesOrdersRouter.delete('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM sales_orders WHERE doc_id = $1 RETURNING doc_id`,
      [req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: { deleted: rows[0].doc_id } });
  } catch (e) { next(e); }
});

// PATCH /sales-orders/:docId/status
salesOrdersRouter.patch('/:docId/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE sales_orders SET status=$1, updated_at=now() WHERE doc_id=$2 RETURNING *`,
      [req.body.status, req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});
