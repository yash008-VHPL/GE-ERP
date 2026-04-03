import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined, InboxOutlined, BankOutlined, DollarOutlined,
  LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ShoppingCartOutlined, SendOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const NAV_ITEMS: MenuProps['items'] = [
  {
    key: 'purchases',
    label: 'Purchases',
    type: 'group',
    children: [
      { key: '/purchase/orders',   icon: <FileTextOutlined />, label: 'Purchase Orders' },
      { key: '/purchase/receipts', icon: <InboxOutlined />,    label: 'Item Receipts' },
      { key: '/purchase/bills',    icon: <BankOutlined />,     label: 'Vendor Bills' },
      { key: '/purchase/payments', icon: <DollarOutlined />,   label: 'Payments' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    type: 'group',
    children: [
      { key: '/sales/orders',       icon: <ShoppingCartOutlined />, label: 'Sales Orders' },
      { key: '/sales/fulfillments', icon: <SendOutlined />,         label: 'Fulfillments' },
      { key: '/sales/invoices',     icon: <FileDoneOutlined />,     label: 'Client Invoices' },
      { key: '/sales/payments',     icon: <DollarOutlined />,       label: 'Client Payments' },
    ],
  },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate   = useNavigate();
  const location   = useLocation();
  const { instance, accounts } = useMsal();
  const user = accounts[0];

  const userMenu = {
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
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div style={{ padding: '16px 12px', borderBottom: '1px solid #132039' }}>
          <Text strong style={{ color: '#B8860B', fontSize: collapsed ? 12 : 16 }}>
            {collapsed ? 'GE' : 'GE ERP'}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ cursor: 'pointer', fontSize: 18 }} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1B2A4A' }} />
              {!collapsed && <Text>{user?.name ?? user?.username}</Text>}
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 4, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
