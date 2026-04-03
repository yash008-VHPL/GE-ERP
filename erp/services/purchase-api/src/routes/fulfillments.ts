import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const fulfillmentsRouter = Router();
fulfillmentsRouter.use(requireAuth);

// GET /fulfillments
fulfillmentsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT itf.*, so.doc_id AS sao_doc_id, c.client_name
      FROM item_fulfillments itf
      JOIN sales_orders so ON so.sao_id = itf.sao_id
      JOIN clients c       ON c.client_id = so.client_id
      ORDER BY itf.created_at DESC
    `);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /fulfillments/:docId
fulfillmentsRouter.get('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT itf.*, so.doc_id AS sao_doc_id, c.client_name
      FROM item_fulfillments itf
      JOIN sales_orders so ON so.sao_id = itf.sao_id
      JOIN clients c       ON c.client_id = so.client_id
      WHERE itf.doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT itfl.*, sol.description, sol.uom
      FROM item_fulfillment_lines itfl
      JOIN sales_order_lines sol ON sol.sol_id = itfl.sol_id
      WHERE itfl.itf_id = $1 ORDER BY itfl.line_seq
    `, [rows[0].itf_id]);

    res.json({ data: { ...rows[0], lines } });
  } catch (e) { next(e); }
});

// POST /fulfillments
fulfillmentsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { saoId, fulfillmentDate, notes, lines } = req.body;

    const { rows: [so] } = await client.query(
      `SELECT doc_number, doc_year FROM sales_orders WHERE sao_id = $1`, [saoId]
    );
    const year = new Date(fulfillmentDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('ItF', $1) AS num`, [year]
    );
    const docId = `GE-ItF-${String(so.doc_number).padStart(4,'0')}-${year}`;

    const { rows: [itf] } = await client.query(`
      INSERT INTO item_fulfillments (doc_id, doc_number, doc_year, sao_id, fulfillment_date, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING *
    `, [docId, seq.num, year, saoId, fulfillmentDate, notes ?? null]);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.quantityFulfilled || l.quantityFulfilled <= 0) continue;
      await client.query(`
        INSERT INTO item_fulfillment_lines (itf_id, sol_id, line_seq, quantity_fulfilled, batch_number, production_date)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [itf.itf_id, l.solId, i+1, l.quantityFulfilled, l.batchNumber ?? null, l.productionDate ?? null]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: itf });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// PATCH /fulfillments/:docId/status
fulfillmentsRouter.patch('/:docId/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE item_fulfillments SET status=$1, updated_at=now() WHERE doc_id=$2 RETURNING *`,
      [req.body.status, req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});
