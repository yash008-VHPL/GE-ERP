import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Typography, message, Popconfirm, Tooltip,
  Modal, Form, Input, Select, Switch, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;
const UOMS = ['EA', 'KG', 'G', 'LT', 'ML', 'MT', 'CBM', 'BOX', 'CTN', 'PAL', 'SET', 'PC', 'M', 'M2', 'M3'];

interface Item {
  item_id:   number;
  item_code: string;
  item_name: string;
  uom:       string;
  item_type: string;
  is_active: boolean;
}

export function ItemList() {
  const [items, setItems]       = useState<Item[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Item | null>(null);
  const [saving, setSaving]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm<any>();

  const load = () => {
    setLoading(true);
    purchaseApi.get('/items')
      .then(r => setItems(r.data.data))
      .catch(() => message.error('Failed to load items'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ uom: 'EA', item_type: 'PRODUCT', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await purchaseApi.patch(`/items/${editing.item_id}`, values);
        setItems(prev => prev.map(i => i.item_id === editing.item_id ? data.data : i));
        message.success('Item updated');
      } else {
        const { data } = await purchaseApi.post('/items', values);
        setItems(prev => [...prev, data.data]);
        message.success(`${data.data.item_name} created`);
      }
      setModalOpen(false);
    } catch {
      message.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/items/${item.item_id}`);
      message.success(`${item.item_name} deleted`);
      setItems(prev => prev.filter(i => i.item_id !== item.item_id));
    } catch {
      message.error('Failed to delete — item may have linked transactions');
    }
  };

  const columns = [
    { title: 'Code',  dataIndex: 'item_code', width: 130, render: (v: string) => <strong>{v}</strong> },
    { title: 'Name',  dataIndex: 'item_name', ellipsis: true },
    { title: 'UOM',   dataIndex: 'uom',       width: 80 },
    {
      title: 'Type', dataIndex: 'item_type', width: 100,
      render: (v: string) => <Tag color={v === 'PRODUCT' ? 'blue' : 'purple'}>{v}</Tag>,
    },
    {
      title: 'Active', dataIndex: 'is_active', width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions', width: 90,
      render: (_: unknown, row: Item) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={e => openEdit(row, e)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title={`Delete ${row.item_name}?`}
              description="Only works if no transactions exist."
              okText="Delete" okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={e => handleDelete(row, e as React.MouseEvent)}
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
        <Title level={4} style={{ margin: 0 }}>Items</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Item</Button>
      </div>

      <Table
        rowKey="item_id" dataSource={items} columns={columns}
        loading={loading} size="small" pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editing ? `Edit — ${editing.item_name}` : 'New Item'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editing ? 'Save Changes' : 'Create Item'}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="item_code" label="Item Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. ITEM-001" />
            </Form.Item>
            <Form.Item name="item_name" label="Item Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="uom" label="Unit of Measure" rules={[{ required: true }]}>
              <Select
                showSearch
                options={UOMS.map(u => ({ value: u, label: u }))}
              />
            </Form.Item>
            <Form.Item name="item_type" label="Type" rules={[{ required: true }]}>
              <Select options={[
                { value: 'PRODUCT', label: 'Product (physical)' },
                { value: 'SERVICE', label: 'Service / Expense' },
              ]} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
