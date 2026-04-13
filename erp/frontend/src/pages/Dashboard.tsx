import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Button, Space, Tag, Spin, Divider, Tooltip } from 'antd';
import {
  FileTextOutlined, InboxOutlined, BankOutlined, DollarOutlined,
  ShoppingCartOutlined, SendOutlined, FileDoneOutlined, StockOutlined,
  BookOutlined, ArrowRightOutlined, WarningOutlined,
  RiseOutlined, GoldOutlined, FallOutlined, WalletOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import dayjs from 'dayjs';
import { purchaseApi } from '../config/apiClient';
import { useUserRoles, hasAnyRole } from '../hooks/useUserRoles';

const { Title, Text } = Typography;

interface StatCard {
  title: string;
  icon: React.ReactNode;
  value: number;
  total: number;
  label: string;
  sublabel: string;
  warn: boolean;
  route: string;
  action: string;
  color: string;
}

interface NavSummary {
  net_asset_value: number;
  total_assets: number;
  inventory_value: number;
  bank_value: number;
  receivables_value: number;
  other_assets_value: number;
  receivables_other_assets: number;
  total_liabilities: number;
}

function greeting() {
  const h = dayjs().hour();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function count(list: any[], ...statuses: string[]): number {
  if (!statuses.length) return list.length;
  return list.filter(i => statuses.includes(i.status)).length;
}

function fmtCcy(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function Dashboard() {
  const navigate = useNavigate();
  const { accounts } = useMsal();
  const roles = useUserRoles();
  const userName = accounts[0]?.name ?? accounts[0]?.username ?? 'there';
  const firstName = userName.split(' ')[0];

  const showProcurement = hasAnyRole(roles, 'Admin', 'Management', 'Coordination');
  const showSales       = hasAnyRole(roles, 'Admin', 'Management', 'Coordination');
  const showInventory   = hasAnyRole(roles, 'Admin', 'Management', 'Coordination');
  const showFinancials  = hasAnyRole(roles, 'Admin', 'Management');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData]       = useState<Record<string, any[]>>({});
  const [nav, setNav]         = useState<NavSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoints: Record<string, string> = {};
    if (showProcurement) {
      endpoints.pos      = '/purchase-orders';
      endpoints.receipts = '/item-receipts';
      endpoints.bills    = '/vendor-bills';
      endpoints.payments = '/payments';
    }
    if (showSales) {
      endpoints.sos          = '/sales-orders';
      endpoints.fulfillments = '/fulfillments';
      endpoints.invoices     = '/invoices';
      endpoints.clientPay    = '/client-payments';
    }
    if (showInventory) {
      endpoints.lots = '/inventory-lots';
    }
    if (showFinancials) {
      endpoints.journals = '/financials/journal-entries';
    }

    const listFetches = Object.entries(endpoints).map(([key, url]) =>
      purchaseApi.get(url)
        .then(r => ({ key, list: r.data.data ?? [] }))
        .catch(() => ({ key, list: [] }))
    );

    const navFetch = showFinancials
      ? purchaseApi.get('/financials/nav-summary')
          .then(r => r.data.data as NavSummary)
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      Promise.allSettled(listFetches),
      navFetch,
    ]).then(([listResults, navData]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any[]> = {};
      listResults.forEach(r => {
        if (r.status === 'fulfilled') map[r.value.key] = r.value.list;
      });
      setData(map);
      setNav(navData);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos      = data.pos      ?? [];
  const receipts = data.receipts ?? [];
  const bills    = data.bills    ?? [];
  const payments = data.payments ?? [];
  const sos      = data.sos      ?? [];
  const fulfs    = data.fulfillments ?? [];
  const invoices = data.invoices ?? [];
  const lots     = data.lots     ?? [];
  const journals = data.journals ?? [];

  const procurementCards: StatCard[] = [
    {
      title: 'Purchase Orders',
      icon: <FileTextOutlined />,
      value: count(pos, 'OPEN', 'PARTIALLY_RECEIVED'),
      total: pos.length,
      label: 'open / partial',
      sublabel: `${pos.length} total`,
      warn: count(pos, 'OPEN') > 0,
      route: '/purchase/orders',
      action: 'View POs',
      color: '#1B2A4A',
    },
    {
      title: 'Item Receipts',
      icon: <InboxOutlined />,
      value: count(receipts, 'DRAFT', 'PENDING'),
      total: receipts.length,
      label: 'pending confirmation',
      sublabel: `${count(receipts, 'CONFIRMED')} confirmed`,
      warn: count(receipts, 'DRAFT', 'PENDING') > 0,
      route: '/purchase/receipts',
      action: 'View Receipts',
      color: '#d46b08',
    },
    {
      title: 'Vendor Bills',
      icon: <BankOutlined />,
      value: count(bills, 'DRAFT'),
      total: bills.length,
      label: 'drafts to post',
      sublabel: `${count(bills, 'POSTED', 'PARTIALLY_PAID')} posted / partial`,
      warn: count(bills, 'DRAFT') > 0,
      route: '/purchase/bills',
      action: 'View Bills',
      color: '#531dab',
    },
    {
      title: 'Vendor Payments',
      icon: <DollarOutlined />,
      value: count(payments, 'PENDING'),
      total: payments.length,
      label: 'pending',
      sublabel: `${count(payments, 'PAID')} paid`,
      warn: count(payments, 'PENDING') > 0,
      route: '/purchase/payments',
      action: 'View Payments',
      color: '#08979c',
    },
  ];

  const salesCards: StatCard[] = [
    {
      title: 'Sales Orders',
      icon: <ShoppingCartOutlined />,
      value: count(sos, 'OPEN', 'CONFIRMED'),
      total: sos.length,
      label: 'open / confirmed',
      sublabel: `${sos.length} total`,
      warn: count(sos, 'OPEN') > 0,
      route: '/sales/orders',
      action: 'View SOs',
      color: '#1B2A4A',
    },
    {
      title: 'Fulfillments',
      icon: <SendOutlined />,
      value: count(fulfs, 'PENDING', 'IN_PROGRESS'),
      total: fulfs.length,
      label: 'pending / in progress',
      sublabel: `${count(fulfs, 'COMPLETED')} completed`,
      warn: count(fulfs, 'PENDING', 'IN_PROGRESS') > 0,
      route: '/sales/fulfillments',
      action: 'View Fulfillments',
      color: '#d46b08',
    },
    {
      title: 'Client Invoices',
      icon: <FileDoneOutlined />,
      value: count(invoices, 'DRAFT', 'SENT'),
      total: invoices.length,
      label: 'outstanding',
      sublabel: `${count(invoices, 'PAID')} paid`,
      warn: count(invoices, 'SENT') > 0,
      route: '/sales/invoices',
      action: 'View Invoices',
      color: '#531dab',
    },
    {
      title: 'Client Payments',
      icon: <DollarOutlined />,
      value: count(payments, 'PENDING'),
      total: payments.length,
      label: 'pending',
      sublabel: `${count(payments, 'RECEIVED')} received`,
      warn: false,
      route: '/sales/payments',
      action: 'View Payments',
      color: '#08979c',
    },
  ];

  function StatCardEl({ card }: { card: StatCard }) {
    const borderColor = card.warn ? '#faad14' : '#f0f0f0';
    return (
      <Card
        size="small"
        style={{ borderTop: `3px solid ${borderColor}`, height: '100%' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space>
            <span style={{ color: card.color, fontSize: 18 }}>{card.icon}</span>
            <Text type="secondary" style={{ fontSize: 13 }}>{card.title}</Text>
            {card.warn && <WarningOutlined style={{ color: '#faad14', fontSize: 12 }} />}
          </Space>
          <Statistic
            value={card.value}
            suffix={<Text type="secondary" style={{ fontSize: 13 }}>{card.label}</Text>}
            valueStyle={{ fontSize: 28, fontWeight: 700, color: card.warn && card.value > 0 ? '#d48806' : '#262626' }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>{card.sublabel}</Text>
          <Button
            type="link" size="small" icon={<ArrowRightOutlined />}
            onClick={() => navigate(card.route)}
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
          >
            {card.action}
          </Button>
        </Space>
      </Card>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Welcome header */}
      <div style={{ marginBottom: 28 }}>
        <Title level={3} style={{ margin: 0 }}>
          {greeting()}, {firstName}
        </Title>
        <Space style={{ marginTop: 4 }}>
          <Text type="secondary">{dayjs().format('dddd, D MMMM YYYY')}</Text>
          {roles.map(r => (
            <Tag key={r} color={
              r === 'Admin' ? 'gold' : r === 'Management' ? 'purple' : 'blue'
            }>{r}</Tag>
          ))}
        </Space>
      </div>

      {/* ── Net Asset Value panel (Management / Admin only) ── */}
      {showFinancials && nav && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <RiseOutlined style={{ color: '#1B2A4A' }} />
            <Text strong>Company Position</Text>
            <Tooltip title="Calculated from all posted journal entries as of today. Currency: EUR (functional currency).">
              <InfoCircleOutlined style={{ color: '#aaa', fontSize: 12 }} />
            </Tooltip>
          </div>

          {/* Hero: NAV */}
          <Card
            style={{
              marginBottom: 16,
              background: '#1B2A4A',
              borderRadius: 8,
              border: 'none',
            }}
            styles={{ body: { padding: '20px 28px' } }}
          >
            <Row align="middle" gutter={32}>
              <Col xs={24} md={8}>
                <Text style={{ color: '#B8860B', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  NET ASSET VALUE
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 13 }}>EUR</Text>
                  <span style={{
                    color: nav.net_asset_value >= 0 ? '#52c41a' : '#ff4d4f',
                    fontSize: 38,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}>
                    {fmtCcy(nav.net_asset_value)}
                  </span>
                </div>
                <Text style={{ color: '#8ca0c0', fontSize: 12, marginTop: 4, display: 'block' }}>
                  Total Assets − Total Liabilities
                </Text>
              </Col>
              <Col xs={0} md={1}>
                <Divider type="vertical" style={{ height: 60, borderColor: '#2d4068' }} />
              </Col>
              <Col xs={24} md={15}>
                <Row gutter={[24, 16]}>
                  <Col xs={12} sm={6}>
                    <Text style={{ color: '#8ca0c0', fontSize: 11, display: 'block' }}>TOTAL ASSETS</Text>
                    <Text style={{ color: '#e8edf5', fontSize: 18, fontWeight: 700 }}>
                      {fmtCcy(nav.total_assets)}
                    </Text>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Text style={{ color: '#8ca0c0', fontSize: 11, display: 'block' }}>TOTAL LIABILITIES</Text>
                    <Text style={{ color: '#e8edf5', fontSize: 18, fontWeight: 700 }}>
                      {fmtCcy(nav.total_liabilities)}
                    </Text>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card>

          {/* Breakdown: 3 asset categories */}
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={8}>
              <Card
                size="small"
                style={{ borderTop: '3px solid #d4b10e', height: '100%' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Space>
                    <GoldOutlined style={{ color: '#d4a017', fontSize: 18 }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>Inventory Value</Text>
                    <Tooltip title="Sum of all STOCK accounts (1301–1308) from posted journal entries.">
                      <InfoCircleOutlined style={{ color: '#ccc', fontSize: 11 }} />
                    </Tooltip>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>EUR</Text>
                    <Text style={{ fontSize: 28, fontWeight: 700 }}>
                      {fmtCcy(nav.inventory_value)}
                    </Text>
                  </div>
                  <Button
                    type="link" size="small" icon={<ArrowRightOutlined />}
                    onClick={() => navigate('/inventory/lots')}
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    View Lots
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                size="small"
                style={{ borderTop: '3px solid #ff4d4f', height: '100%' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Space>
                    <FallOutlined style={{ color: '#cf1322', fontSize: 18 }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>Payables &amp; Liabilities</Text>
                    <Tooltip title="Sum of all LIABILITY accounts (AP, loans, salary payable, etc.) from posted journal entries.">
                      <InfoCircleOutlined style={{ color: '#ccc', fontSize: 11 }} />
                    </Tooltip>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>EUR</Text>
                    <Text style={{ fontSize: 28, fontWeight: 700, color: nav.total_liabilities > 0 ? '#cf1322' : '#262626' }}>
                      {fmtCcy(nav.total_liabilities)}
                    </Text>
                  </div>
                  <Button
                    type="link" size="small" icon={<ArrowRightOutlined />}
                    onClick={() => navigate('/financials/balance-sheet')}
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    View Balance Sheet
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                size="small"
                style={{ borderTop: '3px solid #1677ff', height: '100%' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Space>
                    <WalletOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>Receivables &amp; Other Assets</Text>
                    <Tooltip title="AR Goods (1200) plus other non-inventory, non-bank assets. Excludes cash held in Wise accounts.">
                      <InfoCircleOutlined style={{ color: '#ccc', fontSize: 11 }} />
                    </Tooltip>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>EUR</Text>
                    <Text style={{ fontSize: 28, fontWeight: 700, color: '#0958d9' }}>
                      {fmtCcy(nav.receivables_other_assets)}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    AR: {fmtCcy(nav.receivables_value)} · Other: {fmtCcy(nav.other_assets_value)}
                  </Text>
                  <Button
                    type="link" size="small" icon={<ArrowRightOutlined />}
                    onClick={() => navigate('/financials/general-ledger')}
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    View General Ledger
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── Procurement ── */}
      {showProcurement && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <FileTextOutlined style={{ color: '#1B2A4A' }} />
            <Text strong>Procurement</Text>
          </div>
          <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
            {procurementCards.map(card => (
              <Col key={card.title} xs={24} sm={12} lg={6}>
                <StatCardEl card={card} />
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* ── Sales ── */}
      {showSales && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#389e0d' }} />
            <Text strong>Sales</Text>
          </div>
          <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
            {salesCards.map(card => (
              <Col key={card.title} xs={24} sm={12} lg={6}>
                <StatCardEl card={card} />
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* ── Inventory + Journals ── */}
      <Row gutter={[16, 16]}>
        {showInventory && (
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{ borderTop: '3px solid #13c2c2', height: '100%' }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space>
                  <StockOutlined style={{ color: '#08979c', fontSize: 18 }} />
                  <Text type="secondary" style={{ fontSize: 13 }}>Inventory Lots</Text>
                </Space>
                <Statistic
                  value={lots.length}
                  suffix={<Text type="secondary" style={{ fontSize: 13 }}>total lots</Text>}
                  valueStyle={{ fontSize: 28, fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {count(lots, 'ACTIVE')} active
                </Text>
                <Button type="link" size="small" icon={<ArrowRightOutlined />}
                  onClick={() => navigate('/inventory/lots')}
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}>
                  View Lots
                </Button>
              </Space>
            </Card>
          </Col>
        )}
        {showFinancials && (
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{ borderTop: '3px solid #722ed1', height: '100%' }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space>
                  <BookOutlined style={{ color: '#531dab', fontSize: 18 }} />
                  <Text type="secondary" style={{ fontSize: 13 }}>Journal Entries</Text>
                </Space>
                <Statistic
                  value={count(journals, 'DRAFT')}
                  suffix={<Text type="secondary" style={{ fontSize: 13 }}>drafts to post</Text>}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: count(journals, 'DRAFT') > 0 ? '#d48806' : '#262626' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {count(journals, 'POSTED')} posted
                </Text>
                <Button type="link" size="small" icon={<ArrowRightOutlined />}
                  onClick={() => navigate('/financials/journal-entries')}
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}>
                  View Journals
                </Button>
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
