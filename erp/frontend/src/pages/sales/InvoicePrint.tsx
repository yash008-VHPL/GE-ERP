import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Typography, Space } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Text } = Typography;

interface InvoiceLine {
  invl_id: number;
  line_seq: number;
  description: string;
  quantity: string;
  unit_price: string;
  line_amount: string;
}

interface Invoice {
  doc_id: string;
  client_name: string;
  client_code: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  sao_doc_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  total_amount: string;
  amount_paid: string;
  currency: string;
  client_ref: string | null;
  notes: string | null;
  lines: InvoiceLine[];
}

const printStyles = `
  @media print {
    .no-print { display: none !important; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    .print-page { padding: 32px !important; box-shadow: none !important; max-width: 100% !important; }
  }
  .print-page {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 40px;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
  }
  .inv-header { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .company-block h1 { font-size: 22px; font-weight: 800; color: #1B2A4A; margin: 0 0 4px; }
  .company-block p  { margin: 0; color: #555; font-size: 12px; }
  .inv-label { font-size: 26px; font-weight: 700; color: #B8860B; text-align: right; }
  .inv-meta  { text-align: right; font-size: 12px; color: #555; margin-top: 4px; }
  .inv-meta strong { color: #1a1a1a; }
  .parties { display: flex; gap: 40px; margin-bottom: 28px; }
  .party-block { flex: 1; }
  .party-block h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin: 0 0 6px; }
  .party-block p  { margin: 2px 0; font-size: 13px; }
  .party-block .name { font-weight: 700; font-size: 15px; }
  hr.divider { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.lines thead th { background: #1B2A4A; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; }
  table.lines thead th.right { text-align: right; }
  table.lines tbody td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  table.lines tbody td.right { text-align: right; }
  table.lines tbody tr:last-child td { border-bottom: none; }
  .totals-block { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-table { width: 260px; }
  .totals-table tr td { padding: 5px 0; font-size: 13px; }
  .totals-table tr td:last-child { text-align: right; font-weight: 600; }
  .totals-table .total-row td { font-size: 16px; font-weight: 800; color: #1B2A4A; border-top: 2px solid #1B2A4A; padding-top: 8px; }
  .totals-table .paid-row  td { color: #16a34a; }
  .totals-table .due-row   td { color: #d97706; }
  .notes-block { background: #f9f9f9; border-left: 3px solid #B8860B; padding: 10px 14px; margin-bottom: 24px; font-size: 12px; }
  .footer { text-align: center; font-size: 11px; color: #aaa; margin-top: 32px; }
`;

export function InvoicePrint() {
  const { docId } = useParams<{ docId: string }>();
  const navigate  = useNavigate();
  const printRef  = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    purchaseApi
      .get(`/invoices/${docId}`)
      .then(r => setInvoice(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docId]);

  const handlePrint = () => window.print();

  if (loading) return <Spin style={{ display: 'block', marginTop: 64 }} />;
  if (!invoice) return <Text type="danger">Invoice not found.</Text>;

  const inv      = invoice;
  const total    = parseFloat(inv.total_amount);
  const paid     = parseFloat(inv.amount_paid);
  const balance  = total - paid;
  const fmt      = (n: number, d = 2) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <>
      <style>{printStyles}</style>

      {/* Print controls — hidden when printing */}
      <Space className="no-print" style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/sales/invoices/${docId}`)}>
          Back to Invoice
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Save as PDF / Print
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Use your browser's "Save as PDF" option in the print dialog.
        </Text>
      </Space>

      {/* Printable invoice */}
      <div ref={printRef} className="print-page">

        {/* Header: company + invoice label */}
        <div className="inv-header">
          <div className="company-block">
            <h1>GIIAVA EUROPE B.V.</h1>
            <p>Amsterdam, Netherlands</p>
            <p>VAT: NL000000000B01</p>
          </div>
          <div>
            <div className="inv-label">TAX INVOICE</div>
            <div className="inv-meta">
              <div><strong>{inv.doc_id}</strong></div>
              <div>Date: <strong>{dayjs(inv.invoice_date).format('DD MMM YYYY')}</strong></div>
              {inv.due_date && (
                <div>Due: <strong>{dayjs(inv.due_date).format('DD MMM YYYY')}</strong></div>
              )}
              {inv.client_ref && (
                <div>Your Ref: <strong>{inv.client_ref}</strong></div>
              )}
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* Bill-to */}
        <div className="parties">
          <div className="party-block">
            <h4>Bill To</h4>
            <p className="name">{inv.client_name}</p>
            {inv.contact_name && <p>{inv.contact_name}</p>}
            {inv.email && <p>{inv.email}</p>}
            {inv.phone && <p>{inv.phone}</p>}
          </div>
          {inv.sao_doc_id && (
            <div className="party-block">
              <h4>Reference</h4>
              <p>Sales Order: <strong>{inv.sao_doc_id}</strong></p>
              <p>Currency: <strong>{inv.currency}</strong></p>
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Line items */}
        <table className="lines">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Description</th>
              <th className="right" style={{ width: 90 }}>Qty</th>
              <th className="right" style={{ width: 120 }}>Unit Price</th>
              <th className="right" style={{ width: 130 }}>Amount ({inv.currency})</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map(l => (
              <tr key={l.invl_id}>
                <td>{l.line_seq}</td>
                <td>{l.description}</td>
                <td className="right">{fmt(parseFloat(l.quantity), 4)}</td>
                <td className="right">{fmt(parseFloat(l.unit_price), 4)}</td>
                <td className="right">{fmt(parseFloat(l.line_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="totals-block">
          <table className="totals-table">
            <tbody>
              <tr className="total-row">
                <td>Total</td>
                <td>{inv.currency} {fmt(total)}</td>
              </tr>
              {paid > 0 && (
                <tr className="paid-row">
                  <td>Amount Received</td>
                  <td>({inv.currency} {fmt(paid)})</td>
                </tr>
              )}
              {paid > 0 && (
                <tr className="due-row">
                  <td>Balance Due</td>
                  <td>{inv.currency} {fmt(balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="notes-block">
            <strong>Notes:</strong> {inv.notes}
          </div>
        )}

        <hr className="divider" />

        <div className="footer">
          Thank you for your business. Please remit payment by {inv.due_date ? dayjs(inv.due_date).format('DD MMM YYYY') : 'the due date'}.
          <br />
          For queries please contact accounts@giiava.eu
        </div>
      </div>
    </>
  );
}
