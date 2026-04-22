import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Typography, Space, Spin, Tabs, Row, Col, message, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface VendorBillPayment {
  vbp_id:         number;
  doc_id:         string;
  vbl_doc_id:     string;
  vendor_name:    string;
  payment_date:   string;
  payment_method: string | null;
  payment_ref:    string | null;
  amount:         string;
  currency:       string;
  bill_type:      string;
  notes:          string | null;
}

interface VendorPrepayment {
  vpr_id:         number;
  doc_id:         string;
  puo_doc_id:     string;
  vendor_name:    string;
  payment_date:   string;
  payment_method: string | null;
  payment_ref:    string | null;
  amount:         string;
  amount_applied: string;
  currency:       string;
  status:         string;
  notes:          string | null;
}

const BILL_TYPE_COLOR: Record<string, string> = {
  GOODS:            'blue',
  DIRECT_SERVICE:   'purple',
  INDIRECT_SERVICE: 'orange',
};

const BILL_TYPE_LABEL: Record<string, string> = {
  GOODS:            'Goods',
  DIRECT_SERVICE:   'Direct Service',
  INDIRECT_SERVICE: 'Indirect Service',
};

export function PaymentList() {
  const navigate = useNavigate();
  const [billPayments, setBillPayments]   = useState<VendorBillPayment[]>([]);
  const [prepayments, setPrepayments]     = useState<VendorPrepayment[]>([]);
  const [loadingBP, setLoadingBP]         = useState(true);
  const [loadingVP, setLoadingVP]         = useState(true);

  useEffect(() => {
    purchaseApi.get('/payments/vendor-bills')
      .then(r => setBillPayments(r.data.data))
      .catch(() => message.error('Failed to load bill payments'))
      .finally(() => setLoadingBP(false));

    purchaseApi.get('/payments/vendor-prepayments')
      .then(r => setPrepayments(r.data.data))
      .catch(() => message.error('Failed to load prepayments'))
      .finally(() => setLoadingVP(false));
  }, []);

  const billPaymentColumns: ColumnsType<VendorBillPayment> = [
    {
      title: 'Payment No.', dataIndex: 'doc_id', width: 165,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    { title: 'Vendor', dataIndex: 'vendor_name', width: 180, ellipsis: true },
    {
      title: 'Bill Ref',
      dataIndex: 'vbl_doc_id',
      width: 170,
      render: (v: string) => (
        <a
          style={{ fontFamily: 'monospace' }}
          onClick={e => { e.stopPropagation(); navigate(`/purchase/bills/${v}`); }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'Bill Type',
      dataIndex: 'bill_type',
      width: 145,
      render: (v: string) => (
        <Tag color={BILL_TYPE_COLOR[v] ?? 'default'}>{BILL_TYPE_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Payment Date',
      dataIndex: 'payment_date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 140,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Method',
      dataIndex: 'payment_method',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Reference',
      dataIndex: 'payment_ref',
      width: 150,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
  ];

  const prepaymentColumns: ColumnsType<VendorPrepayment> = [
    {
      title: 'Prepayment No.', dataIndex: 'doc_id', width: 175,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    { title: 'Vendor', dataIndex: 'vendor_name', width: 180, ellipsis: true },
    {
      title: 'PO Ref',
      dataIndex: 'puo_doc_id',
      width: 170,
      render: (v: string) => (
        <a
          style={{ fontFamily: 'monospace' }}
          onClick={e => { e.stopPropagation(); navigate(`/purchase/orders/${v}`); }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'Payment Date',
      dataIndex: 'payment_date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 140,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Applied',
      dataIndex: 'amount_applied',
      width: 140,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: 'Method',
      dataIndex: 'payment_method',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Reference',
      dataIndex: 'payment_ref',
      width: 150,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
  ];

  const tabItems = [
    {
      key: 'bill-payments',
      label: `Bill Payments${billPayments.length ? ` (${billPayments.length})` : ''}`,
      children: loadingBP ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="vbp_id"
          dataSource={billPayments}
          columns={billPaymentColumns}
          size="small"
          scroll={{ x: 1370 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      ),
    },
    {
      key: 'prepayments',
      label: `Prepayments${prepayments.length ? ` (${prepayments.length})` : ''}`,
      children: loadingVP ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="vpr_id"
          dataSource={prepayments}
          columns={prepaymentColumns}
          size="small"
          scroll={{ x: 1525 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Vendor Payments</Title>
        </Col>
      </Row>

      <Tabs items={tabItems} />
    </>
  );
}
