import { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Divider, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { Item } from '../../types/purchase';

const { Title } = Typography;

interface Client { client_id: number; client_code: string; client_name: string; credit_terms: boolean; currency: string; }
interface LineItem { key: number; itemId?: number; description?: string; uom?: string; quantity: number; unitPrice: number; }

export function SOCreate() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [f] = Form.useForm<any>();
  const [clients, setClients]   = useState<Client[]>([]);
  const [items, setItems]       = useState<Item[]>([]);
  const [lines, setLines]       = useState<LineItem[]>([{ key: 0, quantity: 1, unitPrice: 0 }]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    purchaseApi.get('/clients').then(r => setClients(r.data.data));
    purchaseApi.get('/items').then(r => setItems(r.data.data));
  }, []);

  const onClientChange = (id: number) => {
    const c = clients.find(x => x.client_id === id) ?? null;
    setSelectedClient(c);
    f.setFieldsValue({ workflow: c?.credit_terms ? 'CREDIT' : 'PREPAY', currency: c?.currency ?? 'USD' });
  };

  const updateLine = (key: number, field: keyof LineItem, value: unknown) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const onItemSelect = (key: number, itemId: number) => {
    const item = items.find(i => i.item_id === itemId);
    updateLine(key, 'itemId', itemId);
    if (item) {
      updateLine(key, 'description', item.item_name);
      updateLine(key, 'uom', item.uom);
    }
  };

  const grandTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0).toFixed(2);

  const lineColumns = [
    {
      title: 'Item', width: '25%',
      render: (_: unknown, row: LineItem) => (
        <Select showSearch optionFilterProp="label" style={{ width: '100%' }}
          options={items.map(i => ({ value: i.item_id, label: `${i.item_code} — ${i.item_name}` }))}
          onChange={v => onItemSelect(row.key, v)} allowClear />
      ),
    },
    {
      title: 'Description', width: '28%',
      render: (_: unknown, row: LineItem) => (
        <Input value={row.description} onChange={e => updateLine(row.key, 'description', e.target.value)} />
      ),
    },
    {
      title: 'UOM', width: '8%',
      render: (_: unknown, row: LineItem) => (
        <Input value={row.uom} onChange={e => updateLine(row.key, 'uom', e.target.value)} />
      ),
    },
    {
      title: 'Qty', width: '10%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber min={0.0001} value={row.quantity} style={{ width: '100%' }}
          onChange={(v: number | null) => updateLine(row.key, 'quantity', v ?? 1)} />
      ),
    },
    {
      title: 'Unit Price', width: '14%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber min={0} precision={4} value={row.unitPrice} style={{ width: '100%' }}
          onChange={(v: number | null) => updateLine(row.key, 'unitPrice', v ?? 0)} />
      ),
    },
    {
      title: 'Amount', width: '12%',
      render: (_: unknown, row: LineItem) => <strong>{(row.quantity * row.unitPrice).toFixed(2)}</strong>,
    },
    {
      title: '', width: '3%',
      render: (_: unknown, row: LineItem) => (
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => setLines(p => p.filter(l => l.key !== row.key))}
          disabled={lines.length === 1} />
      ),
    },
  ];

  const onFinish = async (values: Record<string, unknown>) => {
    if (lines.some(l => !l.description)) { message.error('All lines need a description'); return; }
    setSubmitting(true);
    try {
      const payload = {
        clientId:     values.clientId,
        workflow:     values.workflow,
        orderDate:    dayjs(values.orderDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        expectedDate: values.expectedDate ? dayjs(values.expectedDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        currency:     values.currency,
        notes:        values.notes ?? null,
        lines: lines.map(l => ({ itemId: l.itemId ?? null, description: l.description ?? '', quantity: l.quantity, unitPrice: l.unitPrice, uom: l.uom ?? null })),
      };
      const { data } = await purchaseApi.post('/sales-orders', payload);
      message.success(`Created ${data.data.doc_id}`);
      navigate(`/sales/orders/${data.data.doc_id}`);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to create Sales Order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>New Sales Order</Title>
      {selectedClient && !selectedClient.credit_terms && (
        <Alert type="warning" showIcon message="This client requires prepayment. A Client Prepayment (CPr) will be needed before fulfillment." style={{ marginBottom: 16 }} />
      )}
      <Form form={f} layout="vertical" onFinish={onFinish} initialValues={{ workflow: 'CREDIT', currency: 'USD', orderDate: dayjs() }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item name="clientId" label="Client" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={clients.map(c => ({ value: c.client_id, label: c.client_name }))}
              onChange={onClientChange} />
          </Form.Item>
          <Form.Item name="workflow" label="Workflow" rules={[{ required: true }]}>
            <Select options={[{ value: 'CREDIT', label: 'Credit (invoice first)' }, { value: 'PREPAY', label: 'Prepayment required' }]} />
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
          <strong>Total: {(f.getFieldsValue(['currency'])?.currency as string) ?? 'USD'} {grandTotal}</strong>
        </div>
        <Divider />
        <Space>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>Create Sales Order</Button>
        </Space>
      </Form>
    </>
  );
}
