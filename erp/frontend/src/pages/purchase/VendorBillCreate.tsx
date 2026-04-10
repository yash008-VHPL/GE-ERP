import { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Divider, Alert, Row, Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { Vendor, Item, Account, VBlBillType } from '../../types/purchase';

const { Title, Text } = Typography;

const BILL_TYPE_OPTIONS = [
  { value: 'GOODS',            label: 'Goods — links to a Purchase Order' },
  { value: 'DIRECT_SERVICE',   label: 'Direct Service — capitalises into inventory (link to SO)' },
  { value: 'INDIRECT_SERVICE', label: 'Indirect Service — standalone expense bill' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'AED', label: 'AED' },
  { value: 'INR', label: 'INR' },
];

interface PurchaseOrder { puo_id: number; doc_id: string; vendor_id: number; }
interface SalesOrder    { so_id: number; doc_id: string; }

interface LineRow {
  key:           number;
  itemId?:       number;
  description:   string;
  quantity:      number;
  unitPrice:     number;
  taxRate:       number;
  glAccountCode?: string;
}

export function VendorBillCreate() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm() as any[];

  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [items, setItems]       = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pos, setPos]           = useState<PurchaseOrder[]>([]);
  const [sos, setSos]           = useState<SalesOrder[]>([]);
  const [lines, setLines]       = useState<LineRow[]>([{ key: 0, description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);

  const [billType, setBillType] = useState<VBlBillType>('GOODS');
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed from query param ?puoId=...
  useEffect(() => {
    const qPuo = searchParams.get('puoId');
    if (qPuo) form.setFieldsValue({ puoId: parseInt(qPuo) });
  }, [searchParams, form]);

  useEffect(() => {
    Promise.all([
      purchaseApi.get('/vendors?is_active=true'),
      purchaseApi.get('/items'),
      purchaseApi.get('/financials/accounts'),
    ]).then(([v, i, a]) => {
      setVendors(v.data.data);
      setItems(i.data.data);
      setAccounts(a.data.data);
    }).catch(() => message.error('Failed to load reference data'));
  }, []);

  useEffect(() => {
    if (vendorId && (billType === 'GOODS')) {
      purchaseApi.get(`/purchase-orders?vendor_id=${vendorId}&status=CONFIRMED`)
        .then(r => setPos(r.data.data))
        .catch(() => {});
    }
  }, [vendorId, billType]);

  useEffect(() => {
    if (billType === 'DIRECT_SERVICE') {
      purchaseApi.get('/sales-orders')
        .then(r => setSos(r.data.data))
        .catch(() => {});
    }
  }, [billType]);

  const expenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE' && a.is_active);

  const updateLine = (key: number, field: keyof LineRow, value: unknown) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };

  const addLine = () => {
    setLines(prev => [...prev, { key: Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
  };

  const removeLine = (key: number) => {
    setLines(prev => prev.filter(l => l.key !== key));
  };

  const calcLineAmount = (l: LineRow) => {
    const subtotal = l.quantity * l.unitPrice;
    return subtotal + subtotal * (l.taxRate / 100);
  };

  const total = lines.reduce((s, l) => s + calcLineAmount(l), 0);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (lines.length === 0) { message.warning('Add at least one line'); return; }
    setSubmitting(true);
    try {
      const payload = {
        vendorId:      values.vendorId,
        billType,
        puoId:         billType === 'GOODS'          ? values.puoId    : undefined,
        linkedSoId:    billType === 'DIRECT_SERVICE' ? values.linkedSoId : undefined,
        billDate:      (values.billDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        dueDate:       values.dueDate ? (values.dueDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
        vendorInvRef:  values.vendorInvRef ?? undefined,
        currency:      values.currency ?? 'USD',
        notes:         values.notes ?? undefined,
        lines: lines.map(l => ({
          itemId:         l.itemId ?? undefined,
          description:    l.description,
          quantity:       l.quantity,
          unitPrice:      l.unitPrice,
          taxRate:        l.taxRate,
          taxAmount:      l.quantity * l.unitPrice * (l.taxRate / 100),
          glAccountCode:  l.glAccountCode ?? undefined,
        })),
      };
      const { data } = await purchaseApi.post('/vendor-bills', payload);
      message.success(`${data.data.doc_id} created`);
      navigate(`/purchase/bills/${data.data.doc_id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  const lineColumns = [
    {
      title: 'Item',
      dataIndex: 'itemId',
      width: 180,
      render: (_: unknown, row: LineRow) => (
        <Select
          allowClear showSearch
          placeholder="Select item"
          style={{ width: '100%' }}
          value={row.itemId}
          onChange={v => {
            updateLine(row.key, 'itemId', v);
            if (v) {
              const it = items.find(i => i.item_id === v);
              if (it && !row.description) updateLine(row.key, 'description', it.item_name);
            }
          }}
          options={items.map(i => ({ value: i.item_id, label: `${i.item_code} — ${i.item_name}` }))}
          filterOption={(input, opt) =>
            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (_: unknown, row: LineRow) => (
        <Input
          value={row.description}
          onChange={e => updateLine(row.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 90,
      render: (_: unknown, row: LineRow) => (
        <InputNumber
          min={0} value={row.quantity} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'quantity', v ?? 0)}
        />
      ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      width: 110,
      render: (_: unknown, row: LineRow) => (
        <InputNumber
          min={0} value={row.unitPrice} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'unitPrice', v ?? 0)}
        />
      ),
    },
    {
      title: 'Tax %',
      dataIndex: 'taxRate',
      width: 80,
      render: (_: unknown, row: LineRow) => (
        <InputNumber
          min={0} max={100} value={row.taxRate} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'taxRate', v ?? 0)}
        />
      ),
    },
    ...(billType === 'INDIRECT_SERVICE' ? [{
      title: 'GL Account',
      dataIndex: 'glAccountCode',
      width: 200,
      render: (_: unknown, row: LineRow) => (
        <Select
          showSearch placeholder="Select account"
          style={{ width: '100%' }}
          value={row.glAccountCode}
          onChange={(v: string) => updateLine(row.key, 'glAccountCode', v)}
          options={expenseAccounts.map(a => ({
            value: a.account_code,
            label: `${a.account_code} — ${a.account_name}`,
          }))}
          filterOption={(input, opt) =>
            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    }] : []),
    {
      title: 'Amount',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, row: LineRow) => (
        <Text strong>{calcLineAmount(row).toFixed(2)}</Text>
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, row: LineRow) => (
        <Button danger type="text" size="small" icon={<DeleteOutlined />}
          onClick={() => removeLine(row.key)} />
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/purchase/bills')}>← Back</Button>
        <Title level={4} style={{ margin: 0 }}>New Vendor Bill</Title>
      </Space>

      {/* Bill type selector at top — drives the rest of the form */}
      <Alert
        style={{ marginBottom: 20 }}
        type="info"
        message={
          <Row gutter={16} align="middle">
            <Col><Text strong>Bill Type:</Text></Col>
            <Col flex="auto">
              <Select
                value={billType}
                onChange={(v: VBlBillType) => { setBillType(v); form.resetFields(['puoId', 'linkedSoId']); }}
                options={BILL_TYPE_OPTIONS}
                style={{ minWidth: 360 }}
              />
            </Col>
          </Row>
        }
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="vendorId" label="Vendor" rules={[{ required: true }]}>
              <Select
                showSearch placeholder="Select vendor"
                onChange={(v: number) => setVendorId(v)}
                options={vendors.map(v => ({ value: v.vendor_id, label: `${v.vendor_code} — ${v.vendor_name}` }))}
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>

          {billType === 'GOODS' && (
            <Col span={8}>
              <Form.Item name="puoId" label="Purchase Order">
                <Select
                  allowClear showSearch placeholder="Link to PO (optional)"
                  options={pos.map(p => ({ value: p.puo_id, label: p.doc_id }))}
                />
              </Form.Item>
            </Col>
          )}

          {billType === 'DIRECT_SERVICE' && (
            <Col span={8}>
              <Form.Item name="linkedSoId" label="Sales Order" rules={[{ required: true, message: 'Direct service bills must link to a SO' }]}>
                <Select
                  showSearch placeholder="Link to SO"
                  options={sos.map(s => ({ value: s.so_id, label: s.doc_id }))}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
          )}

          <Col span={8}>
            <Form.Item name="vendorInvRef" label="Vendor Invoice Ref">
              <Input placeholder="Vendor's own invoice number" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="billDate" label="Bill Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" defaultValue={dayjs()} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dueDate" label="Due Date">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="currency" label="Currency" initialValue="USD">
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={1} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Line Items</Divider>

        <Table
          rowKey="key"
          dataSource={lines}
          columns={lineColumns}
          pagination={false}
          size="small"
          style={{ marginBottom: 12 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={billType === 'INDIRECT_SERVICE' ? 6 : 5} />
              <Table.Summary.Cell index={1} align="right">
                <Text strong>Total: {total.toFixed(2)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          )}
        />

        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginBottom: 24 }}>
          Add Line
        </Button>

        <Divider />

        <Button type="primary" htmlType="submit" loading={submitting}>
          Create Bill (Draft)
        </Button>
      </Form>
    </>
  );
}
