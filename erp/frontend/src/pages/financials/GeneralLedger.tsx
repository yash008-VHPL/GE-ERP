import { useEffect, useState } from 'react';
import {
  Table, Button, Select, DatePicker, Typography,
  Spin, Alert, Descriptions, message, Space, Row, Col,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;

interface Account { account_code: string; account_name: string; account_type: string; normal_balance: string; }
interface GLLine {
  jel_id:           number;
  entry_date:       string;
  doc_id:           string;
  je_description:   string;
  line_description: string | null;
  source_type:      string;
  debit:            string;
  credit:           string;
  running_balance:  number;
}
interface GLData {
  account:         Account;
  opening_balance: number;
  closing_balance: number;
  lines:           GLLine[];
}

export function GeneralLedger() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [code, setCode]         = useState<string | undefined>(undefined);
  const [from, setFrom]         = useState<string | undefined>(undefined);
  const [to, setTo]             = useState<string | undefined>(undefined);
  const [data, setData]         = useState<GLData | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    purchaseApi.get('/financials/accounts')
      .then(r => setAccounts(r.data.data))
      .catch(() => message.error('Failed to load accounts'));
  }, []);

  const load = () => {
    if (!code) return;
    setLoading(true);
    const params = new URLSearchParams({ account_code: code });
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    purchaseApi.get(`/financials/general-ledger?${params}`)
      .then(r => setData(r.data.data))
      .catch(() => message.error('Failed to load ledger'))
      .finally(() => setLoading(false));
  };

  const columns = [
    {
      title: 'Date', dataIndex: 'entry_date', width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    { title: 'JE',          dataIndex: 'doc_id',           width: 160 },
    { title: 'Description', dataIndex: 'je_description',   ellipsis: true },
    { title: 'Line Desc',   dataIndex: 'line_description', ellipsis: true, render: (v: string | null) => v ?? '—' },
    {
      title: 'Debit',  dataIndex: 'debit',  width: 120, align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credit', dataIndex: 'credit', width: 120, align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Balance', dataIndex: 'running_balance', width: 130, align: 'right' as const,
      render: (v: number) => (
        <Text strong type={v < 0 ? 'danger' : undefined}>
          {v.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ];

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>General Ledger</Title>

      <Row gutter={8} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Select
            showSearch placeholder="Select account"
            style={{ width: 280 }}
            value={code}
            onChange={v => setCode(v)}
            options={accounts.map(a => ({
              value: a.account_code,
              label: `${a.account_code} — ${a.account_name}`,
            }))}
            filterOption={(input, opt) =>
              String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Col>
        <Col>
          <DatePicker placeholder="From" format="DD MMM YYYY"
            onChange={d => setFrom(d ? d.format('YYYY-MM-DD') : undefined)} />
        </Col>
        <Col>
          <DatePicker placeholder="To" format="DD MMM YYYY"
            onChange={d => setTo(d ? d.format('YYYY-MM-DD') : undefined)} />
        </Col>
        <Col>
          <Button type="primary" onClick={load} disabled={!code}>Load</Button>
        </Col>
        <Col>
          <Button
            icon={<DownloadOutlined />}
            disabled={!data}
            onClick={() => {
              if (!data) return;
              const filename = `GL_${data.account.account_code}_${dayjs().format('YYYY-MM-DD')}`;
              exportToExcel(
                [
                  // Opening balance row
                  { date: '', doc_id: '', je_description: 'Opening Balance', line_description: '', debit: '', credit: '', running_balance: data.opening_balance },
                  ...data.lines.map(l => ({
                    date: dayjs(l.entry_date).format('DD MMM YYYY'),
                    doc_id: l.doc_id,
                    je_description: l.je_description,
                    line_description: l.line_description ?? '',
                    source_type: l.source_type,
                    debit: parseFloat(l.debit) || '',
                    credit: parseFloat(l.credit) || '',
                    running_balance: l.running_balance,
                  })),
                  // Closing balance row
                  { date: '', doc_id: '', je_description: 'Closing Balance', line_description: '', debit: '', credit: '', running_balance: data.closing_balance },
                ],
                [
                  { key: 'date',            label: 'Date',         width: 14 },
                  { key: 'doc_id',          label: 'JE Ref',       width: 18 },
                  { key: 'je_description',  label: 'Description',  width: 32 },
                  { key: 'line_description',label: 'Line Detail',  width: 24 },
                  { key: 'source_type',     label: 'Source',       width: 16 },
                  { key: 'debit',           label: 'Debit',        width: 14 },
                  { key: 'credit',          label: 'Credit',       width: 14 },
                  { key: 'running_balance', label: 'Balance',      width: 14 },
                ],
                filename,
                `${data.account.account_code} — ${data.account.account_name}`,
              );
            }}
          >
            Export Excel
          </Button>
        </Col>
      </Row>

      {loading && <Spin />}

      {data && !loading && (
        <>
          <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Account">
              <strong>{data.account.account_code}</strong> — {data.account.account_name}
            </Descriptions.Item>
            <Descriptions.Item label="Type">{data.account.account_type}</Descriptions.Item>
            <Descriptions.Item label="Opening Balance">
              {data.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Closing Balance">
              <Text strong type={data.closing_balance < 0 ? 'danger' : undefined}>
                {data.closing_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          {data.lines.length === 0 && (
            <Alert type="info" message="No transactions in this period" />
          )}

          <Table
            rowKey="jel_id"
            dataSource={data.lines}
            columns={columns}
            pagination={false}
            size="small"
            scroll={{ y: 500 }}
          />
        </>
      )}

      {!data && !loading && (
        <Space style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <Text type="secondary">Select an account and date range to view the ledger.</Text>
        </Space>
      )}
    </>
  );
}
