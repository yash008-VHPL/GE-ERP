import { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Divider, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ImportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title, Text } = Typography;

interface Client {
  client_id: number;
  client_code: string;
  client_name: string;
  currency: string;
  credit_terms: boolean;
}

interface SalesOrder {
  sao_id: number;
  doc_id: string;
  client_id: number;
  client_name: string;
  currency: string;
  status: string;
}

interface SOLine {
  sol_id: number;
  line_seq: number;
  description: string;
  quantity: string;
  unit_price: string;
  uom: string | null;
}

interface LineItem {
  key: number;
  solId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function InvoiceCreate() {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [clients, setClients]   = useState<Client[]>([]);
  const [orders, setOrders]     = useState<SalesOrder[]>([]);
  const [lines, setLines]       = useState<LineItem[]>([{ key: 0, description: '', quantity: 1, unitPrice: 0 }]);
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const [importingLines, setImportingLines] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);

  useEffect(() => {
    purchaseApi.get('/clients').then(r => setClients(r.data.data ?? []));
    // Fetch SOs that are open/confirmed/partially fulfilled — eligible for invoicing
    purchaseApi.get('/sales-orders').then(r => {
      const eligible = (r.data.data ?? []).filter((s: SalesOrder) =>
        ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULLY_FULFILLED'].includes(s.status)
      );
      setOrders(eligible);
    });
  }, []);

  const onSOChange = (saoId: number) => {
    const so = orders.find(o => o.sao_id === saoId) ?? null;
    setSelectedSO(so);
    if (so) {
      const client = clients.find(c => c.client_id === so.client_id);
      form.setFieldsValue({
        clientId: so.client_id,
        currency: so.currency,
        workflow: client?.credit_terms ? 'CREDIT' : 'PREPAY',
      });
      setCurrency(so.currency);
    }
  };

  const onClientChange = (clientId: number) => {
    const c = clients.find(x => x.client_id === clientId);
    if (c) {
      form.setFieldsValue({ currency: c.currency, workflow: c.credit_terms ? 'CREDIT' : 'PREPAY' });
      setCurrency(c.currency);
    }
    // Clear SO selection if client changed
    setSelectedSO(null);
    form.setFieldValue('saoId', undefined);
  };

  const importSOLines = async () => {
    if (!selectedSO) return;
    setImportingLines(true);
    try {
      const { data } = await purchaseApi.get(`/sales-orders/${selectedSO.doc_id}`);
      const soLines: SOLine[] = data.data?.lines ?? [];
      if (soLines.length === 0) {
        message.warning('No lines found on this Sales Order');
        return;
      }
      setLines(soLines.map((l, idx) => ({
        key:         idx,
        solId:       l.sol_id,
        description: l.description,
        quantity:    parseFloat(l.quantity),
        unitPrice:   parseFloat(l.unit_price),
      })));
      message.success(`Imported ${soLines.length} line(s) from ${selectedSO.doc_id}`);
    } catch {
      message.error('Failed to import lines from Sales Order');
    } finally {
      setImportingLines(false);
    }
  };

