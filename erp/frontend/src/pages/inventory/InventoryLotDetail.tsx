import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag, Typography,
  Spin, message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title, Text } = Typography;

interface Allocation {
  allocation_id:        number;
  quantity_allocated:   string;
  allocated_at:         string;
  shipment_lot_number:  string;
  shipment_status:      string;
  so_doc_id:            string;
}

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
  sharepoint_folder:  string | null;
  received_date:      string;
  status:             string;
  notes:              string | null;
  receipt_doc_id:     string;
  allocations:        Allocation[];
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:      'success',
  PARTIALLY_USED: 'warning',
  FULLY_USED:     'default',
};

export function InventoryLotDetail() {
  const { lotNumber } = useParams<{ lotNumber: string }>();
  const navigate      = useNavigate();
  const [lot, setLot] = useState<InventoryLot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lotNumber) return;
    purchaseApi.get(`/inventory-lots/${lotNumber}`)
      .then(r => setLot(r.data.data))
      .catch(() => message.error('Failed to load lot'))
      .finally(() => setLoading(false));
  }, [lotNumber]);

  if (loading) return <Spin />;
  if (!lot) return <Text type="danger">Lot not found</Text>;

  const allocColumns = [
    { title: 'Shipment Lot', dataIndex: 'shipment_lot_number', width: 160 },
    { title: 'SO',           dataIndex: 'so_doc_id',           width: 150,
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }}
          onClick={() => navigate(`/sales/orders/${v}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Qty Allocated',
      dataIndex: 'quantity_allocated',
      width: 120,
      align: 'right' as const,
      render: (v: string) => Number(v).toFixed(4),
    },
    { title: 'Shipment Status', dataIndex: 'shipment_status', width: 130,
      render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Allocated At', dataIndex: 'allocated_at', width: 160,
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventory/lots')}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>{lot.lot_number}</Title>
        <Tag color={STATUS_COLOR[lot.status] ?? 'default'}>{lot.status.replace('_', ' ')}</Tag>
      </Space>

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Lot Number">{lot.lot_number}</Descriptions.Item>
        <Descriptions.Item label="Docket">{lot.docket_number}</Descriptions.Item>
        <Descriptions.Item label="Receipt">
          <Button type="link" style={{ padding: 0 }}
            onClick={() => navigate(`/purchase/receipts/${lot.receipt_doc_id}`)}>
            {lot.receipt_doc_id}
          </Button>
        </Descriptions.Item>
        <Descriptions.Item label="Item">{lot.item_code} — {lot.item_name}</Descriptions.Item>
        <Descriptions.Item label="Vendor">{lot.vendor_name}</Descriptions.Item>
        <Descriptions.Item label="Received Date">{dayjs(lot.received_date).format('DD MMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Qty Received">
          {Number(lot.quantity_received).toFixed(4)} {lot.uom}
        </Descriptions.Item>
        <Descriptions.Item label="Qty Available">
          <Text type={parseFloat(lot.quantity_available) > 0 ? 'success' : 'secondary'}>
            {Number(lot.quantity_available).toFixed(4)} {lot.uom}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={STATUS_COLOR[lot.status] ?? 'default'}>{lot.status.replace('_', ' ')}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Vendor Batch Ref">{lot.vendor_batch_ref ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="SharePoint Folder" span={2}>
          {lot.sharepoint_folder
            ? <a href={lot.sharepoint_folder} target="_blank" rel="noreferrer">Open Folder</a>
            : '—'
          }
        </Descriptions.Item>
        <Descriptions.Item label="Notes" span={3}>{lot.notes ?? '—'}</Descriptions.Item>
      </Descriptions>

      <Title level={5}>Shipment Allocations</Title>
      <Table
        rowKey="allocation_id"
        dataSource={lot.allocations}
        columns={allocColumns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No allocations yet' }}
      />
    </>
  );
}
