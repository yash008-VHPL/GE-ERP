// =============================================================================
// GE ERP — Inventory Lots Router
// Inward lots (IB), outward/shipment lots (OB), allocations
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool }        from '../config/db';

export const inventoryLotsRouter = Router();
inventoryLotsRouter.use(requireAuth);

// =============================================================================
// INWARD LOTS
// =============================================================================

// GET /inventory-lots — list all inward lots
inventoryLotsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, item_id } = req.query;
    let query = `
      SELECT il.*,
             i.item_code, i.item_name, i.uom AS item_uom,
             v.vendor_name,
             ir.doc_id AS receipt_doc_id
        FROM inventory_lots il
        JOIN items i         ON i.item_id    = il.item_id
        JOIN vendors v       ON v.vendor_id  = il.vendor_id
        JOIN item_receipts ir ON ir.itr_id   = il.itr_id
       WHERE 1=1`;
    const params: unknown[] = [];
    if (status)  { params.push(status);  query += ` AND il.status = $${params.length}`; }
    if (item_id) { params.push(item_id); query += ` AND il.item_id = $${params.length}`; }
    query += ' ORDER BY il.received_date DESC, il.lot_id DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /inventory-lots/:lotNumber — single lot with allocations
inventoryLotsRouter.get('/:lotNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: [lot] } = await pool.query(`
      SELECT il.*,
             i.item_code, i.item_name, i.uom AS item_uom,
             v.vendor_name,
             ir.doc_id AS receipt_doc_id
        FROM inventory_lots il
        JOIN items i          ON i.item_id   = il.item_id
        JOIN vendors v        ON v.vendor_id = il.vendor_id
        JOIN item_receipts ir ON ir.itr_id   = il.itr_id
       WHERE il.lot_number = $1`, [req.params.lotNumber]
    );
    if (!lot) { res.status(404).json({ error: 'Lot not found' }); return; }

    // Allocations (which shipments used this lot)
    const { rows: allocations } = await pool.query(`
      SELECT la.*, sl.lot_number AS shipment_lot_number, sl.status AS shipment_status,
             so.doc_id AS so_doc_id
        FROM lot_allocations la
        JOIN shipment_lots sl ON sl.shipment_lot_id = la.shipment_lot_id
        JOIN sales_orders so  ON so.sao_id = sl.sao_id
       WHERE la.inventory_lot_id = $1
       ORDER BY la.allocated_at`, [lot.lot_id]
    );

    res.json({ success: true, data: { ...lot, allocations } });
  } catch (e) { next(e); }
});

// PATCH /inventory-lots/:lotNumber — update vendor_batch_ref or notes
inventoryLotsRouter.patch('/:lotNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorBatchRef, notes } = req.body;
    const { rows: [lot] } = await pool.query(`
      UPDATE inventory_lots
         SET vendor_batch_ref = COALESCE($1, vendor_batch_ref),
             notes            = COALESCE($2, notes)
       WHERE lot_number = $3
      RETURNING *`, [vendorBatchRef ?? null, notes ?? null, req.params.lotNumber]
    );
    if (!lot) { res.status(404).json({ error: 'Lot not found' }); return; }
    res.json({ success: true, data: lot });
  } catch (e) { next(e); }
});

// =============================================================================
// SHIPMENT (OUTWARD) LOTS
// =============================================================================

// GET /inventory-lots/shipments/list — list shipment lots
inventoryLotsRouter.get('/shipments/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sao_id, status } = req.query;
    let query = `
      SELECT sl.*,
             i.item_code, i.item_name,
             so.doc_id AS so_doc_id,
             c.client_name
        FROM shipment_lots sl
        JOIN items i        ON i.item_id = sl.item_id
        JOIN sales_orders so ON so.sao_id = sl.sao_id
        JOIN clients c      ON c.client_id = so.client_id
       WHERE 1=1`;
    const params: unknown[] = [];
    if (sao_id) { params.push(sao_id); query += ` AND sl.sao_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND sl.status = $${params.length}`; }
    query += ' ORDER BY sl.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// POST /inventory-lots/shipments — create outward lot (manually assigned number)
inventoryLotsRouter.post('/shipments', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { lotNumber, soId, itemId, quantity, uom, notes, allocations } = req.body;
    // allocations = [{ inventoryLotId, quantityAllocated }]

    // Validate total allocation matches quantity
    const totalAlloc = (allocations ?? []).reduce((s: number, a: { quantityAllocated: number }) => s + a.quantityAllocated, 0);
    if (Math.abs(totalAlloc - quantity) > 0.001) {
      throw new Error(`Allocation total ${totalAlloc} does not match shipment quantity ${quantity}`);
    }

    // Check each inventory lot has sufficient availability
    for (const a of (allocations ?? [])) {
      const { rows: [il] } = await client.query(
        `SELECT lot_number, quantity_available FROM inventory_lots WHERE lot_id = $1 FOR UPDATE`,
        [a.inventoryLotId]
      );
      if (!il) throw new Error(`Inventory lot ${a.inventoryLotId} not found`);
      if (il.quantity_available < a.quantityAllocated) {
        throw new Error(`Lot ${il.lot_number} only has ${il.quantity_available} available, requested ${a.quantityAllocated}`);
      }
    }

    // Create shipment lot
    const { rows: [sl] } = await client.query(`
      INSERT INTO shipment_lots (lot_number, sao_id, item_id, quantity, uom, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [lotNumber, soId, itemId, quantity, uom ?? 'MT', notes ?? null]
    );

    // Create allocations and decrement inventory
    for (const a of (allocations ?? [])) {
      await client.query(
        `INSERT INTO lot_allocations (shipment_lot_id, inventory_lot_id, quantity_allocated)
         VALUES ($1,$2,$3)`,
        [sl.shipment_lot_id, a.inventoryLotId, a.quantityAllocated]
      );

      // Decrement quantity_available
      await client.query(`
        UPDATE inventory_lots
           SET quantity_available = quantity_available - $1,
               status = CASE
                 WHEN quantity_available - $1 <= 0 THEN 'FULLY_USED'
                 ELSE 'PARTIALLY_USED'
               END
         WHERE lot_id = $2`, [a.quantityAllocated, a.inventoryLotId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: sl });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// GET /inventory-lots/shipments/:lotNumber — single shipment lot with allocations
inventoryLotsRouter.get('/shipments/:lotNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: [sl] } = await pool.query(`
      SELECT sl.*,
             i.item_code, i.item_name,
             so.doc_id AS so_doc_id,
             c.client_name
        FROM shipment_lots sl
        JOIN items i         ON i.item_id  = sl.item_id
        JOIN sales_orders so ON so.so_id   = sl.so_id
        JOIN clients c       ON c.client_id = so.client_id
       WHERE sl.lot_number = $1`, [req.params.lotNumber]
    );
    if (!sl) { res.status(404).json({ error: 'Shipment lot not found' }); return; }

    const { rows: allocations } = await pool.query(`
      SELECT la.*, il.lot_number AS inward_lot_number, il.vendor_batch_ref,
             v.vendor_name, il.received_date
        FROM lot_allocations la
        JOIN inventory_lots il ON il.lot_id     = la.inventory_lot_id
        JOIN vendors v         ON v.vendor_id   = il.vendor_id
       WHERE la.shipment_lot_id = $1
       ORDER BY la.allocated_at`, [sl.shipment_lot_id]
    );

    res.json({ success: true, data: { ...sl, allocations } });
  } catch (e) { next(e); }
});
