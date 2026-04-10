import { Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

export const itemReceiptsRouter = Router();
itemReceiptsRouter.use(requireAuth);

// GET /item-receipts
itemReceiptsRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ir.itr_id, ir.doc_id,
        po.doc_id   AS puo_doc_id,
        v.vendor_name,
        ir.receipt_date, ir.status, ir.notes
      FROM item_receipts ir
      JOIN purchase_orders po ON po.puo_id = ir.puo_id
      JOIN vendors v          ON v.vendor_id = po.vendor_id
      ORDER BY ir.created_at DESC
    `);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// GET /item-receipts/:docId
itemReceiptsRouter.get('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ir.*, po.doc_id AS puo_doc_id, v.vendor_name
      FROM item_receipts ir
      JOIN purchase_orders po ON po.puo_id = ir.puo_id
      JOIN vendors v          ON v.vendor_id = po.vendor_id
      WHERE ir.doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT irl.*, pol.description, i.item_code, i.uom
      FROM item_receipt_lines irl
      JOIN purchase_order_lines pol ON pol.pol_id = irl.pol_id
      LEFT JOIN items i             ON i.item_id  = pol.item_id
      WHERE irl.itr_id = $1
      ORDER BY irl.line_seq
    `, [rows[0].itr_id]);

    res.json({ data: { ...rows[0], lines } });
  } catch (e) { next(e); }
});

// POST /item-receipts
itemReceiptsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { puoId, receiptDate, notes, lines } = req.body;

    // Get next doc number for ItR series
    const year = new Date(receiptDate).getFullYear();
    const { rows: [seq] } = await client.query(
      `SELECT next_doc_number('ItR', $1) AS num`, [year]
    );

    // Get vendor_id from the PO (required NOT NULL on item_receipts)
    const { rows: [po] } = await client.query(
      `SELECT vendor_id FROM purchase_orders WHERE puo_id = $1`, [puoId]
    );
    if (!po) throw new Error(`Purchase order ${puoId} not found`);

    const docId = `GE-ItR-${String(seq.num).padStart(4,'0')}-${year}`;

    const { rows: [itr] } = await client.query(`
      INSERT INTO item_receipts (doc_id, doc_number, doc_year, puo_id, vendor_id, receipt_date, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
      RETURNING *
    `, [docId, seq.num, year, puoId, po.vendor_id, receiptDate, notes ?? null]);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.quantityReceived || l.quantityReceived <= 0) continue;
      // Pull unit_price from the PO line (required NOT NULL on receipt lines)
      await client.query(`
        INSERT INTO item_receipt_lines
          (itr_id, pol_id, line_seq, qty_received, unit_price, batch_number, production_date)
        VALUES ($1, $2, $3, $4,
                (SELECT unit_price FROM purchase_order_lines WHERE pol_id = $2),
                $5, $6)
      `, [itr.itr_id, l.polId, i + 1, l.quantityReceived, l.batchNumber ?? null, l.productionDate ?? null]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: itr });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// DELETE /item-receipts/:docId — hard delete (testing only)
itemReceiptsRouter.delete('/:docId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM item_receipts WHERE doc_id = $1 RETURNING doc_id`,
      [req.params.docId]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ data: { deleted: rows[0].doc_id } });
  } catch (e) { next(e); }
});

// PATCH /item-receipts/:docId/status
// When confirming (DRAFT → CONFIRMED):
//   - Requires vendorBatchRef in body (optional) and spFolderUrl (SharePoint folder)
//   - Auto-generates: docket number (GE-DCK-NNNN-YYYY) and lot numbers (GE-IB-NNNN-YYYY)
//   - Creates one inventory_lot per receipt line
//   - Triggers DB trigger to update PO qty_received
itemReceiptsRouter.patch('/:docId/status', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { status, vendorBatchRef, spFolderUrl } = req.body;

    const { rows: [itr] } = await client.query(
      `SELECT ir.*, po.vendor_id
         FROM item_receipts ir
         JOIN purchase_orders po ON po.puo_id = ir.puo_id
        WHERE ir.doc_id = $1`, [req.params.docId]
    );
    if (!itr) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Not found' }); return; }

    // Update status (DB trigger fires here to roll up qty_received on PO lines)
    const { rows: [updated] } = await client.query(
      `UPDATE item_receipts SET status = $1 WHERE itr_id = $2 RETURNING *`,
      [status, itr.itr_id]
    );

    // When confirming, create inward inventory lots (one per receipt line)
    if (status === 'CONFIRMED' && itr.status === 'DRAFT') {
      const year = new Date(itr.receipt_date).getFullYear();

      // Allocate a single docket number for this receipt
      const { rows: [dckSeq] } = await client.query(
        `SELECT next_doc_number('DCK', $1) AS num`, [year]
      );
      const docketNumber = `GE-DCK-${String(dckSeq.num).padStart(4,'0')}-${year}`;

      // Fetch lines with item info
      const { rows: lines } = await client.query(`
        SELECT irl.irl_id, irl.qty_received, irl.unit_price,
               pol.item_id, i.uom
          FROM item_receipt_lines irl
          JOIN purchase_order_lines pol ON pol.pol_id = irl.pol_id
          LEFT JOIN items i             ON i.item_id  = pol.item_id
         WHERE irl.itr_id = $1
         ORDER BY irl.line_seq`, [itr.itr_id]
      );

      for (const line of lines) {
        if (!line.item_id) continue; // skip lines without an item

        const { rows: [ibSeq] } = await client.query(
          `SELECT next_doc_number('IB', $1) AS num`, [year]
        );
        const lotNumber = `GE-IB-${String(ibSeq.num).padStart(4,'0')}-${year}`;

        await client.query(`
          INSERT INTO inventory_lots
            (lot_number, docket_number, itr_id, irl_id, item_id, vendor_id,
             quantity_received, quantity_available, uom,
             vendor_batch_ref, sharepoint_folder, received_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11)`,
          [
            lotNumber, docketNumber, itr.itr_id, line.irl_id,
            line.item_id, itr.vendor_id,
            line.qty_received,
            line.uom ?? 'MT',
            vendorBatchRef ?? null,
            spFolderUrl ?? null,
            itr.receipt_date,
          ]
        );
      }

      await client.query('COMMIT');
      res.json({ data: { ...updated, docket_number: docketNumber } });
    } else {
      await client.query('COMMIT');
      res.json({ data: updated });
    }
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});
