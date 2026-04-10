// =============================================================================
// GE ERP — Journal Entry Service
// All double-entry bookkeeping logic lives here.
// Every auto-generated JE is created inside the caller's DB transaction.
// =============================================================================

import { PoolClient } from 'pg';

// ── System account codes (from GIIAVA GNUCash CoA) ───────────────────────────
export const ACC = {
  // Assets
  WISE_EUR:    '1100',
  WISE_USD:    '1110',
  AR_GOODS:    '1200',
  INVENTORY:   '1300',   // parent — used when specific product account unknown
  // Liabilities
  AP_GOODS:    '2100',
  // Revenue
  SALE_GOODS:  '4100',
  // Expenses
  COGS:        '5100',
} as const;

interface JELine {
  accountCode: string;
  debit:       number;
  credit:      number;
  description: string;
}

interface CreateJEParams {
  client:       PoolClient;
  entryDate:    string;          // YYYY-MM-DD
  description:  string;
  reference?:   string;
  sourceType:   'MANUAL' | 'VBL' | 'VPY' | 'SIV' | 'CPY' | 'ITR';
  sourceId?:    number;
  lines:        JELine[];
  postImmediately?: boolean;     // true = POSTED in same transaction
}

// ── Helper: resolve account_id from account_code ─────────────────────────────
async function getAccountId(client: PoolClient, code: string): Promise<number> {
  const { rows } = await client.query<{ account_id: number }>(
    `SELECT account_id FROM accounts WHERE account_code = $1 AND is_active = TRUE`,
    [code]
  );
  if (!rows[0]) throw new Error(`Account code '${code}' not found in chart of accounts`);
  return rows[0].account_id;
}

// ── Core JE creator ───────────────────────────────────────────────────────────
export async function createJournalEntry(params: CreateJEParams): Promise<{ je_id: number; doc_id: string }> {
  const { client, entryDate, description, reference, sourceType, sourceId, lines, postImmediately } = params;

  // Validate balance
  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal entry not balanced: debit ${totalDebit} ≠ credit ${totalCredit}`);
  }

  // Allocate doc number
  const year = new Date(entryDate).getFullYear();
  const { rows: [seq] } = await client.query<{ num: number }>(
    `SELECT next_doc_number('JnE', $1) AS num`, [year]
  );
  const docId = `GE-JnE-${String(seq.num).padStart(4, '0')}-${year}`;

  const status = postImmediately ? 'POSTED' : 'DRAFT';

  const { rows: [je] } = await client.query<{ je_id: number; doc_id: string }>(
    `INSERT INTO journal_entries
       (doc_id, doc_number, doc_year, entry_date, description, reference,
        source_type, source_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING je_id, doc_id`,
    [docId, seq.num, year, entryDate, description, reference ?? null,
     sourceType, sourceId ?? null, status]
  );

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const accountId = await getAccountId(client, l.accountCode);
    await client.query(
      `INSERT INTO journal_entry_lines (je_id, account_id, line_seq, description, debit, credit)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [je.je_id, accountId, i + 1, l.description, l.debit, l.credit]
    );
  }

  return { je_id: je.je_id, doc_id: je.doc_id };
}

