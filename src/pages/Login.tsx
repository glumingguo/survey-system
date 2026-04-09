import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Tabs, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSiteSettings, type SiteSettings } from '../api/site';

// 提取错误消息的辅助函数（与 api/auth.ts 保持一致）
function extractErrorMessage(error: any): string {
  // 优先从 response.data.error 获取
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  // 尝试 response.data.message
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  // 网络错误
  if (error.code === 'ECONNABORTED') {
    return '请求超时，请检查网络连接';
  }
  if (error.message?.includes('Network Error') || !error.response) {
    return '无法连接服务器，请检查网络或服务是否正常运行';
  }
  // 未知错误
  return '操作失败，请稍后重试';
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [registerMsg, setRegisterMsg] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getSiteSettings()
      .then(s => setSiteSettings(s))
      .catch(() => {});
  }, []);

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    inviteCode?: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      const result = await register(values.username, values.email, values.password, values.inviteCode);
      // 如果返回的是 pending 状态（注册待审核）
      if ((result as any)?.message?.includes('等待管理员审核')) {
        setRegisterMsg('注册申请已提交，请等待管理员审核后即可登录。');
        setActiveTab('login');
      } else {
        message.success('注册成功');
        navigate('/');
      }
    } catch (error: any) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const registerMode = siteSettings.registerMode || 'open';
  const siteName = siteSettings.siteName || '我的个人空间';
  const siteSubtitle = siteSettings.siteSubtitle || '';
  const loginBg = siteSettings.loginBg;

  const bgStyle = loginBg
    ? {
        backgroundImage: `url(${API_BASE}${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      };

  const showRegister = registerMode === 'open' || registerMode === 'invite' || registerMode === 'approval';

  const tabItems = [
    {
      key: 'login',
      label: '登录',
      children: (
        <>
          {registerMsg && (
            <Alert message={registerMsg} type="info" showIcon style={{ marginBottom: 16 }} />
          )}
          <Form name="login" onFinish={onLogin} autoComplete="off" layout="vertical">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或邮箱' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                登录
              </Button>
            </Form.Item>
          </Form>
        </>
      ),
    },
    ...(showRegister
      ? [{
          key: 'register',
          label: '注册',
          children: (
            <Form name="register" onFinish={onRegister} autoComplete="off" layout="vertical">
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '用户名至少3个字符' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
              </Form.Item>
              <Form.Item
                name="email"
                rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6个字符' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="确认密码" size="large" />
              </Form.Item>
              {registerMode === 'invite' && (
                <Form.Item name="inviteCode" rules={[{ required: true, message: '请输入邀请码' }]}>
                  <Input prefix={<KeyOutlined />} placeholder="邀请码" size="large" />
                </Form.Item>
              )}
              {registerMode === 'approval' && (
                <Alert
                  message="注册后需等待管理员审核才能登录"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                  注册
                </Button>
              </Form.Item>
            </Form>
          ),
        }]
      : []
    ),
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', ...bgStyle }}>
      {loginBg && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 0
        }} />
      )}
      <Card
        style={{
          width: 400,
          boxShadow: '0 14px 30px rgba(0,0,0,0.2)',
          borderRadius: 12,
          position: 'relative',
          zIndex: 1
        }}
        styles={{ body: { padding: '32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, marginBottom: 6, color: '#333' }}>{siteName}</h1>
          {siteSubtitle && <p style={{ color: '#888', margin: 0 }}>{siteSubtitle}</p>}
        </div>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} centered />
      </Card>
    </div>
  );
};

export default Login;
