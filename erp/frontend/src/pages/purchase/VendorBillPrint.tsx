import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { VendorBill } from '../../types/purchase';

export function VendorBillPrint() {
  const { docId } = useParams<{ docId: string }>();
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!docId) return;
    purchaseApi.get(`/vendor-bills/${docId}`)
      .then(r => setBill(r.data.data))
      .catch(() => setError('Failed to load bill'))
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>;
  if (error || !bill) return <div style={{ padding: 48 }}>{error || 'Bill not found'}</div>;

  const outstanding = Math.max(0, parseFloat(bill.total_amount) - parseFloat(bill.amount_paid));

  const BILL_TYPE_LABEL: Record<string, string> = {
    GOODS: 'Goods', DIRECT_SERVICE: 'Direct Service', INDIRECT_SERVICE: 'Indirect Service',
  };

  return (
    <>
      {/* Print controls — hidden during print */}
      <div className="no-print" style={{
        background: '#f5f5f5', padding: '12px 24px', display: 'flex',
        alignItems: 'center', gap: 12, borderBottom: '1px solid #e0e0e0',
      }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Save as PDF / Print
        </Button>
        <span style={{ color: '#666', fontSize: 13 }}>
          Use your browser's "Save as PDF" option to export.
        </span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        body { background: #e8e8e8; font-family: Arial, Helvetica, sans-serif; }
        .print-page {
          background: #fff;
          width: 210mm;
          min-height: 297mm;
          margin: 24px auto;
          padding: 20mm 18mm;
          box-shadow: 0 2px 12px rgba(0,0,0,.15);
          border-radius: 4px;
          box-sizing: border-box;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; font-size: 11px; }
        th { background: #1B2A4A; color: #fff; text-align: left; }
        .lines-table td { border-bottom: 1px solid #f0f0f0; }
        .totals-table td { padding: 4px 8px; font-size: 12px; }
        .grand-total td { font-size: 14px; font-weight: bold; border-top: 2px solid #1B2A4A; }
      `}</style>

      <div className="print-page">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1B2A4A', letterSpacing: 1 }}>
              GIIAVA EUROPE B.V.
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
              Westblaak 180, 3012 KN Rotterdam<br />
              The Netherlands<br />
              KvK: 90622433 | VAT: NL864911295B01
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#B8860B', letterSpacing: 2 }}>
              VENDOR BILL
            </div>
            <div style={{ fontSize: 13, color: '#1B2A4A', marginTop: 6 }}>
              <strong>{bill.doc_id}</strong>
            </div>
            <div style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px',
              background: bill.status === 'PAID' ? '#d4edda'
                : bill.status === 'POSTED' ? '#cce5ff'
                : bill.status === 'PARTIALLY_PAID' ? '#fff3cd'
                : '#e2e3e5',
              borderRadius: 12, fontSize: 11, fontWeight: 600,
              color: bill.status === 'PAID' ? '#155724'
                : bill.status === 'POSTED' ? '#004085'
                : bill.status === 'PARTIALLY_PAID' ? '#856404'
                : '#383d41',
            }}>
              {bill.status.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Bill details + vendor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>Vendor</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{bill.vendor_name}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{bill.vendor_code}</div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>Bill Details</div>
            <table style={{ width: '100%' }}>
              <tbody>
                {[
                  ['Bill Date', dayjs(bill.bill_date).format('DD MMM YYYY')],
                  ['Due Date', bill.due_date ? dayjs(bill.due_date).format('DD MMM YYYY') : '—'],
                  ['Type', BILL_TYPE_LABEL[bill.bill_type] ?? bill.bill_type],
                  ['Currency', bill.currency],
                  ...(bill.vendor_inv_ref ? [['Vendor Inv Ref', bill.vendor_inv_ref]] : []),
                  ...(bill.puo_doc_id    ? [['PO Reference',   bill.puo_doc_id]] : []),
                  ...(bill.so_doc_id     ? [['SO Reference',   bill.so_doc_id]] : []),
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontSize: 11, color: '#666', padding: '2px 0', width: '50%' }}>{k}</td>
                    <td style={{ fontSize: 11, fontWeight: 600, padding: '2px 0' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Line items */}
        <table className="lines-table" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Description</th>
              <th style={{ width: 80, textAlign: 'right' }}>Qty</th>
              <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
              <th style={{ width: 60, textAlign: 'right' }}>Tax %</th>
              <th style={{ width: 80, textAlign: 'right' }}>Tax</th>
              <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(bill.lines ?? []).map(l => (
              <tr key={l.line_seq}>
                <td style={{ color: '#999' }}>{l.line_seq}</td>
                <td>{l.description}{l.item_code ? <span style={{ color: '#999', fontSize: 10 }}> [{l.item_code}]</span> : null}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.quantity).toFixed(4)}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.unit_price).toFixed(4)}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.tax_rate).toFixed(2)}%</td>
                <td style={{ textAlign: 'right' }}>{Number(l.tax_amount).toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(l.line_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <table className="totals-table" style={{ width: 300 }}>
            <tbody>
              <tr>
                <td style={{ color: '#666' }}>Subtotal</td>
                <td style={{ textAlign: 'right' }}>{bill.currency} {Number(bill.subtotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td style={{ color: '#666' }}>Tax</td>
                <td style={{ textAlign: 'right' }}>{bill.currency} {Number(bill.tax_amount).toFixed(2)}</td>
              </tr>
              <tr className="grand-total">
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{bill.currency} {Number(bill.total_amount).toFixed(2)}</td>
              </tr>
              {parseFloat(bill.amount_paid) > 0 && (
                <tr>
                  <td style={{ color: '#16a34a' }}>Paid</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>
                    {bill.currency} {Number(bill.amount_paid).toFixed(2)}
                  </td>
                </tr>
              )}
              {outstanding > 0 && (
                <tr>
                  <td style={{ color: '#dc2626', fontWeight: 700 }}>Outstanding</td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                    {bill.currency} {outstanding.toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {bill.notes && (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: '#fffbeb', borderRadius: 4, fontSize: 12, color: '#555' }}>
            <strong>Notes:</strong> {bill.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12, fontSize: 10, color: '#999', textAlign: 'center' }}>
          Generated by GE ERP · {dayjs().format('DD MMM YYYY, HH:mm')} · {bill.doc_id}
        </div>
      </div>
    </>
  );
}
