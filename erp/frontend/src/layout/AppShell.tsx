import { useState, useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined, InboxOutlined, BankOutlined, DollarOutlined,
  LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ShoppingCartOutlined, SendOutlined, FileDoneOutlined,
  TeamOutlined, ShopOutlined, AppstoreOutlined,
  StockOutlined, BarChartOutlined, BookOutlined,
  FundOutlined, TableOutlined, LineChartOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useUserRoles, hasAnyRole } from '../hooks/useUserRoles';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate   = useNavigate();
  const location   = useLocation();
  const { instance, accounts } = useMsal();
  const user  = accounts[0];
  const roles = useUserRoles();

  // Which top-level sections this user can see
  // Admin        — everything
  // Management   — everything including financials (read/oversight)
  // Coordination — sell/buy/inventory only (no financials)
  const canSee = {
    sellSide:    hasAnyRole(roles, 'Admin', 'Management', 'Coordination'),
    buySide:     hasAnyRole(roles, 'Admin', 'Management', 'Coordination'),
    inventory:   hasAnyRole(roles, 'Admin', 'Management', 'Coordination'),
    financials:  hasAnyRole(roles, 'Admin', 'Management'),
    setup:       hasAnyRole(roles, 'Admin', 'Management', 'Coordination'),
  };

  const sellSideChildren: MenuProps['items'] = [
    { key: '/sales/orders',       icon: <ShoppingCartOutlined />, label: 'Sales Orders' },
    { key: '/sales/fulfillments', icon: <SendOutlined />,         label: 'Fulfillments' },
    { key: '/sales/invoices',     icon: <FileDoneOutlined />,     label: 'Client Invoices' },
    { key: '/sales/payments',     icon: <DollarOutlined />,       label: 'Client Payments' },
  ];

  const buySideChildren: MenuProps['items'] = [
    { key: '/purchase/orders',   icon: <FileTextOutlined />, label: 'Purchase Orders' },
    { key: '/purchase/receipts', icon: <InboxOutlined />,    label: 'Item Receipts' },
    { key: '/purchase/bills',    icon: <BankOutlined />,     label: 'Vendor Bills' },
    { key: '/purchase/payments', icon: <DollarOutlined />,   label: 'Vendor Payments' },
  ];

  const inventoryChildren: MenuProps['items'] = [
    { key: '/inventory/lots', icon: <StockOutlined />, label: 'Inventory Lots' },
  ];

  const financialsChildren: MenuProps['items'] = [
    { key: '/financials/accounts',             icon: <BookOutlined />,      label: 'Chart of Accounts' },
    { key: '/financials/journal-entries',      icon: <TableOutlined />,     label: 'Journal Entries' },
    { key: '/financials/transaction-register', icon: <DatabaseOutlined />,  label: 'Transaction Register' },
    { key: '/financials/general-ledger',       icon: <BarChartOutlined />,  label: 'General Ledger' },
    { key: '/financials/trial-balance',        icon: <FundOutlined />,      label: 'Trial Balance' },
    { key: '/financials/balance-sheet',        icon: <LineChartOutlined />, label: 'Balance Sheet' },
    { key: '/financials/profit-loss',          icon: <LineChartOutlined />, label: 'Profit & Loss' },
  ];

  const setupChildren: MenuProps['items'] = [
    { key: '/items',            icon: <AppstoreOutlined />, label: 'Items' },
    { key: '/purchase/vendors', icon: <ShopOutlined />,     label: 'Vendors' },
    { key: '/sales/clients',    icon: <TeamOutlined />,     label: 'Clients' },
  ];

  const navItems = useMemo((): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    ];

    if (canSee.sellSide) {
      items.push({
        key: 'group-sell',
        icon: <ShoppingCartOutlined />,
        label: 'Sell Side',
        children: sellSideChildren,
      });
    }
    if (canSee.buySide) {
      items.push({
        key: 'group-buy',
        icon: <FileTextOutlined />,
        label: 'Buy Side',
        children: buySideChildren,
      });
    }
    if (canSee.inventory) {
      items.push({
        key: 'group-inventory',
        icon: <StockOutlined />,
        label: 'Inventory Management',
        children: inventoryChildren,
      });
    }
    if (canSee.financials) {
      items.push({
        key: 'group-financials',
        icon: <BookOutlined />,
        label: 'Financials',
        children: financialsChildren,
      });
    }
    if (canSee.setup) {
      items.push({
        key: 'group-setup',
        icon: <DatabaseOutlined />,
        label: 'Setup',
        children: setupChildren,
      });
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  // Open the submenu whose child matches current path
  const openKeys = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/sales')) return ['group-sell'];
    if (p.startsWith('/purchase')) return ['group-buy'];
    if (p.startsWith('/inventory')) return ['group-inventory'];
    if (p.startsWith('/financials')) return ['group-financials'];
    if (p === '/items' || p.startsWith('/purchase/vendors') || p.startsWith('/sales/clients')) return ['group-setup'];
    return [];
  }, [location.pathname]);

  const userMenu: MenuProps = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Sign out',
        onClick: () => instance.logoutRedirect(),
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{ overflow: 'hidden' }}
      >
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid #132039',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Text strong style={{ color: '#B8860B', fontSize: collapsed ? 12 : 15, whiteSpace: 'nowrap' }}>
            {collapsed ? 'GE' : 'GE ERP'}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={openKeys}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          style={{ overflowY: 'auto', height: 'calc(100vh - 50px)', borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          height: 52,
          lineHeight: '52px',
        }}>
          <span style={{ cursor: 'pointer', fontSize: 16, color: '#595959' }} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1B2A4A' }} />
              {!collapsed && (
                <Text style={{ fontSize: 13 }}>
                  {user?.name?.split(' ')[0] ?? user?.username}
                </Text>
              )}
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 20, padding: 24, background: '#fff', borderRadius: 6, minHeight: 360, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
