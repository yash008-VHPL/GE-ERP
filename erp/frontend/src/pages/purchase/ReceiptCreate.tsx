import { useEffect, useState } from 'react';
import {
  Form, Select, DatePicker, Button, InputNumber,
  Table, Space, Typography, message, Divider, Input,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;

interface POOption { puo_id: number; doc_id: string; vendor_name: string; }
interface POLine {
  pol_id: number; line_seq: number; item_code: string | null;
  description: string | null; quantity: string; qty_received: string; uom: string | null;
}
interface ReceiptLine {
  key: number; pol_id: number; description: string; uom: string;
  qtyOrdered: number; qtyAlreadyReceived: number;
  qtyReceiving: number; batchNumber: string; productionDate: dayjs.Dayjs | null;
}

export function ReceiptCreate() {
  const [form]        = Form.useForm();
  const [pos, setPOs] = useState<POOption[]>([]);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    purchaseApi.get('/purchase-orders', { params: { status: 'CONFIRMED' } })
      .then(r => setPOs(r.data.data))
      .catch(() => message.error('Failed to load confirmed POs'));
  }, []);

  const onPOSelect = async (puoId: number) => {
    const r = await purchaseApi.get(`/purchase-orders/${pos.find(p => p.puo_id === puoId)?.doc_id}`);
    const po = r.data.data;
    setLines((po.lines as POLine[]).map((l, i) => ({
      key:                 i,
      pol_id:              l.pol_id,
      description:         l.description ?? l.item_code ?? '',
      uom:                 l.uom ?? '',
      qtyOrdered:          Number(l.quantity),
      qtyAlreadyReceived:  Number(l.qty_received),
      qtyReceiving:        Math.max(0, Number(l.quantity) - Number(l.qty_received)),
      batchNumber:         '',
      productionDate:      null,
    })));
  };

  const updateLine = (key: number, field: keyof ReceiptLine, value: unknown) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const lineColumns = [
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'UOM',  dataIndex: 'uom', width: 60 },
    { title: 'Ordered',  dataIndex: 'qtyOrdered', width: 80 },
    { title: 'Already Rcvd', dataIndex: 'qtyAlreadyReceived', width: 100 },
    {
      title: 'Receiving', width: 100,
      render: (_: unknown, row: ReceiptLine) => (
        <InputNumber
          min={0} max={row.qtyOrdered - row.qtyAlreadyReceived}
          value={row.qtyReceiving} style={{ width: '100%' }}
          onChange={(v: number | null) => updateLine(row.key, 'qtyReceiving', v ?? 0)}
        />
      ),
    },
    {
      title: 'Batch No.', width: 130,
      render: (_: unknown, row: ReceiptLine) => (
        <Input
          value={row.batchNumber} placeholder="Optional"
          onChange={e => updateLine(row.key, 'batchNumber', e.target.value)}
        />
      ),
    },
    {
      title: 'Production Date', width: 150,
      render: (_: unknown, row: ReceiptLine) => (
        <DatePicker
          value={row.productionDate} style={{ width: '100%' }}
          onChange={d => updateLine(row.key, 'productionDate', d)}
        />
      ),
    },
  ];

  const onFinish = async (values: Record<string, unknown>) => {
    if (!lines.length) { message.error('Select a PO first'); return; }
    setSubmitting(true);
    try {
      const payload = {
        puoId:       values.puoId,
        receiptDate: dayjs(values.receiptDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        notes:       values.notes ?? null,
        lines: lines.map(l => ({
          polId:          l.pol_id,
          quantityReceived: l.qtyReceiving,
          batchNumber:    l.batchNumber || null,
          productionDate: l.productionDate ? l.productionDate.format('YYYY-MM-DD') : null,
        })),
      };
      const { data } = await purchaseApi.post('/item-receipts', payload);
      message.success(`Created ${data.data.doc_id}`);
      navigate(`/purchase/receipts/${data.data.doc_id}`);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to create receipt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Title level={4}>New Item Receipt</Title>
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ receiptDate: dayjs() }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item name="puoId" label="Purchase Order" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              options={pos.map(p => ({ value: p.puo_id, label: `${p.doc_id} — ${p.vendor_name}` }))}
              onChange={onPOSelect}
            />
          </Form.Item>
          <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input />
          </Form.Item>
        </div>

        {lines.length > 0 && (
          <>
            <Divider>Lines</Divider>
            <Table dataSource={lines} columns={lineColumns} rowKey="key" pagination={false} size="small" />
          </>
        )}

        <Divider />
        <Space>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={!lines.length}>
            Create Receipt
          </Button>
        </Space>
      </Form>
    </>
  );
}
