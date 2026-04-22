import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Typography, Space, Spin, Row, Col, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';
import { StatusTag } from '../../components/purchase/StatusTag';

const { Title } = Typography;

interface Fulfillment {
  itf_id: number;
  doc_id: string;
  sao_doc_id: string;
  client_name: string;
  fulfillment_date: string;
  status: string;
  notes: string | null;
}

export function FulfillmentList() {
  const navigate = useNavigate();
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    purchaseApi.get('/fulfillments')
      .then(r => setFulfillments(r.data.data))
      .catch(() => message.error('Failed to load fulfillments'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<Fulfillment> = [
    {
      title: 'Fulfillment No.', dataIndex: 'doc_id', width: 165,
      render: (v: string) => <a style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</a>,
    },
    {
      title: 'SO Ref',
      dataIndex: 'sao_doc_id',
      width: 165,
      render: (v: string) => (
        <a
          style={{ fontFamily: 'monospace' }}
          onClick={e => { e.stopPropagation(); navigate(`/sales/orders/${v}`); }}
        >
          {v}
        </a>
      ),
    },
    { title: 'Client', dataIndex: 'client_name', width: 150, ellipsis: true },
    {
      title: 'Fulfillment Date',
      dataIndex: 'fulfillment_date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Item Fulfillments</Title>
        </Col>
      </Row>

      {loading ? (
        <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </Space>
      ) : (
        <Table
          rowKey="itf_id"
          dataSource={fulfillments}
          columns={columns}
          size="small"
          scroll={{ x: 950 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          onRow={row => ({
            onClick: () => navigate(`/sales/fulfillments/${row.doc_id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </>
  );
}
