import { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Divider, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { Vendor, Item } from '../../types/purchase';

const { Title } = Typography;

interface LineItem { key: number; itemId?: number; description?: string; quantity: number; unitPrice: number; }

export function POCreate() {
  const [form]      = Form.useForm();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems]     = useState<Item[]>([]);
  const [lines, setLines]     = useState<LineItem[]>([{ key: 0, quantity: 1, unitPrice: 0 }]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    purchaseApi.get('/vendors').then(r => setVendors(r.data.data));
    purchaseApi.get('/items').then(r => setItems(r.data.data));
  }, []);

  const onVendorChange = (id: number) => {
    const v = vendors.find(x => x.vendor_id === id) ?? null;
    setSelectedVendor(v);
    form.setFieldValue('workflow', v?.credit_terms ? 'CREDIT' : 'PREPAY');
    form.setFieldValue('currency', v?.currency ?? 'USD');
  };

  const updateLine = (key: number, field: keyof LineItem, value: unknown) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };

  const onItemSelect = (key: number, itemId: number) => {
    const item = items.find(i => i.item_id === itemId);
    updateLine(key, 'itemId', itemId);
    if (item) updateLine(key, 'description', item.item_name);
  };

  const lineTotal = (l: LineItem) => (l.quantity * l.unitPrice).toFixed(2);
  const grandTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0).toFixed(2);

  const lineColumns = [
    {
      title: 'Item', width: '28%',
      render: (_: unknown, row: LineItem) => (
        <Select showSearch optionFilterProp="label" style={{ width: '100%' }}
          options={items.map(i => ({ value: i.item_id, label: `${i.item_code} — ${i.item_name}` }))}
          onChange={v => onItemSelect(row.key, v)} allowClear
        />
      ),
    },
    {
      title: 'Description', width: '30%',
      render: (_: unknown, row: LineItem) => (
        <Input value={row.description} onChange={e => updateLine(row.key, 'description', e.target.value)} />
      ),
    },
    {
      title: 'Qty', width: '12%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber min={0.0001} value={row.quantity} onChange={v => updateLine(row.key, 'quantity', v ?? 1)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Unit Price', width: '15%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber min={0} precision={4} value={row.unitPrice} onChange={v => updateLine(row.key, 'unitPrice', v ?? 0)} style={{ width: '100%' }} />
      ),
    },
    { title: 'Amount', width: '12%', render: (_: unknown, row: LineItem) => <strong>{lineTotal(row)}</strong> },
    {
      title: '', width: '3%',
      render: (_: unknown, row: LineItem) => (
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => setLines(p => p.filter(l => l.key !== row.key))}
          disabled={lines.length === 1}
        />
      ),
    },
  ];

  const onFinish = async (values: Record<string, unknown>) => {
    if (lines.some(l => !l.description)) { message.error('All lines need a description'); return; }
    setSubmitting(true);
    try {
      const payload = {
        vendorId:     values.vendorId,
        workflow:     values.workflow,
        orderDate:    dayjs(values.orderDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        expectedDate: values.expectedDate ? dayjs(values.expectedDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        currency:     values.currency,
        notes:        values.notes ?? null,
        lines:        lines.map(l => ({ itemId: l.itemId ?? null, description: l.description ?? null, quantity: l.quantity, unitPrice: l.unitPrice })),
      };
      const { data } = await purchaseApi.post('/purchase-orders', payload);
      message.success(`Created ${data.data.doc_id}`);
      navigate(`/purchase/orders/${data.data.doc_id}`);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>New Purchase Order</Title>

      {selectedVendor && !selectedVendor.credit_terms && (
        <Alert type="warning" showIcon message="This vendor requires prepayment. A Vendor Prepayment (VPr) will be needed before goods are received." style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ workflow: 'CREDIT', currency: 'USD', orderDate: dayjs() }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item name="vendorId" label="Vendor" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={vendors.map(v => ({ value: v.vendor_id, label: v.vendor_name }))}
              onChange={onVendorChange}
            />
          </Form.Item>
          <Form.Item name="workflow" label="Workflow" rules={[{ required: true }]}>
            <Select options={[{ value: 'CREDIT', label: 'Credit (net terms)' }, { value: 'PREPAY', label: 'Prepayment required' }]} />
          </Form.Item>
          <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
            <Select options={['USD','EUR','GBP','SGD','AED'].map(c => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expectedDate" label="Expected Delivery">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={1} />
          </Form.Item>
        </div>

        <Divider>Line Items</Divider>

        <Table dataSource={lines} columns={lineColumns} rowKey="key" pagination={false} size="small" />

        <Space style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => setLines(p => [...p, { key: Date.now(), quantity: 1, unitPrice: 0 }])}>
            Add Line
          </Button>
        </Space>

        <div style={{ textAlign: 'right', marginTop: 8, fontSize: 16 }}>
          <strong>Total: {form.getFieldValue('currency') ?? 'USD'} {grandTotal}</strong>
        </div>

        <Divider />

        <Space>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>Create Purchase Order</Button>
        </Space>
      </Form>
    </>
  );
}
