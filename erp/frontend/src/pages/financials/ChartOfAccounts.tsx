import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Typography, message, Tag,
  Modal, Form, Input, Select,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { purchaseApi } from '../../config/apiClient';

const { Title } = Typography;

interface Account {
  account_id:     number;
  account_code:   string;
  account_name:   string;
  account_type:   string;
  normal_balance: string;
  parent_code:    string | null;
  gnucash_type:   string | null;
  is_active:      boolean;
}

const TYPE_COLOR: Record<string, string> = {
  ASSET:     'blue',
  LIABILITY: 'red',
  EQUITY:    'purple',
  REVENUE:   'green',
  EXPENSE:   'orange',
};

export function ChartOfAccounts() {
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm<any>();

  const load = () => {
    setLoading(true);
    purchaseApi.get('/financials/accounts')
      .then(r => setAccounts(r.data.data))
      .catch(() => message.error('Failed to load chart of accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await purchaseApi.post('/financials/accounts', values);
      message.success('Account created');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error ?? 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Code',    dataIndex: 'account_code', width: 100, render: (v: string) => <strong>{v}</strong> },
    { title: 'Name',    dataIndex: 'account_name', ellipsis: true },
    {
      title: 'Type', dataIndex: 'account_type', width: 100,
      render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Dr/Cr', dataIndex: 'normal_balance', width: 70,
      render: (v: string) => <Tag color={v === 'DR' ? 'blue' : 'red'}>{v}</Tag>,
    },
    { title: 'Parent Code',   dataIndex: 'parent_code',  width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'GNUCash Type',  dataIndex: 'gnucash_type', width: 130, render: (v: string | null) => v ?? '—' },
    {
      title: 'Active', dataIndex: 'is_active', width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Chart of Accounts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Account
        </Button>
      </div>

      <Table
        rowKey="account_id"
        dataSource={accounts}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true }}
      />

      <Modal
        title="New Account"
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={saving}
        okText="Create Account"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space style={{ width: '100%' }} direction="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="accountCode" label="Account Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. 1305" />
              </Form.Item>
              <Form.Item name="accountName" label="Account Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="accountType" label="Type" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'ASSET',     label: 'Asset' },
                  { value: 'LIABILITY', label: 'Liability' },
                  { value: 'EQUITY',    label: 'Equity' },
                  { value: 'REVENUE',   label: 'Revenue' },
                  { value: 'EXPENSE',   label: 'Expense' },
                ]} />
              </Form.Item>
              <Form.Item name="normalBalance" label="Normal Balance" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'DR', label: 'Debit (DR)' },
                  { value: 'CR', label: 'Credit (CR)' },
                ]} />
              </Form.Item>
              <Form.Item name="parentCode" label="Parent Account Code">
                <Input placeholder="e.g. 1300" />
              </Form.Item>
              <Form.Item name="gnucashType" label="GNUCash Type">
                <Input placeholder="e.g. ASSET, EXPENSE" />
              </Form.Item>
            </div>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
