import { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface Receipt {
  itr_id:      number;
  doc_id:      string;
  puo_doc_id:  string;
  vendor_name: string;
  receipt_date: string;
  status:      string;
  notes:       string | null;
}

export function ReceiptList() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    purchaseApi.get('/item-receipts')
      .then(r => setReceipts(r.data.data))
      .catch(() => message.error('Failed to load receipts'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/item-receipts/${docId}`);
      message.success(`${docId} deleted`);
      setReceipts(prev => prev.filter(r => r.doc_id !== docId));
    } catch {
      message.error('Failed to delete');
    }
  };

  const columns = [
    { title: 'Doc ID',      dataIndex: 'doc_id',      width: 170, render: (v: string) => <strong>{v}</strong> },
    { title: 'PO Ref',      dataIndex: 'puo_doc_id',  width: 170 },
    { title: 'Vendor',      dataIndex: 'vendor_name', ellipsis: true },
    { title: 'Receipt Date',dataIndex: 'receipt_date',width: 120, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Status',      dataIndex: 'status',      width: 140, render: (v: string) => <StatusTag status={v} /> },
    {
      title: 'Actions', width: 100,
      render: (_: unknown, row: Receipt) => (
        <Space>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/purchase/receipts/${row.doc_id}`)} />
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
        <Title level={4} style={{ margin: 0 }}>Item Receipts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/purchase/receipts/new')}>
          New Receipt
        </Button>
      </div>
      <Table
        rowKey="itr_id"
        scroll={{ x: 800 }}
        dataSource={receipts}
        columns={columns}
        loading={loading}
        size="small"
        onRow={row => ({ onClick: () => navigate(`/purchase/receipts/${row.doc_id}`) })}
        pagination={{ pageSize: 20 }}
      />
    </>
  );
}