  const updateLine = (key: number, field: keyof LineItem, value: unknown) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const grandTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const lineColumns = [
    {
      title: 'Description', width: '40%',
      render: (_: unknown, row: LineItem) => (
        <Input
          value={row.description}
          placeholder="Line description…"
          onChange={e => updateLine(row.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'Qty', width: '12%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber
          min={0.0001} precision={4} value={row.quantity} style={{ width: '100%' }}
          onChange={(v: number | null) => updateLine(row.key, 'quantity', v ?? 1)}
        />
      ),
    },
    {
      title: 'Unit Price', width: '18%',
      render: (_: unknown, row: LineItem) => (
        <InputNumber
          min={0} precision={4} value={row.unitPrice} style={{ width: '100%' }}
          addonBefore={currency}
          onChange={(v: number | null) => updateLine(row.key, 'unitPrice', v ?? 0)}
        />
      ),
    },
    {
      title: 'Amount', width: '18%',
      render: (_: unknown, row: LineItem) => (
        <Text strong>{currency} {(row.quantity * row.unitPrice).toFixed(2)}</Text>
      ),
    },
    {
      title: '', width: '4%',
      render: (_: unknown, row: LineItem) => (
        <Button
          danger size="small" icon={<DeleteOutlined />}
          disabled={lines.length === 1}
          onClick={() => setLines(p => p.filter(l => l.key !== row.key))}
        />
      ),
    },
  ];

  const onFinish = async (values: Record<string, unknown>) => {
    if (lines.some(l => !l.description?.trim())) {
      message.error('All lines need a description'); return;
    }
    if (lines.some(l => l.quantity <= 0)) {
      message.error('All quantities must be greater than zero'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        saoId:       values.saoId ?? null,
        invoiceDate: dayjs(values.invoiceDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        dueDate:     values.dueDate ? dayjs(values.dueDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        currency:    values.currency ?? 'USD',
        clientRef:   values.clientRef ?? null,
        notes:       values.notes ?? null,
        lines:       lines.map(l => ({
          solId:       l.solId ?? null,
          description: l.description,
          quantity:    l.quantity,
          unitPrice:   l.unitPrice,
        })),
      };
      const { data } = await purchaseApi.post('/invoices', payload);
      message.success(`Created ${data.data.doc_id}`);
      navigate(`/sales/invoices/${data.data.doc_id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = selectedSO
    ? orders
    : orders.filter(o => {
        const clientId = form.getFieldValue('clientId');
        return clientId ? o.client_id === clientId : true;
      });

  return (
    <>
      <Title level={4}>New Client Invoice</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ workflow: 'CREDIT', currency: 'USD', invoiceDate: dayjs() }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item name="clientId" label="Client" rules={[{ required: true, message: 'Select a client' }]}>
            <Select
              showSearch optionFilterProp="label"
              options={clients.map(c => ({ value: c.client_id, label: c.client_name }))}
              onChange={onClientChange}
              placeholder="Select client…"
            />
          </Form.Item>

          <Form.Item name="saoId" label="Sales Order (optional)">
            <Select
              showSearch optionFilterProp="label" allowClear
              options={filteredOrders.map(o => ({
                value: o.sao_id,
                label: `${o.doc_id} — ${o.client_name} (${o.status})`,
              }))}
              onChange={onSOChange}
              placeholder="Link to a Sales Order…"
            />
          </Form.Item>

          <Form.Item name="workflow" label="Workflow" rules={[{ required: true }]}>
            <Select options={[
              { value: 'CREDIT', label: 'Credit (invoice now)' },
              { value: 'PREPAY', label: 'Prepayment required' },
            ]} />
          </Form.Item>

          <Form.Item name="invoiceDate" label="Invoice Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>

          <Form.Item name="dueDate" label="Due Date">
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>

          <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
            <Select
              options={['USD','EUR','GBP','SGD','AED'].map(c => ({ value: c, label: c }))}
              onChange={v => setCurrency(v)}
            />
          </Form.Item>

          <Form.Item name="clientRef" label="Client Reference / PO Number">
            <Input placeholder="Client's own reference…" />
          </Form.Item>

          <Form.Item name="notes" label="Notes" style={{ gridColumn: 'span 2' }}>
            <Input.TextArea rows={1} />
          </Form.Item>
        </div>

        <Divider>
          <Space>
            Invoice Lines
            {selectedSO && (
              <Button
                size="small" icon={<ImportOutlined />}
                loading={importingLines}
                onClick={importSOLines}
              >
                Import from {selectedSO.doc_id}
              </Button>
            )}
          </Space>
        </Divider>

        {lines.length === 0 && (
          <Alert type="info" showIcon message="Add at least one line to the invoice." style={{ marginBottom: 12 }} />
        )}

        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          pagination={false}
          size="small"
          style={{ marginBottom: 8 }}
        />

        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setLines(p => [...p, { key: Date.now(), description: '', quantity: 1, unitPrice: 0 }])}
          >
            Add Line
          </Button>
        </Space>

        <div style={{ textAlign: 'right', marginBottom: 16, fontSize: 16 }}>
          <Text strong>
            Total: {currency} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </div>

        <Divider />
        <Space>
          <Button onClick={() => navigate('/sales/invoices')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create Invoice
          </Button>
        </Space>
      </Form>
    </>
  );
}
