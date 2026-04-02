import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const itemsRouter = Router();

itemsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM items WHERE is_active = TRUE ORDER BY item_name'
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
