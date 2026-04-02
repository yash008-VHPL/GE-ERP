import { useState } from 'react';
import { Upload, Button, message, Typography, Space } from 'antd';
import { UploadOutlined, LinkOutlined } from '@ant-design/icons';
import { spApi } from '../../config/apiClient';
import type { DocType } from '../../types/document';

const { Text, Link } = Typography;

interface Props {
  docId:        string;
  docType:      DocType;
  relatedDocId?: string;
  label:        string;
  onUploaded?:  (webUrl: string) => void;
}

export function DocumentUpload({ docId, label, relatedDocId, onUploaded }: Props) {
  const [uploading, setUploading]   = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('doc_id', docId);
      if (relatedDocId) form.append('related_doc_id', relatedDocId);

      const { data } = await spApi.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedUrl(data.data.sharepointWebUrl);
      onUploaded?.(data.data.sharepointWebUrl);
      message.success(`${file.name} uploaded as ${docId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      message.error(msg);
    } finally {
      setUploading(false);
    }
    return false; // prevent antd auto-upload
  };

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <Upload
        beforeUpload={handleUpload}
        showUploadList={false}
        accept=".pdf,.jpg,.jpeg,.png,.tiff,.xlsx,.xls,.docx,.doc,.msg"
      >
        <Button icon={<UploadOutlined />} loading={uploading} size="small">
          {uploading ? 'Uploading…' : 'Attach file'}
        </Button>
      </Upload>
      {uploadedUrl && (
        <Link href={uploadedUrl} target="_blank">
          <LinkOutlined /> View on SharePoint
        </Link>
      )}
    </Space>
  );
}
