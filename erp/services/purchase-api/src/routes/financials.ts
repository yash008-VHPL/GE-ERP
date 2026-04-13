// =============================================================================
// GE ERP — Financials Router
// Chart of Accounts, Journal Entries, General Ledger, Trial Balance,
// Balance Sheet, P&L
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool }        from '../config/db';
import { createJournalEntry } from '../services/jeService';

export const financialsRouter = Router();
financialsRouter.use(requireAuth);

// =============================================================================
// CHART OF ACCOUNTS
// =============================================================================

// GET /financials/accounts
financialsRouter.get('/accounts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.account_name AS parent_name
        FROM accounts a
        LEFT JOIN accounts p ON p.account_code = a.parent_code
       ORDER BY a.account_code
    `);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// POST /financials/accounts
financialsRouter.post('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountCode, accountName, accountType, normalBalance, parentCode, gnucashType } = req.body;
    const { rows: [row] } = await pool.query(`
      INSERT INTO accounts (account_code, account_name, account_type, normal_balance, parent_code, gnucash_type)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [accountCode, accountName, accountType, normalBalance, parentCode ?? null, gnucashType ?? null]
    );
    res.status(201).json({ success: true, data: row });
  } catch (e) { next(e); }
});

// PATCH /financials/accounts/:code
financialsRouter.patch('/accounts/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountName, isActive } = req.body;
    const { rows: [row] } = await pool.query(`
      UPDATE accounts
         SET account_name = COALESCE($1, account_name),
             is_active    = COALESCE($2, is_active)
       WHERE account_code = $3
      RETURNING *`,
      [accountName ?? null, isActive ?? null, req.params.code]
    );
    if (!row) { res.status(404).json({ error: 'Account not found' }); return; }
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

// =============================================================================
// JOURNAL ENTRIES
// =============================================================================

// GET /financials/journal-entries
financialsRouter.get('/journal-entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, from, to, source_type } = req.query;
    let query = `
      SELECT je.*,
             COALESCE(SUM(jel.debit),  0) AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
        FROM journal_entries je
        LEFT JOIN journal_entry_lines jel ON jel.je_id = je.je_id
       WHERE 1=1`;
    const params: unknown[] = [];
    if (status)      { params.push(status);      query += ` AND je.status = $${params.length}`; }
    if (from)        { params.push(from);         query += ` AND je.entry_date >= $${params.length}`; }
    if (to)          { params.push(to);           query += ` AND je.entry_date <= $${params.length}`; }
    if (source_type) { params.push(source_type);  query += ` AND je.source_type = $${params.length}`; }
    query += ' GROUP BY je.je_id ORDER BY je.entry_date DESC, je.je_id DESC';
    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /financials/journal-entries/:docId
financialsRouter.get('/journal-entries/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: [je] } = await pool.query(
      `SELECT * FROM journal_entries WHERE doc_id = $1`, [req.params.docId]
    );
    if (!je) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: lines } = await pool.query(`
      SELECT jel.*, a.account_code, a.account_name, a.account_type
        FROM journal_entry_lines jel
        JOIN accounts a ON a.account_id = jel.account_id
       WHERE jel.je_id = $1
       ORDER BY jel.line_seq`, [je.je_id]
    );
    res.json({ success: true, data: { ...je, lines } });
  } catch (e) { next(e); }
});

