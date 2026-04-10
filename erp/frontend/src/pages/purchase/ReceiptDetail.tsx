import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag,
  Typography, Spin, Divider, message, Popconfirm,
  Modal, Form, Input, Alert,
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title, Text } = Typography;

interface ReceiptLine {
  irl_id:          number;
  line_seq:        number;
  pol_id:          number;
  item_code:       string | null;
  description:     string | null;
  uom:             string | null;
  qty_received:    string;
  unit_price:      string;
  line_amount:     string;
  batch_number:    string | null;
  production_date: string | null;
}

interface Receipt {
  itr_id:       number;
  doc_id:       string;
  puo_doc_id:   string;
  vendor_name:  string;
  receipt_date: string;
  status:       string;
  notes:        string | null;
  lines:        ReceiptLine[];
}

export function ReceiptDetail() {
  const { docId }  = useParams<{ docId: string }>();
  const navigate   = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [confirmForm] = Form.useForm();

  useEffect(() => {
    if (!docId) return;
    purchaseApi.get(`/item-receipts/${docId}`)
      .then(r => setReceipt(r.data.data))
      .catch(() => message.error('Failed to load receipt'))
      .finally(() => setLoading(false));
  }, [docId]);

  const handleConfirm = async (values: Record<string, unknown>) => {
    setConfirming(true);
    try {
      const res = await purchaseApi.patch(`/item-receipts/${docId}/status`, {
        status:         'CONFIRMED',
        vendorBatchRef: values.vendorBatchRef ?? null,
        spFolderUrl:    values.spFolderUrl ?? null,
      });
      const docket = res.data?.data?.docket_number;
      message.success(
        docket
          ? `Receipt confirmed — Docket: ${docket} — Inventory lots created`
          : 'Receipt confirmed — PO quantities updated'
      );
      setConfirmModal(false);
      confirmForm.resetFields();
      purchaseApi.get(`/item-receipts/${docId}`).then(r => setReceipt(r.data.data));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to confirm receipt');
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async () => {
    try {
      await purchaseApi.delete(`/item-receipts/${docId}`);
      message.success(`${docId} deleted`);
      navigate('/purchase/receipts');
    } catch {
      message.error('Failed to delete receipt');
    }
  };

  if (loading) return <Spin />;
  if (!receipt) return <Text type="danger">Receipt not found</Text>;

  const lineColumns = [
    { title: '#',              dataIndex: 'line_seq',      width: 40 },
    { title: 'Item Code',      dataIndex: 'item_code',     width: 120, render: (v: string | null) => v ?? '—' },
    { title: 'Description',    dataIndex: 'description',   ellipsis: true },
    { title: 'UOM',            dataIndex: 'uom',           width: 60,  render: (v: string | null) => v ?? '—' },
    { title: 'Qty Received',   dataIndex: 'qty_received',  width: 110, render: (v: string) => Number(v).toFixed(4) },
    { title: 'Unit Price',     dataIndex: 'unit_price',    width: 110, render: (v: string) => Number(v).toFixed(4) },
    { title: 'Line Amount',    dataIndex: 'line_amount',   width: 120, render: (v: string) => <strong>{Number(v).toFixed(2)}</strong> },
    { title: 'Batch No.',      dataIndex: 'batch_number',  width: 120, render: (v: string | null) => v ?? '—' },
    {
      title: 'Production Date', dataIndex: 'production_date', width: 140,
      render: (v: string | null) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase/receipts')}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>{receipt.doc_id}</Title>
        <StatusTag status={receipt.status} />
      </Space>

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Receipt Doc">{receipt.doc_id}</Descriptions.Item>
        <Descriptions.Item label="Against PO">
          <Button type="link" style={{ padding: 0 }}
            onClick={() => navigate(`/purchase/orders/${receipt.puo_doc_id}`)}>
            {receipt.puo_doc_id}
          </Button>
        </Descriptions.Item>
        <Descriptions.Item label="Vendor">{receipt.vendor_name}</Descriptions.Item>
        <Descriptions.Item label="Receipt Date">{dayjs(receipt.receipt_date).format('DD MMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag>{receipt.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Notes">{receipt.notes ?? '—'}</Descriptions.Item>
      </Descriptions>

      <Table
        rowKey="irl_id"
        dataSource={receipt.lines}
        columns={lineColumns}
        pagination={false}
        size="small"
      />

      <Divider />

      <Space>
        {receipt.status === 'DRAFT' && (
          <Button type="primary" icon={<CheckCircleOutlined />}
            onClick={() => setConfirmModal(true)}>
            Confirm Receipt
          </Button>
        )}
        <Popconfirm
          title={`Delete ${receipt.doc_id}?`}
          description="This cannot be undone."
          okText="Delete" okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={handleDelete}
        >
          <Button danger icon={<DeleteOutlined />}>Delete Receipt</Button>
        </Popconfirm>
      </Space>

      {/* Confirm modal — collects docket info before confirming */}
      <Modal
        title={`Confirm Receipt — ${receipt.doc_id}`}
        open={confirmModal}
        onCancel={() => { setConfirmModal(false); confirmForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message="Confirming will update PO received quantities and create inventory lot records (one per line)."
        />
        <Form form={confirmForm} layout="vertical" onFinish={handleConfirm}>
          <Form.Item
            name="vendorBatchRef"
            label="Vendor Batch / Lot Reference"
            tooltip="The vendor's own batch or lot number for this shipment"
          >
            <Input placeholder="e.g. VL-2026-1234" />
          </Form.Item>
          <Form.Item
            name="spFolderUrl"
            label="SharePoint Docket Folder URL"
            tooltip="Paste the SharePoint folder link where the inward docket documents are stored"
            rules={[{
              type: 'url',
              message: 'Enter a valid URL (https://...)',
              warningOnly: true,
            }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="https://giiava.sharepoint.com/sites/..."
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={confirming} block
            icon={<CheckCircleOutlined />}>
            Confirm Receipt &amp; Create Lots
          </Button>
        </Form>
      </Modal>
    </>
  );
}
