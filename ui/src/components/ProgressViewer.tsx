import { useEffect, useState } from 'react';
import { Progress, Card, List, Tag, Spin, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

interface ChangeProgress {
  proposalId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  progress: number;
  currentStep?: string;
  tasks?: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

interface ProgressViewerProps {
  proposalId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function ProgressViewer({ proposalId, autoRefresh = true, refreshInterval = 2000 }: ProgressViewerProps) {
  const [progress, setProgress] = useState<ChangeProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    try {
      const res = await axios.get(`/api/changes/${proposalId}/progress`);
      setProgress(res.data);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
    
    if (autoRefresh) {
      const interval = setInterval(fetchProgress, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [proposalId, autoRefresh, refreshInterval]);

  if (loading) {
    return <Spin />;
  }

  if (!progress) {
    return <Text type="secondary">无法加载进度信息</Text>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'processing';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined />;
      case 'in_progress': return <SyncOutlined spin />;
      case 'pending': return <ClockCircleOutlined />;
      default: return null;
    }
  };

  return (
    <Card title="变更进度" size="small">
      <div style={{ marginBottom: 16 }}>
        <Progress 
          percent={progress.progress} 
          status={progress.progress === 100 ? 'success' : 'active'}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          {progress.completedTasks} / {progress.totalTasks} 任务已完成
          {progress.currentStep && (
            <span style={{ marginLeft: 16 }}>
              当前步骤: <Text strong>{progress.currentStep}</Text>
            </span>
          )}
        </div>
      </div>

      {progress.tasks && progress.tasks.length > 0 && (
        <List
          size="small"
          dataSource={progress.tasks}
          renderItem={(task) => (
            <List.Item>
              <List.Item.Meta
                avatar={getStatusIcon(task.status)}
                title={
                  <span>
                    <Tag color={getStatusColor(task.status)}>{task.status}</Tag>
                    {task.description}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}

      {(!progress.tasks || progress.tasks.length === 0) && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
          <Text type="secondary">暂无任务列表</Text>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            状态: <Tag>{progress.currentStep || '未知'}</Tag>
          </div>
        </div>
      )}
    </Card>
  );
}