// POST /financials/journal-entries — create manual DRAFT entry
financialsRouter.post('/journal-entries', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { entryDate, description, reference, lines } = req.body;
    const result = await createJournalEntry({
      client,
      entryDate,
      description,
      reference,
      sourceType:      'MANUAL',
      lines,
      postImmediately: false,
    });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: result });
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// POST /financials/journal-entries/:docId/post — post a DRAFT JE
financialsRouter.post('/journal-entries/:docId/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Re-validate balance before posting
    const { rows: [je] } = await pool.query(
      `SELECT * FROM journal_entries WHERE doc_id = $1`, [req.params.docId]
    );
    if (!je)                        { res.status(404).json({ error: 'Not found' }); return; }
    if (je.status === 'POSTED')     { res.json({ success: true, data: je }); return; }

    const { rows: [bal] } = await pool.query(
      `SELECT SUM(debit) AS td, SUM(credit) AS tc FROM journal_entry_lines WHERE je_id = $1`,
      [je.je_id]
    );
    if (Math.abs(parseFloat(bal.td ?? '0') - parseFloat(bal.tc ?? '0')) > 0.001) {
      res.status(400).json({ error: `Entry not balanced: debit ${bal.td} ≠ credit ${bal.tc}` });
      return;
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE journal_entries SET status = 'POSTED' WHERE je_id = $1 RETURNING *`, [je.je_id]
    );
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// =============================================================================
// GENERAL LEDGER
// =============================================================================

// GET /financials/general-ledger?account_code=1100&from=2026-01-01&to=2026-12-31
financialsRouter.get('/general-ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_code, from, to } = req.query;
    if (!account_code) { res.status(400).json({ error: 'account_code required' }); return; }

    const { rows: [acct] } = await pool.query(
      `SELECT * FROM accounts WHERE account_code = $1`, [account_code]
    );
    if (!acct) { res.status(404).json({ error: 'Account not found' }); return; }

    // Opening balance = all posted transactions before 'from'
    let openingBalance = 0;
    if (from) {
      const { rows: [ob] } = await pool.query(`
        SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0) AS balance
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.je_id = jel.je_id
         WHERE jel.account_id = $1
           AND je.status = 'POSTED'
           AND je.entry_date < $2`, [acct.account_id, from]
      );
      openingBalance = parseFloat(ob.balance);
    }

    // Transactions in range
    const params: unknown[] = [acct.account_id];
    let lineQuery = `
      SELECT jel.jel_id, je.entry_date, je.doc_id, je.description AS je_description,
             je.source_type, je.source_id,
             jel.description AS line_description,
             jel.debit, jel.credit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.je_id = jel.je_id
       WHERE jel.account_id = $1
         AND je.status = 'POSTED'`;
    if (from) { params.push(from); lineQuery += ` AND je.entry_date >= $${params.length}`; }
    if (to)   { params.push(to);   lineQuery += ` AND je.entry_date <= $${params.length}`; }
    lineQuery += ' ORDER BY je.entry_date, je.je_id, jel.line_seq';

    const { rows: lines } = await pool.query(lineQuery, params);

    // Add running balance
    let running = openingBalance;
    const withBalance = lines.map(l => {
      running += parseFloat(l.debit) - parseFloat(l.credit);
      return { ...l, running_balance: running };
    });

    res.json({
      success: true,
      data: {
        account: acct,
        opening_balance: openingBalance,
        lines: withBalance,
        closing_balance: running,
      },
    });
  } catch (e) { next(e); }
});

// =============================================================================
// TRIAL BALANCE
// =============================================================================

// GET /financials/trial-balance?as_of=2026-12-31
financialsRouter.get('/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { as_of } = req.query;
    const params: unknown[] = [];
    let dateFilter = '';
    if (as_of) { params.push(as_of); dateFilter = `AND je.entry_date <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
          a.account_code,
          a.account_name,
          a.account_type,
          a.normal_balance,
          COALESCE(SUM(jel.debit),  0) AS total_debit,
          COALESCE(SUM(jel.credit), 0) AS total_credit,
          CASE a.normal_balance
              WHEN 'DR' THEN COALESCE(SUM(jel.debit),  0) - COALESCE(SUM(jel.credit), 0)
              WHEN 'CR' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit),  0)
          END AS balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON jel.account_id = a.account_id
        LEFT JOIN journal_entries je      ON je.je_id = jel.je_id
            AND je.status = 'POSTED' ${dateFilter}
       WHERE a.is_active = TRUE
       GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.normal_balance
      HAVING COALESCE(SUM(jel.debit), 0) + COALESCE(SUM(jel.credit), 0) > 0
       ORDER BY a.account_code
    `, params);

    const totalDebit  = rows.reduce((s, r) => s + parseFloat(r.total_debit),  0);
    const totalCredit = rows.reduce((s, r) => s + parseFloat(r.total_credit), 0);

    res.json({
      success: true,
      data: { rows, total_debit: totalDebit, total_credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 },
    });
  } catch (e) { next(e); }
});

// =============================================================================
// BALANCE SHEET
// =============================================================================

// GET /financials/balance-sheet?as_of=2026-12-31
financialsRouter.get('/balance-sheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { as_of } = req.query;
    const params: unknown[] = [];
    let dateFilter = '';
    if (as_of) { params.push(as_of); dateFilter = `AND je.entry_date <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
          a.account_code, a.account_name, a.account_type, a.normal_balance,
          CASE a.normal_balance
              WHEN 'DR' THEN COALESCE(SUM(jel.debit),  0) - COALESCE(SUM(jel.credit), 0)
              WHEN 'CR' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit),  0)
          END AS balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON jel.account_id = a.account_id
        LEFT JOIN journal_entries je      ON je.je_id = jel.je_id
            AND je.status = 'POSTED' ${dateFilter}
       WHERE a.is_active = TRUE
         AND a.account_type IN ('ASSET','LIABILITY','EQUITY')
       GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.normal_balance
      HAVING COALESCE(SUM(jel.debit), 0) + COALESCE(SUM(jel.credit), 0) > 0
       ORDER BY a.account_code
    `, params);

    const sections: Record<string, { accounts: typeof rows; total: number }> = {
      ASSET:     { accounts: [], total: 0 },
      LIABILITY: { accounts: [], total: 0 },
      EQUITY:    { accounts: [], total: 0 },
    };
    for (const r of rows) {
      sections[r.account_type].accounts.push(r);
      sections[r.account_type].total += parseFloat(r.balance);
    }

    const check = sections.ASSET.total - (sections.LIABILITY.total + sections.EQUITY.total);

    res.json({ success: true, data: { sections, balanced: Math.abs(check) < 0.01, difference: check } });
  } catch (e) { next(e); }
});

// =============================================================================
// NAV SUMMARY — management dashboard KPIs
// Returns four figures based on all posted journal entries as of today:
//   total_assets, inventory_value, receivables_other_assets,
//   total_liabilities, net_asset_value
// GET /financials/nav-summary
// =============================================================================
financialsRouter.get('/nav-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.account_code,
        a.account_type,
        a.normal_balance,
        a.gnucash_type,
        a.parent_code,
        CASE a.normal_balance
          WHEN 'DR' THEN COALESCE(SUM(jel.debit),  0) - COALESCE(SUM(jel.credit), 0)
          WHEN 'CR' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit),  0)
        END AS balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.account_id
      LEFT JOIN journal_entries je
             ON je.je_id = jel.je_id AND je.status = 'POSTED'
      WHERE a.is_active = TRUE
        AND a.account_type IN ('ASSET','LIABILITY')
        AND a.parent_code IS NOT NULL   -- exclude header/summary accounts (1000, 2000)
      GROUP BY a.account_id, a.account_code, a.account_type, a.normal_balance, a.gnucash_type, a.parent_code
    `);

    let totalAssets            = 0;
    let inventoryValue         = 0;
    let bankValue              = 0;
    let receivablesValue       = 0;
    let totalLiabilities       = 0;

    for (const r of rows) {
      const bal = parseFloat(r.balance) || 0;
      if (r.account_type === 'ASSET') {
        totalAssets += bal;
        if (r.parent_code === '1300' || r.account_code === '1300') {
          inventoryValue += bal;
        } else if (r.gnucash_type === 'BANK') {
          bankValue += bal;
        } else if (r.gnucash_type === 'RECEIVABLE') {
          receivablesValue += bal;
        }
      } else if (r.account_type === 'LIABILITY') {
        totalLiabilities += bal;
      }
    }

    const otherAssets           = totalAssets - inventoryValue - bankValue - receivablesValue;
    const netAssetValue         = totalAssets - totalLiabilities;

    res.json({
      success: true,
      data: {
        net_asset_value:          parseFloat(netAssetValue.toFixed(2)),
        total_assets:             parseFloat(totalAssets.toFixed(2)),
        inventory_value:          parseFloat(inventoryValue.toFixed(2)),
        bank_value:               parseFloat(bankValue.toFixed(2)),
        receivables_value:        parseFloat(receivablesValue.toFixed(2)),
        other_assets_value:       parseFloat(otherAssets.toFixed(2)),
        receivables_other_assets: parseFloat((receivablesValue + otherAssets).toFixed(2)),
        total_liabilities:        parseFloat(totalLiabilities.toFixed(2)),
      },
    });
  } catch (e) { next(e); }
});

