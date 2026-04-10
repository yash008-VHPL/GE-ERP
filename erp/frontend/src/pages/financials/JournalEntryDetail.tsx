import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Button, Space, Tag, Typography, Spin,
  message, Popconfirm,
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title, Text } = Typography;

interface JELine {
  jel_id:       number;
  line_seq:     number;
  account_code: string;
  account_name: string;
  account_type: string;
  description:  string | null;
  debit:        string;
  credit:       string;
}

interface JournalEntry {
  je_id:       number;
  doc_id:      string;
  entry_date:  string;
  description: string;
  reference:   string | null;
  source_type: string;
  status:      string;
  lines:       JELine[];
}

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  VBL:    'Vendor Bill',
  VPY:    'Vendor Payment',
  SIV:    'Sales Invoice',
  CPY:    'Client Payment',
  ITR:    'COGS / Fulfil',
};

export function JournalEntryDetail() {
  const { docId } = useParams<{ docId: string }>();
  const navigate  = useNavigate();
  const [je, setJe]           = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const reload = () => {
    if (!docId) return;
    setLoading(true);
    purchaseApi.get(`/financials/journal-entries/${docId}`)
      .then(r => setJe(r.data.data))
      .catch(() => message.error('Failed to load journal entry'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePost = async () => {
    setPosting(true);
    try {
      await purchaseApi.post(`/financials/journal-entries/${docId}/post`);
      message.success('Journal entry posted');
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to post JE');
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <Spin />;
  if (!je) return <Text type="danger">Journal entry not found</Text>;

  const totalDebit  = je.lines.reduce((s, l) => s + parseFloat(l.debit),  0);
  const totalCredit = je.lines.reduce((s, l) => s + parseFloat(l.credit), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  const lineColumns = [
    { title: '#',           dataIndex: 'line_seq',    width: 40 },
    { title: 'Account',     dataIndex: 'account_code', width: 100, render: (v: string) => <strong>{v}</strong> },
    { title: 'Account Name', dataIndex: 'account_name', ellipsis: true },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: (v: string | null) => v ?? '—' },
    {
      title: 'Debit',  dataIndex: 'debit',  width: 130,
      align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? <Text strong>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credit', dataIndex: 'credit', width: 130,
      align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? <Text strong>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/financials/journal-entries')}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>{je.doc_id}</Title>
        <Tag color={je.status === 'POSTED' ? 'success' : 'default'}>{je.status}</Tag>
        <Tag color="blue">{SOURCE_LABEL[je.source_type] ?? je.source_type}</Tag>
      </Space>

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Entry Date">{dayjs(je.entry_date).format('DD MMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Reference">{je.reference ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Source">{SOURCE_LABEL[je.source_type] ?? je.source_type}</Descriptions.Item>
        <Descriptions.Item label="Description" span={3}>{je.description}</Descriptions.Item>
      </Descriptions>

      <Table
        rowKey="jel_id"
        dataSource={je.lines}
        columns={lineColumns}
        pagination={false}
        size="small"
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}>
              <Text strong>Total</Text>
              {!balanced && <Tag color="error" style={{ marginLeft: 8 }}>NOT BALANCED</Tag>}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text strong>{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <Text strong>{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      {je.status === 'DRAFT' && (
        <Space style={{ marginTop: 16 }}>
          <Popconfirm
            title="Post this journal entry?"
            description={balanced
              ? 'This will lock the entry and update the general ledger.'
              : 'Warning: entry is not balanced!'}
            okText="Post" cancelText="Cancel"
            onConfirm={handlePost}
          >
            <Button type="primary" icon={<CheckCircleOutlined />} loading={posting}>
              Post Entry
            </Button>
          </Popconfirm>
        </Space>
      )}
    </>
  );
}
