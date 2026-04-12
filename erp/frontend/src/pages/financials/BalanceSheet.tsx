import { useEffect, useState } from 'react';
import {
  Button, DatePicker, Typography, Spin, Alert,
  Row, Col, Card, Statistic, Table, message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { exportToExcelMultiSheet } from '../../utils/exportExcel';

const { Title, Text } = Typography;

interface BSRow { account_code: string; account_name: string; balance: string; }
interface BSSection { accounts: BSRow[]; total: number; }
interface BSData {
  sections: {
    ASSET:     BSSection;
    LIABILITY: BSSection;
    EQUITY:    BSSection;
  };
  balanced:   boolean;
  difference: number;
}

const accountColumns = [
  { title: 'Code',    dataIndex: 'account_code', width: 90, render: (v: string) => <strong>{v}</strong> },
  { title: 'Account', dataIndex: 'account_name', ellipsis: true },
  {
    title: 'Balance', dataIndex: 'balance', width: 140, align: 'right' as const,
    render: (v: string) => (
      <Text strong>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
    ),
  },
];

export function BalanceSheet() {
  const [asOf, setAsOf]       = useState<string | undefined>(dayjs().format('YYYY-MM-DD'));
  const [data, setData]       = useState<BSData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (asOf) params.set('as_of', asOf);
    purchaseApi.get(`/financials/balance-sheet?${params}`)
      .then(r => setData(r.data.data))
      .catch(() => message.error('Failed to load balance sheet'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>Balance Sheet</Title>

      <Row gutter={8} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <DatePicker placeholder="As of date" format="DD MMM YYYY"
            defaultValue={dayjs()}
            onChange={d => setAsOf(d ? d.format('YYYY-MM-DD') : undefined)} />
        </Col>
        <Col>
          <Button type="primary" onClick={load}>Run</Button>
        </Col>
        <Col>
          <Button
            icon={<DownloadOutlined />}
            disabled={!data}
            onClick={() => {
              if (!data) return;
              const acctHeaders = [
                { key: 'account_code', label: 'Code',    width: 10 },
                { key: 'account_name', label: 'Account', width: 36 },
                { key: 'balance',      label: 'Balance', width: 16 },
              ];
              exportToExcelMultiSheet([
                {
                  name: 'Assets',
                  headers: acctHeaders,
                  rows: [
                    ...data.sections.ASSET.accounts as any[],
                    { account_code: '', account_name: 'TOTAL ASSETS', balance: data.sections.ASSET.total },
                  ],
                },
                {
                  name: 'Liabilities',
                  headers: acctHeaders,
                  rows: [
                    ...data.sections.LIABILITY.accounts as any[],
                    { account_code: '', account_name: 'TOTAL LIABILITIES', balance: data.sections.LIABILITY.total },
                  ],
                },
                {
                  name: 'Equity',
                  headers: acctHeaders,
                  rows: [
                    ...data.sections.EQUITY.accounts as any[],
                    { account_code: '', account_name: 'TOTAL EQUITY', balance: data.sections.EQUITY.total },
                  ],
                },
                {
                  name: 'Summary',
                  headers: [
                    { key: 'label',  label: 'Section',  width: 24 },
                    { key: 'amount', label: 'Total',     width: 16 },
                  ],
                  rows: [
                    { label: 'Total Assets',      amount: data.sections.ASSET.total },
                    { label: 'Total Liabilities', amount: data.sections.LIABILITY.total },
                    { label: 'Total Equity',      amount: data.sections.EQUITY.total },
                    { label: 'Balanced',          amount: data.balanced ? 'YES' : 'NO' },
                  ],
                },
              ], `BalanceSheet_${asOf ?? dayjs().format('YYYY-MM-DD')}`);
            }}
          >
            Export Excel
          </Button>
        </Col>
      </Row>

      {loading && <Spin />}

      {data && !loading && (
        <>
          {!data.balanced && (
            <Alert type="error" message={`Balance sheet does not balance! Difference: ${data.difference.toFixed(2)}`}
              style={{ marginBottom: 16 }} />
          )}

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Total Assets"      value={data.sections.ASSET.total}     precision={2} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Total Liabilities" value={data.sections.LIABILITY.total} precision={2} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Total Equity"      value={data.sections.EQUITY.total}    precision={2} valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
          </Row>

          <Title level={5} style={{ color: '#1677ff' }}>Assets</Title>
          <Table rowKey="account_code" dataSource={data.sections.ASSET.accounts}
            columns={accountColumns} pagination={false} size="small" style={{ marginBottom: 24 }} />

          <Title level={5} style={{ color: '#ff4d4f' }}>Liabilities</Title>
          <Table rowKey="account_code" dataSource={data.sections.LIABILITY.accounts}
            columns={accountColumns} pagination={false} size="small" style={{ marginBottom: 24 }} />

          <Title level={5} style={{ color: '#722ed1' }}>Equity</Title>
          <Table rowKey="account_code" dataSource={data.sections.EQUITY.accounts}
            columns={accountColumns} pagination={false} size="small" />
        </>
      )}
    </>
  );
}
