import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Typography,
  Spin, Select, Row, Col, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface ClientInvoice {
  inv_id: number;
  doc_id: string;
  sao_doc_id: string | null;
  client_name: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: string;
  amount_paid: string;
  currency: string;
  status: string;
  client_ref: string | null;
}

export function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    purchaseApi.get(`/invoices?${params}`)
      .then(r => setInvoices(r.data.data))
      .catch(() => message.error('Failed to load invoices'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<ClientInvoice> = [
    {
      title: 'Invoice No.', dataIndex: 'doc_id', width: 165,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    { title: 'Client', dataIndex: 'client_name', width: 160, ellipsis: true },
    {
      title: 'SO Ref',
      dataIndex: 'sao_doc_id',
      width: 180,
      render: (v: string | null) =>
        v ? (
          <a
            style={{ fontFamily: 'monospace' }}
            onClick={e => { e.stopPropagation(); navigate(`/sales/orders/${v}`); }}
          >
            {v}
          </a>
        ) : '—',
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      width: 120,
      render: (v: string | null) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Paid',
      dataIndex: 'amount_paid',
      width: 130,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: 'Client Ref',
      dataIndex: 'client_ref',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Client Invoices</Title>
        </Col>
        <Col>
          <Space>
            <Select
              allowClear placeholder="All Statuses"
              style={{ width: 160 }}
              value={status}
              onChange={v => setStatus(v)}
              options={[
                { label: 'Draft',          value: 'DRAFT' },
                { label: 'Posted',         value: 'POSTED' },
                { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
                { label: 'Paid',           value: 'PAID' },
                { label: 'Cancelled',      value: 'CANCELLED' },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/sales/invoices/new')}
            >
              New Invoice
            </Button>
          </Space>
        </Col>
      </Row>

      {loading ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="inv_id"
          dataSource={invoices}
          columns={columns}
          size="small"
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          onRow={row => ({
            onClick: () => navigate(`/sales/invoices/${row.doc_id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </>
  );
}
