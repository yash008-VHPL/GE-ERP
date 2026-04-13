import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Tag, Typography,
  Spin, Select, Row, Col, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { VendorBill, VBlBillType } from '../../types/purchase';

const { Title } = Typography;

const BILL_TYPE_COLOR: Record<VBlBillType, string> = {
  GOODS:            'blue',
  DIRECT_SERVICE:   'purple',
  INDIRECT_SERVICE: 'orange',
};

const BILL_TYPE_LABEL: Record<VBlBillType, string> = {
  GOODS:            'Goods',
  DIRECT_SERVICE:   'Direct Service',
  INDIRECT_SERVICE: 'Indirect Service',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:          'default',
  POSTED:         'processing',
  PARTIALLY_PAID: 'warning',
  PAID:           'success',
  CANCELLED:      'error',
};

export function VendorBillList() {
  const navigate = useNavigate();
  const [bills, setBills]       = useState<VendorBill[]>([]);
  const [loading, setLoading]   = useState(true);
  const [billType, setBillType] = useState<string | undefined>(undefined);
  const [status, setStatus]     = useState<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (billType) params.set('bill_type', billType);
    if (status)   params.set('status', status);
    purchaseApi.get(`/vendor-bills?${params}`)
      .then(r => setBills(r.data.data))
      .catch(() => message.error('Failed to load vendor bills'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [billType, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<VendorBill> = [
    {
      title: 'Bill No.',
      dataIndex: 'doc_id',
      render: (v: string, row) => (
        <Button type="link" style={{ padding: 0 }}
          onClick={() => navigate(`/purchase/bills/${row.doc_id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'bill_type',
      width: 140,
      render: (v: VBlBillType) => (
        <Tag color={BILL_TYPE_COLOR[v]}>{BILL_TYPE_LABEL[v]}</Tag>
      ),
    },
    { title: 'Vendor',     dataIndex: 'vendor_name',    ellipsis: true },
    { title: 'Inv Ref',    dataIndex: 'vendor_inv_ref', width: 140, render: (v: string | null) => v ?? '—' },
    {
      title: 'Bill Date', dataIndex: 'bill_date', width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Due Date', dataIndex: 'due_date', width: 110,
      render: (v: string | null) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right' as const,
      render: (v: string, row) => `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Paid',
      dataIndex: 'amount_paid',
      width: 120,
      align: 'right' as const,
      render: (v: string, row) => `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    { title: 'PO Ref', dataIndex: 'puo_doc_id',  width: 150, render: (v: string | null) => v ?? '—' },
    { title: 'SO Ref', dataIndex: 'so_doc_id',   width: 150, render: (v: string | null) => v ?? '—' },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Vendor Bills</Title>
        </Col>
        <Col>
          <Space>
            <Select
              allowClear placeholder="All Types"
              style={{ width: 160 }}
              value={billType}
              onChange={v => setBillType(v)}
              options={[
                { label: 'Goods', value: 'GOODS' },
                { label: 'Direct Service', value: 'DIRECT_SERVICE' },
                { label: 'Indirect Service', value: 'INDIRECT_SERVICE' },
              ]}
            />
            <Select
              allowClear placeholder="All Statuses"
              style={{ width: 150 }}
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
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => navigate('/purchase/bills/create')}>
              New Bill
            </Button>
          </Space>
        </Col>
      </Row>

      {loading ? <Spin /> : (
        <Table
          rowKey="vbl_id"
          dataSource={bills}
          columns={columns}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      )}
    </>
  );
}
