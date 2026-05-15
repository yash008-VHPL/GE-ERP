import { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Spin, Row, Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import type { VendorBill, Item, Account, VBlBillType } from '../../types/purchase';

const { Title, Text } = Typography;

interface LineRow {
  key:           number;
  itemId?:       number;
  description:   string;
  quantity:      number;
  unitPrice:     number;
  taxRate:       number;
  glAccountCode?: string;
}

const CURRENCY_OPTIONS = ['USD','EUR','AED','INR','GBP','SGD'].map(c => ({ value: c, label: c }));

export function VendorBillEdit() {
  const { docId } = useParams<{ docId: string }>();
  const navigate  = useNavigate();
  const [form]    = Form.useForm();

  const [bill, setBill]         = useState<VendorBill | null>(null);
  const [items, setItems]       = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines]       = useState<LineRow[]>([]);
  const [billType, setBillType] = useState<VBlBillType>('GOODS');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!docId) return;
    Promise.all([
      purchaseApi.get(`/vendor-bills/${docId}`),
      purchaseApi.get('/items'),
      purchaseApi.get('/financials/accounts'),
    ]).then(([billRes, itemRes, accRes]) => {
      const b: VendorBill = billRes.data.data;
      if (b.status !== 'DRAFT') {
        message.error('Only DRAFT bills can be fully edited.');
        navigate(`/purchase/bills/${docId}`);
        return;
      }
      setBill(b);
      setBillType(b.bill_type as VBlBillType);
      setItems(itemRes.data.data);
      setAccounts(accRes.data.data);

      // Pre-fill form
      form.setFieldsValue({
        vendorInvRef: b.vendor_inv_ref ?? '',
        billDate:     dayjs(b.bill_date),
        dueDate:      b.due_date ? dayjs(b.due_date) : null,
        currency:     b.currency,
        notes:        b.notes ?? '',
      });

      // Pre-fill lines
      setLines((b.lines ?? []).map((l, idx) => ({
        key:          idx,
        itemId:       (l as { item_id?: number }).item_id,
        description:  l.description ?? '',
        quantity:     parseFloat(l.quantity),
        unitPrice:    parseFloat(l.unit_price),
        taxRate:      parseFloat(l.tax_rate),
        glAccountCode: l.gl_account_code ?? undefined,
      })));
    }).catch(() => message.error('Failed to load bill'))
      .finally(() => setLoading(false));
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const expenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE' && a.is_active);

  const updateLine = (key: number, field: keyof LineRow, value: unknown) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const calcLineAmount = (l: LineRow) => {
    const sub = l.quantity * l.unitPrice;
    return sub + sub * (l.taxRate / 100);
  };

  const total = lines.reduce((s, l) => s + calcLineAmount(l), 0);

  const handleSave = async (values: Record<string, unknown>) => {
    if (lines.length === 0) { message.warning('Add at least one line'); return; }
    if (lines.some(l => !l.description?.trim())) { message.warning('All lines need a description'); return; }
    setSaving(true);
    try {
      await purchaseApi.patch(`/vendor-bills/${docId}/draft`, {
        vendorInvRef: values.vendorInvRef || null,
        billDate:     (values.billDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        dueDate:      values.dueDate ? (values.dueDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        currency:     values.currency ?? bill?.currency ?? 'USD',
        notes:        values.notes || null,
        lines: lines.map(l => ({
          itemId:        l.itemId ?? null,
          description:   l.description,
          quantity:      l.quantity,
          unitPrice:     l.unitPrice,
          taxRate:       l.taxRate,
          glAccountCode: l.glAccountCode ?? null,
        })),
      });
      message.success('Bill saved');
      navigate(`/purchase/bills/${docId}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const lineColumns = [
    {
      title: 'Item', width: 180,
      render: (_: unknown, row: LineRow) => (
        <Select
          allowClear showSearch style={{ width: '100%' }}
          value={row.itemId}
          onChange={(v: number) => {
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
      render: (_: unknown, row: LineRow) => (
        <Input value={row.description} onChange={e => updateLine(row.key, 'description', e.target.value)} />
      ),
    },
    {
      title: 'Qty', width: 90,
      render: (_: unknown, row: LineRow) => (
        <InputNumber min={0.0001} precision={4} value={row.quantity} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'quantity', v ?? 0)} />
      ),
    },
    {
      title: 'Unit Price', width: 120,
      render: (_: unknown, row: LineRow) => (
        <InputNumber min={0} precision={4} value={row.unitPrice} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'unitPrice', v ?? 0)} />
      ),
    },
    {
      title: 'Tax %', width: 80,
      render: (_: unknown, row: LineRow) => (
        <InputNumber min={0} max={100} precision={2} value={row.taxRate} style={{ width: '100%' }}
          onChange={v => updateLine(row.key, 'taxRate', v ?? 0)} />
      ),
    },
    ...(billType === 'INDIRECT_SERVICE' ? [{
      title: 'GL Account', width: 200,
      render: (_: unknown, row: LineRow) => (
        <Select showSearch style={{ width: '100%' }}
          value={row.glAccountCode}
          onChange={(v: string) => updateLine(row.key, 'glAccountCode', v)}
          options={expenseAccounts.map(a => ({
            value: a.account_code,
            label: `${a.account_code} — ${a.account_name}`,
          }))}
          filterOption={(input, opt) =>
            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
      ),
    }] : []),
    {
      title: 'Amount', width: 110, align: 'right' as const,
      render: (_: unknown, row: LineRow) => <Text strong>{calcLineAmount(row).toFixed(2)}</Text>,
    },
    {
      title: '', width: 40,
      render: (_: unknown, row: LineRow) => (
        <Button danger type="text" size="small" icon={<DeleteOutlined />}
          disabled={lines.length === 1}
          onClick={() => setLines(p => p.filter(l => l.key !== row.key))} />
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', marginTop: 64 }} />;
  if (!bill) return <Text type="danger">Bill not found or not editable.</Text>;

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/purchase/bills/${docId}`)}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>Edit Draft Bill — {docId}</Title>
      </Space>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="billDate" label="Bill Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dueDate" label="Due Date">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="vendorInvRef" label="Vendor Invoice Reference">
              <Input placeholder="Supplier's own invoice number" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>

        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          pagination={false}
          size="small"
          style={{ marginBottom: 8 }}
        />

        <Space style={{ marginBottom: 16 }}>
          <Button icon={<PlusOutlined />}
            onClick={() => setLines(p => [...p, { key: Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 0 }])}>
            Add Line
          </Button>
        </Space>

        <div style={{ textAlign: 'right', marginBottom: 16, fontSize: 16 }}>
          <Text strong>
            Total: {bill.currency} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </div>

        <Space>
          <Button onClick={() => navigate(`/purchase/bills/${docId}`)}>Cancel</Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
            Save Changes
          </Button>
        </Space>
      </Form>
    </>
  );
}