// =============================================================================
// TRANSACTION REGISTER
// All posted JE lines across all accounts — the full accounting ledger
// GET /financials/transaction-register?from=&to=&account_code=&source_type=
// =============================================================================

financialsRouter.get('/transaction-register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, account_code, source_type } = req.query;
    const params: unknown[] = ['POSTED'];
    let query = `
      SELECT
          je.entry_date,
          je.doc_id           AS je_ref,
          je.description      AS je_description,
          je.source_type,
          je.source_id,
          a.account_code,
          a.account_name,
          a.account_type,
          jel.description     AS line_description,
          jel.debit,
          jel.credit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.je_id = jel.je_id
        JOIN accounts a         ON a.account_id = jel.account_id
       WHERE je.status = $1`;

    if (from)         { params.push(from);         query += ` AND je.entry_date >= $${params.length}`; }
    if (to)           { params.push(to);           query += ` AND je.entry_date <= $${params.length}`; }
    if (account_code) { params.push(account_code); query += ` AND a.account_code = $${params.length}`; }
    if (source_type)  { params.push(source_type);  query += ` AND je.source_type = $${params.length}`; }

    query += ' ORDER BY je.entry_date, je.je_id, jel.line_seq';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// =============================================================================
// P&L
// =============================================================================

// GET /financials/profit-loss?from=2026-01-01&to=2026-12-31
financialsRouter.get('/profit-loss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    const params: unknown[] = [];
    let dateFilter = 'WHERE je.status = \'POSTED\'';
    if (from) { params.push(from); dateFilter += ` AND je.entry_date >= $${params.length}`; }
    if (to)   { params.push(to);   dateFilter += ` AND je.entry_date <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
          a.account_code, a.account_name, a.account_type, a.normal_balance,
          CASE a.normal_balance
              WHEN 'DR' THEN COALESCE(SUM(jel.debit),  0) - COALESCE(SUM(jel.credit), 0)
              WHEN 'CR' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit),  0)
          END AS balance
        FROM accounts a
        JOIN journal_entry_lines jel ON jel.account_id = a.account_id
        JOIN journal_entries je      ON je.je_id = jel.je_id
        ${dateFilter}
          AND a.account_type IN ('REVENUE','EXPENSE')
       GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code
    `, params);

    const revenue  = rows.filter(r => r.account_type === 'REVENUE');
    const expenses = rows.filter(r => r.account_type === 'EXPENSE');
    const totalRevenue  = revenue.reduce((s, r)  => s + parseFloat(r.balance), 0);
    const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.balance), 0);
    const netIncome = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: { revenue, expenses, total_revenue: totalRevenue, total_expenses: totalExpenses, net_income: netIncome },
    });
  } catch (e) { next(e); }
});
