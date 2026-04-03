import { useEffect, useState } from 'react';
import { Table, Button, Space, Select, Typography, Tooltip, Popconfirm, message } from 'antd';
import { PlusOutlined, FilePdfOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';
import type { PurchaseOrder } from '../../types/purchase';

const { Title } = Typography;

export function POList() {
  const [orders, setOrders]   = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    purchaseApi.get('/purchase-orders', {
      params: statusFilter ? { status: statusFilter } : {},
    })
      .then(r => setOrders(r.data.data))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/purchase-orders/${docId}`);
      message.success(`${docId} deleted`);
      setOrders(prev => prev.filter(o => o.doc_id !== docId));
    } catch {
      message.error('Failed to delete');
    }
  };

  const handlePdf = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const response = await purchaseApi.get(`/purchase-orders/${docId}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  };

  const columns = [
    { title: 'Doc ID',    dataIndex: 'doc_id',      width: 170, render: (v: string) => <strong>{v}</strong> },
    { title: 'Vendor',    dataIndex: 'vendor_name', ellipsis: true },
    { title: 'Workflow',  dataIndex: 'workflow',    width: 90 },
    { title: 'Status',    dataIndex: 'status',      width: 160, render: (v: string) => <StatusTag status={v} /> },
    { title: 'Order Date',dataIndex: 'order_date',  width: 110, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Currency',  dataIndex: 'currency',    width: 80 },
    {
      title: 'Actions', width: 130,
      render: (_: unknown, row: PurchaseOrder) => (
        <Space>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/purchase/orders/${row.doc_id}`)} />
          </Tooltip>
          <Tooltip title="Download PDF">
            <Button size="small" icon={<FilePdfOutlined />} onClick={e => handlePdf(row.doc_id, e)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title={`Delete ${row.doc_id}?`}
              description="This cannot be undone."
              okText="Delete" okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={e => handleDelete(row.doc_id, e as React.MouseEvent)}
              onPopupClick={e => e.stopPropagation()}
            >
              <Button danger size="small" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Purchase Orders</Title>
        <Space>
          <Select
            allowClear placeholder="Filter by status" style={{ width: 180 }}
            onChange={setStatusFilter}
            options={[
              'DRAFT','CONFIRMED','PARTIALLY_RECEIVED','FULLY_RECEIVED','BILLED','CLOSED','CANCELLED'
            ].map(s => ({ value: s, label: s.replace(/_/g,' ') }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/purchase/orders/new')}>
            New PO
          </Button>
        </Space>
      </div>

      <Table
        rowKey="puo_id"
        dataSource={orders}
        columns={columns}
        loading={loading}
        size="small"
        onRow={row => ({ onClick: () => navigate(`/purchase/orders/${row.doc_id}`) })}
        rowClassName={() => 'clickable-row'}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </>
  );
}
