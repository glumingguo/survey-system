import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space,
  Popconfirm, message, Typography, Badge, Tooltip, Avatar,
  Tabs, Card
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, StopOutlined, UserOutlined, TeamOutlined
} from '@ant-design/icons';
import {
  getAdminUsers, updateUserStatus, updateUserGroups, deleteAdminUser,
  getGroups, createGroup, updateGroup, deleteGroup,
  type AdminUser, type UserGroup
} from '../api/site';

const { Title, Text } = Typography;
const { Option } = Select;

const statusLabels: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '正常' },
  pending: { color: 'orange', text: '待审核' },
  banned: { color: 'red', text: '已禁用' },
};

const MemberManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [groupForm] = Form.useForm();
  const [assignGroupUserId, setAssignGroupUserId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [usersData, groupsData] = await Promise.all([getAdminUsers(), getGroups()]);
      setUsers(usersData);
      setGroups(groupsData);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await updateUserStatus(userId, status);
      message.success('状态已更新');
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteAdminUser(userId);
      message.success('用户已删除');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const openAssignGroups = (user: AdminUser) => {
    setAssignGroupUserId(user.id);
    setSelectedGroupIds(user.group_ids || []);
  };

  const handleAssignGroups = async () => {
    if (!assignGroupUserId) return;
    try {
      await updateUserGroups(assignGroupUserId, selectedGroupIds);
      message.success('分组已更新');
      setAssignGroupUserId(null);
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const handleGroupSubmit = async (values: any) => {
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, values);
        message.success('分组已更新');
      } else {
        await createGroup(values);
        message.success('分组已创建');
      }
      setGroupModalOpen(false);
      groupForm.resetFields();
      setEditingGroup(null);
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteGroup(id);
      message.success('分组已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (name: string, record: AdminUser) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: record.role === 'admin' ? '#f50' : '#1890ff' }} />
          <span>{name}</span>
          {record.role === 'admin' && <Tag color="red">管理员</Tag>}
        </Space>
      )
    },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        const s = statusLabels[status] || { color: 'default', text: status };
        return <Badge color={s.color} text={s.text} />;
      }
    },
    {
      title: '分组',
      dataIndex: 'group_ids',
      render: (groupIds: string[]) => (
        <Space wrap>
          {(groupIds || []).map(gid => {
            const g = groups.find(g => g.id === gid);
            return g ? <Tag key={gid} color={g.color}>{g.name}</Tag> : null;
          })}
          {(!groupIds || groupIds.length === 0) && <Text type="secondary">无分组</Text>}
        </Space>
      )
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (t: string) => new Date(t).toLocaleDateString('zh-CN')
    },
    {
      title: '操作',
      render: (_: any, record: AdminUser) => (
        <Space>
          <Tooltip title="分配分组">
            <Button size="small" icon={<TeamOutlined />} onClick={() => openAssignGroups(record)} />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="通过审核">
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleStatusChange(record.id, 'active')} />
            </Tooltip>
          )}
          {record.status === 'active' && record.role !== 'admin' && (
            <Tooltip title="禁用账号">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => handleStatusChange(record.id, 'banned')} />
            </Tooltip>
          )}
          {record.status === 'banned' && (
            <Tooltip title="恢复账号">
              <Button size="small" icon={<CheckOutlined />} onClick={() => handleStatusChange(record.id, 'active')} />
            </Tooltip>
          )}
          {record.role !== 'admin' && (
            <Popconfirm title="确认删除此用户？" onConfirm={() => handleDeleteUser(record.id)} okText="删除" cancelText="取消" okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const groupColumns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      render: (name: string, record: UserGroup) => (
        <Tag color={record.color} style={{ fontSize: 14, padding: '4px 12px' }}>{name}</Tag>
      )
    },
    { title: '描述', dataIndex: 'description', render: (v: string) => v || '-' },
    {
      title: '操作',
      render: (_: any, record: UserGroup) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingGroup(record);
            groupForm.setFieldsValue(record);
            setGroupModalOpen(true);
          }} />
          <Popconfirm title="确认删除此分组？" onConfirm={() => handleDeleteGroup(record.id)} okText="删除" cancelText="取消" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={3}>会员管理</Title>

      <Tabs
        items={[
          {
            key: 'users',
            label: (
              <span>
                会员列表
                {pendingCount > 0 && <Badge count={pendingCount} style={{ marginLeft: 8 }} />}
              </span>
            ),
            children: (
              <Table
                dataSource={users}
                columns={userColumns}
                rowKey="id"
                loading={loadingUsers}
                pagination={{ pageSize: 20 }}
              />
            )
          },
          {
            key: 'groups',
            label: '用户分组',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingGroup(null);
                      groupForm.resetFields();
                      setGroupModalOpen(true);
                    }}
                  >
                    新建分组
                  </Button>
                </div>
                <Table
                  dataSource={groups}
                  columns={groupColumns}
                  rowKey="id"
                  pagination={false}
                />
              </div>
            )
          }
        ]}
      />

      {/* 分组编辑弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalOpen}
        onOk={() => groupForm.submit()}
        onCancel={() => { setGroupModalOpen(false); setEditingGroup(null); groupForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={groupForm} layout="vertical" onFinish={handleGroupSubmit}>
          <Form.Item label="分组名称" name="name" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="例如：VIP会员" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="分组说明（可选）" />
          </Form.Item>
          <Form.Item label="标签颜色" name="color" initialValue="#1890ff">
            <Select>
              {['#f50', '#2db7f5', '#87d068', '#108ee9', '#722ed1', '#eb2f96', '#fa8c16', '#52c41a'].map(c => (
                <Option key={c} value={c}>
                  <Tag color={c}>{c}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配分组弹窗 */}
      <Modal
        title="分配用户分组"
        open={!!assignGroupUserId}
        onOk={handleAssignGroups}
        onCancel={() => setAssignGroupUserId(null)}
        okText="保存"
        cancelText="取消"
      >
        <p>选择该用户所属的分组（可多选）：</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择分组"
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
        >
          {groups.map(g => (
            <Option key={g.id} value={g.id}>
              <Tag color={g.color}>{g.name}</Tag>
            </Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default MemberManagement;
