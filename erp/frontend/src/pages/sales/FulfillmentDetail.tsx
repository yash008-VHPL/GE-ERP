import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag, Typography,
  Spin, Divider, message, Select, DatePicker, Input,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { EditWithCommentModal } from '../../components/common/EditWithCommentModal';
import { AmendmentHistory } from '../../components/common/AmendmentHistory';

const { Title, Text } = Typography;

interface FulfillmentLine {
  itfl_id: number;
  line_seq: number;
  description: string;
  uom: string;
  quantity_fulfilled: string;
  batch_number: string | null;
  production_date: string | null;
}

interface Fulfillment {
  itf_id: number;
  doc_id: string;
  sao_doc_id: string;
  client_name: string;
  fulfillment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: FulfillmentLine[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     'default',
  CONFIRMED: 'green',
  CANCELLED: 'red',
};

const EDITABLE_STATUSES = ['DRAFT', 'CONFIRMED'];

export function FulfillmentDetail() {
  const { docId }   = useParams<{ docId: string }>();
  const navigate    = useNavigate();

  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [loading, setLoading]         = useState(true);
  const [editOpen, setEditOpen]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [amendKey, setAmendKey]       = useState(0);

  const reload = () => {
    if (!docId) return;
    setLoading(true);
    purchaseApi
      .get(`/fulfillments/${docId}`)
      .then(r => setFulfillment(r.data.data))
      .catch(() => message.error('Failed to load fulfillment'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await purchaseApi.patch(`/fulfillments/${docId}`, {
        notes:           values.notes ?? null,
        fulfillmentDate: values.fulfillmentDate
          ? (values.fulfillmentDate as dayjs.Dayjs).format('YYYY-MM-DD')
          : undefined,
        status:    values.status,
        changeNote: values.changeNote,
      });
      message.success('Fulfillment updated');
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

  if (loading) return <Spin style={{ display: 'block', marginTop: 64 }} />;
  if (!fulfillment) return <Text type="danger">Fulfillment not found.</Text>;

  const f = fulfillment;
  const canEdit = EDITABLE_STATUSES.includes(f.status);

  const lineColumns = [
    { title: '#',          dataIndex: 'line_seq',          width: 50 },
    { title: 'Description', dataIndex: 'description' },
    { title: 'UOM',        dataIndex: 'uom',               width: 80 },
    {
      title: 'Qty Fulfilled',
      dataIndex: 'quantity_fulfilled',
      width: 120,
      render: (v: string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }),
    },
    { title: 'Batch',      dataIndex: 'batch_number',       width: 130, render: (v: string | null) => v ?? '—' },
    {
      title: 'Prod. Date',
      dataIndex: 'production_date',
      width: 120,
      render: (v: string | null) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/fulfillments')}>
          Fulfillments
        </Button>
      </Space>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {f.doc_id}
          <Tag color={STATUS_COLOR[f.status] ?? 'default'} style={{ marginLeft: 12, fontSize: 13 }}>
            {f.status}
          </Tag>
        </Title>
        {canEdit && (
          <Button
            icon={<EditOutlined />}
            type="primary"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Details */}
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Document">
          <Text strong>{f.doc_id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Sales Order">
          <Link to={`/sales/orders/${f.sao_doc_id}`}>{f.sao_doc_id}</Link>
        </Descriptions.Item>
        <Descriptions.Item label="Client">{f.client_name}</Descriptions.Item>
        <Descriptions.Item label="Fulfillment Date">
          {dayjs(f.fulfillment_date).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {dayjs(f.created_at).format('DD MMM YYYY, HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {dayjs(f.updated_at).format('DD MMM YYYY, HH:mm')}
        </Descriptions.Item>
        {f.notes && (
          <Descriptions.Item label="Notes" span={2}>
            {f.notes}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Lines */}
      <Title level={5}>Fulfillment Lines</Title>
      <Table
        size="small"
        dataSource={f.lines}
        columns={lineColumns}
        rowKey="itfl_id"
        pagination={false}
        style={{ marginBottom: 32 }}
        locale={{ emptyText: 'No lines' }}
      />

      {/* Amendment history */}
      <Divider orientation="left">Amendment History</Divider>
      <AmendmentHistory docId={f.doc_id} refreshKey={amendKey} />

      {/* Edit modal */}
      <EditWithCommentModal
        open={editOpen}
        title={`Edit Fulfillment — ${f.doc_id}`}
        submitting={saving}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleSave}
        fields={[
          {
            name:  'status',
            label: 'Status',
            initialValue: f.status,
            element: (
              <Select style={{ width: '100%' }}>
                <Select.Option value="DRAFT">Draft</Select.Option>
                <Select.Option value="CONFIRMED">Confirmed</Select.Option>
                <Select.Option value="CANCELLED">Cancelled</Select.Option>
              </Select>
            ),
          },
          {
            name:         'fulfillmentDate',
            label:        'Fulfillment Date',
            initialValue: dayjs(f.fulfillment_date),
            element:      <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />,
          },
          {
            name:         'notes',
            label:        'Notes',
            initialValue: f.notes ?? '',
            element:      <Input.TextArea rows={2} placeholder="Any additional notes…" />,
          },
        ]}
      />
    </div>
  );
}
