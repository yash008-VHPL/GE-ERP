import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Typography, Space, Spin, Row, Col, message,
  Modal, Form, Input, Button,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface ClientInvoicePayment {
  cip_id:       number;
  doc_id:       string;
  inv_id:       number;
  inv_doc_id:   string;
  client_name:  string;
  client_code:  string;
  payment_date: string;
  amount:       string;
  currency:     string;
  reference:    string | null;
  status:       string;
  notes:        string | null;
}

export function ClientPaymentList() {
  const navigate = useNavigate();
  const [payments, setPayments]   = useState<ClientInvoicePayment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editRow, setEditRow]     = useState<ClientInvoicePayment | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    purchaseApi.get('/payments/client-invoices')
      .then(r => setPayments(r.data.data))
      .catch(() => message.error('Failed to load client payments'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = async (values: Record<string, unknown>) => {
    if (!editRow) return;
    setSaving(true);
    try {
      await purchaseApi.patch(`/payments/client-invoice/${editRow.doc_id}`, {
        reference:  values.reference ?? null,
        notes:      values.notes ?? null,
        changeNote: values.changeNote,
      });
      message.success('Payment updated');
      setEditRow(null);
      form.resetFields();
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<ClientInvoicePayment> = [
    {
      title: 'Payment No.', dataIndex: 'doc_id', width: 165,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    { title: 'Client', dataIndex: 'client_name', width: 150, ellipsis: true },
    {
      title: 'Invoice Ref',
      dataIndex: 'inv_doc_id',
      width: 180,
      render: (v: string) => (
        <a
          style={{ fontFamily: 'monospace' }}
          onClick={e => { e.stopPropagation(); navigate(`/sales/invoices/${v}`); }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'Payment Date',
      dataIndex: 'payment_date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 130,
      align: 'right' as const,
      render: (v: string, row) =>
        `${row.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    { title: 'Currency', dataIndex: 'currency', width: 90 },
    {
      title: 'Reference',
      dataIndex: 'reference',
      width: 150,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      width: 150,
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '', width: 55,
      render: (_: unknown, row: ClientInvoicePayment) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={e => {
            e.stopPropagation();
            setEditRow(row);
            form.setFieldsValue({
              reference:  row.reference ?? '',
              notes:      row.notes ?? '',
              changeNote: '',
            });
          }}
        />
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Client Payments</Title>
        </Col>
      </Row>

      {loading ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="cip_id"
          dataSource={payments}
          columns={columns}
          size="small"
          scroll={{ x: 1330 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      )}

      {/* Payment correction modal */}
      <Modal
        title={`Correct Payment — ${editRow?.doc_id}`}
        open={!!editRow}
        onCancel={() => { setEditRow(null); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="reference" label="Payment Reference">
            <Input placeholder="Bank TT / reference number…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="changeNote"
            label="Reason for correction"
            rules={[{ required: true, message: 'Please explain the correction' }]}
          >
            <Input.TextArea rows={2} placeholder="e.g. Reference was missing — TT number is XYZ" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>
            Save Correction
          </Button>
        </Form>
      </Modal>
    </>
  );
}
