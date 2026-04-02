import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const vendorsRouter = Router();

vendorsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vendors WHERE is_active = TRUE ORDER BY vendor_name'
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

vendorsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vendors WHERE vendor_id = $1', [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Vendor not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
