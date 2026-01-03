import { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DesktopOutlined,
  FileOutlined,
  ProjectOutlined,
  TeamOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import Changes from './pages/Changes';

const { Header, Content, Footer, Sider } = Layout;

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div className="demo-logo-vertical" style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6 }} />
        <Menu theme="dark" defaultSelectedKeys={[location.pathname]} mode="inline">
          <Menu.Item key="/" icon={<DesktopOutlined />}>
            <Link to="/">Dashboard</Link>
          </Menu.Item>
          <Menu.Item key="/changes" icon={<FileOutlined />}>
            <Link to="/changes">Changes</Link>
          </Menu.Item>
          <Menu.Item key="/workflow" icon={<DeploymentUnitOutlined />}>
            <Link to="/workflow">Workflow</Link>
          </Menu.Item>
          <Menu.Item key="/agents" icon={<TeamOutlined />}>
            <Link to="/agents">Agents</Link>
          </Menu.Item>
          <Menu.Item key="/files" icon={<ProjectOutlined />}>
            <Link to="/files">Files</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content style={{ margin: '16px 16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/changes" element={<Changes />} />
              <Route path="/workflow" element={<div>Workflow (Coming Soon)</div>} />
              <Route path="/agents" element={<div>Agents (Coming Soon)</div>} />
              <Route path="/files" element={<div>Files (Coming Soon)</div>} />
            </Routes>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          SpecKit-BMAD ©{new Date().getFullYear()} Created by SpecKit Team
        </Footer>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

