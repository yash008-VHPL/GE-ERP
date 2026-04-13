import { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';

export interface EditField {
  name: string;
  label: string;
  element: React.ReactNode;
  initialValue?: unknown;
  rules?: object[];
}

interface Props {
  open: boolean;
  title: string;
  fields: EditField[];
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitting?: boolean;
}

/**
 * Wraps any set of form fields with a mandatory "Reason for change" textarea.
 * Every edit in this ERP must be accompanied by a comment explaining what
 * changed and why — this creates the audit trail in record_amendments.
 */
export function EditWithCommentModal({
  open, title, fields, onCancel, onSubmit, submitting,
}: Props) {
  const [form] = Form.useForm();

  // Reset form when modal opens so stale values don't linger
  useEffect(() => {
    if (open) {
      const initials: Record<string, unknown> = {};
      fields.forEach(f => { if (f.initialValue !== undefined) initials[f.name] = f.initialValue; });
      form.setFieldsValue(initials);
    }
  }, [open, fields, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values as Record<string, unknown>);
    form.resetFields();
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={title}
      okText="Save Changes"
      cancelText="Cancel"
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        {fields.map(f => (
          <Form.Item
            key={f.name}
            name={f.name}
            label={f.label}
            rules={f.rules}
          >
            {f.element}
          </Form.Item>
        ))}

        <Form.Item
          name="changeNote"
          label="Reason for change"
          rules={[{ required: true, message: 'Please explain what changed and why.' }]}
          style={{ marginTop: 8 }}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. Client requested due date extension to 30 Apr — confirmed by email on 12 Apr"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
