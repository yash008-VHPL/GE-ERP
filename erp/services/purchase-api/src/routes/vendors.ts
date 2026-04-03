import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

// GET /vendors — list all active vendors
vendorsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vendors ORDER BY vendor_name'
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /vendors/:id
vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vendors WHERE vendor_id = $1', [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Vendor not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// POST /vendors — create
vendorsRouter.post('/', async (req, res, next) => {
  try {
    const { vendor_code, vendor_name, credit_terms, credit_days, currency,
            contact_name, email, phone, address } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO vendors
        (vendor_code, vendor_name, credit_terms, credit_days, currency,
         contact_name, email, phone, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [vendor_code, vendor_name, credit_terms ?? false, credit_days ?? 0,
        currency ?? 'USD', contact_name ?? null, email ?? null,
        phone ?? null, address ?? null]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// PATCH /vendors/:id — update
vendorsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { vendor_code, vendor_name, credit_terms, credit_days, currency,
            contact_name, email, phone, address, is_active } = req.body;
    const { rows } = await pool.query(`
      UPDATE vendors SET
        vendor_code  = COALESCE($1, vendor_code),
        vendor_name  = COALESCE($2, vendor_name),
        credit_terms = COALESCE($3, credit_terms),
        credit_days  = COALESCE($4, credit_days),
        currency     = COALESCE($5, currency),
        contact_name = COALESCE($6, contact_name),
        email        = COALESCE($7, email),
        phone        = COALESCE($8, phone),
        address      = COALESCE($9, address),
        is_active    = COALESCE($10, is_active)
      WHERE vendor_id = $11
      RETURNING *
    `, [vendor_code, vendor_name, credit_terms, credit_days, currency,
        contact_name, email, phone, address, is_active, req.params.id]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});

// DELETE /vendors/:id — hard delete (testing only)
vendorsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM vendors WHERE vendor_id = $1 RETURNING vendor_id, vendor_name',
      [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, deleted: rows[0] });
  } catch (e) { next(e); }
});
