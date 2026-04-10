import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Tag, Typography, Spin,
  Select, DatePicker, Row, Col, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;

interface JournalEntry {
  je_id:        number;
  doc_id:       string;
  entry_date:   string;
  description:  string;
  source_type:  string;
  status:       string;
  total_debit:  string;
  total_credit: string;
}

const SOURCE_COLOR: Record<string, string> = {
  MANUAL: 'default',
  VBL:    'blue',
  VPY:    'cyan',
  SIV:    'green',
  CPY:    'lime',
  ITR:    'purple',
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  VBL:    'Vendor Bill',
  VPY:    'Vendor Pmt',
  SIV:    'Sales Invoice',
  CPY:    'Client Pmt',
  ITR:    'COGS / Fulfil',
};

export function JournalEntryList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<string | undefined>(undefined);
  const [from, setFrom]       = useState<string | undefined>(undefined);
  const [to, setTo]           = useState<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);
    purchaseApi.get(`/financials/journal-entries?${params}`)
      .then(r => setEntries(r.data.data))
      .catch(() => message.error('Failed to load journal entries'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<JournalEntry> = [
    {
      title: 'JE No.',
      dataIndex: 'doc_id',
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }}
          onClick={() => navigate(`/financials/journal-entries/${v}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Date', dataIndex: 'entry_date', width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: 'Source', dataIndex: 'source_type', width: 120,
      render: (v: string) => <Tag color={SOURCE_COLOR[v] ?? 'default'}>{SOURCE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={v === 'POSTED' ? 'success' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Debit',  dataIndex: 'total_debit',  width: 120,
      align: 'right' as const,
      render: (v: string) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Credit', dataIndex: 'total_credit', width: 120,
      align: 'right' as const,
      render: (v: string) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={4} style={{ margin: 0 }}>Journal Entries</Title></Col>
        <Col>
          <Space wrap>
            <DatePicker placeholder="From" format="DD MMM YYYY"
              onChange={d => setFrom(d ? d.format('YYYY-MM-DD') : undefined)} />
            <DatePicker placeholder="To"   format="DD MMM YYYY"
              onChange={d => setTo(d ? d.format('YYYY-MM-DD') : undefined)} />
            <Select allowClear placeholder="All Statuses" style={{ width: 130 }}
              value={status} onChange={v => setStatus(v)}
              options={[
                { label: 'Draft',  value: 'DRAFT' },
                { label: 'Posted', value: 'POSTED' },
              ]} />
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => navigate('/financials/journal-entries/create')}>
              New JE
            </Button>
          </Space>
        </Col>
      </Row>

      {loading ? <Spin /> : (
        <Table
          rowKey="je_id"
          dataSource={entries}
          columns={columns}
          size="small"
          pagination={{ pageSize: 30, showSizeChanger: true }}
        />
      )}
    </>
  );
}
