import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal } from 'antd';
import axios from 'axios';
import ProgressViewer from '../components/ProgressViewer';

interface ChangeProposal {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'review' | 'approved' | 'implemented' | 'merged' | 'rejected';
  createdAt: string;
}

export default function Changes() {
  const [data, setData] = useState<ChangeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);

  useEffect(() => {
    fetchChanges();
  }, []);

  const fetchChanges = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/changes');
      setData(res.data);
    } catch (err: any) {
      message.error(err.message || 'Failed to fetch changes');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (id: string) => {
    try {
      await axios.post(`/api/changes/${id}/apply`, { force: true }); // Demo purposes using force
      message.success('Change applied successfully');
      fetchChanges();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed to apply change');
    }
  };

  const handleViewProgress = (id: string) => {
    setSelectedProposal(id);
    setProgressModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'approved') color = 'success';
        if (status === 'review') color = 'processing';
        if (status === 'merged') color = 'purple';
        if (status === 'rejected') color = 'error';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleDateString(),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 150,
      render: (_: any, record: ChangeProposal) => {
        // 这里可以添加一个简单的进度指示器
        // 为了简化，我们先显示一个查看按钮，点击后显示详细进度
        return (
          <Button type="link" size="small" onClick={() => handleViewProgress(record.id)}>
            查看进度
          </Button>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: ChangeProposal) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleViewProgress(record.id)}>View</Button>
          {(record.status === 'approved' || record.status === 'implemented') && (
            <Button type="primary" size="small" onClick={() => handleApply(record.id)}>
              Apply
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Change Proposals</h2>
        <Button type="primary">New Proposal</Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '16px 0' }}>
              <ProgressViewer proposalId={record.id} autoRefresh={true} />
            </div>
          ),
          rowExpandable: () => true,
        }}
      />
      
      <Modal
        title="变更进度详情"
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedProposal && (
          <ProgressViewer proposalId={selectedProposal} autoRefresh={true} />
        )}
      </Modal>
    </div>
  );
}

