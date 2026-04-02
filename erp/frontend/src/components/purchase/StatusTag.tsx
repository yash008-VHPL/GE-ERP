import { Tag } from 'antd';

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:               'default',
  CONFIRMED:           'blue',
  PARTIALLY_RECEIVED:  'orange',
  FULLY_RECEIVED:      'green',
  BILLED:              'purple',
  CLOSED:              'cyan',
  CANCELLED:           'red',
  POSTED:              'blue',
  PARTIALLY_PAID:      'orange',
  PAID:                'green',
  PARTIALLY_APPLIED:   'orange',
  FULLY_APPLIED:       'green',
};

export function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLOURS[status] ?? 'default'}>{status.replace(/_/g, ' ')}</Tag>;
}