// ── Auto-JE: Vendor Bill POSTED ───────────────────────────────────────────────
// GOODS bill:           Dr inventory account (from item gl_account_code)  Cr AP Goods
// DIRECT_SERVICE bill:  Dr inventory account (from linked SO's item)      Cr AP Goods
// INDIRECT_SERVICE bill:Dr expense account (from bill line gl_account_code) Cr AP Goods
export async function buildVendorBillJE(
  client:  PoolClient,
  vblId:   number,
  billDate: string,
): Promise<{ je_id: number; doc_id: string }> {

  // Fetch bill header
  const { rows: [bill] } = await client.query(
    `SELECT b.doc_id, b.total_amount, b.bill_type, b.currency, b.linked_so_id,
            v.vendor_name
       FROM vendor_bills b
       JOIN vendors v ON b.vendor_id = v.vendor_id
      WHERE b.vbl_id = $1`, [vblId]
  );

  // Fetch bill lines with their gl_account_code and item mapping
  const { rows: lines } = await client.query(
    `SELECT vll.line_seq, vll.description, vll.line_amount,
            vll.gl_account_code,
            i.gl_account_code AS item_gl_code,
            i.item_name
       FROM vendor_bill_lines vll
       LEFT JOIN items i ON vll.item_id = i.item_id
      WHERE vll.vbl_id = $1
      ORDER BY vll.line_seq`, [vblId]
  );

  const jeLines: JELine[] = [];

  for (const l of lines) {
    const amount = parseFloat(l.line_amount);
    if (amount === 0) continue;

    let debitAccount: string;

    if (bill.bill_type === 'INDIRECT_SERVICE') {
      // Use the line-level gl_account_code (set at entry time by user)
      debitAccount = l.gl_account_code ?? '6000';
    } else if (bill.bill_type === 'DIRECT_SERVICE' && bill.linked_so_id) {
      // Get the inventory account from the SO's item
      const { rows: [soItem] } = await client.query(
        `SELECT i.gl_account_code
           FROM sales_order_lines sol
           JOIN items i ON sol.item_id = i.item_id
          WHERE sol.so_id = $1 LIMIT 1`, [bill.linked_so_id]
      );
      debitAccount = soItem?.gl_account_code ?? ACC.INVENTORY;
    } else {
      // GOODS bill: use item's gl_account_code
      debitAccount = l.item_gl_code ?? ACC.INVENTORY;
    }

    jeLines.push({
      accountCode: debitAccount,
      debit:       amount,
      credit:      0,
      description: l.description ?? `${bill.vendor_name} — line ${l.line_seq}`,
    });
  }

  // Single credit to AP Goods for total
  jeLines.push({
    accountCode: ACC.AP_GOODS,
    debit:       0,
    credit:      parseFloat(bill.total_amount),
    description: `AP — ${bill.vendor_name} ${bill.doc_id}`,
  });

  const billTypeLabel = bill.bill_type === 'GOODS' ? 'Purchase'
    : bill.bill_type === 'DIRECT_SERVICE' ? 'Direct Service'
    : 'Indirect Service';

  return createJournalEntry({
    client,
    entryDate:       billDate,
    description:     `${billTypeLabel} bill: ${bill.vendor_name} (${bill.doc_id})`,
    reference:       bill.doc_id,
    sourceType:      'VBL',
    sourceId:        vblId,
    lines:           jeLines,
    postImmediately: true,
  });
}

// ── Auto-JE: Vendor Payment ───────────────────────────────────────────────────
// Dr AP Goods   Cr Bank (Wise EUR or Wise USD by currency)
export async function buildVendorPaymentJE(
  client:    PoolClient,
  vbpId:     number,
  payDate:   string,
  amount:    number,
  currency:  string,
  vendorName: string,
  docId:     string,
): Promise<{ je_id: number; doc_id: string }> {

  const bankAccount = currency === 'EUR' ? ACC.WISE_EUR : ACC.WISE_USD;

  return createJournalEntry({
    client,
    entryDate:       payDate,
    description:     `Vendor payment: ${vendorName} (${docId})`,
    reference:       docId,
    sourceType:      'VPY',
    sourceId:        vbpId,
    lines: [
      { accountCode: ACC.AP_GOODS,    debit: amount, credit: 0,      description: `Payment to ${vendorName}` },
      { accountCode: bankAccount,     debit: 0,      credit: amount, description: `Payment to ${vendorName}` },
    ],
    postImmediately: true,
  });
}

