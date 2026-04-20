import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag, Typography,
  Spin, Divider, message, Modal, Form, DatePicker,
  InputNumber, Input, Select, Statistic, Row, Col,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined,
  CheckCircleOutlined, DollarOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { EditWithCommentModal } from '../../components/common/EditWithCommentModal';
import { AmendmentHistory } from '../../components/common/AmendmentHistory';

const { Title, Text } = Typography;

interface InvoiceLine {
  invl_id: number;
  line_seq: number;
  description: string;
  quantity: string;
  unit_price: string;
  line_amount: string;
}

interface InvoicePayment {
  cip_id: number;
  doc_id: string;
  payment_date: string;
  amount: string;
  currency: string;
  reference: string | null;
  notes: string | null;
  status: string;
}

interface Invoice {
  inv_id: number;
  doc_id: string;
  sao_doc_id: string | null;
  client_id: number;
  client_name: string;
  client_code: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  workflow: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  total_amount: string;
  amount_paid: string;
  currency: string;
  client_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:           'default',
  POSTED:          'blue',
  PARTIALLY_PAID:  'orange',
  PAID:            'green',
  CANCELLED:       'red',
};

export function InvoiceDetail() {
  const { docId }  = useParams<{ docId: string }>();
  const navigate   = useNavigate();

  const [invoice, setInvoice]     = useState<Invoice | null>(null);
  const [loading, setLoading]     = useState(true);
  const [posting, setPosting]     = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [payModal, setPayModal]   = useState(false);
  const [paying, setPaying]       = useState(false);
  const [amendKey, setAmendKey]   = useState(0);
  const [payForm] = Form.useForm();

  const reload = () => {
    if (!docId) return;
    setLoading(true);
    purchaseApi
      .get(`/invoices/${docId}`)
      .then(r => setInvoice(r.data.data))
      .catch(() => message.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePost = async () => {
    setPosting(true);
    try {
      await purchaseApi.post(`/invoices/${docId}/post`);
      message.success('Invoice posted');
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to post invoice');
    } finally {
      setPosting(false);
    }
  };

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await purchaseApi.patch(`/invoices/${docId}`, {
        dueDate:   values.dueDate
          ? (values.dueDate as dayjs.Dayjs).format('YYYY-MM-DD')
          : null,
        clientRef:  values.clientRef ?? null,
        notes:      values.notes ?? null,
        changeNote: values.changeNote,
      });
      message.success('Invoice updated');
      setEditOpen(false);
      setAmendKey(k => k + 1);
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (values: Record<string, unknown>) => {
    setPaying(true);
    try {
      await purchaseApi.post(`/invoices/${docId}/payment`, {
        paymentDate: (values.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        amount:      values.amount,
        currency:    values.currency ?? invoice?.currency ?? 'USD',
        reference:   values.reference ?? null,
        notes:       values.notes ?? null,
      });
      message.success('Payment recorded');
      setPayModal(false);
      payForm.resetFields();
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 64 }} />;
  if (!invoice) return <Text type="danger">Invoice not found.</Text>;

  const inv = invoice;
  const totalAmt  = Number(inv.total_amount);
  const paidAmt   = Number(inv.amount_paid);
  const balanceAmt = totalAmt - paidAmt;
  const canEdit    = ['DRAFT', 'POSTED', 'PARTIALLY_PAID'].includes(inv.status);
  const canPost    = inv.status === 'DRAFT';
  const canPay     = ['POSTED', 'PARTIALLY_PAID'].includes(inv.status);

  const lineColumns = [
    { title: '#',           dataIndex: 'line_seq',    width: 50 },
    { title: 'Description', dataIndex: 'description' },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 100,
      render: (v: string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      width: 120,
      render: (v: string) =>
        `${inv.currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    },
    {
      title: 'Line Amount',
      dataIndex: 'line_amount',
      width: 140,
      render: (v: string) =>
        `${inv.currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
  ];

  const payColumns = [
    { title: 'Payment No.', dataIndex: 'doc_id', width: 160 },
    {
      title: 'Date',
      dataIndex: 'payment_date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 140,
      render: (v: string) =>
        `${inv.currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    { title: 'Reference', dataIndex: 'reference', render: (v: string | null) => v ?? '—' },
    { title: 'Status',    dataIndex: 'status',    width: 100, render: (v: string) => <Tag color="green">{v}</Tag> },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Back */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/invoices')}>
          Invoices
        </Button>
      </Space>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {inv.doc_id}
          <Tag color={STATUS_COLOR[inv.status] ?? 'default'} style={{ marginLeft: 12, fontSize: 13 }}>
            {inv.status.replace('_', ' ')}
          </Tag>
        </Title>
        <Space>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/sales/invoices/${inv.doc_id}/print`, '_blank')}
          >
            Print / PDF
          </Button>
          {canPost && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={posting}
              onClick={handlePost}
            >
              Post Invoice
            </Button>
          )}
          {canPay && (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => setPayModal(true)}
            >
              Record Payment
            </Button>
          )}
        </Space>
      </div>

      {/* Totals */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Statistic
            title="Total Invoiced"
            value={totalAmt}
            prefix={inv.currency}
            precision={2}
            valueStyle={{ color: '#374151' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Amount Paid"
            value={paidAmt}
            prefix={inv.currency}
            precision={2}
            valueStyle={{ color: '#16a34a' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Balance Due"
            value={balanceAmt}
            prefix={inv.currency}
            precision={2}
            valueStyle={{ color: balanceAmt > 0 ? '#d97706' : '#16a34a' }}
          />
        </Col>
      </Row>

      {/* Header details */}
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Client">
          <Text strong>{inv.client_name}</Text>
          {inv.client_code && <Text type="secondary"> ({inv.client_code})</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Sales Order">
          {inv.sao_doc_id
            ? <Link to={`/sales/orders/${inv.sao_doc_id}`}>{inv.sao_doc_id}</Link>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Invoice Date">
          {dayjs(inv.invoice_date).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label="Due Date">
          {inv.due_date ? dayjs(inv.due_date).format('DD MMM YYYY') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Workflow">
          <Tag color={inv.workflow === 'PREPAY' ? 'purple' : 'blue'}>{inv.workflow}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Currency">{inv.currency}</Descriptions.Item>
        <Descriptions.Item label="Client Reference">{inv.client_ref ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {dayjs(inv.updated_at).format('DD MMM YYYY, HH:mm')}
        </Descriptions.Item>
        {inv.notes && (
          <Descriptions.Item label="Notes" span={2}>{inv.notes}</Descriptions.Item>
        )}
      </Descriptions>

      {/* Lines */}
      <Title level={5}>Invoice Lines</Title>
      <Table
        size="small"
        dataSource={inv.lines}
        columns={lineColumns}
        rowKey="invl_id"
        pagination={false}
        style={{ marginBottom: 32 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4} align="right">
              <Text strong>Total</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1}>
              <Text strong>
                {inv.currency}{' '}
                {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      {/* Payments */}
      {inv.payments.length > 0 && (
        <>
          <Title level={5}>Payments Received</Title>
          <Table
            size="small"
            dataSource={inv.payments}
            columns={payColumns}
            rowKey="cip_id"
            pagination={false}
            style={{ marginBottom: 32 }}
          />
        </>
      )}

      {/* Amendment history */}
      <Divider orientation="left">Amendment History</Divider>
      <AmendmentHistory docId={inv.doc_id} refreshKey={amendKey} />

      {/* Edit modal */}
      <EditWithCommentModal
        open={editOpen}
        title={`Edit Invoice — ${inv.doc_id}`}
        submitting={saving}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleSave}
        fields={[
          {
            name:         'dueDate',
            label:        'Due Date',
            initialValue: inv.due_date ? dayjs(inv.due_date) : null,
            element:      <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />,
          },
          {
            name:         'clientRef',
            label:        'Client Reference',
            initialValue: inv.client_ref ?? '',
            element:      <Input placeholder="Client PO number or reference…" />,
          },
          {
            name:         'notes',
            label:        'Notes',
            initialValue: inv.notes ?? '',
            element:      <Input.TextArea rows={2} placeholder="Any additional notes…" />,
          },
        ]}
      />

      {/* Payment modal */}
      <Modal
        open={payModal}
        title="Record Client Payment"
        okText="Record Payment"
        onCancel={() => { setPayModal(false); payForm.resetFields(); }}
        onOk={() => payForm.validateFields().then(handlePayment).catch(() => {})}
        confirmLoading={paying}
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="paymentDate"
            label="Payment Date"
            rules={[{ required: true, message: 'Required' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              prefix={inv.currency}
              placeholder={`Max ${balanceAmt.toFixed(2)}`}
            />
          </Form.Item>
          <Form.Item name="currency" label="Currency" initialValue={inv.currency}>
            <Select>
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="EUR">EUR</Select.Option>
              <Select.Option value="GBP">GBP</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Payment Reference">
            <Input placeholder="Bank reference / TT number…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
