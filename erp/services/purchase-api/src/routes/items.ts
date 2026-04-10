import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

// GET /items
itemsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM items ORDER BY item_name'
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// POST /items — create
itemsRouter.post('/', async (req, res, next) => {
  try {
    const { item_code, item_name, uom, item_type, item_usage, gl_account_code } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO items (item_code, item_name, uom, item_type, item_usage, gl_account_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [item_code, item_name, uom ?? 'EA', item_type ?? 'PRODUCT', item_usage ?? 'BOTH', gl_account_code ?? null]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// PATCH /items/:id — update
itemsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { item_code, item_name, uom, item_type, item_usage, is_active, gl_account_code } = req.body;
    const { rows } = await pool.query(`
      UPDATE items SET
        item_code        = COALESCE($1, item_code),
        item_name        = COALESCE($2, item_name),
        uom              = COALESCE($3, uom),
        item_type        = COALESCE($4, item_type),
        item_usage       = COALESCE($5, item_usage),
        is_active        = COALESCE($6, is_active),
        gl_account_code  = COALESCE($7, gl_account_code)
      WHERE item_id = $8
      RETURNING *
    `, [item_code, item_name, uom, item_type, item_usage, is_active, gl_account_code ?? null, req.params.id]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// DELETE /items/:id — hard delete (testing only)
itemsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM items WHERE item_id = $1 RETURNING item_id, item_name',
      [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, deleted: rows[0] });
  } catch (e) { next(e); }
});
