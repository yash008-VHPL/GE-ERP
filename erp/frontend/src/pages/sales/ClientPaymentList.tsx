import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Typography, Space, Spin, Row, Col, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface ClientInvoicePayment {
  cip_id: number;
  doc_id: string;
  inv_id: number;
  inv_doc_id: string;
  client_name: string;
  client_code: string;
  payment_date: string;
  amount: string;
  currency: string;
  reference: string | null;
  status: string;
  notes: string | null;
}

export function ClientPaymentList() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<ClientInvoicePayment[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = () => {
    setLoading(true);
    purchaseApi.get('/payments/client-invoices')
      .then(r => setPayments(r.data.data))
      .catch(() => message.error('Failed to load client payments'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<ClientInvoicePayment> = [
    {
      title: 'Payment No.',
      dataIndex: 'doc_id',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace' }}>{v}</span>
      ),
    },
    { title: 'Client', dataIndex: 'client_name', ellipsis: true },
    {
      title: 'Invoice Ref',
      dataIndex: 'inv_doc_id',
      width: 180,
      render: (v: string) => (
        <a
          style={{ fontFamily: 'monospace' }}
          onClick={e => { e.stopPropagation(); navigate(`/sales/invoices/${v}`); }}
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
      width: 130,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    { title: 'Currency', dataIndex: 'currency', width: 90 },
    {
      title: 'Reference',
      dataIndex: 'reference',
      width: 150,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Client Payments</Title>
        </Col>
      </Row>

      {loading ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="cip_id"
          dataSource={payments}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      )}
    </>
  );
}
