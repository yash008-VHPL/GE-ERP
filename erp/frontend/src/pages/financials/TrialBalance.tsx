import { useEffect, useState } from 'react';
import {
  Table, Button, DatePicker, Typography, Spin, Alert, Tag,
  Row, Col, Statistic, Card, message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;

interface TBRow {
  account_code:   string;
  account_name:   string;
  account_type:   string;
  normal_balance: string;
  total_debit:    string;
  total_credit:   string;
  balance:        string;
}

interface TBData {
  rows:         TBRow[];
  total_debit:  number;
  total_credit: number;
  balanced:     boolean;
}

const TYPE_COLOR: Record<string, string> = {
  ASSET:     'blue',
  LIABILITY: 'red',
  EQUITY:    'purple',
  REVENUE:   'green',
  EXPENSE:   'orange',
};

export function TrialBalance() {
  const [asOf, setAsOf]       = useState<string | undefined>(undefined);
  const [data, setData]       = useState<TBData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (asOf) params.set('as_of', asOf);
    purchaseApi.get(`/financials/trial-balance?${params}`)
      .then(r => setData(r.data.data))
      .catch(() => message.error('Failed to load trial balance'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { title: 'Code',    dataIndex: 'account_code', width: 90, render: (v: string) => <strong>{v}</strong> },
    { title: 'Account', dataIndex: 'account_name', ellipsis: true },
    {
      title: 'Type', dataIndex: 'account_type', width: 100,
      render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Dr Balance', dataIndex: 'total_debit', width: 130, align: 'right' as const,
      render: (v: string) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Cr Balance', dataIndex: 'total_credit', width: 130, align: 'right' as const,
      render: (v: string) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Net Balance', dataIndex: 'balance', width: 130, align: 'right' as const,
      render: (v: string) => (
        <Text strong type={parseFloat(v) < 0 ? 'danger' : undefined}>
          {Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ];

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>Trial Balance</Title>

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
              exportToExcel(
                [
                  ...data.rows,
                  { account_code: 'TOTAL', account_name: '', account_type: '', total_debit: data.total_debit, total_credit: data.total_credit, balance: '' },
                ],
                [
                  { key: 'account_code',  label: 'Code',         width: 10 },
                  { key: 'account_name',  label: 'Account',      width: 36 },
                  { key: 'account_type',  label: 'Type',         width: 12 },
                  { key: 'total_debit',   label: 'Dr Balance',   width: 16 },
                  { key: 'total_credit',  label: 'Cr Balance',   width: 16 },
                  { key: 'balance',       label: 'Net Balance',  width: 16 },
                ],
                `TrialBalance_${asOf ?? dayjs().format('YYYY-MM-DD')}`,
                'Trial Balance',
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
          {!data.balanced && (
            <Alert
              type="error"
              message={`Trial balance is NOT balanced! Debit: ${data.total_debit.toFixed(2)} ≠ Credit: ${data.total_credit.toFixed(2)}`}
              style={{ marginBottom: 16 }}
            />
          )}
          {data.balanced && (
            <Alert type="success" message="Trial balance is balanced." style={{ marginBottom: 16 }} />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total Debit"  value={data.total_debit}  precision={2} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total Credit" value={data.total_credit} precision={2} />
              </Card>
            </Col>
          </Row>

          <Table
            rowKey="account_code"
            dataSource={data.rows}
            columns={columns}
            pagination={false}
            size="small"
          />
        </>
      )}
    </>
  );
}
