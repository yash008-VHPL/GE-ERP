import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Typography, message, Popconfirm, Tooltip,
  Modal, Form, Input, InputNumber, Select, Switch, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];

interface Client {
  client_id:    number;
  client_code:  string;
  client_name:  string;
  credit_terms: boolean;
  credit_days:  number;
  currency:     string;
  contact_name: string | null;
  email:        string | null;
  phone:        string | null;
  address:      string | null;
  is_active:    boolean;
}

export function ClientList() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [saving, setSaving]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm<any>();

  const load = () => {
    setLoading(true);
    purchaseApi.get('/clients')
      .then(r => setClients(r.data.data))
      .catch(() => message.error('Failed to load clients'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ credit_terms: true, credit_days: 30, currency: 'USD', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(c);
    form.setFieldsValue(c);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await purchaseApi.patch(`/clients/${editing.client_id}`, values);
        setClients(prev => prev.map(c => c.client_id === editing.client_id ? data.data : c));
        message.success('Client updated');
      } else {
        const { data } = await purchaseApi.post('/clients', values);
        setClients(prev => [...prev, data.data]);
        message.success(`${data.data.client_name} created`);
      }
      setModalOpen(false);
    } catch {
      message.error('Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/clients/${c.client_id}`);
      message.success(`${c.client_name} deleted`);
      setClients(prev => prev.filter(x => x.client_id !== c.client_id));
    } catch {
      message.error('Failed to delete — client may have linked transactions');
    }
  };

  const columns = [
    { title: 'Code',    dataIndex: 'client_code', width: 120, render: (v: string) => <strong>{v}</strong> },
    { title: 'Name',    dataIndex: 'client_name', ellipsis: true },
    { title: 'Currency',dataIndex: 'currency',    width: 90 },
    {
      title: 'Payment Terms', width: 140,
      render: (_: unknown, row: Client) => row.credit_terms
        ? <Tag color="blue">Credit {row.credit_days}d</Tag>
        : <Tag color="orange">Prepay</Tag>,
    },
    { title: 'Contact', dataIndex: 'contact_name', width: 150, ellipsis: true },
    { title: 'Email',   dataIndex: 'email',         ellipsis: true },
    {
      title: 'Active', dataIndex: 'is_active', width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions', width: 90,
      render: (_: unknown, row: Client) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={e => openEdit(row, e)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title={`Delete ${row.client_name}?`}
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
        <Title level={4} style={{ margin: 0 }}>Clients</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Client</Button>
      </div>

      <Table
        rowKey="client_id" dataSource={clients} columns={columns}
        loading={loading} size="small" pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editing ? `Edit — ${editing.client_name}` : 'New Client'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editing ? 'Save Changes' : 'Create Client'}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="client_code" label="Client Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. CUST-001" />
            </Form.Item>
            <Form.Item name="client_name" label="Client Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
              <Select options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="credit_days" label="Credit Days">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="credit_terms" label="Payment Terms" valuePropName="checked">
              <Switch checkedChildren="Credit" unCheckedChildren="Prepay" />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="contact_name" label="Contact Name">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ gridColumn: 'span 2' }}>
              <Input />
            </Form.Item>
            <Form.Item name="address" label="Address" style={{ gridColumn: 'span 2' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
