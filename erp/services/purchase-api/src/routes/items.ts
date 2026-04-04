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
    const { item_code, item_name, uom, item_type } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO items (item_code, item_name, uom, item_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [item_code, item_name, uom ?? 'EA', item_type ?? 'PRODUCT']);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// PATCH /items/:id — update
itemsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { item_code, item_name, uom, item_type, is_active } = req.body;
    const { rows } = await pool.query(`
      UPDATE items SET
        item_code = COALESCE($1, item_code),
        item_name = COALESCE($2, item_name),
        uom       = COALESCE($3, uom),
        item_type = COALESCE($4, item_type),
        is_active = COALESCE($5, is_active)
      WHERE item_id = $6
      RETURNING *
    `, [item_code, item_name, uom, item_type, is_active, req.params.id]);
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
