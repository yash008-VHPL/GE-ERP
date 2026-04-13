import { useEffect, useState } from 'react';
import { Timeline, Typography, Spin, Empty, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi } from '../../config/apiClient';

interface Amendment {
  amendment_id: number;
  changed_by: string;
  change_note: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_at: string;
}

interface Props {
  docId: string;
  /** Set to true to re-fetch after an edit completes */
  refreshKey?: number;
}

const { Text } = Typography;

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function AmendmentHistory({ docId, refreshKey }: Props) {
  const [items, setItems] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    purchaseApi
      .get(`/amendments?docId=${encodeURIComponent(docId)}`)
      .then(r => setItems(r.data.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [docId, refreshKey]);

  if (loading) return <Spin size="small" />;
  if (items.length === 0) {
    return (
      <Empty
        description="No amendments recorded"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '12px 0' }}
      />
    );
  }

  return (
    <Timeline
      style={{ marginTop: 8 }}
      items={items.map(a => ({
        dot: <EditOutlined style={{ color: '#1677ff', fontSize: 14 }} />,
        children: (
          <div style={{ paddingBottom: 4 }}>
            <div>
              <Text strong style={{ marginRight: 8 }}>
                {a.changed_by || 'Unknown user'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(a.changed_at).format('DD MMM YYYY, HH:mm')}
              </Text>
            </div>
            <div style={{ margin: '4px 0', fontStyle: 'italic', color: '#374151' }}>
              "{a.change_note}"
            </div>
            {a.new_values && Object.keys(a.new_values).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {Object.keys(a.new_values).map(k => (
                  <Tag key={k} color="blue" style={{ fontSize: 11 }}>
                    {k}: {formatValue(a.old_values?.[k])} → {formatValue(a.new_values![k])}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        ),
      }))}
    />
  );
}
