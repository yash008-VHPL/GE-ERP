import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Steps, Tag,
  Typography, Spin, Divider, message,
} from 'antd';
import { FilePdfOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi, spApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';
import { DocumentUpload } from '../../components/purchase/DocumentUpload';
import { SUPPORTING_DOC_LABEL } from '../../types/document';
import type { PurchaseOrder } from '../../types/purchase';

const { Title, Text, Link } = Typography;

export function PODetail() {
  const { docId }  = useParams<{ docId: string }>();
  const navigate   = useNavigate();
  const [po, setPo]           = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [spDoc, setSpDoc]     = useState<{ sharepoint_web_url: string; stored_filename: string } | null>(null);

  useEffect(() => {
    if (!docId) return;
    Promise.all([
      purchaseApi.get(`/purchase-orders/${docId}`).then(r => setPo(r.data.data)),
      spApi.get(`/documents/${docId}`).then(r => setSpDoc(r.data.data)).catch(() => null),
    ]).finally(() => setLoading(false));
  }, [docId]);

  const handlePdf = async () => {
    const r = await purchaseApi.get(`/purchase-orders/${docId}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  };

  const confirmPO = async () => {
    await purchaseApi.patch(`/purchase-orders/${docId}/status`, { status: 'CONFIRMED' });
    message.success('Purchase Order confirmed');
    purchaseApi.get(`/purchase-orders/${docId}`).then(r => setPo(r.data.data));
  };

  if (loading) return <Spin />;
  if (!po)     return <Text type="danger">Purchase Order not found</Text>;

  const workflowSteps = po.workflow === 'CREDIT'
    ? ['PuO Created', 'PuO Confirmed', 'Goods Received', 'Vendor Bill', 'Payment']
    : ['PuO Created', 'PuO Confirmed', 'Prepayment', 'Goods Received', 'Vendor Bill', 'Applied'];

  const lineColumns = [
    { title: '#',           dataIndex: 'line_seq',   width: 40 },
    { title: 'Item Code',   dataIndex: 'item_code',  width: 120 },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'Qty',         dataIndex: 'quantity',   width: 80,  render: (v: string) => Number(v).toFixed(2) },
    { title: 'UOM',         dataIndex: 'uom',        width: 60 },
    { title: 'Unit Price',  dataIndex: 'unit_price', width: 110, render: (v: string) => `${po.currency} ${Number(v).toFixed(4)}` },
    { title: 'Amount',      dataIndex: 'line_amount',width: 120, render: (v: string) => <strong>{po.currency} {Number(v).toFixed(2)}</strong> },
    { title: 'Received',    dataIndex: 'qty_received',width: 90,render: (v: string) => Number(v).toFixed(2) },
  ];

  const total = (po.lines ?? []).reduce((s, l) => s + Number(l.line_amount), 0);

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase/orders')}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>{po.doc_id}</Title>
        <StatusTag status={po.status} />
      </Space>

      {/* Workflow steps */}
      <Steps size="small" style={{ marginBottom: 24 }}
        items={workflowSteps.map(s => ({ title: s }))}
      />

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Vendor">{po.vendor_name} ({po.vendor_code})</Descriptions.Item>
        <Descriptions.Item label="Workflow"><Tag>{po.workflow}</Tag></Descriptions.Item>
        <Descriptions.Item label="Currency">{po.currency}</Descriptions.Item>
        <Descriptions.Item label="Order Date">{dayjs(po.order_date).format('DD MMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Expected Delivery">{po.expected_date ? dayjs(po.expected_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Notes">{po.notes ?? '—'}</Descriptions.Item>
      </Descriptions>

      <Table
        rowKey="pol_id"
        dataSource={po.lines}
        columns={lineColumns}
        pagination={false}
        size="small"
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6} align="right"><strong>Total</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={1}><strong>{po.currency} {total.toFixed(2)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
          </Table.Summary.Row>
        )}
      />

      <Divider />

      {/* Supporting document */}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text strong>Supporting Document — {SUPPORTING_DOC_LABEL['PuO']}</Text>
        {spDoc ? (
          <Text><Link href={spDoc.sharepoint_web_url} target="_blank">{spDoc.stored_filename}</Link></Text>
        ) : (
          <DocumentUpload docId={po.doc_id} docType="PuO" label={SUPPORTING_DOC_LABEL['PuO']}
            onUploaded={() => spApi.get(`/documents/${docId}`).then(r => setSpDoc(r.data.data))}
          />
        )}
      </Space>

      <Divider />

      {/* Actions */}
      <Space>
        <Button icon={<FilePdfOutlined />} onClick={handlePdf}>Download PO PDF</Button>
        {po.status === 'DRAFT' && (
          <Button type="primary" onClick={confirmPO}>Confirm Purchase Order</Button>
        )}
      </Space>
    </>
  );
}
