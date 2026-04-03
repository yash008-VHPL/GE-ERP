import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

// GET /clients
clientsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clients ORDER BY client_name'
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /clients/:id
clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clients WHERE client_id = $1', [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});

// POST /clients — create
clientsRouter.post('/', async (req, res, next) => {
  try {
    const { client_code, client_name, credit_terms, credit_days, currency,
            contact_name, email, phone, address } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO clients
        (client_code, client_name, credit_terms, credit_days, currency,
         contact_name, email, phone, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [client_code, client_name, credit_terms ?? true, credit_days ?? 30,
        currency ?? 'USD', contact_name ?? null, email ?? null,
        phone ?? null, address ?? null]);
    res.status(201).json({ data: rows[0] });
  } catch (e) { next(e); }
});

// PATCH /clients/:id — update
clientsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { client_code, client_name, credit_terms, credit_days, currency,
            contact_name, email, phone, address, is_active } = req.body;
    const { rows } = await pool.query(`
      UPDATE clients SET
        client_code  = COALESCE($1, client_code),
        client_name  = COALESCE($2, client_name),
        credit_terms = COALESCE($3, credit_terms),
        credit_days  = COALESCE($4, credit_days),
        currency     = COALESCE($5, currency),
        contact_name = COALESCE($6, contact_name),
        email        = COALESCE($7, email),
        phone        = COALESCE($8, phone),
        address      = COALESCE($9, address),
        is_active    = COALESCE($10, is_active)
      WHERE client_id = $11
      RETURNING *
    `, [client_code, client_name, credit_terms, credit_days, currency,
        contact_name, email, phone, address, is_active, req.params.id]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});

// DELETE /clients/:id — hard delete (testing only)
clientsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM clients WHERE client_id = $1 RETURNING client_id, client_name',
      [req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: { deleted: rows[0] } });
  } catch (e) { next(e); }
});
