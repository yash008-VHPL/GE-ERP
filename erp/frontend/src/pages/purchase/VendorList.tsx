import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Typography, message, Popconfirm, Tooltip,
  Modal, Form, Input, InputNumber, Select, Switch, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];

interface Vendor {
  vendor_id:    number;
  vendor_code:  string;
  vendor_name:  string;
  credit_terms: boolean;
  credit_days:  number;
  currency:     string;
  contact_name: string | null;
  email:        string | null;
  phone:        string | null;
  address:      string | null;
  is_active:    boolean;
}

export function VendorList() {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Vendor | null>(null);
  const [saving, setSaving]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm<any>();

  const load = () => {
    setLoading(true);
    purchaseApi.get('/vendors')
      .then(r => setVendors(r.data.data))
      .catch(() => message.error('Failed to load vendors'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ credit_terms: false, credit_days: 0, currency: 'USD', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (v: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(v);
    form.setFieldsValue(v);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await purchaseApi.patch(`/vendors/${editing.vendor_id}`, values);
        setVendors(prev => prev.map(v => v.vendor_id === editing.vendor_id ? data.data : v));
        message.success('Vendor updated');
      } else {
        const { data } = await purchaseApi.post('/vendors', values);
        setVendors(prev => [...prev, data.data]);
        message.success(`${data.data.vendor_name} created`);
      }
      setModalOpen(false);
    } catch {
      message.error('Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await purchaseApi.delete(`/vendors/${v.vendor_id}`);
      message.success(`${v.vendor_name} deleted`);
      setVendors(prev => prev.filter(x => x.vendor_id !== v.vendor_id));
    } catch {
      message.error('Failed to delete — vendor may have linked transactions');
    }
  };

  const columns = [
    { title: 'Code',    dataIndex: 'vendor_code', width: 120, render: (v: string) => <strong>{v}</strong> },
    { title: 'Name',    dataIndex: 'vendor_name', ellipsis: true },
    { title: 'Currency',dataIndex: 'currency',    width: 90 },
    {
      title: 'Credit Terms', width: 130,
      render: (_: unknown, row: Vendor) => row.credit_terms
        ? <Tag color="blue">Credit {row.credit_days}d</Tag>
        : <Tag>Prepay</Tag>,
    },
    { title: 'Contact', dataIndex: 'contact_name', width: 150, ellipsis: true },
    { title: 'Email',   dataIndex: 'email',         ellipsis: true },
    {
      title: 'Active', dataIndex: 'is_active', width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions', width: 90,
      render: (_: unknown, row: Vendor) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={e => openEdit(row, e)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title={`Delete ${row.vendor_name}?`}
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
        <Title level={4} style={{ margin: 0 }}>Vendors</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Vendor</Button>
      </div>

      <Table
        rowKey="vendor_id" dataSource={vendors} columns={columns}
        loading={loading} size="small" pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editing ? `Edit — ${editing.vendor_name}` : 'New Vendor'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editing ? 'Save Changes' : 'Create Vendor'}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="vendor_code" label="Vendor Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. VEND-001" />
            </Form.Item>
            <Form.Item name="vendor_name" label="Vendor Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
              <Select options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="credit_days" label="Credit Days">
              <InputNumber min={0} style={{ width: '100%' }}
                onChange={(v: number | null) => {
                  if ((v ?? 0) > 0) form.setFieldsValue({ credit_terms: true });
                }}
              />
            </Form.Item>
            <Form.Item name="credit_terms" label="Credit Terms" valuePropName="checked">
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
