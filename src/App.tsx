import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  PictureOutlined,
  FolderOpenOutlined,
  TeamOutlined,
  NotificationOutlined,
  MessageOutlined,
  EyeOutlined,
  SafetyOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FormOutlined,
  IdcardOutlined,
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
import SiteSettingsPage from './components/SiteSettings';
import MemberManagement from './pages/MemberManagement';
import InviteCodes from './components/InviteCodes';
import HomePage from './components/Announcements';
import AnnouncementList from './pages/AnnouncementList';
import MessagesPage from './components/Messages';
import VisitStatistics from './components/VisitStatistics';
import ResourceLibrary from './components/ResourceLibrary';
import AlbumPage from './components/Albums';
import ProfilePage from './pages/Profile';
import { useAuth } from './context/AuthContext';
import { getSiteSettings } from './api/site';
import './App.css';

const { Header, Sider, Content } = Layout;

interface SiteConfig {
  siteName: string;
  siteSubtitle?: string;
  sidebarLogo?: string;
  heroBanner?: string;
  loginBg?: string;
  registerMode?: string;
  menuLabels?: {
    dashboard?: string;
    announcements?: string;
    messages?: string;
    resources?: string;
    albums?: string;
    surveys?: string;
    members?: string;
    inviteCodes?: string;
    visitStats?: string;
    siteSettings?: string;
    emailSettings?: string;
  };
  moduleIcons?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  heroTitleStyle?: {
    fontSize?: number;
    subtitleFontSize?: number;
    titleColor?: string;
    subtitleColor?: string;
    position?: 'top' | 'center' | 'bottom';
    bannerOpacity?: number;
  };
  marqueeConfig?: {
    enabled?: boolean;
    announcementIds?: string[];
    fontSize?: number;
    color?: string;
    background?: string;
    speed?: number;
  };
  moduleImages?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  homePageStyle?: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundOpacity?: number;
    moduleCount?: number;
    containerPadding?: number;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({ siteName: '我的空间' });