// ── Auto-JE: Fulfillment dispatched (COGS recognition) ───────────────────────
// Dr COGS   Cr Inventory account (from item gl_account_code)
export async function buildFulfillmentCOGSJE(
  client:        PoolClient,
  fulfillmentId: number,
  fulfillDate:   string,
  soDocId:       string,
): Promise<{ je_id: number; doc_id: string }> {

  // Get all inventory lot allocations for this fulfillment to calculate full capitalised cost
  const { rows: lines } = await client.query(
    `SELECT sol.description, i.gl_account_code,
            SUM(la.quantity_allocated * il.quantity_received / il.quantity_received) AS qty,
            -- cost = purchase cost + capitalised service costs (from direct service bills)
            (
              SELECT COALESCE(SUM(vll.line_amount), 0)
              FROM vendor_bill_lines vll
              JOIN vendor_bills vb ON vll.vbl_id = vb.vbl_id
              WHERE vb.linked_so_id = so.so_id
                AND vb.bill_type = 'DIRECT_SERVICE'
                AND vb.status = 'POSTED'
            ) AS service_cost,
            SUM(il.quantity_received * irl.unit_price) AS purchase_cost
       FROM fulfillments f
       JOIN sales_orders so         ON so.so_id = f.so_id
       JOIN sales_order_lines sol   ON sol.so_id = so.so_id
       JOIN items i                 ON i.item_id = sol.item_id
       JOIN shipment_lots sl        ON sl.so_id = so.so_id AND sl.fulfillment_id = f.fulfillment_id
       JOIN lot_allocations la      ON la.shipment_lot_id = sl.shipment_lot_id
       JOIN inventory_lots il       ON il.lot_id = la.inventory_lot_id
       JOIN item_receipt_lines irl  ON irl.irl_id = il.irl_id
      WHERE f.fulfillment_id = $1
      GROUP BY sol.description, i.gl_account_code, so.so_id`,
    [fulfillmentId]
  );

  const jeLines: JELine[] = [];

  for (const l of lines) {
    const totalCost = parseFloat(l.purchase_cost ?? '0') + parseFloat(l.service_cost ?? '0');
    if (totalCost === 0) continue;

    const invAccount = l.gl_account_code ?? ACC.INVENTORY;

    jeLines.push({
      accountCode: ACC.COGS,
      debit:       totalCost,
      credit:      0,
      description: `COGS — ${l.description ?? 'goods'} (SO ${soDocId})`,
    });
    jeLines.push({
      accountCode: invAccount,
      debit:       0,
      credit:      totalCost,
      description: `Inventory relief — ${l.description ?? 'goods'} (SO ${soDocId})`,
    });
  }

  if (jeLines.length === 0) {
    // No lot allocations yet — create a manual placeholder COGS entry
    jeLines.push(
      { accountCode: ACC.COGS,      debit: 0, credit: 0, description: `COGS — ${soDocId}` },
      { accountCode: ACC.INVENTORY, debit: 0, credit: 0, description: `Inventory relief — ${soDocId}` },
    );
  }

  return createJournalEntry({
    client,
    entryDate:       fulfillDate,
    description:     `COGS recognition — fulfillment ${fulfillmentId} (${soDocId})`,
    reference:       soDocId,
    sourceType:      'ITR',
    sourceId:        fulfillmentId,
    lines:           jeLines,
    postImmediately: true,
  });
}

// ── Auto-JE: Sales Invoice POSTED ────────────────────────────────────────────
// Dr AR Goods   Cr Sale of Goods
export async function buildSalesInvoiceJE(
  client:      PoolClient,
  invId:       number,
  invDate:     string,
  totalAmount: number,
  clientName:  string,
  docId:       string,
): Promise<{ je_id: number; doc_id: string }> {

  return createJournalEntry({
    client,
    entryDate:       invDate,
    description:     `Sales invoice: ${clientName} (${docId})`,
    reference:       docId,
    sourceType:      'SIV',
    sourceId:        invId,
    lines: [
      { accountCode: ACC.AR_GOODS,   debit: totalAmount, credit: 0,           description: `Invoice to ${clientName}` },
      { accountCode: ACC.SALE_GOODS, debit: 0,           credit: totalAmount, description: `Revenue — ${clientName}` },
    ],
    postImmediately: true,
  });
}

// ── Auto-JE: Client Payment ───────────────────────────────────────────────────
// Dr Bank   Cr AR Goods
export async function buildClientPaymentJE(
  client:     PoolClient,
  cipId:      number,
  payDate:    string,
  amount:     number,
  currency:   string,
  clientName: string,
  docId:      string,
): Promise<{ je_id: number; doc_id: string }> {

  const bankAccount = currency === 'EUR' ? ACC.WISE_EUR : ACC.WISE_USD;

  return createJournalEntry({
    client,
    entryDate:       payDate,
    description:     `Client payment: ${clientName} (${docId})`,
    reference:       docId,
    sourceType:      'CPY',
    sourceId:        cipId,
    lines: [
      { accountCode: bankAccount,  debit: amount, credit: 0,      description: `Payment from ${clientName}` },
      { accountCode: ACC.AR_GOODS, debit: 0,      credit: amount, description: `Payment from ${clientName}` },
    ],
    postImmediately: true,
  });
}
