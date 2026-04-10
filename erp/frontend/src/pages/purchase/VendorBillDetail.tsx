import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag, Typography,
  Spin, Divider, message, Popconfirm, Modal, Form,
  DatePicker, InputNumber, Input, Select,
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined,
  CheckCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';
import type { VendorBill } from '../../types/purchase';

const { Title, Text } = Typography;

const BILL_TYPE_LABEL: Record<string, string> = {
  GOODS:            'Goods',
  DIRECT_SERVICE:   'Direct Service',
  INDIRECT_SERVICE: 'Indirect Service',
};

const BILL_TYPE_COLOR: Record<string, string> = {
  GOODS:            'blue',
  DIRECT_SERVICE:   'purple',
  INDIRECT_SERVICE: 'orange',
};

export function VendorBillDetail() {
  const { docId } = useParams<{ docId: string }>();
  const navigate  = useNavigate();

  const [bill, setBill]           = useState<VendorBill | null>(null);
  const [loading, setLoading]     = useState(true);
  const [posting, setPosting]     = useState(false);
  const [payModal, setPayModal]   = useState(false);
  const [paying, setPaying]       = useState(false);
  const [payForm] = Form.useForm();

  const reload = () => {
    if (!docId) return;
    setLoading(true);
    purchaseApi.get(`/vendor-bills/${docId}`)
      .then(r => setBill(r.data.data))
      .catch(() => message.error('Failed to load bill'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePost = async () => {
    setPosting(true);
    try {
      await purchaseApi.patch(`/vendor-bills/${docId}/status`, { status: 'POSTED' });
      message.success('Bill posted — journal entry created');
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to post bill');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await purchaseApi.delete(`/vendor-bills/${docId}`);
      message.success(`${docId} deleted`);
      navigate('/purchase/bills');
    } catch {
      message.error('Failed to delete bill');
    }
  };

  const handlePayment = async (values: Record<string, unknown>) => {
    setPaying(true);
    try {
      await purchaseApi.post(`/vendor-bills/${docId}/payment`, {
        paymentDate:   (values.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        paymentMethod: values.paymentMethod ?? null,
        paymentRef:    values.paymentRef ?? null,
        amount:        values.amount,
      });
      message.success('Payment recorded — journal entry created');
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

  if (loading) return <Spin />;
  if (!bill) return <Text type="danger">Bill not found</Text>;

  const outstanding = Math.max(0, parseFloat(bill.total_amount) - parseFloat(bill.amount_paid));

  const lineColumns = [
    { title: '#',          dataIndex: 'line_seq',      width: 40 },
    { title: 'Item',       dataIndex: 'item_code',     width: 100, render: (v: string | null) => v ?? '—' },
    { title: 'Description', dataIndex: 'description',  ellipsis: true },
    { title: 'Qty',        dataIndex: 'quantity',      width: 80,  render: (v: string) => Number(v).toFixed(4) },
    { title: 'Unit Price', dataIndex: 'unit_price',    width: 110, render: (v: string) => Number(v).toFixed(4) },
    { title: 'Tax %',      dataIndex: 'tax_rate',      width: 70,  render: (v: string) => `${Number(v).toFixed(2)}%` },
    { title: 'Tax Amt',    dataIndex: 'tax_amount',    width: 100, render: (v: string) => Number(v).toFixed(2) },
    { title: 'Amount',     dataIndex: 'line_amount',   width: 120,
      render: (v: string) => <strong>{Number(v).toFixed(2)}</strong> },
    { title: 'GL Account', dataIndex: 'gl_account_code', width: 100, render: (v: string | null) => v ?? '—' },
    { title: 'GL Name',    dataIndex: 'gl_account_name', width: 160, render: (v: string | null) => v ?? '—' },
  ];

  const paymentColumns = [
    { title: 'Date',    dataIndex: 'payment_date',   width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Method',  dataIndex: 'payment_method', width: 120, render: (v: string | null) => v ?? '—' },
    { title: 'Ref',     dataIndex: 'payment_ref',    width: 140, render: (v: string | null) => v ?? '—' },
    { title: 'Amount',  dataIndex: 'amount',         width: 120,
      render: (v: string) => <strong>{Number(v).toFixed(2)}</strong> },
    { title: 'Currency', dataIndex: 'currency',      width: 80 },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase/bills')}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>{bill.doc_id}</Title>
        <Tag color={BILL_TYPE_COLOR[bill.bill_type]}>{BILL_TYPE_LABEL[bill.bill_type]}</Tag>
        <StatusTag status={bill.status} />
      </Space>

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Bill Doc">{bill.doc_id}</Descriptions.Item>
        <Descriptions.Item label="Vendor">{bill.vendor_name} ({bill.vendor_code})</Descriptions.Item>
        <Descriptions.Item label="Vendor Inv Ref">{bill.vendor_inv_ref ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Bill Date">{dayjs(bill.bill_date).format('DD MMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Due Date">
          {bill.due_date ? dayjs(bill.due_date).format('DD MMM YYYY') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Currency">{bill.currency}</Descriptions.Item>

        {bill.puo_doc_id && (
          <Descriptions.Item label="PO Ref">
            <Button type="link" style={{ padding: 0 }}
              onClick={() => navigate(`/purchase/orders/${bill.puo_doc_id}`)}>
              {bill.puo_doc_id}
            </Button>
          </Descriptions.Item>
        )}
        {bill.so_doc_id && (
          <Descriptions.Item label="SO Ref">
            <Button type="link" style={{ padding: 0 }}
              onClick={() => navigate(`/sales/orders/${bill.so_doc_id}`)}>
              {bill.so_doc_id}
            </Button>
          </Descriptions.Item>
        )}

        <Descriptions.Item label="Subtotal">
          {bill.currency} {Number(bill.subtotal).toFixed(2)}
        </Descriptions.Item>
        <Descriptions.Item label="Tax">
          {bill.currency} {Number(bill.tax_amount).toFixed(2)}
        </Descriptions.Item>
        <Descriptions.Item label="Total">
          <strong>{bill.currency} {Number(bill.total_amount).toFixed(2)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Amount Paid">
          {bill.currency} {Number(bill.amount_paid).toFixed(2)}
        </Descriptions.Item>
        <Descriptions.Item label="Outstanding">
          <Text type={outstanding > 0 ? 'danger' : 'success'}>
            {bill.currency} {outstanding.toFixed(2)}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Notes">{bill.notes ?? '—'}</Descriptions.Item>
      </Descriptions>

      <Title level={5}>Lines</Title>
      <Table
        rowKey="line_seq"
        dataSource={bill.lines ?? []}
        columns={lineColumns}
        pagination={false}
        size="small"
        style={{ marginBottom: 24 }}
      />

      <Title level={5}>Payments</Title>
      <Table
        rowKey="vbp_id"
        dataSource={bill.payments ?? []}
        columns={paymentColumns}
        pagination={false}
        size="small"
        style={{ marginBottom: 24 }}
        locale={{ emptyText: 'No payments recorded' }}
      />

      <Divider />

      <Space>
        {bill.status === 'DRAFT' && (
          <Popconfirm
            title="Post this bill?"
            description="This will create a journal entry and lock the bill."
            okText="Post" cancelText="Cancel"
            onConfirm={handlePost}
          >
            <Button type="primary" icon={<CheckCircleOutlined />} loading={posting}>
              Post Bill
            </Button>
          </Popconfirm>
        )}

        {(bill.status === 'POSTED' || bill.status === 'PARTIALLY_PAID') && outstanding > 0 && (
          <Button icon={<DollarOutlined />} onClick={() => setPayModal(true)}>
            Record Payment
          </Button>
        )}

        {bill.status === 'DRAFT' && (
          <Popconfirm
            title={`Delete ${bill.doc_id}?`}
            description="Only draft bills can be deleted."
            okText="Delete" okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={handleDelete}
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        )}
      </Space>

      {/* Payment modal */}
      <Modal
        title={`Record Payment — ${bill.doc_id}`}
        open={payModal}
        onCancel={() => { setPayModal(false); payForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={payForm} layout="vertical" onFinish={handlePayment}>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" defaultValue={dayjs()} />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}
            initialValue={outstanding}>
            <InputNumber
              min={0.01} max={outstanding} step={0.01}
              style={{ width: '100%' }}
              addonBefore={bill.currency}
            />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method">
            <Select
              allowClear
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer' },
                { value: 'Wise',          label: 'Wise' },
                { value: 'Cheque',        label: 'Cheque' },
                { value: 'Cash',          label: 'Cash' },
              ]}
            />
          </Form.Item>
          <Form.Item name="paymentRef" label="Payment Reference">
            <Input placeholder="UTR / cheque no. / etc." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={paying} block>
            Record Payment
          </Button>
        </Form>
      </Modal>
    </>
  );
}