  useEffect(() => {
    getSiteSettings().then(cfg => setSiteConfig(cfg as SiteConfig)).catch(() => {});
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 根据路径推导当前选中菜单
  const getSelectedKey = () => {
    const p = location.pathname;
    if (p === '/' || p === '/dashboard') return 'dashboard';
    if (p.startsWith('/surveys') || p.startsWith('/survey')) return 'surveys';
    if (p.startsWith('/albums')) return 'albums';
    if (p.startsWith('/resources')) return 'resources';
    if (p.startsWith('/announcements')) return 'announcements';
    if (p.startsWith('/messages')) return 'messages';
    if (p.startsWith('/profile')) return 'profile';
    if (p.startsWith('/admin/members')) return 'members';
    if (p.startsWith('/admin/invite-codes')) return 'invite-codes';
    if (p.startsWith('/admin/visit-stats')) return 'visit-stats';
    if (p.startsWith('/admin/site-settings')) return 'site-settings';
    if (p.startsWith('/settings')) return 'email-settings';
    return 'dashboard';
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: siteConfig.menuLabels?.dashboard || '首页',
      path: '/'
    },
    {
      key: 'announcements',
      icon: <NotificationOutlined />,
      label: siteConfig.menuLabels?.announcements || '公告通知',
      path: '/announcements'
    },
    {
      key: 'messages',
      icon: <MessageOutlined />,
      label: siteConfig.menuLabels?.messages || '私信留言',
      path: '/messages'
    },
    {
      key: 'resources',
      icon: <FolderOpenOutlined />,
      label: siteConfig.menuLabels?.resources || '资源库',
      path: '/resources'
    },
    {
      key: 'albums',
      icon: <PictureOutlined />,
      label: siteConfig.menuLabels?.albums || '相册',
      path: '/albums'
    },
    {
      key: 'surveys',
      icon: <FormOutlined />,
      label: siteConfig.menuLabels?.surveys || '问卷',
      path: '/surveys'
    },
    // 管理员功能
    ...(isAdmin ? [
      { type: 'divider' as const },
      {
        key: 'admin-group',
        label: '管理',
        type: 'group' as const,
        children: [
          { key: 'members', icon: <TeamOutlined />, label: siteConfig.menuLabels?.members || '会员管理', path: '/admin/members' },
          { key: 'invite-codes', icon: <SafetyOutlined />, label: siteConfig.menuLabels?.inviteCodes || '邀请码', path: '/admin/invite-codes' },
          { key: 'visit-stats', icon: <EyeOutlined />, label: siteConfig.menuLabels?.visitStats || '访客统计', path: '/admin/visit-stats' },
          { key: 'email-settings', icon: <SettingOutlined />, label: siteConfig.menuLabels?.emailSettings || '邮件配置', path: '/settings/email' },
          { key: 'site-settings', icon: <SettingOutlined />, label: siteConfig.menuLabels?.siteSettings || '网站设置', path: '/admin/site-settings' },
        ]
      }
    ] : [])
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    const allItems = [
      ...menuItems,
      ...(isAdmin ? [
        { key: 'members', path: '/admin/members' },
        { key: 'invite-codes', path: '/admin/invite-codes' },
        { key: 'visit-stats', path: '/admin/visit-stats' },
        { key: 'email-settings', path: '/settings/email' },
        { key: 'site-settings', path: '/admin/site-settings' },
      ] : [])
    ];
    const item = allItems.find(i => i.key === key) as any;
    if (item?.path) navigate(item.path);
    if (isMobile) setCollapsed(true);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
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
        <div className="logo" style={{ padding: collapsed ? '12px 0' : '16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          {siteConfig.sidebarLogo && !collapsed ? (
            <img
              src={`${API_BASE}${siteConfig.sidebarLogo}`}
              alt="logo"
              style={{ maxWidth: 160, maxHeight: 60, objectFit: 'contain' }}
            />
          ) : (
            <h2 style={{ color: 'white', margin: 0, fontSize: collapsed ? 14 : 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {collapsed ? '✦' : siteConfig.siteName}
            </h2>
          )}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[getSelectedKey()]}
          mode="inline"
          items={menuItems as any}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 0 : 200, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <div
            style={{ cursor: 'pointer', fontSize: 18 }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <UserMenu />
        </Header>

        <Content style={{ margin: isMobile ? '12px' : '24px 16px', padding: isMobile ? 12 : 24, background: '#fff', minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<HomePage siteConfig={siteConfig} />} />
            <Route path="/dashboard" element={<HomePage siteConfig={siteConfig} />} />
            <Route path="/announcements" element={<AnnouncementList />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/resources" element={<ResourceLibrary />} />
            <Route path="/albums" element={<AlbumPage />} />
            {/* 问卷模块 */}
            <Route path="/surveys" element={<SurveyList />} />
            <Route path="/surveys/new" element={<SurveyEditor />} />
            <Route path="/surveys/:id/edit" element={<SurveyEditor />} />
            <Route path="/survey/:id" element={<SurveyView />} />
            <Route path="/survey/:id/sequential" element={<SurveyViewSequential />} />
            <Route path="/surveys/:id/responses" element={<ResponseList />} />
            <Route path="/surveys/:id/statistics" element={<SurveyStatistics />} />
            {/* 个人中心 */}
            <Route path="/profile" element={<ProfilePage />} />
            {/* 管理员模块 */}
            <Route path="/admin/members" element={<MemberManagement />} />
            <Route path="/admin/invite-codes" element={<InviteCodes />} />
            <Route path="/admin/visit-stats" element={<VisitStatistics />} />
            <Route path="/admin/site-settings" element={<SiteSettingsPage />} />
            <Route path="/settings/email" element={<EmailSettings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/survey/:id" element={<SurveyView />} />
      <Route path="/survey/:id/sequential" element={<SurveyViewSequential />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
