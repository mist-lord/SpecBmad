import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Spin, Alert, Descriptions, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';

interface ProjectStatus {
  project: {
    name: string;
    language: string;
    framework: string;
    type: string;
  };
  status: {
    tasks: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      blocked: number;
    };
    agents: {
      available: string[];
      active: string[];
    };
    files: {
      specifications: string[];
      implementations: string[];
      tests: string[];
    };
  };
  timestamp: string;
}

export default function Dashboard() {
  const [data, setData] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/status');
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!data) return <Alert message="No Data" type="warning" showIcon />;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Project Overview</h2>
      
      <Descriptions title="Project Info" bordered style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Project Name">{data.project.name}</Descriptions.Item>
        <Descriptions.Item label="Language">{data.project.language}</Descriptions.Item>
        <Descriptions.Item label="Framework">{data.project.framework || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Type">{data.project.type}</Descriptions.Item>
        <Descriptions.Item label="Last Updated">{new Date(data.timestamp).toLocaleString()}</Descriptions.Item>
      </Descriptions>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tasks Completed"
              value={data.status.tasks.completed}
              suffix={`/ ${data.status.tasks.total}`}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="In Progress"
              value={data.status.tasks.inProgress}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending"
              value={data.status.tasks.pending}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Blocked"
              value={data.status.tasks.blocked}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Files Overview">
            <p><strong>Specifications:</strong> {data.status.files.specifications.length} files</p>
            <p><strong>Implementations:</strong> {data.status.files.implementations.length} files</p>
            <p><strong>Tests:</strong> {data.status.files.tests.length} files</p>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Available Agents">
            {data.status.agents.available.length > 0 ? (
              data.status.agents.available.map(agent => (
                <Tag color="blue" key={agent} style={{ marginBottom: 8 }}>{agent}</Tag>
              ))
            ) : (
              <p>No agents available</p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

