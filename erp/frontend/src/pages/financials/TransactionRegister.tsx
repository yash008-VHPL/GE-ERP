import { useEffect, useState } from 'react';
import {
  Table, Button, Select, DatePicker, Typography,
  Row, Col, Tag, Space, message, Statistic, Card,
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SOURCE_COLORS: Record<string, string> = {
  VENDOR_BILL:     'blue',
  VENDOR_PAYMENT:  'cyan',
  SALES_INVOICE:   'green',
  CLIENT_PAYMENT:  'lime',
  COGS:            'orange',
  MANUAL:          'default',
};

const ACCOUNT_COLORS: Record<string, string> = {
  ASSET:     'blue',
  LIABILITY: 'red',
  EQUITY:    'purple',
  REVENUE:   'green',
  EXPENSE:   'orange',
};

interface TxRow {
  entry_date:       string;
  je_ref:           string;
  je_description:   string;
  source_type:      string;
  source_id:        string | null;
  account_code:     string;
  account_name:     string;
  account_type:     string;
  line_description: string | null;
  debit:            string;
  credit:           string;
}

interface Account { account_code: string; account_name: string; }

export function TransactionRegister() {
  const [rows, setRows]           = useState<TxRow[]>([]);
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().startOf('year').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);
  const [accountCode, setAccountCode] = useState<string | undefined>();
  const [sourceType,  setSourceType]  = useState<string | undefined>();

  useEffect(() => {
    purchaseApi.get('/financials/accounts')
      .then(r => setAccounts(r.data.data))
      .catch(() => {});
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange[0]) params.set('from', dateRange[0]);
    if (dateRange[1]) params.set('to',   dateRange[1]);
    if (accountCode)  params.set('account_code', accountCode);
    if (sourceType)   params.set('source_type',  sourceType);
    purchaseApi.get(`/financials/transaction-register?${params}`)
      .then(r => setRows(r.data.data))
      .catch(() => message.error('Failed to load transaction register'))
      .finally(() => setLoading(false));
  };

  const totalDebit  = rows.reduce((s, r) => s + parseFloat(r.debit  || '0'), 0);
  const totalCredit = rows.reduce((s, r) => s + parseFloat(r.credit || '0'), 0);

  const handleExport = () => {
    const filename = `TransactionRegister_${dateRange[0]}_to_${dateRange[1]}`;
    exportToExcel(
      rows.map(r => ({
        entry_date:       dayjs(r.entry_date).format('DD MMM YYYY'),
        je_ref:           r.je_ref,
        je_description:   r.je_description,
        source_type:      r.source_type,
        source_id:        r.source_id ?? '',
        account_code:     r.account_code,
        account_name:     r.account_name,
        account_type:     r.account_type,
        line_description: r.line_description ?? '',
        debit:            parseFloat(r.debit)  || '',
        credit:           parseFloat(r.credit) || '',
      })),
      [
        { key: 'entry_date',       label: 'Date',         width: 14 },
        { key: 'je_ref',           label: 'JE Ref',       width: 20 },
        { key: 'je_description',   label: 'Description',  width: 34 },
        { key: 'source_type',      label: 'Source Type',  width: 18 },
        { key: 'source_id',        label: 'Source Ref',   width: 18 },
        { key: 'account_code',     label: 'Acct Code',    width: 10 },
        { key: 'account_name',     label: 'Account',      width: 30 },
        { key: 'account_type',     label: 'Acct Type',    width: 12 },
        { key: 'line_description', label: 'Line Detail',  width: 24 },
        { key: 'debit',            label: 'Debit',        width: 14 },
        { key: 'credit',           label: 'Credit',       width: 14 },
      ],
      filename,
      'Transactions',
    );
  };

  const columns = [
    {
      title: 'Date', dataIndex: 'entry_date', width: 110, sorter: (a: TxRow, b: TxRow) => a.entry_date.localeCompare(b.entry_date),
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    { title: 'JE Ref', dataIndex: 'je_ref', width: 170,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Description', dataIndex: 'je_description', ellipsis: true },
    {
      title: 'Source', dataIndex: 'source_type', width: 150,
      render: (v: string) => <Tag color={SOURCE_COLORS[v] ?? 'default'} style={{ fontSize: 11 }}>{v.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Account', width: 220,
      render: (_: unknown, r: TxRow) => (
        <Space size={4} direction="vertical" style={{ gap: 0 }}>
          <Text style={{ fontSize: 12 }}><strong>{r.account_code}</strong> {r.account_name}</Text>
          <Tag color={ACCOUNT_COLORS[r.account_type] ?? 'default'} style={{ fontSize: 10, lineHeight: '16px' }}>{r.account_type}</Tag>
        </Space>
      ),
    },
    { title: 'Line Detail', dataIndex: 'line_description', ellipsis: true,
      render: (v: string | null) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : null },
    {
      title: 'Debit', dataIndex: 'debit', width: 120, align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? <Text style={{ color: '#1677ff' }}>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credit', dataIndex: 'credit', width: 120, align: 'right' as const,
      render: (v: string) => parseFloat(v) > 0
        ? <Text style={{ color: '#52c41a' }}>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Transaction Register</Title>
        <Button
          icon={<DownloadOutlined />}
          disabled={rows.length === 0}
          onClick={handleExport}
        >
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <RangePicker
            format="DD MMM YYYY"
            defaultValue={[dayjs().startOf('year'), dayjs()]}
            onChange={dates => {
              if (dates?.[0] && dates?.[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
              }
            }}
          />
        </Col>
        <Col>
          <Select
            showSearch allowClear
            placeholder="All accounts"
            style={{ width: 240 }}
            value={accountCode}
            onChange={v => setAccountCode(v)}
            options={accounts.map(a => ({
              value: a.account_code,
              label: `${a.account_code} — ${a.account_name}`,
            }))}
            filterOption={(input, opt) =>
              String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Col>
        <Col>
          <Select
            allowClear placeholder="All sources"
            style={{ width: 180 }}
            value={sourceType}
            onChange={v => setSourceType(v)}
            options={[
              { value: 'VENDOR_BILL',    label: 'Vendor Bill' },
              { value: 'VENDOR_PAYMENT', label: 'Vendor Payment' },
              { value: 'SALES_INVOICE',  label: 'Sales Invoice' },
              { value: 'CLIENT_PAYMENT', label: 'Client Payment' },
              { value: 'COGS',           label: 'COGS' },
              { value: 'MANUAL',         label: 'Manual JE' },
            ]}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<SearchOutlined />} onClick={load}>Search</Button>
        </Col>
      </Row>

      {/* Totals */}
      {rows.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Card size="small" style={{ minWidth: 160 }}>
              <Statistic title="Total Debit"  value={totalDebit}  precision={2} valueStyle={{ color: '#1677ff', fontSize: 18 }} />
            </Card>
          </Col>
          <Col>
            <Card size="small" style={{ minWidth: 160 }}>
              <Statistic title="Total Credit" value={totalCredit} precision={2} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
            </Card>
          </Col>
          <Col>
            <Card size="small" style={{ minWidth: 120 }}>
              <Statistic title="Lines" value={rows.length} valueStyle={{ fontSize: 18 }} />
            </Card>
          </Col>
        </Row>
      )}

      <Table
        rowKey={(r, i) => `${r.je_ref}-${i}`}
        dataSource={rows}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['50', '100', '250', 'All'] as unknown as number[] }}
        scroll={{ x: 1200 }}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6}><Text strong>Totals</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              <Text strong style={{ color: '#1677ff' }}>
                {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              <Text strong style={{ color: '#52c41a' }}>
                {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </>
  );
}
