import React, { useState, useEffect } from 'react';
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
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UserMenu from './components/UserMenu';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1');
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    <Routes>
      {/* 登录页 - 不需要认证 */}
      <Route path="/login" element={<Login />} />
      
      {/* 受保护的路由 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout style={{ minHeight: '100vh' }}>
              <Sider 
                collapsible 
                collapsed={collapsed || isMobile}
                onCollapse={setCollapsed}
                breakpoint="lg"
                collapsedWidth={0}
                onBreakpoint={(broken) => {
                  if (broken) {
                    setCollapsed(true);
                  }
                }}
                style={{
                  overflow: 'auto',
                  height: '100vh',
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 100,
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
              <Layout style={{ marginLeft: (collapsed || isMobile) ? 0 : 200, transition: 'margin-left 0.2s', transitionProperty: 'margin-left' }}>
                <Header 
                  style={{ 
                    padding: '0 24px', 
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    position: 'sticky',
                    top: 0,
                    zIndex: 99,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }} 
                >
                  {isMobile && (
                    <BarsOutlined 
                      style={{ fontSize: 20, marginRight: 'auto', cursor: 'pointer' }}
                      onClick={() => setCollapsed(!collapsed)}
                    />
                  )}
                  <UserMenu />
                </Header>
                <Content style={{ margin: isMobile ? '12px' : '24px 16px', padding: isMobile ? 12 : 24, background: '#fff', minHeight: 280 }}>
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
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
