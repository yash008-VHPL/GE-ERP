import { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface SalesOrder {
  sao_id: number; doc_id: string; client_name: string;
  workflow: string; status: string; order_date: string; currency: string;
}

export function SOList() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    purchaseApi.get('/sales-orders')
      .then(r => setOrders(r.data.data))
      .catch(() => message.error('Failed to load sales orders'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/sales-orders/${docId}`);
      message.success(`${docId} deleted`);
      setOrders(prev => prev.filter(o => o.doc_id !== docId));
    } catch {
      message.error('Failed to delete');
    }
  };

  const columns = [
    { title: 'Doc ID',    dataIndex: 'doc_id',      width: 170, render: (v: string) => <strong>{v}</strong> },
    { title: 'Client',   dataIndex: 'client_name',  ellipsis: true },
    { title: 'Workflow', dataIndex: 'workflow',      width: 90 },
    { title: 'Status',   dataIndex: 'status',        width: 160, render: (v: string) => <StatusTag status={v} /> },
    { title: 'Order Date', dataIndex: 'order_date', width: 120, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Currency', dataIndex: 'currency',      width: 80 },
    {
      title: 'Actions', width: 100,
      render: (_: unknown, row: SalesOrder) => (
        <Space>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/sales/orders/${row.doc_id}`)} />
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
        <Title level={4} style={{ margin: 0 }}>Sales Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/sales/orders/new')}>
          New Sales Order
        </Button>
      </div>
      <Table
        rowKey="sao_id" scroll={{ x: 900 }} dataSource={orders} columns={columns} loading={loading} size="small"
        onRow={row => ({ onClick: () => navigate(`/sales/orders/${row.doc_id}`) })}
        pagination={{ pageSize: 20 }}
      />
    </>
  );
}
