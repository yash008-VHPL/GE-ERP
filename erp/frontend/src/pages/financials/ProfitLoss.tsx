import { useEffect, useState } from 'react';
import {
  Button, DatePicker, Typography, Spin, Row, Col,
  Card, Statistic, Table, message,
} from 'antd';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

const { Title, Text } = Typography;

interface PLRow { account_code: string; account_name: string; balance: string; }
interface PLData {
  revenue:        PLRow[];
  expenses:       PLRow[];
  total_revenue:  number;
  total_expenses: number;
  net_income:     number;
}

const accountColumns = [
  { title: 'Code',    dataIndex: 'account_code', width: 90, render: (v: string) => <strong>{v}</strong> },
  { title: 'Account', dataIndex: 'account_name', ellipsis: true },
  {
    title: 'Amount', dataIndex: 'balance', width: 140, align: 'right' as const,
    render: (v: string) => (
      <Text strong>{Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
    ),
  },
];

export function ProfitLoss() {
  const currentYear = dayjs().year();
  const [from, setFrom]       = useState<string>(dayjs().startOf('year').format('YYYY-MM-DD'));
  const [to, setTo]           = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [data, setData]       = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    purchaseApi.get(`/financials/profit-loss?${params}`)
      .then(r => setData(r.data.data))
      .catch(() => message.error('Failed to load P&L'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  void currentYear; // suppress unused warning

  return (
    <>
      <Title level={4} style={{ marginBottom: 16 }}>Profit &amp; Loss</Title>

      <Row gutter={8} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <DatePicker placeholder="From" format="DD MMM YYYY"
            defaultValue={dayjs().startOf('year')}
            onChange={d => setFrom(d ? d.format('YYYY-MM-DD') : dayjs().startOf('year').format('YYYY-MM-DD'))} />
        </Col>
        <Col>
          <DatePicker placeholder="To" format="DD MMM YYYY"
            defaultValue={dayjs()}
            onChange={d => setTo(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))} />
        </Col>
        <Col>
          <Button type="primary" onClick={load}>Run</Button>
        </Col>
      </Row>

      {loading && <Spin />}

      {data && !loading && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total Revenue"  value={data.total_revenue}  precision={2} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total Expenses" value={data.total_expenses} precision={2} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Net Income"
                  value={data.net_income}
                  precision={2}
                  valueStyle={{ color: data.net_income >= 0 ? '#52c41a' : '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Title level={5} style={{ color: '#52c41a' }}>Revenue</Title>
          <Table rowKey="account_code" dataSource={data.revenue}
            columns={accountColumns} pagination={false} size="small" style={{ marginBottom: 24 }} />

          <Title level={5} style={{ color: '#ff4d4f' }}>Expenses</Title>
          <Table rowKey="account_code" dataSource={data.expenses}
            columns={accountColumns} pagination={false} size="small" />
        </>
      )}
    </>
  );
}
