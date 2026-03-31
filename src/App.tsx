import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { 
  BarsOutlined, 
  DashboardOutlined, 
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import SurveyList from './components/SurveyList';
import SurveyEditor from './components/SurveyEditor';
import SurveyView from './components/SurveyView';
import SurveyViewSequential from './components/SurveyViewSequential';
import SurveyStatistics from './components/SurveyStatistics';
import ResponseList from './components/ResponseList';
import EmailSettings from './components/EmailSettings';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1');

  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      path: '/'
    },
    {
      key: '2',
      icon: <BarsOutlined />,
      label: '问卷列表',
      path: '/surveys'
    },
    {
      key: '3',
      icon: <FileTextOutlined />,
      label: '创建问卷',
      path: '/surveys/new'
    },
    {
      key: '4',
      icon: <BarChartOutlined />,
      label: '邮件配置',
      path: '/settings/email'
    }
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedKey(key);
    const menuItem = menuItems.find(item => item.key === key);
    if (menuItem) {
      navigate(menuItem.path);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div className="logo">
          <h2 style={{ color: 'white', textAlign: 'center', padding: '16px' }}>
            {collapsed ? '问卷' : '自建问卷系统'}
          </h2>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header style={{ padding: 0, background: '#fff' }} />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<SurveyList />} />
            <Route path="/surveys" element={<SurveyList />} />
            <Route path="/surveys/new" element={<SurveyEditor />} />
            <Route path="/surveys/:id/edit" element={<SurveyEditor />} />
            <Route path="/survey/:id" element={<SurveyView />} />
            <Route path="/survey/:id/sequential" element={<SurveyViewSequential />} />
            <Route path="/surveys/:id/responses" element={<ResponseList />} />
            <Route path="/surveys/:id/statistics" element={<SurveyStatistics />} />
            <Route path="/settings/email" element={<EmailSettings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
