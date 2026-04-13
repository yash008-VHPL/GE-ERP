import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../config/db';

export const amendmentsRouter = Router();
amendmentsRouter.use(requireAuth);

// GET /amendments?docId=GE-ItF-0001-2025
// GET /amendments?table=item_fulfillments&recordId=5
amendmentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table, recordId, docId } = req.query;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (docId) {
      params.push(docId);
      where += ` AND doc_id = $${idx++}`;
    } else {
      if (table) { params.push(table); where += ` AND table_name = $${idx++}`; }
      if (recordId) { params.push(recordId); where += ` AND record_id = $${idx++}`; }
    }

    const { rows } = await pool.query(
      `SELECT * FROM record_amendments ${where} ORDER BY changed_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});
