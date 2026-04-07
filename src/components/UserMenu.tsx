import React from 'react';
import { Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined, IdcardOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChangePasswordModal from './ChangePasswordModal';

const { Text } = Typography;

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'username',
      label: (
        <Space>
          <UserOutlined />
          <span>{user?.username}</span>
        </Space>
      ),
      disabled: true,
    },
    {
      key: 'email',
      label: (
        <Text type="secondary" style={{ fontSize: 12 }}>{user?.email}</Text>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      label: '个人资料',
      icon: <IdcardOutlined />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'changePassword',
      label: '修改密码',
      icon: <SettingOutlined />,
      onClick: () => setChangePasswordOpen(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  if (!user) return null;

  return (
    <>
      <Dropdown menu={{ items: menuItems }} placement="bottomRight">
        <Space style={{ cursor: 'pointer', padding: '0 16px' }}>
          <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
          <span style={{ color: '#333' }}>{user.username}</span>
        </Space>
      </Dropdown>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
};

export default UserMenu;
