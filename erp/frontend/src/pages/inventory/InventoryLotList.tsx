import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Tag, Typography,
  Spin, Select, Row, Col, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;

interface InventoryLot {
  lot_id:             number;
  lot_number:         string;
  docket_number:      string;
  item_code:          string;
  item_name:          string;
  vendor_name:        string;
  quantity_received:  string;
  quantity_available: string;
  uom:                string;
  vendor_batch_ref:   string | null;
  received_date:      string;
  status:             string;
  receipt_doc_id:     string;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:      'success',
  PARTIALLY_USED: 'warning',
  FULLY_USED:     'default',
};

export function InventoryLotList() {
  const navigate = useNavigate();
  const [lots, setLots]       = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    purchaseApi.get(`/inventory-lots?${params}`)
      .then(r => setLots(r.data.data))
      .catch(() => message.error('Failed to load inventory lots'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<InventoryLot> = [
    {
      title: 'Lot No.',
      dataIndex: 'lot_number',
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }}
          onClick={() => navigate(`/inventory/lots/${v}`)}>
          {v}
        </Button>
      ),
    },
    { title: 'Docket',      dataIndex: 'docket_number', width: 160 },
    { title: 'Item',        dataIndex: 'item_code',     width: 100 },
    { title: 'Item Name',   dataIndex: 'item_name',     ellipsis: true },
    { title: 'Vendor',      dataIndex: 'vendor_name',   ellipsis: true },
    { title: 'Vendor Batch', dataIndex: 'vendor_batch_ref', width: 130,
      render: (v: string | null) => v ?? '—' },
    {
      title: 'Received', dataIndex: 'received_date', width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Qty Received',
      dataIndex: 'quantity_received',
      width: 110,
      align: 'right' as const,
      render: (v: string, row) => `${Number(v).toFixed(4)} ${row.uom}`,
    },
    {
      title: 'Qty Available',
      dataIndex: 'quantity_available',
      width: 120,
      align: 'right' as const,
      render: (v: string, row) => `${Number(v).toFixed(4)} ${row.uom}`,
    },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Receipt', dataIndex: 'receipt_doc_id', width: 150,
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }}
          onClick={() => navigate(`/purchase/receipts/${v}`)}>
          {v}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Inventory Lots (Inward)</Title>
        </Col>
        <Col>
          <Space>
            <Select
              allowClear placeholder="All Statuses"
              style={{ width: 160 }}
              value={status}
              onChange={v => setStatus(v)}
              options={[
                { label: 'Available',      value: 'AVAILABLE' },
                { label: 'Partially Used', value: 'PARTIALLY_USED' },
                { label: 'Fully Used',     value: 'FULLY_USED' },
              ]}
            />
          </Space>
        </Col>
      </Row>

      {loading ? <Spin /> : (
        <Table
          rowKey="lot_id"
          dataSource={lots}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      )}
    </>
  );
}
